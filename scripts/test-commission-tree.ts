import "dotenv/config";
import { loadCommissionTree } from "../src/lib/commission-tree";
import { getCommissionRate } from "../src/lib/settlements";
import { prisma } from "../src/lib/prisma";

async function main() {
  const { defaultRate, tree } = await loadCommissionTree();

  const count = (nodes: typeof tree): number =>
    nodes.reduce((acc, n) => acc + 1 + count(n.children), 0);
  const maxDepth = (nodes: typeof tree, d = 1): number =>
    nodes.reduce((acc, n) => Math.max(acc, n.children.length ? maxDepth(n.children, d + 1) : d), d);

  console.log(`Défaut: ${defaultRate}% · ${count(tree)} catégories · profondeur max: ${maxDepth(tree)}`);
  console.log(`Racines: ${tree.length} (ex: ${tree.slice(0, 4).map((r) => r.name).join(", ")})`);

  // Vérifie que le taux effectif de l'arbre == getCommissionRate (échantillon de 12)
  const sample: typeof tree = [];
  const collect = (nodes: typeof tree, budget: number) => {
    for (const n of nodes) {
      if (sample.length >= budget) return;
      sample.push(n);
      collect(n.children, budget - sample.length);
    }
  };
  collect(tree, 12);

  let mismatches = 0;
  for (const n of sample) {
    const direct = await getCommissionRate(n.id);
    if (direct !== n.effectiveRate) {
      mismatches++;
      console.log(`ÉCART ${n.name}: arbre=${n.effectiveRate} direct=${direct}`);
    }
  }
  console.log(mismatches === 0 ? "✅ Arbre == calcul direct (getCommissionRate) sur l'échantillon" : `❌ ${mismatches} écarts`);

  // Échantillon : une catégorie avec taux propre vs une héritée
  const withOwn = tree.find((r) => r.children.some((c) => c.ownRate !== null))
    ?.children.find((c) => c.ownRate !== null);
  if (withOwn) {
    console.log(`Exemple taux propre: ${withOwn.name} = ${withOwn.ownRate}% (effectif ${withOwn.effectiveRate}%)`);
  }
  const inherited = tree.find((r) => r.children.some((c) => c.ownRate === null))?.children.find((c) => c.ownRate === null);
  if (inherited) {
    console.log(`Exemple hérité: ${inherited.name} → effectif ${inherited.effectiveRate}% (hérite de ${inherited.parentId ? "parent" : "défaut"})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
