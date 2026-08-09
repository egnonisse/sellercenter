import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { getOrCreateBrand } from "@/lib/brands";

// Validation des entrées produit
export const productSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  categoryId: z.string().min(1, "Catégorie requise"),
  brand: z.string().max(100).optional().or(z.literal("")),
  sku: z.string().max(64).optional().or(z.literal("")),
  ean: z.string().max(32).optional().or(z.literal("")),
  price: z.coerce.number().positive("Prix invalide").max(100_000_000),
  compareAtPrice: z.coerce.number().positive().max(100_000_000).optional().nullable(),
  saleStartDate: z.string().optional().or(z.literal("")),
  saleEndDate: z.string().optional().or(z.literal("")),
  stockQty: z.coerce.number().int().min(0).max(1_000_000),
  images: z.array(z.string().url("URL d'image invalide")).max(8).optional(),
  attributes: z
    .object({
      color: z.string().max(50).optional(),
      size: z.string().max(50).optional(),
      warranty: z.string().max(100).optional(),
    })
    .optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

async function uniqueProductSlug(base: string): Promise<string> {
  const root = base || "produit";
  const existing = await prisma.product.findMany({
    where: { slug: { startsWith: root } },
    select: { slug: true },
  });
  if (!existing.some((p) => p.slug === root)) return root;
  return `${root}-${existing.length + 1}`;
}

// Options de catégories pour le formulaire (parents + enfants)
export async function loadCategoryOptions() {
  const cats = await prisma.category.findMany({
    where: { parentId: null },
    include: { children: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    children: c.children.map((ch) => ({ id: ch.id, name: ch.name })),
  }));
}

function toDates(d: ProductInput) {
  return {
    saleStartDate: d.saleStartDate ? new Date(d.saleStartDate) : null,
    saleEndDate: d.saleEndDate ? new Date(d.saleEndDate) : null,
  };
}

function attrsToJson(d: ProductInput) {
  const a = d.attributes;
  const has = a && (a.color || a.size || a.warranty);
  return has ? { color: a?.color || null, size: a?.size || null, warranty: a?.warranty || null } : undefined;
}

// Création : draft, rattaché à la boutique du user connecté.
export async function createProduct(shopId: string, input: ProductInput) {
  const data = productSchema.parse(input);
  const slug = await uniqueProductSlug(slugify(data.name));
  const brandId = data.brand ? await getOrCreateBrand(data.brand.trim()) : null;

  return prisma.product.create({
    data: {
      shopId,
      name: data.name.trim(),
      slug,
      description: data.description || null,
      categoryId: data.categoryId,
      brand: data.brand || null,
      brandId,
      sku: data.sku || null,
      ean: data.ean || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      ...toDates(data),
      stockQty: data.stockQty,
      images: data.images?.length ? data.images : undefined,
      attributes: attrsToJson(data),
      status: "DRAFT",
    },
  });
}

// Mise à jour : le produit doit appartenir à la boutique du user.
export async function updateProduct(shopId: string, productId: string, input: ProductInput) {
  const data = productSchema.parse(input);
  const existing = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!existing) throw new Error("PRODUIT_INTROUVABLE");
  if (existing.status === "DELETION_PENDING") throw new Error("PRODUIT_DELETION_PENDING");
  const brandId = data.brand ? await getOrCreateBrand(data.brand.trim()) : null;

  return prisma.product.update({
    where: { id: productId },
    data: {
      name: data.name.trim(),
      description: data.description || null,
      categoryId: data.categoryId,
      brand: data.brand || null,
      brandId,
      sku: data.sku || null,
      ean: data.ean || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      ...toDates(data),
      stockQty: data.stockQty,
      images: data.images?.length ? data.images : undefined,
      attributes: attrsToJson(data),
      // toute modification repasse en draft (nouveau QC si déjà actif)
      status: "DRAFT",
      syncStatus: "PENDING",
    },
  });
}

// Le vendeur soumet pour contrôle qualité.
export async function submitProduct(shopId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!product) throw new Error("PRODUIT_INTROUVABLE");
  return prisma.product.update({
    where: { id: productId },
    data: { status: "PENDING_QC", qcNote: null, qcReason: null },
  });
}

// Approbation QC par le super admin.
export async function approveProduct(productId: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { status: "ACTIVE", qcNote: null, qcReason: null, syncStatus: "PENDING" },
  });
}

// Rejet QC par le super admin (raison structurée + note libre).
export async function rejectProduct(productId: string, reason: string, note?: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { status: "REJECTED", qcReason: reason || null, qcNote: note || null },
  });
}

// Retrait (delist) par le vendeur, avec raison + commentaire.
export async function delistProduct(shopId: string, productId: string, reason?: string, comment?: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!product) throw new Error("PRODUIT_INTROUVABLE");
  return prisma.product.update({
    where: { id: productId },
    data: { status: "DELISTED", delistReason: reason || null, delistComment: comment || null, syncStatus: "PENDING" },
  });
}

// Demande de suppression (retention) : passe en DELETION_PENDING, attend la confirmation admin.
export async function requestProductDeletion(shopId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!product) throw new Error("PRODUIT_INTROUVABLE");
  return prisma.product.update({
    where: { id: productId },
    data: { status: "DELETION_PENDING", deletionRequestedAt: new Date() },
  });
}

// Confirmation admin : suppression réelle + retrait du shop public si synchronisé.
export async function confirmProductDeletion(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("PRODUIT_INTROUVABLE");
  if (product.status !== "DELETION_PENDING") throw new Error("PRODUIT_PAS_EN_RETENTION");
  // Transaction : l'historique référence le produit (FK) — suppression dans l'ordre
  await prisma.$transaction([
    prisma.productHistory.deleteMany({ where: { productId } }),
    prisma.product.delete({ where: { id: productId } }),
  ]);
  return product;
}

// Restauration admin : un produit en suppression en attente redevient brouillon.
export async function restoreProduct(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("PRODUIT_INTROUVABLE");
  return prisma.product.update({
    where: { id: productId },
    data: { status: "DRAFT", deletionRequestedAt: null },
  });
}
