import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { syncProduct } from "../src/lib/sync";

// Vérifie qu'une boutique non validée (PENDING) ou suspendue ne peut PAS publier.
// Le garde-fou intervient AVANT tout appel WooCommerce : ce test ne touche pas la vitrine.
async function main() {
  const product = await prisma.product.findFirst({
    where: { status: "ACTIVE" },
    include: { shop: { select: { id: true, name: true, status: true } } },
  });
  if (!product) throw new Error("aucun produit ACTIVE en base pour le test");

  const shop = product.shop;
  console.log(`Produit : « ${product.name} » (statut ${product.status})`);
  console.log(`Boutique : « ${shop.name} » — statut initial ${shop.status}`);

  try {
    await prisma.shop.update({ where: { id: shop.id }, data: { status: "PENDING" } });
    const pending = await syncProduct(product.id);
    console.log(`\nBoutique PENDING  → synced=${pending.synced} | ${pending.error ?? "publié (!!)"}`);
    console.log(pending.synced === false ? "  ✅ publication bloquée" : "  ❌ FUITE : le produit est parti sur WooCommerce");

    await prisma.shop.update({ where: { id: shop.id }, data: { status: "SUSPENDED" } });
    const suspended = await syncProduct(product.id);
    console.log(`Boutique SUSPENDUE → synced=${suspended.synced} | ${suspended.error ?? "publié (!!)"}`);
    console.log(suspended.synced === false ? "  ✅ publication bloquée" : "  ❌ FUITE : le produit est parti sur WooCommerce");

    // Produit non approuvé : refusé aussi (contrôle existant, on vérifie qu'il tient toujours)
    await prisma.shop.update({ where: { id: shop.id }, data: { status: "ACTIVE" } });
    await prisma.product.update({ where: { id: product.id }, data: { status: "DRAFT" } });
    const draft = await syncProduct(product.id);
    console.log(`\nProduit DRAFT (boutique ACTIVE) → synced=${draft.synced} | ${draft.error ?? "publié (!!)"}`);
    console.log(draft.synced === false ? "  ✅ publication bloquée" : "  ❌ FUITE");
  } finally {
    // Restauration de l'état initial
    await prisma.shop.update({ where: { id: shop.id }, data: { status: shop.status } });
    await prisma.product.update({ where: { id: product.id }, data: { status: product.status } });
    console.log(`\nÉtat restauré : boutique ${shop.status}, produit ${product.status}`);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
