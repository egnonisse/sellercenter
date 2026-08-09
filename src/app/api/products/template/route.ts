import { PRODUCT_CSV_HEADERS } from "@/lib/products-export";

// Template CSV d'import (en-têtes + une ligne d'exemple)
export async function GET() {
  const example = [
    "",
    "Smart TV 43 pouces",
    "Téléviseurs",
    "Samsung",
    "250000",
    "280000",
    "10",
    "",
    "Description du produit",
    "https://example.com/image.jpg",
  ];
  const csv = [PRODUCT_CSV_HEADERS.join(","), example.join(",")].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="template-produits.csv"',
    },
  });
}
