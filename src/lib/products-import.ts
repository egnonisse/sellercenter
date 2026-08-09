import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct } from "@/lib/products";

export type ImportResult = {
  created: number;
  updated: number;
  errors: { line: number; error: string }[];
};

// Import CSV : création (slug absent ou nouveau) ou mise à jour (slug existant de la boutique).
// Format identique à l'export (voir src/lib/products-export.ts).
export async function importProductsCsv(shopId: string, csv: string): Promise<ImportResult> {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const result: ImportResult = { created: 0, updated: 0, errors: [] };

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const line = i + 2; // +1 header, +1 index
    try {
      const name = row.name?.trim();
      if (!name) throw new Error("Nom manquant");
      if (!row.category) throw new Error("Catégorie manquante");

      const category = await prisma.category.findFirst({
        where: { OR: [{ name: row.category }, { slug: row.category }] },
      });
      if (!category) throw new Error(`Catégorie introuvable: ${row.category}`);

      const input = {
        name,
        description: row.description ?? "",
        categoryId: category.id,
        brand: row.brand ?? "",
        price: Number(row.price ?? ""),
        compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : null,
        stockQty: Number(row.stock ?? "0"),
        images: (row.images ?? "").split("|").map((s) => s.trim()).filter(Boolean),
      };

      const existing = row.slug
        ? await prisma.product.findFirst({ where: { shopId, slug: row.slug.trim() } })
        : null;

      if (existing) {
        await updateProduct(shopId, existing.id, input);
        result.updated += 1;
      } else {
        await createProduct(shopId, input);
        result.created += 1;
      }
    } catch (e) {
      result.errors.push({ line, error: e instanceof Error ? e.message : "Erreur inconnue" });
    }
  }

  return result;
}
