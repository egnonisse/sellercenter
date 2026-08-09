import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { submitProductAction, delistProductAction, bulkProductsAction } from "./actions";

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

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "PENDING_QC", label: "En validation" },
  { value: "ACTIVE", label: "Actif" },
  { value: "REJECTED", label: "Rejeté" },
  { value: "DELISTED", label: "Retiré" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "", q = "" } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "SUPER_ADMIN";
  const shopId = session.user.shopId;

  const where: Prisma.ProductWhereInput = {
    ...(shopId ? { shopId } : {}),
    ...(status ? { status: status as Prisma.ProductWhereInput["status"] } : {}),
    ...(q ? { name: { contains: q.trim(), mode: "insensitive" } } : {}),
  };

  const [products, shop, counts] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } } },
      take: 200,
    }),
    shopId ? prisma.shop.findUnique({ where: { id: shopId } }) : Promise.resolve(null),
    prisma.product.groupBy({ by: ["status"], where: shopId ? { shopId } : {}, _count: true }),
  ]);

  const countByStatus: Record<string, number> = {};
  for (const c of counts) countByStatus[c.status] = c._count;

  const buildHref = (nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/products?${s}` : "/products";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestion des produits</h1>
          <p className="text-sm text-muted-foreground">
            {shop ? `${shop.name} — ` : ""}{products.length} produit(s)
            {q && ` · recherche « ${q} »`}
          </p>
        </div>
        {!isAdmin && (
          <div className="flex gap-2">
            <Link href="/products/import">
              <Button type="button" variant="outline" size="sm">
                Importer
              </Button>
            </Link>
            <Link href="/api/products/export">
              <Button type="button" variant="outline" size="sm">
                Exporter CSV
              </Button>
            </Link>
            <Link href="/products/new">
              <Button>Ajouter un produit</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Filtres de statut (pills) */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          const count = f.value ? countByStatus[f.value] ?? 0 : products.length;
          return (
            <Link
              key={f.value || "all"}
              href={buildHref(f.value)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
              <span className="ml-1 text-xs opacity-70">({count})</span>
            </Link>
          );
        })}
      </div>

      {/* Recherche par nom */}
      <form method="GET" action="/products" className="flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom de produit..."
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {status && <input type="hidden" name="status" value={status} />}
        <Button type="submit" size="sm" variant="outline">
          Rechercher
        </Button>
        {q && (
          <Link href={buildHref(status)}>
            <Button type="button" size="sm" variant="ghost">
              Effacer
            </Button>
          </Link>
        )}
      </form>

      {!isAdmin && (
        <form id="bulk-form" action={bulkProductsAction} className="flex items-center gap-2">
          <Button type="submit" name="bulkAction" value="submit" size="sm" variant="outline">
            Soumettre la sélection
          </Button>
          <Button type="submit" name="bulkAction" value="delist" size="sm" variant="outline">
            Retirer la sélection
          </Button>
          <span className="text-xs text-muted-foreground">
            cochez des produits pour agir en masse
          </span>
        </form>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {!isAdmin && <TableHead className="w-10" />}
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix (FCFA)</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Aucun produit{status ? ` avec le statut « ${STATUS_LABEL[status] ?? status} »` : ""}
                  {q ? ` pour « ${q} »` : ""}.{" "}
                  {!isAdmin && (
                    <Link href="/products/new" className="underline">
                      Ajoutez votre premier produit
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id}>
                {!isAdmin && (
                  <TableCell>
                    <input
                      type="checkbox"
                      name="ids"
                      value={p.id}
                      form="bulk-form"
                      className="h-4 w-4 rounded border-input"
                    />
                  </TableCell>
                )}
                <TableCell className="max-w-[280px] font-medium">
                  <Link href={`/products/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                  {p.syncStatus === "PENDING" && (
                    <div className="text-[10px] text-amber-600">sync en attente</div>
                  )}
                </TableCell>
                <TableCell>{p.category.name}</TableCell>
                <TableCell>{Number(p.price).toLocaleString("fr-FR")}</TableCell>
                <TableCell>{p.stockQty}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {!isAdmin && p.status !== "DELISTED" && (
                      <>
                        <Link href={`/products/${p.id}/edit`}>
                          <Button type="button" size="sm" variant="outline">
                            Modifier
                          </Button>
                        </Link>
                        {p.status === "DRAFT" || p.status === "REJECTED" ? (
                          <form
                            action={async () => {
                              "use server";
                              await submitProductAction(p.id);
                            }}
                          >
                            <Button type="submit" size="sm">
                              Soumettre
                            </Button>
                          </form>
                        ) : (
                          <form
                            action={async () => {
                              "use server";
                              await delistProductAction(p.id);
                            }}
                          >
                            <Button type="submit" size="sm" variant="outline">
                              Retirer
                            </Button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
