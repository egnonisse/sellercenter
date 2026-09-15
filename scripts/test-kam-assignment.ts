import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  assignShopToKam,
  unassignShop,
  resolveShopScope,
  getShopKam,
  listShopAssignmentHistory,
} from "../src/lib/shop-assignment";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true, email: true } });
  const kam = await prisma.user.findFirst({ where: { role: "KAM" }, select: { id: true, email: true } });
  const shop = await prisma.shop.findFirst({ select: { id: true, name: true } });
  const vendor = await prisma.user.findFirst({ where: { role: "SHOP_ADMIN" }, select: { id: true, email: true, shopId: true } });
  if (!admin || !kam || !shop || !vendor) throw new Error("données de test insuffisantes (admin/KAM/boutique/vendeur)");

  console.log(`Admin: ${admin.email} | KAM: ${kam.email} | Boutique: ${shop.name}\n`);

  // 1. Un KAM sans affectation ne voit RIEN (cloisonnement strict)
  let scope = await resolveShopScope({ id: kam.id, role: "KAM", shopId: null });
  console.log(`1. KAM sans portefeuille → isGlobal=${scope.isGlobal} | ${scope.shopIds.length} boutique(s)`);
  console.log(scope.shopIds.length === 0 ? "   ✅ cloisonnement : il ne voit rien" : "   ❌ il voit des boutiques");

  // 2. Le SUPER_ADMIN voit tout
  scope = await resolveShopScope({ id: admin.id, role: "SUPER_ADMIN", shopId: null });
  console.log(`\n2. SUPER_ADMIN → isGlobal=${scope.isGlobal}`);
  console.log(scope.isGlobal ? "   ✅ accès global" : "   ❌ pas global");

  // 3. Le vendeur ne voit que sa boutique
  scope = await resolveShopScope({ id: vendor.id, role: "SHOP_ADMIN", shopId: vendor.shopId });
  console.log(`\n3. Vendeur → ${scope.shopIds.length} boutique(s)`);
  console.log(scope.shopIds.length === 1 && scope.shopIds[0] === vendor.shopId ? "   ✅ sa boutique uniquement" : "   ❌ périmètre incorrect");

  // 4. Affectation
  const res = await assignShopToKam(shop.id, kam.id, admin.id);
  console.log(`\n4. Affectation « ${res.shop} » → ${res.kam} (remplacement: ${res.replaced})`);
  const current = await getShopKam(shop.id);
  console.log(current?.id === kam.id ? "   ✅ KAM en poste" : "   ❌ affectation non prise en compte");

  // 5. Le KAM voit maintenant la boutique
  scope = await resolveShopScope({ id: kam.id, role: "KAM", shopId: null });
  console.log(`\n5. Périmètre du KAM → ${scope.shopIds.length} boutique(s)`);
  console.log(scope.shopIds.includes(shop.id) ? "   ✅ il voit sa boutique" : "   ❌ boutique absente du périmètre");

  // 6. Réaffectation à un autre KAM : l'ancien mandat est clôturé, l'historique conservé
  const kam2 = await prisma.user.create({
    data: { email: `kam2-${Date.now()}@example.ci`, passwordHash: "x", role: "KAM", status: "ACTIVE" },
  });
  await assignShopToKam(shop.id, kam2.id, admin.id);
  const history = await listShopAssignmentHistory(shop.id);
  const active = history.filter((h) => h.unassignedAt === null);
  console.log(`\n6. Réaffectation → historique: ${history.length} mandat(s), ${active.length} actif(s)`);
  console.log(history.length === 2 && active.length === 1 && active[0].kamUserId === kam2.id
    ? "   ✅ un seul actif, l'ancien mandat est conservé"
    : "   ❌ incohérence d'historique");

  // 7. Garde-fous
  try {
    await assignShopToKam(shop.id, vendor.id, admin.id);
    console.log("\n7. ❌ un non-KAM a pu être affecté");
  } catch (e) {
    console.log(`\n7. ✅ affectation à un non-KAM refusée (${(e as Error).message})`);
  }
  try {
    await assignShopToKam(shop.id, kam2.id, admin.id);
    console.log("   ❌ double affectation acceptée");
  } catch (e) {
    console.log(`   ✅ doublon refusé (${(e as Error).message})`);
  }

  // Nettoyage : on retire les affectations de test et le KAM créé
  await unassignShop(shop.id, admin.id);
  await prisma.shopAssignment.deleteMany({ where: { kamUserId: { in: [kam.id, kam2.id] } } });
  await prisma.user.delete({ where: { id: kam2.id } });
  const after = await getShopKam(shop.id);
  console.log(`\nNettoyage : KAM en poste = ${after ? after.email : "aucun (état initial restauré)"}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e.message?.slice(0, 300));
  process.exit(1);
});
