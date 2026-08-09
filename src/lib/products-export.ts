import { prisma } from "@/lib/prisma";

export const PRODUCT_CSV_HEADERS = [
  "slug",
  "name",
  "category",
  "brand",
  "price",
  "compare_at_price",
  "stock",
  "status",
  "description",
  "images",
];

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Export des produits d'une boutique (ou tous pour l'admin) au format CSV.
// Format compatible avec l'import (mise à jour par slug).
export async function exportProductsCsv(shopId: string | null): Promise<string> {
  const products = await prisma.product.findMany({
    where: shopId ? { shopId } : undefined,
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = products.map((p) => {
    const images = Array.isArray(p.images)
      ? (p.images as { url: string }[]).map((i) => i.url).join("|")
      : "";
    return [
      p.slug,
      p.name,
      p.category.name,
      p.brand ?? "",
      String(p.price),
      p.compareAtPrice ? String(p.compareAtPrice) : "",
      String(p.stockQty),
      p.status,
      p.description ?? "",
      images,
    ]
      .map(csvCell)
      .join(",");
  });

  return [PRODUCT_CSV_HEADERS.join(","), ...rows].join("\n");
}
