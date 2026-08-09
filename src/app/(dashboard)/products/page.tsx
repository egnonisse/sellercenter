import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "SUPER_ADMIN";
  const shopId = session.user.shopId;

  const [products, shop] = await Promise.all([
    prisma.product.findMany({
      where: shopId ? { shopId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } } },
      take: 200,
    }),
    shopId ? prisma.shop.findUnique({ where: { id: shopId } }) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
          <p className="text-sm text-zinc-500">
            {shop ? `${shop.name} — ` : ""}{products.length} produit(s)
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
              <Button>Ajouter</Button>
            </Link>
          </div>
        )}
      </div>

      {!isAdmin && (
        <form id="bulk-form" action={bulkProductsAction} className="flex items-center gap-2">
          <Button type="submit" name="bulkAction" value="submit" size="sm" variant="outline">
            Soumettre la sélection
          </Button>
          <Button type="submit" name="bulkAction" value="delist" size="sm" variant="outline">
            Retirer la sélection
          </Button>
          <span className="text-xs text-zinc-400">cochez des produits pour agir en masse</span>
        </form>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {!isAdmin && <TableHead className="w-10" />}
              <TableHead>Produit</TableHead>
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
                <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                  Aucun produit.{" "}
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
                      className="h-4 w-4 rounded border-zinc-300"
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
