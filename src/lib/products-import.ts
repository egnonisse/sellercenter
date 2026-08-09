import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct } from "@/lib/products";

export type ImportType = "CREATION" | "UPDATE" | "STOCK" | "PRICE";

export type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors: { line: number; error: string }[];
};

async function findProduct(shopId: string, slug?: string, sku?: string) {
  if (slug) {
    const p = await prisma.product.findFirst({ where: { shopId, slug } });
    if (p) return p;
  }
  if (sku) {
    const p = await prisma.product.findFirst({ where: { shopId, sku } });
    if (p) return p;
  }
  return null;
}

async function findCategory(raw?: string) {
  if (!raw) return null;
  const byName = await prisma.category.findFirst({ where: { name: raw.trim() } });
  if (byName) return byName;
  return prisma.category.findFirst({ where: { slug: raw.trim().toLowerCase() } });
}

async function importRow(
  shopId: string,
  row: Record<string, string>,
  type: ImportType,
  result: ImportResult,
) {
  if (type === "STOCK") {
    const product = await findProduct(shopId, row.slug, row.sku);
    if (!product) throw new Error("Produit introuvable (slug ou sku)");
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQty: Number(row.stock ?? "0"), syncStatus: "PENDING" },
    });
    result.updated++;
    return;
  }

  if (type === "PRICE") {
    const product = await findProduct(shopId, row.slug, row.sku);
    if (!product) throw new Error("Produit introuvable (slug ou sku)");
    await prisma.product.update({
      where: { id: product.id },
      data: {
        price: Number(row.price ?? "0"),
        compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : null,
        saleStartDate: row.sale_start_date ? new Date(row.sale_start_date) : null,
        saleEndDate: row.sale_end_date ? new Date(row.sale_end_date) : null,
        syncStatus: "PENDING",
        status: "DRAFT",
      },
    });
    result.updated++;
    return;
  }

  // CREATION / UPDATE : champs complets
  const name = (row.name ?? "").trim();
  if (!name) throw new Error("Nom requis");
  const category = await findCategory(row.category);
  if (!category) throw new Error(`Catégorie introuvable: ${row.category}`);

  const input = {
    name,
    description: row.description ?? "",
    categoryId: category.id,
    brand: row.brand ?? "",
    sku: row.sku ?? "",
    ean: row.ean ?? "",
    price: Number(row.price ?? ""),
    compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : null,
    saleStartDate: row.sale_start_date ?? "",
    saleEndDate: row.sale_end_date ?? "",
    stockQty: Number(row.stock ?? "0"),
    images: (row.images ?? "").split("|").map((s) => s.trim()).filter(Boolean),
  };

  const existing = await findProduct(shopId, row.slug, row.sku);
  if (existing) {
    if (type === "CREATION") throw new Error("Produit déjà existant (utiliser le type Mise à jour)");
    await updateProduct(shopId, existing.id, input);
    result.updated++;
  } else {
    await createProduct(shopId, input);
    result.created++;
  }
};

// Import CSV par type (pattern feeds Jumia) + historique
export async function importProductsCsv(
  shopId: string,
  csv: string,
  type: ImportType = "CREATION",
  fileName = "import.csv",
): Promise<ImportResult> {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const result: ImportResult = { created: 0, updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < parsed.data.length; i++) {
    try {
      await importRow(shopId, parsed.data[i], type, result);
    } catch (e) {
      result.failed++;
      result.errors.push({
        line: i + 2,
        error: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }

  await prisma.importHistory.create({
    data: {
      shopId,
      type,
      fileName,
      created: result.created,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors.length ? result.errors : undefined,
    },
  });

  return result;
}

// Historique des imports récents d'une boutique
export async function listImportHistory(shopId: string, take = 10) {
  return prisma.importHistory.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
