import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  buildProductWhere,
  buildProductOrderBy,
  expandCategoryIds,
  parsePagination,
} from "../src/lib/product-query";

async function main() {
  // 1. Pagination pure
  const p = parsePagination({ page: "2", perPage: "25" }, 120);
  console.log("pagination:", JSON.stringify(p));
  if (p.skip !== 25 || p.take !== 25 || p.page !== 2) throw new Error("pagination KO");

  // 2. Recherche multi-champs (nom/SKU/EAN/marque) sur le shop du vendeur test
  const shop = await prisma.shop.findFirst({ where: { slug: { not: undefined } } });
  const shopId = shop?.id ?? (await prisma.shop.findFirst())!.id;
  console.log("shop test:", shop?.slug ?? shopId);

  const whereQ = buildProductWhere(shopId, { q: "tele" });
  const hits = await prisma.product.count({ where: whereQ });
  console.log("recherche 'tele':", hits, "produits");

  // 3. Filtre catégorie étendue aux enfants
  const parent = await prisma.category.findFirst({ where: { parentId: null } });
  if (parent) {
    const ids = await expandCategoryIds(parent.id);
    console.log("catégorie parente:", parent.name, "→", ids?.length, "ids");
  }

  // 4. Tri par prix asc
  const order = buildProductOrderBy({ sort: "price", dir: "asc" });
  const first = await prisma.product.findFirst({ where: { shopId }, orderBy: order });
  console.log("tri prix asc — 1er:", first?.name, Number(first?.price ?? 0));

  // 5. Filtre stock bas + images
  const whereStock = buildProductWhere(shopId, { stockMax: "5" });
  const lowStock = await prisma.product.count({ where: whereStock });
  console.log("produits stock ≤ 5:", lowStock);

  // 6. Badge erreurs de sync (champ syncError)
  const withError = await prisma.product.count({ where: { syncStatus: "ERROR" } });
  console.log("produits en erreur sync:", withError);

  // 7. Stats rejets groupées (pattern de la page)
  const rejections = await prisma.product.groupBy({
    by: ["qcReason"],
    where: { shopId, status: "REJECTED", qcReason: { not: null } },
    _count: true,
    orderBy: { _count: { qcReason: "desc" } },
    take: 5,
  });
  console.log("top raisons rejet:", JSON.stringify(rejections.slice(0, 3)));

  await prisma.$disconnect();
  console.log("\n✅ Toutes les requêtes passent");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
