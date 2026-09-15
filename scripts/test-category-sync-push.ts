import "dotenv/config";
import { createCategoryAndPush, pushCategoryToWoo } from "../src/lib/sync-categories";
import { prisma } from "../src/lib/prisma";
import { wooGetCategoryBySlug, wooFetch } from "../src/lib/woocommerce";
import type WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

async function main() {
  const unique = Date.now().toString().slice(-6);

  // 1. Création locale + poussée immédiate
  const { id, wooId } = await createCategoryAndPush({ name: `Catégorie Test ${unique}` });
  console.log("Créée localement:", id, "| wooId:", wooId);
  if (!wooId) throw new Error("poussée échouée (pas de wooId)");

  // 2. Vérifier que WC la connaît
  const bySlug = await wooGetCategoryBySlug(`categorie-test-${unique}`);
  console.log("Trouvée côté WC par slug:", bySlug?.id === wooId ? "OK" : `PROBLÈME (${bySlug?.id})`);

  // 3. La re-pousser (doit réutiliser l'id, pas dupliquer)
  const again = await pushCategoryToWoo(id);
  console.log("Re-poussée → wooId:", again.wooId, "| créée:", again.created, "| même id:", again.wooId === wooId);

  // 4. Nettoyage : suppression côté WC puis côté base
  await wooFetch((api: WooCommerceRestApi) => api.delete(`products/categories/${wooId}`, { force: true }));
  await prisma.category.delete({ where: { id } });
  const gone = await wooGetCategoryBySlug(`categorie-test-${unique}`);
  console.log("Nettoyage: WC supprimée:", !gone, "| base supprimée: OK");

  await prisma.$disconnect();
  console.log("✅ Poussée catégorie OK");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
