import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { assignShopToKam, unassignShop, resolveShopScope, scopeFilter } from "../src/lib/shop-assignment";
import { buildProductWhere } from "../src/lib/product-query";

// Preuve du cloisonnement avec DEUX boutiques : le KAM ne doit voir que la sienne.
// La seconde boutique est créée pour le test puis supprimée.
async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  const kam = await prisma.user.findFirst({ where: { role: "KAM" }, select: { id: true, email: true } });
  const shopA = await prisma.shop.findFirst({ select: { id: true, name: true } });
  if (!admin || !kam || !shopA) throw new Error("données de test insuffisantes");

  // Boutique B : hors portefeuille, créée uniquement pour la démonstration
  const marker = Date.now();
  const sellerB = await prisma.seller.create({
    data: { name: `Vendeur Test ${marker}`, email: `seller-${marker}@example.ci`, phone: "+22500000000" },
  });
  const shopB = await prisma.shop.create({
    data: { sellerId: sellerB.id, name: `Boutique Hors Périmètre ${marker}`, slug: `hors-perimetre-${marker}`, status: "ACTIVE" },
  });
  await prisma.product.create({
    data: {
      shopId: shopB.id,
      name: "Produit Confidentiel",
      slug: `produit-confidentiel-${marker}`,
      price: 9999,
      stockQty: 5,
      status: "ACTIVE",
      categoryId: (await prisma.category.findFirst({ select: { id: true } }))!.id,
    },
  });
  console.log(`Boutique A (à attribuer) : « ${shopA.name} »`);
  console.log(`Boutique B (hors périmètre) : « ${shopB.name} » + 1 produit\n`);

  try {
    await assignShopToKam(shopA.id, kam.id, admin.id);
    const scope = await resolveShopScope({ id: kam.id, role: "KAM", shopId: null });
    const visible = await prisma.product.findMany({
      where: buildProductWhere(scopeFilter(scope), {}),
      select: { name: true, shopId: true },
    });

    console.log(`Portefeuille du KAM : ${scope.shopIds.length} boutique(s)`);
    console.log(`Produits visibles : ${visible.length} → ${visible.map((p) => p.name).join(", ") || "aucun"}`);
    const leak = visible.some((p) => p.shopId === shopB.id);
    console.log(leak ? "  ❌ FUITE : le produit hors périmètre est visible" : "  ✅ le produit hors périmètre est INVISIBLE");
    console.log(
      visible.every((p) => p.shopId === shopA.id)
        ? "  ✅ tous les produits visibles appartiennent à sa boutique"
        : "  ❌ produits hors périmètre",
    );

    // Accès direct à la boutique B (comme un utilisateur qui forcerait l'URL)
    const { canAccessShop } = await import("../src/lib/shop-assignment");
    console.log(
      canAccessShop(scope, shopB.id)
        ? "  ❌ accès direct à la boutique B autorisé"
        : "  ✅ accès direct à la boutique B refusé",
    );
  } finally {
    // Nettoyage complet
    await prisma.product.deleteMany({ where: { shopId: shopB.id } });
    await unassignShop(shopA.id, admin.id);
    await prisma.shopAssignment.deleteMany({ where: { kamUserId: kam.id } });
    await prisma.shop.delete({ where: { id: shopB.id } });
    await prisma.seller.delete({ where: { id: sellerB.id } });
    console.log("\nNettoyage : boutique de test supprimée, portefeuille réinitialisé");
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌", e.message?.slice(0, 300));
  process.exit(1);
});
