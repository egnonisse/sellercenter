import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { wooListAllCategories } from "../src/lib/woocommerce";

async function main() {
  const wooCats = await wooListAllCategories();
  const local = await prisma.category.findMany();

  const localByWoo = new Map(local.filter((c) => c.wooId).map((c) => [c.wooId!, c]));
  const localBySlug = new Map(local.map((c) => [c.slug, c]));

  let toCreate = 0;
  let toUpdate = 0;
  let toLink = 0;
  let parentMissing = 0;
  for (const wc of wooCats) {
    const existing = localByWoo.get(wc.id);
    if (existing) {
      toUpdate++;
    } else if (localBySlug.has(wc.slug)) {
      toLink++;
    } else {
      toCreate++;
    }
    if (wc.parent && !localByWoo.has(wc.parent) && !localBySlug.has(String(wc.parent))) {
      parentMissing++;
    }
  }

  console.log("Catégories WooCommerce:", wooCats.length);
  console.log("Catégories locales (SellerCenter):", local.length);
  console.log(`→ à mettre à jour: ${toUpdate} · à lier par slug: ${toLink} · à créer: ${toCreate}`);
  console.log("Parents WC non résolus (à surveiller):", parentMissing);

  const wooIdsLocal = new Set(local.filter((c) => c.wooId !== null).map((c) => c.wooId!));
  const wooIdsRemote = new Set(wooCats.map((c) => c.id));
  const orphans = [...wooIdsLocal].filter((id) => !wooIdsRemote.has(id));
  console.log("Catégories locales liées à un wooId absent de WC (aucune suppression prévue):", orphans.length, orphans.slice(0, 5));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
