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
  sku: string | null;
  ean: string | null;
  price: { toString(): string };
  compareAtPrice: { toString(): string } | null;
  saleStartDate: Date | null;
  saleEndDate: Date | null;
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
    sku: product.sku ?? "",
    regular_price: hasCompare ? String(product.compareAtPrice) : String(product.price),
    sale_price: hasCompare ? String(product.price) : "",
    ...(hasCompare && product.saleStartDate
      ? { date_on_sale_from: product.saleStartDate.toISOString().slice(0, 10) }
      : {}),
    ...(hasCompare && product.saleEndDate
      ? { date_on_sale_to: product.saleEndDate.toISOString().slice(0, 10) }
      : {}),
    manage_stock: true,
    stock_quantity: product.stockQty,
    images: Array.isArray(product.images)
      ? (product.images as { url: string }[]).map((i) => ({ src: i.url }))
      : [],
    meta_data: [
      { key: "_zariamall_shop_id", value: product.shopId },
      ...(product.ean ? [{ key: "_zariamall_ean", value: product.ean }] : []),
    ],
  };
}

// Synchronise UN produit vers WooCommerce.
// Retourne { synced: boolean, wooId?: number, error?: string }
export async function syncProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true, shop: { select: { status: true } } },
  });
  if (!product) return { synced: false, error: "Produit introuvable" };
  // Seuls les produits actifs ou retirés partent en sync (draft/QC restent en interne)
  if (product.status !== "ACTIVE" && product.status !== "DELISTED") {
    return { synced: false, error: "Statut non synchronisable" };
  }
  // RIEN n'est publié tant que la boutique n'est pas validée (ni si elle est suspendue) :
  // le vendeur peut préparer son catalogue, la vitrine reste fermée pour lui.
  if (product.shop.status !== "ACTIVE") {
    return {
      synced: false,
      error:
        product.shop.status === "PENDING"
          ? "Boutique en attente de validation : publication impossible"
          : "Boutique suspendue : publication impossible",
    };
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
        syncError: null,
        lastSyncedAt: new Date(),
      },
    });
    return { synced: true, wooId };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Erreur inconnue";
    await prisma.product.update({
      where: { id: product.id },
      data: { syncStatus: "ERROR", syncError: message },
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
