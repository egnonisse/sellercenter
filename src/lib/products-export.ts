import { prisma } from "@/lib/prisma";

export const PRODUCT_CSV_HEADERS = [
  "slug",
  "sku",
  "name",
  "category",
  "brand",
  "price",
  "compare_at_price",
  "sale_start_date",
  "sale_end_date",
  "stock",
  "status",
  "ean",
  "description",
  "images",
];

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function exportProductsCsv(shopId: string | null) {
  const products = await prisma.product.findMany({
    where: shopId ? { shopId } : undefined,
    include: { category: true, shop: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = products.map((p) => [
    p.slug,
    p.sku ?? "",
    p.name,
    p.category.name,
    p.brand ?? "",
    Number(p.price),
    p.compareAtPrice ? Number(p.compareAtPrice) : "",
    fmtDate(p.saleStartDate),
    fmtDate(p.saleEndDate),
    p.stockQty,
    p.status,
    p.ean ?? "",
    p.description ?? "",
    (p.images as { url: string }[] | null ?? []).map((i) => i.url).join("|"),
  ]);

  return [PRODUCT_CSV_HEADERS, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}
