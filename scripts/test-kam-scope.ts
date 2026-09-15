import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { assignShopToKam, unassignShop, resolveShopScope, scopeFilter } from "../src/lib/shop-assignment";
import { listSettlements } from "../src/lib/settlements";
import { buildProductWhere } from "../src/lib/product-query";

// Vérifie que le cloisonnement s'applique RÉELLEMENT aux requêtes des pages.
async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  const kam = await prisma.user.findFirst({ where: { role: "KAM" }, select: { id: true, email: true } });
  if (!admin || !kam) throw new Error("admin ou KAM introuvable");

  const shops = await prisma.shop.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  console.log("Boutiques en base :", shops.map((s) => s.name).join(" | "));
  if (shops.length < 2) {
    console.log("⚠️  Une seule boutique : le test de cloisonnement reste valable mais moins parlant.");
  }
  const [shopA, shopB] = shops;

  const totalProducts = await prisma.product.count();
  const productsA = await prisma.product.count({ where: { shopId: shopA.id } });
  console.log(`\nProduits : ${totalProducts} au total, ${productsA} chez « ${shopA.name} »`);

  try {
    await assignShopToKam(shopA.id, kam.id, admin.id);

    // Ce que voit le KAM (requête de la page /products)
    const kamScope = await resolveShopScope({ id: kam.id, role: "KAM", shopId: null });
    const visible = await prisma.product.findMany({
      where: buildProductWhere(scopeFilter(kamScope), {}),
      select: { shopId: true },
    });
    const shopsVisible = new Set(visible.map((p) => p.shopId));
    console.log(`\nKAM ${kam.email} — portefeuille : ${kamScope.shopIds.length} boutique(s)`);
    console.log(`  Produits visibles : ${visible.length} (attendu : ${productsA})`);
    console.log(visible.length === productsA ? "  ✅ aucun produit hors périmètre" : "  ❌ fuite de données");
    console.log(
      shopsVisible.size <= 1
        ? "  ✅ une seule boutique visible"
        : `  ❌ ${shopsVisible.size} boutiques visibles`,
    );

    // Relevés financiers (page /finances)
    const settlements = await listSettlements(scopeFilter(kamScope).shopId?.in ?? []);
    const badSettlement = settlements.find((s) => s.shopId !== shopA.id);
    console.log(`\nRelevés visibles : ${settlements.length}`);
    console.log(badSettlement ? "  ❌ relevé hors périmètre" : "  ✅ uniquement son périmètre");

    // Comparaison : l'admin voit tout
    const adminScope = await resolveShopScope({ id: admin.id, role: "SUPER_ADMIN", shopId: null });
    const adminProducts = await prisma.product.count({ where: buildProductWhere(scopeFilter(adminScope), {}) });
    console.log(`\nAdmin — produits visibles : ${adminProducts} (total ${totalProducts})`);
    console.log(adminProducts === totalProducts ? "  ✅ accès global confirmé" : "  ❌ l'admin est bridé");

    if (shopB) {
      const outside = await prisma.product.count({ where: { shopId: shopB.id } });
      console.log(`\nBoutique hors portefeuille « ${shopB.name} » : ${outside} produit(s)`);
      console.log(
        shopsVisible.has(shopB.id) ? "  ❌ visible par le KAM" : "  ✅ invisible pour le KAM",
      );
    }
  } finally {
    await unassignShop(shopA.id, admin.id);
    await prisma.shopAssignment.deleteMany({ where: { kamUserId: kam.id } });
    console.log("\nNettoyage : portefeuille du KAM réinitialisé");
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌", e.message?.slice(0, 300));
  process.exit(1);
});
