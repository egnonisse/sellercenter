import "dotenv/config";
import {
  recordRateChange,
  closeActiveRate,
  getRateAt,
  listRateHistory,
} from "../src/lib/commission-history";
import { prisma } from "../src/lib/prisma";

async function main() {
  const cat = await prisma.category.findFirst();
  if (!cat) throw new Error("aucune catégorie");
  const createdIds: string[] = [];
  const track = async (id: string) => createdIds.push(id);

  // 1. Premier changement : 7%
  await recordRateChange(cat.id, 7, null);
  const tBetween = new Date(); // juste après le 1er changement
  const rows1 = await prisma.commissionRateHistory.findMany({
    where: { categoryId: cat.id, rate: 7 },
    orderBy: { validFrom: "desc" },
    take: 1,
  });
  if (rows1.length !== 1) throw new Error("ligne 7% non créée");
  await track(rows1[0].id);
  console.log("1. Taux 7% enregistré — active:", rows1[0].validTo === null);

  // 2. Deuxième changement : 9% → la ligne 7% doit être fermée
  await recordRateChange(cat.id, 9, null);
  const rows9 = await prisma.commissionRateHistory.findMany({
    where: { categoryId: cat.id, rate: 9 },
    orderBy: { validFrom: "desc" },
    take: 1,
  });
  if (rows9.length !== 1) throw new Error("ligne 9% non créée");
  await track(rows9[0].id);
  const closed7 = await prisma.commissionRateHistory.findUnique({ where: { id: rows1[0].id } });
  console.log(
    "2. Taux 9% enregistré — 7% fermé:",
    closed7?.validTo !== null,
    "| 9% active:",
    rows9[0].validTo === null,
  );

  // 3. Lecture rétroactive : avant tout → null ; entre les deux → 7% ; maintenant → 9%
  const beforeAll = await getRateAt(cat.id, new Date(Date.now() - 3_600_000));
  const atBetween = await getRateAt(cat.id, tBetween);
  const now = await getRateAt(cat.id, new Date());
  console.log("3. Rétroactif: avant →", beforeAll, "% | entre →", atBetween, "% | maintenant →", now, "%");
  if (beforeAll !== null) throw new Error("getRateAt(avant) != null");
  if (atBetween !== 7) throw new Error("getRateAt(entre) != 7");
  if (now !== 9) throw new Error("getRateAt(now) != 9");

  // 4. Passage à « hérite » : ferme l'active sans nouvelle ligne
  await closeActiveRate(cat.id);
  const activeAfterClose = await prisma.commissionRateHistory.count({
    where: { categoryId: cat.id, validTo: null },
  });
  console.log("4. Après closeActiveRate — lignes actives:", activeAfterClose);

  // 5. listRateHistory contient nos entrées
  const history = await listRateHistory(10);
  const found = history.filter((h) => createdIds.includes(h.id)).length;
  console.log("5. Historique listé — entrées de test visibles:", found);

  // Nettoyage
  await prisma.commissionRateHistory.deleteMany({ where: { id: { in: createdIds } } });
  console.log("✅ Test historique commissions OK (nettoyé)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
