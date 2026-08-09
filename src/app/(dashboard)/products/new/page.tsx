import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { loadCategoryOptions } from "@/lib/products";
import { listBrands } from "@/lib/brands";
import { ProductForm } from "@/components/product-form";
import { createProductAction } from "../actions";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/products");

  const [categories, brands] = await Promise.all([loadCategoryOptions(), listBrands()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau produit</h1>
        <p className="text-sm text-muted-foreground">
          Le produit sera en brouillon, puis soumis à validation.
        </p>
      </div>
      <ProductForm
        categories={categories}
        brands={brands}
        action={createProductAction}
        submitLabel="Créer le produit"
      />
    </div>
  );
}
