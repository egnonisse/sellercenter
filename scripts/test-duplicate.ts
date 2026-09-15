import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { duplicateProduct } from "../src/lib/products";

async function main() {
  const shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
  if (!shop) throw new Error("aucun shop");
  const source = await prisma.product.findFirst({ where: { shopId: shop.id } });
  if (!source) {
    console.log("aucun produit à dupliquer — création d'un produit test");
    const cat = await prisma.category.findFirst();
    if (!cat) throw new Error("aucune catégorie");
    const created = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: "Produit Test Duplication",
        slug: `test-dup-${Date.now()}`,
        categoryId: cat.id,
        price: 10000,
        stockQty: 3,
        sku: `DUP-${Date.now()}`,
        status: "ACTIVE",
      },
    });
    const copy = await duplicateProduct(shop.id, created.id);
    console.log("duplication OK:", copy.name, "| sku:", copy.sku, "| slug:", copy.slug, "| status:", copy.status);
    await prisma.product.deleteMany({ where: { id: { in: [created.id, copy.id] } } });
    console.log("nettoyage OK");
    await prisma.$disconnect();
    return;
  }

  const copy = await duplicateProduct(shop.id, source.id);
  console.log("source:", source.name, "| sku:", source.sku, "| slug:", source.slug);
  console.log("copie:", copy.name, "| sku:", copy.sku, "| slug:", copy.slug, "| status:", copy.status);
  if (copy.slug === source.slug) throw new Error("slug non unique !");
  if (copy.id === source.id) throw new Error("même id !");
  if (copy.sku === source.sku && source.sku) throw new Error("sku non unique !");
  if (copy.status !== "DRAFT") throw new Error("statut != DRAFT");

  // Nettoyage
  await prisma.product.delete({ where: { id: copy.id } });
  console.log("✅ duplication + nettoyage OK");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
