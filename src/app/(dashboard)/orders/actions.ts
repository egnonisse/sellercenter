"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { canAccessShop, resolveShopScope } from "@/lib/shop-assignment";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/generated/prisma/enums";

// Transitions autorisées pour un vendeur (les gestionnaires globaux peuvent tout faire)
const SELLER_TRANSITIONS: Record<string, string[]> = {
  READY_TO_SHIP: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  PENDING: ["CANCELLED"],
};

export async function updateOrderStatusAction(orderId: string, newStatus: string) {
  const user = await requirePermission("orders.manage");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Commande introuvable." };

  // Cloisonnement : le périmètre remplace l'ancien test « global »
  const scope = await resolveShopScope({ id: user.id, role: user.role, shopId: user.shopId });
  if (!canAccessShop(scope, order.shopId)) return { error: "Accès refusé." };

  // Le workflow de transition s'applique aux vendeurs ; un superviseur (KAM/admin) a la main
  const isVendor = user.role === "SHOP_ADMIN" || user.role === "SHOP_MANAGER";
  if (isVendor) {
    const allowed = SELLER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return { error: `Transition ${order.status} → ${newStatus} non autorisée.` };
    }
  }

  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: newStatus as OrderStatus } }),
    prisma.orderStatusHistory.create({
      data: {
        orderId,
        from: order.status,
        to: newStatus,
        actorUserId: user.id,
      },
    }),
  ]);

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return {};
}
