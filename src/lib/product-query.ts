// Construction des requêtes liste produits (filtres, tri, pagination).
// Pattern Jumia : recherche par nom/SKU/EAN, filtres multiples, colonnes triables.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type ProductListParams = {
  status?: string;
  q?: string;
  categoryId?: string;
  brand?: string;
  priceMin?: string;
  priceMax?: string;
  stockMax?: string;
  hasImage?: string;
  sort?: string;
  dir?: string;
  page?: string;
  perPage?: string;
};

export type ProductOrder = { [key: string]: "asc" | "desc" };

// Colonnes triables (whitelist — jamais de clé arbitraire dans orderBy)
const SORTABLE: Record<string, string> = {
  name: "name",
  price: "price",
  stockQty: "stockQty",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

export function buildProductOrderBy(params: ProductListParams): ProductOrder {
  const field = SORTABLE[params.sort ?? ""] ?? "createdAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  return { [field]: dir } as ProductOrder;
}

// Étend une catégorie parente à ses enfants (pattern filtre arborescence Jumia).
export async function expandCategoryIds(categoryId?: string): Promise<string[] | undefined> {
  if (!categoryId) return undefined;
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { children: { select: { id: true } } },
  });
  if (!cat) return undefined;
  return [cat.id, ...cat.children.map((c) => c.id)];
}

// `scopeWhere` = filtre imposé par le périmètre de l'utilisateur (boutique, portefeuille KAM
// ou aucun filtre pour un admin) — il est fusionné avant les filtres de l'interface.
export function buildProductWhere(
  scopeWhere: Prisma.ProductWhereInput,
  params: ProductListParams,
  categoryIds?: string[],
): Prisma.ProductWhereInput {
  const q = params.q?.trim();
  const where: Prisma.ProductWhereInput = {
    ...scopeWhere,
    ...(params.status ? { status: params.status as Prisma.ProductWhereInput["status"] } : {}),
    ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
    ...(params.brand?.trim()
      ? { brand: { contains: params.brand.trim(), mode: "insensitive" as const } }
      : {}),
    ...(params.priceMin ? { price: { gte: Number(params.priceMin) } } : {}),
    ...(params.priceMax ? { price: { lte: Number(params.priceMax) } } : {}),
    ...(params.stockMax ? { stockQty: { lte: Number(params.stockMax) } } : {}),
    ...(params.hasImage === "yes"
      ? { images: { not: Prisma.DbNull } }
      : params.hasImage === "no"
        ? { images: { equals: Prisma.DbNull } }
        : {}),
  };

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" as const } },
      { sku: { contains: q, mode: "insensitive" as const } },
      { ean: { contains: q, mode: "insensitive" as const } },
      { brand: { contains: q, mode: "insensitive" as const } },
    ];
  }

  return where;
}

export type PageInfo = { page: number; perPage: number; skip: number; take: number; total: number };

export function parsePagination(params: ProductListParams, total: number): PageInfo {
  const perPageRaw = Number(params.perPage);
  const perPage = PAGE_SIZES.includes(perPageRaw as (typeof PAGE_SIZES)[number])
    ? perPageRaw
    : DEFAULT_PAGE_SIZE;
  const maxPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(params.page) || 1), maxPage);
  return { page, perPage, skip: (page - 1) * perPage, take: perPage, total };
}
