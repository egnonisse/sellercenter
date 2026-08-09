import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

// Validation des entrées produit
export const productSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  categoryId: z.string().min(1, "Catégorie requise"),
  brand: z.string().max(100).optional().or(z.literal("")),
  price: z.coerce.number().positive("Prix invalide").max(100_000_000),
  compareAtPrice: z.coerce.number().positive().max(100_000_000).optional().nullable(),
  stockQty: z.coerce.number().int().min(0).max(1_000_000),
  images: z.array(z.string().url("URL d'image invalide")).max(8).optional(),
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

// Création : draft, rattaché à la boutique du user connecté.
export async function createProduct(shopId: string, input: ProductInput) {
  const data = productSchema.parse(input);
  const slug = await uniqueProductSlug(slugify(data.name));

  return prisma.product.create({
    data: {
      shopId,
      name: data.name.trim(),
      slug,
      description: data.description || null,
      categoryId: data.categoryId,
      brand: data.brand || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      stockQty: data.stockQty,
      images: data.images?.length ? data.images : undefined,
      status: "DRAFT",
    },
  });
}

// Mise à jour : le produit doit appartenir à la boutique du user.
export async function updateProduct(shopId: string, productId: string, input: ProductInput) {
  const data = productSchema.parse(input);
  const existing = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!existing) throw new Error("PRODUIT_INTROUVABLE");

  return prisma.product.update({
    where: { id: productId },
    data: {
      name: data.name.trim(),
      description: data.description || null,
      categoryId: data.categoryId,
      brand: data.brand || null,
      price: data.price,
      compareAtPrice: data.compareAtPrice ?? null,
      stockQty: data.stockQty,
      images: data.images?.length ? data.images : undefined,
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
    data: { status: "PENDING_QC", qcNote: null },
  });
}

// Approbation QC par le super admin.
export async function approveProduct(productId: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { status: "ACTIVE", qcNote: null, syncStatus: "PENDING" },
  });
}

// Rejet QC par le super admin.
export async function rejectProduct(productId: string, note: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { status: "REJECTED", qcNote: note || null },
  });
}

// Suppression logique (delist) par le vendeur.
export async function delistProduct(shopId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!product) throw new Error("PRODUIT_INTROUVABLE");
  return prisma.product.update({
    where: { id: productId },
    data: { status: "DELISTED", syncStatus: "PENDING" },
  });
}
