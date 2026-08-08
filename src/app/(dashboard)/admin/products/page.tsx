import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { approveProductAction, rejectProductAction, syncNowAction } from "./actions";

export default async function AdminProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");

  const [products, pendingSync] = await Promise.all([
    prisma.product.findMany({
      where: { status: "PENDING_QC" },
      orderBy: { updatedAt: "asc" },
      include: {
        shop: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.product.count({
      where: { syncStatus: { in: ["PENDING", "ERROR"] }, status: { in: ["ACTIVE", "DELISTED"] } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produits à valider</h1>
          <p className="text-sm text-zinc-500">
            {products.length} produit(s) en attente de contrôle qualité
            {pendingSync > 0 && ` · ${pendingSync} en attente de sync WooCommerce`}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await syncNowAction();
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Synchroniser maintenant
          </Button>
        </form>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>Boutique</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Prix (FCFA)</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-zinc-500">
                  Aucun produit en attente de validation.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-[280px] font-medium">
                  <div className="truncate">{p.name}</div>
                  {p.description && (
                    <div className="truncate text-xs text-zinc-500">{p.description}</div>
                  )}
                </TableCell>
                <TableCell>{p.shop.name}</TableCell>
                <TableCell>{p.category.name}</TableCell>
                <TableCell>{Number(p.price).toLocaleString("fr-FR")}</TableCell>
                <TableCell>{p.stockQty}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await approveProductAction(p.id);
                      }}
                    >
                      <Button type="submit" size="sm">
                        Approuver
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await rejectProductAction(p.id, "Rejeté par l'administrateur");
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        Rejeter
                      </Button>
                    </form>
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
