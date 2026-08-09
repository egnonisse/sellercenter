import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { submitProductAction, delistProductAction } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_QC: "En validation",
  ACTIVE: "Actif",
  REJECTED: "Rejeté",
  DELISTED: "Retiré",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PENDING_QC: "secondary",
  REJECTED: "outline",
  DELISTED: "outline",
  DRAFT: "secondary",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "SUPER_ADMIN";
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      shop: { select: { name: true, slug: true } },
    },
  });
  if (!product) redirect("/products");
  if (!isAdmin && product.shopId !== session.user.shopId) redirect("/products");

  const images = Array.isArray(product.images)
    ? (product.images as { url: string }[]).map((i) => i.url)
    : [];
  const canSubmit = product.status === "DRAFT" || product.status === "REJECTED";
  const canDelist = product.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {product.shop.name} · {product.category.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[product.status] ?? "secondary"}>
            {STATUS_LABEL[product.status] ?? product.status}
          </Badge>
          {!isAdmin && product.status !== "DELISTED" && (
            <>
              <Link href={`/products/${product.id}/edit`}>
                <Button type="button" size="sm" variant="outline">
                  Modifier
                </Button>
              </Link>
              {canSubmit ? (
                <form
                  action={async () => {
                    "use server";
                    await submitProductAction(product.id);
                  }}
                >
                  <Button type="submit" size="sm">
                    Soumettre
                  </Button>
                </form>
              ) : (
                canDelist && (
                  <form
                    action={async () => {
                      "use server";
                      await delistProductAction(product.id);
                    }}
                  >
                    <Button type="submit" size="sm" variant="outline">
                      Retirer
                    </Button>
                  </form>
                )
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {images.length > 0 ? (
          <div className="space-y-2">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-zinc-50 dark:bg-zinc-900">
              <img
                src={images[0]}
                alt={product.name}
                className="h-full w-full object-contain"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.slice(1, 6).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${product.name} ${i + 2}`}
                    className="h-16 w-16 rounded-md border object-contain"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-md border bg-zinc-50 text-sm text-zinc-400 dark:bg-zinc-900">
            Aucune image
          </div>
        )}

        <div className="space-y-4">
          <div className="rounded-md border p-4">
            <h2 className="mb-3 text-sm font-semibold">Prix & stock</h2>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold">
                {Number(product.price).toLocaleString("fr-FR")} FCFA
              </span>
              {product.compareAtPrice && (
                <span className="text-sm text-zinc-400 line-through">
                  {Number(product.compareAtPrice).toLocaleString("fr-FR")} FCFA
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Stock : {product.stockQty} · Marque : {product.brand || "—"}
            </p>
          </div>

          {product.description && (
            <div className="rounded-md border p-4">
              <h2 className="mb-2 text-sm font-semibold">Description</h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                {product.description}
              </p>
            </div>
          )}

          <div className="rounded-md border p-4 text-sm">
            <h2 className="mb-2 text-sm font-semibold">Informations</h2>
            <dl className="space-y-1 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <dt>Boutique</dt>
                <dd>{product.shop.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Catégorie</dt>
                <dd>{product.category.name}</dd>
              </div>
              {product.wooId && (
                <div className="flex justify-between">
                  <dt>Shop public</dt>
                  <dd>
                    <a
                      href={`https://zariamall.com/produit/${product.slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      Voir sur zariamall.com
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Synchronisation</dt>
                <dd>
                  {product.syncStatus === "SYNCED" ? "À jour" : product.syncStatus === "ERROR" ? "Échec" : "En attente"}
                </dd>
              </div>
              {product.qcNote && (
                <div className="flex justify-between">
                  <dt>Note QC</dt>
                  <dd>{product.qcNote}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt>Créé le</dt>
                <dd>{new Date(product.createdAt).toLocaleDateString("fr-FR")}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
