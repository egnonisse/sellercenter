import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCategoryOptions } from "@/lib/products";
import { ProductForm } from "@/components/product-form";
import { updateProductAction } from "../../actions";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/products");

  const product = await prisma.product.findFirst({
    where: { id, shopId: session.user.shopId },
  });
  if (!product) redirect("/products");

  const categories = await loadCategoryOptions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le produit</h1>
        <p className="text-sm text-zinc-500">
          Toute modification repasse le produit en brouillon (nouvelle validation).
        </p>
      </div>
      <ProductForm
        categories={categories}
        action={updateProductAction.bind(null, product.id)}
        initial={{
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          brand: product.brand,
          price: String(product.price),
          compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : null,
          stockQty: product.stockQty,
          images: product.images,
        }}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
