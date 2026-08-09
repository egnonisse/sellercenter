import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import type { OrderStatus } from "@/generated/prisma/enums";

// Payload WooCommerce (order.created / order.updated)
export type WooOrderPayload = {
  id: number;
  status: string;
  total?: string;
  payment_method?: string;
  billing?: { first_name?: string; last_name?: string; phone?: string; address_1?: string; city?: string };
  line_items?: {
    product_id?: number;
    name?: string;
    quantity?: number;
    total?: string;
  }[];
};

const WC_STATUS_MAP: Record<string, OrderStatus> = {
  pending: "PENDING",
  "on-hold": "PENDING",
  processing: "READY_TO_SHIP",
  completed: "DELIVERED",
  cancelled: "CANCELLED",
  refunded: "CANCELLED",
  failed: "CANCELLED",
};

function toDecimal(value?: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Traite une commande WooCommerce : une Order par boutique impliquée.
export async function processWooOrder(payload: WooOrderPayload) {
  const wooId = payload.id;
  const status: OrderStatus = WC_STATUS_MAP[payload.status] ?? "PENDING";

  // 1. Grouper les items par boutique (via le produit mappé)
  const groups = new Map<string, NonNullable<WooOrderPayload["line_items"]>>();
  for (const item of payload.line_items ?? []) {
    if (!item.product_id) continue;
    const product = await prisma.product.findUnique({ where: { wooId: item.product_id } });
    if (!product) continue; // produit non géré par le SellerCenter → ignoré
    const list = groups.get(product.shopId) ?? [];
    list.push(item);
    groups.set(product.shopId, list);
  }

  // 2. Pour chaque boutique : upsert commande + items
  let orders = 0;
  for (const [shopId, items] of groups) {
    const itemsTotal = items.reduce((sum, i) => sum + toDecimal(i.total), 0);
    const billing = payload.billing ?? {};
    const customerName = `${billing.first_name ?? ""} ${billing.last_name ?? ""}`.trim() || "Client";

    const existing = await prisma.order.findFirst({ where: { wooId, shopId } });

    const data = {
      wooId,
      shopId,
      customerName,
      phone: billing.phone ?? "",
      address: [billing.address_1, billing.city].filter(Boolean).join(", ") || null,
      itemsTotal,
      shippingFee: 0,
      total: toDecimal(payload.total),
      status,
      paymentMethod: payload.payment_method ?? null,
    };

    const order = existing
      ? await prisma.order.update({ where: { id: existing.id }, data })
      : await prisma.order.create({ data });

    // Notification : nouvelle commande pour la boutique
    if (!existing) {
      await createNotification({
        shopId,
        type: "ORDER_RECEIVED",
        title: `Nouvelle commande #${wooId}`,
        message: `${customerName} — ${Number(toDecimal(payload.total)).toLocaleString("fr-FR")} FCFA (${items.length} article(s))`,
      });
    }

    // Items : recréation simple (idempotent)
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    for (const item of items) {
      const product = await prisma.product.findFirst({ where: { wooId: item.product_id } });
      if (!product) continue;
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          name: item.name ?? product.name,
          qty: item.quantity ?? 1,
          unitPrice: toDecimal(item.total) / (item.quantity ?? 1),
          total: toDecimal(item.total),
        },
      });
    }

    // Historique : uniquement si le statut change
    if (existing && existing.status !== status) {
      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, from: existing.status, to: status },
      });
    }

    orders += 1;
  }

  return { orders };
}
