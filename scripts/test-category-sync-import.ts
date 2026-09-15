import "dotenv/config";
import { syncCategoriesFromWoo } from "../src/lib/sync-categories";
import { prisma } from "../src/lib/prisma";

async function main() {
  const r = await syncCategoriesFromWoo();
  console.log("Résultat import:", JSON.stringify(r));

  // Vérifications post-sync
  const total = await prisma.category.count();
  const withWoo = await prisma.category.count({ where: { wooId: { not: null } } });
  const withoutWoo = await prisma.category.count({ where: { wooId: null } });
  console.log(`Après sync: ${total} catégories · ${withWoo} avec wooId · ${withoutWoo} sans wooId`);
  if (r.errors > 0) throw new Error("erreurs pendant la sync");

  // Échantillon : vérifier le mapping parent
  const sample = await prisma.category.findFirst({
    where: { parentId: { not: null } },
    include: { parent: true },
  });
  if (sample) {
    console.log(`Exemple hiérarchie: ${sample.parent?.name ?? "?"} → ${sample.name} (woo ${sample.wooId})`);
  }

  await prisma.$disconnect();
  console.log("✅ Import catégories OK");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
