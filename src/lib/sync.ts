import { prisma } from "@/lib/prisma";
import {
  wooCreateProduct,
  wooUpdateProduct,
  wooGetProductBySlug,
} from "@/lib/woocommerce";

// Mapping produit SellerCenter → payload WooCommerce
// price = prix actuel, compareAtPrice = ancien prix (affiché barré)
// WooCommerce : regular_price = prix normal, sale_price = prix en promo
function toWooPayload(product: {
  name: string;
  description: string | null;
  price: { toString(): string };
  compareAtPrice: { toString(): string } | null;
  stockQty: number;
  status: string;
  images: unknown;
  shopId: string;
}): Record<string, unknown> {
  const hasCompare = product.compareAtPrice !== null;
  return {
    type: "simple",
    status: product.status === "DELISTED" ? "private" : "publish",
    name: product.name,
    description: product.description ?? "",
    regular_price: hasCompare ? String(product.compareAtPrice) : String(product.price),
    sale_price: hasCompare ? String(product.price) : "",
    manage_stock: true,
    stock_quantity: product.stockQty,
    images: Array.isArray(product.images)
      ? (product.images as { url: string }[]).map((i) => ({ src: i.url }))
      : [],
    meta_data: [{ key: "_zariamall_shop_id", value: product.shopId }],
  };
}

// Synchronise UN produit vers WooCommerce.
// Retourne { synced: boolean, wooId?: number, error?: string }
export async function syncProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });
  if (!product) return { synced: false, error: "Produit introuvable" };
  // Seuls les produits actifs ou retirés partent en sync (draft/QC restent en interne)
  if (product.status !== "ACTIVE" && product.status !== "DELISTED") {
    return { synced: false, error: "Statut non synchronisable" };
  }

  const payload = toWooPayload(product);
  if (product.category.wooId) {
    payload.categories = [{ id: product.category.wooId }];
  } else {
    console.warn(`syncProduct: catégorie ${product.category.name} sans wooId (produit ${product.name})`);
  }

  try {
    let wooId = product.wooId;
    if (wooId === null) {
      // Slug déjà présent sur WooCommerce ? réutiliser l'id au lieu de dupliquer
      const bySlug = await wooGetProductBySlug(product.slug);
      if (bySlug) {
        wooId = bySlug.id;
        await wooUpdateProduct(wooId, payload);
      } else {
        const created = await wooCreateProduct(payload);
        wooId = created.id;
      }
    } else {
      await wooUpdateProduct(wooId, payload);
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        wooId,
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
      },
    });
    return { synced: true, wooId };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Erreur inconnue";
    await prisma.product.update({
      where: { id: product.id },
      data: { syncStatus: "ERROR" },
    });
    console.error(`syncProduct(${product.id}):`, message);
    return { synced: false, error: message };
  }
}

// Synchronise tous les produits en attente (PENDING ou ERROR).
export async function syncPendingProducts() {
  const pending = await prisma.product.findMany({
    where: {
      syncStatus: { in: ["PENDING", "ERROR"] },
      status: { in: ["ACTIVE", "DELISTED"] },
    },
    select: { id: true },
    take: 50,
  });

  const results = [];
  for (const p of pending) {
    results.push({ id: p.id, ...(await syncProduct(p.id)) });
  }

  const ok = results.filter((r) => r.synced).length;
  return { total: pending.length, synced: ok, failed: results.length - ok, results };
}
