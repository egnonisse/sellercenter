import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadCategoryOptions } from "@/lib/products";
import { listBrands } from "@/lib/brands";
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

  const [categories, brands] = await Promise.all([loadCategoryOptions(), listBrands()]);
  const attrs = (product.attributes as {
    color?: string;
    size?: string;
    warranty?: string;
    custom?: { key: string; value: string }[];
  } | null) ?? {};

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le produit</h1>
        <p className="text-sm text-muted-foreground">
          Toute modification repasse le produit en brouillon (nouvelle validation).
        </p>
      </div>
      <ProductForm
        categories={categories}
        brands={brands}
        action={updateProductAction.bind(null, product.id)}
        initial={{
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          brand: product.brand,
          sku: product.sku,
          ean: product.ean,
          price: String(product.price),
          compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : null,
          saleStartDate: product.saleStartDate ? product.saleStartDate.toISOString() : null,
          saleEndDate: product.saleEndDate ? product.saleEndDate.toISOString() : null,
          stockQty: product.stockQty,
          images: product.images,
          attributes: {
            color: attrs.color ?? null,
            size: attrs.size ?? null,
            warranty: attrs.warranty ?? null,
            custom: attrs.custom ?? [],
          },
        }}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
