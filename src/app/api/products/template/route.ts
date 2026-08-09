const TEMPLATES: Record<string, { headers: string[]; example: string[] }> = {
  CREATION: {
    headers: [
      "slug", "sku", "name", "category", "brand", "price", "compare_at_price",
      "sale_start_date", "sale_end_date", "stock", "status", "ean", "description", "images",
    ],
    example: [
      "", "GLTV5", "Smart TV 43 pouces", "Accessories", "Samsung", "250000", "280000",
      "2026-08-10", "2026-08-31", "10", "DRAFT", "5901234123457",
      "Description du produit", "https://example.com/image1.jpg",
    ],
  },
  UPDATE: {
    headers: [
      "slug", "sku", "name", "category", "brand", "price", "compare_at_price",
      "sale_start_date", "sale_end_date", "stock", "ean", "description", "images",
    ],
    example: [
      "smart-tv-43-pouces-test", "GLTV5", "Smart TV 43 pouces (nouveau nom)", "Accessories",
      "Samsung", "245000", "", "", "", "8", "", "Nouvelle description", "",
    ],
  },
  STOCK: {
    headers: ["slug", "sku", "stock"],
    example: ["smart-tv-43-pouces-test", "GLTV5", "15"],
  },
  PRICE: {
    headers: ["slug", "sku", "price", "compare_at_price", "sale_start_date", "sale_end_date"],
    example: ["smart-tv-43-pouces-test", "GLTV5", "240000", "280000", "2026-08-10", "2026-08-31"],
  },
};

// Template CSV d'import par type (pattern feeds Jumia)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "CREATION").toUpperCase();
  const tpl = TEMPLATES[type] ?? TEMPLATES.CREATION;

  const csv = [tpl.headers.join(","), tpl.example.join(",")].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="template_${type.toLowerCase()}.csv"`,
    },
  });
}
