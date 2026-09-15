import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import { getOrCreateBrand } from "@/lib/brands";
import { normalizeEan, isValidEan } from "@/lib/product-quality";

// Validation des entrées produit
export const productSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  categoryId: z.string().min(1, "Catégorie requise"),
  brand: z.string().max(100).optional().or(z.literal("")),
  sku: z.string().max(64).optional().or(z.literal("")),
  ean: z
    .string()
    .max(32)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isValidEan(v), "EAN/GTIN invalide (vérifier le code-barres)"),
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
      custom: z
        .array(z.object({ key: z.string().max(50), value: z.string().max(200) }))
        .max(20)
        .optional(),
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
  const custom = Array.isArray(a?.custom)
    ? a!.custom.filter((c) => c.key.trim() && c.value.trim()).map((c) => ({ key: c.key.trim(), value: c.value.trim() }))
    : [];
  const has = a && (a.color || a.size || a.warranty || custom.length > 0);
  if (!has) return undefined;
  return {
    color: a?.color || null,
    size: a?.size || null,
    warranty: a?.warranty || null,
    ...(custom.length ? { custom } : {}),
  };
}

// EAN/GTIN unique par boutique (comme le SKU). Retourne une erreur si déjà utilisé.
async function assertEanAvailable(shopId: string, ean: string | null, excludeProductId?: string) {
  const normalized = ean ? normalizeEan(ean) : "";
  if (!normalized) return;
  const dup = await prisma.product.findFirst({
    where: {
      shopId,
      ean: { not: null },
      NOT: excludeProductId ? { id: excludeProductId } : undefined,
    },
  });
  // Comparaison normalisée : on liste les EAN de la boutique et on compare via SQL LIKE n'est pas fiable
  // → vérification simple côté app pour les EAN exacts stockés normalisés au moment de la création.
  const candidates = dup
    ? await prisma.product.findMany({
        where: { shopId, ean: { not: null } },
        select: { id: true, ean: true },
      })
    : [];
  const clash = candidates.find((c) => normalizeEan(c.ean ?? "") === normalized && c.id !== excludeProductId);
  if (clash) throw new Error("PRODUIT_EAN_DUPLIQUE");
}

// Création : draft, rattaché à la boutique du user connecté.
export async function createProduct(shopId: string, input: ProductInput) {
  const data = productSchema.parse(input);
  const slug = await uniqueProductSlug(slugify(data.name));
  const brandId = data.brand ? await getOrCreateBrand(data.brand.trim()) : null;
  const ean = data.ean ? normalizeEan(data.ean) : null;
  await assertEanAvailable(shopId, ean);

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
      ean,
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
  const ean = data.ean ? normalizeEan(data.ean) : null;
  await assertEanAvailable(shopId, ean, productId);

  return prisma.product.update({
    where: { id: productId },
    data: {
      name: data.name.trim(),
      description: data.description || null,
      categoryId: data.categoryId,
      brand: data.brand || null,
      brandId,
      sku: data.sku || null,
      ean,
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

// Duplication (pattern Jumia) : copie complète en brouillon, slug/SKU adaptés.
export async function duplicateProduct(shopId: string, productId: string) {
  const source = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!source) throw new Error("PRODUIT_INTROUVABLE");

  const slug = await uniqueProductSlug(`${slugify(source.name)}-copie`);
  const baseSku = source.sku ? `${source.sku}-COPIE`.slice(0, 64) : null;
  let sku = baseSku;
  if (sku) {
    const taken = await prisma.product.findFirst({ where: { shopId, sku } });
    if (taken) sku = `${baseSku}-${Date.now().toString().slice(-4)}`.slice(0, 64);
  }

  return prisma.product.create({
    data: {
      shopId,
      name: `${source.name} (copie)`,
      slug,
      description: source.description,
      categoryId: source.categoryId,
      brand: source.brand,
      brandId: source.brandId,
      sku,
      ean: source.ean ? `${source.ean}-X`.slice(0, 32) : null, // l'EAN d'origine reste unique à la boutique
      price: source.price,
      compareAtPrice: source.compareAtPrice,
      saleStartDate: source.saleStartDate,
      saleEndDate: source.saleEndDate,
      stockQty: source.stockQty,
      images: (source.images ?? undefined) as Prisma.InputJsonValue | undefined,
      attributes: (source.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      status: "DRAFT",
    },
  });
}
