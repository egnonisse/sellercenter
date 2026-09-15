import "dotenv/config";
import { processWooOrder } from "../src/lib/orders";
import { prisma } from "../src/lib/prisma";

async function main() {
  // Un produit existant avec sa catégorie
  const product = await prisma.product.findFirst({ include: { category: true } });
  if (!product) throw new Error("aucun produit");

  // Taux effectif de la catégorie au moment de la "vente"
  const expected = product.category.commissionRate ?? 10; // défaut probable
  const fakeWooId = 999_000_000 + Math.floor(Math.random() * 1000);

  await processWooOrder({
    id: fakeWooId,
    status: "processing",
    total: "15000",
    payment_method: "wave",
    billing: { first_name: "Test", last_name: "Gel", phone: "+22500000000", address_1: "Abidjan" },
    line_items: [{ product_id: product.wooId ?? 0, name: product.name, quantity: 2, total: "15000" }],
  });

  const order = await prisma.order.findFirst({ where: { wooId: fakeWooId }, include: { items: true } });
  if (!order) throw new Error("commande non créée");
  const item = order.items[0];
  console.log(`Commande #${fakeWooId} créée · item ${item.name}`);
  console.log(`commissionRate figé: ${item.commissionRate} (attendu: ${expected} si catégorie sans taux perso)`);

  // Vérifier que la commission calculée utilise CE taux (logique generateSettlement)
  const gross = Number(item.total);
  const comm = (gross * (item.commissionRate ?? 10)) / 100;
  console.log(`CA ${gross} → commission ${comm} (taux ${item.commissionRate}%)`);

  if (item.commissionRate === null) console.log("⚠️ commissionRate null — vérifier getCommissionRate");

  // Nettoyage
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  console.log("✅ Test gel du taux OK (nettoyé)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
