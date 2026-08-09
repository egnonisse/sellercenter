import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { formatSyncDelay } from "@/lib/sync-timing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DelistForm } from "@/components/delist-form";
import {
  submitProductAction,
  requestDeletionAction,
  delistProductWithReasonAction,
} from "../actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_QC: "En validation",
  ACTIVE: "Actif",
  REJECTED: "Rejeté",
  DELISTED: "Retiré",
  DELETION_PENDING: "Suppression en attente",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PENDING_QC: "secondary",
  REJECTED: "outline",
  DELISTED: "outline",
  DELETION_PENDING: "outline",
  DRAFT: "secondary",
};

const ACTION_LABEL: Record<string, string> = {
  CREATED: "Créé",
  SUBMITTED: "Soumis pour validation",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
  UPDATED: "Modifié",
  DELISTED: "Retiré",
  DELETION_REQUESTED: "Suppression demandée",
  RESTORED: "Restauration",
  DELETED: "Supprimé",
  SYNCED: "Synchronisé",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isGlobal = hasPermission(session.user.permissions, "products.manage_all");
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      shop: { select: { name: true, slug: true } },
      history: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!product) redirect("/products");
  if (!isGlobal && product.shopId !== session.user.shopId) redirect("/products");

  const images = Array.isArray(product.images)
    ? (product.images as { url: string }[]).map((i) => i.url)
    : [];
  const attrs = (product.attributes as { color?: string; size?: string; warranty?: string } | null) ?? {};
  const canSubmit = product.status === "DRAFT" || product.status === "REJECTED";
  const canEdit = product.status !== "DELISTED" && product.status !== "DELETION_PENDING";
  const canRequestDeletion = product.status !== "DELETION_PENDING";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {product.shop.name} · {product.category.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={STATUS_VARIANT[product.status] ?? "secondary"}>
            {STATUS_LABEL[product.status] ?? product.status}
          </Badge>
          {!isGlobal && canEdit && (
            <Link href={`/products/${product.id}/edit`}>
              <Button type="button" size="sm" variant="outline">
                Modifier
              </Button>
            </Link>
          )}
          {!isGlobal && canSubmit && (
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
          )}
          {!isGlobal && canRequestDeletion && product.status !== "DELISTED" && (
            <form
              action={async () => {
                "use server";
                await requestDeletionAction(product.id);
              }}
            >
              <Button type="submit" size="sm" variant="outline" className="text-red-600">
                Demander la suppression
              </Button>
            </form>
          )}
        </div>
      </div>

      {product.status === "DELETION_PENDING" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Suppression demandée le{" "}
          {product.deletionRequestedAt
            ? new Date(product.deletionRequestedAt).toLocaleDateString("fr-FR")
            : "—"}{" "}
          — en attente de confirmation de l&apos;administrateur.
        </div>
      )}

      {product.status === "REJECTED" && product.qcReason && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <strong>Rejeté :</strong> {product.qcReason}
          {product.qcNote && <span> — {product.qcNote}</span>}
        </div>
      )}

      {product.status === "DELISTED" && product.delistReason && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900">
          <strong>Retiré :</strong> {product.delistReason}
          {product.delistComment && <span> — {product.delistComment}</span>}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {images.length > 0 ? (
          <div className="space-y-2">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-zinc-50 dark:bg-zinc-900">
              <img src={images[0]} alt={product.name} className="h-full w-full object-contain" />
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
            {product.compareAtPrice && (product.saleStartDate || product.saleEndDate) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Promo du {product.saleStartDate ? new Date(product.saleStartDate).toLocaleDateString("fr-FR") : "—"} au{" "}
                {product.saleEndDate ? new Date(product.saleEndDate).toLocaleDateString("fr-FR") : "—"}
              </p>
            )}
          </div>

          {(attrs.color || attrs.size || attrs.warranty) && (
            <div className="rounded-md border p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold">Caractéristiques</h2>
              <dl className="space-y-1 text-zinc-600 dark:text-zinc-400">
                {attrs.color && (
                  <div className="flex justify-between">
                    <dt>Couleur</dt>
                    <dd>{attrs.color}</dd>
                  </div>
                )}
                {attrs.size && (
                  <div className="flex justify-between">
                    <dt>Taille</dt>
                    <dd>{attrs.size}</dd>
                  </div>
                )}
                {attrs.warranty && (
                  <div className="flex justify-between">
                    <dt>Garantie</dt>
                    <dd>{attrs.warranty}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

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
              <div className="flex justify-between">
                <dt>SKU vendeur</dt>
                <dd>{product.sku || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>EAN / GTIN</dt>
                <dd>{product.ean || "—"}</dd>
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
                  {product.syncStatus === "SYNCED"
                    ? "À jour"
                    : product.syncStatus === "ERROR"
                      ? "Échec"
                      : `En attente — passe en ligne dans ${formatSyncDelay()}`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Créé le</dt>
                <dd>{new Date(product.createdAt).toLocaleDateString("fr-FR")}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {!isGlobal && product.status === "ACTIVE" && (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Retirer du shop public (motivé)</summary>
          <div className="mt-3">
            <DelistForm productId={product.id} action={delistProductWithReasonAction} />
          </div>
        </details>
      )}

      {product.history.length > 0 && (
        <div className="rounded-md border p-4">
          <h2 className="mb-3 text-sm font-semibold">Historique</h2>
          <ol className="space-y-2 text-sm">
            {product.history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {ACTION_LABEL[h.action] ?? h.action}
                  {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(h.createdAt).toLocaleDateString("fr-FR")}{" "}
                  {new Date(h.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
