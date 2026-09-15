import "dotenv/config";
import { syncBrandsFromWoo } from "../src/lib/sync-brands";
import { prisma } from "../src/lib/prisma";

async function main() {
  const r = await syncBrandsFromWoo();
  console.log("Résultat import:", JSON.stringify(r));

  const total = await prisma.brand.count();
  const withWoo = await prisma.brand.count({ where: { wooId: { not: null } } });
  const sample = await prisma.brand.findMany({ orderBy: { name: "asc" }, take: 8 });
  console.log(`Marques en base: ${total} · avec wooId: ${withWoo}`);
  console.log("Échantillon:", sample.map((b) => b.name).join(" · "));

  if (r.errors > 0) throw new Error("erreurs pendant la sync");
  await prisma.$disconnect();
  console.log("✅ Import marques OK");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
