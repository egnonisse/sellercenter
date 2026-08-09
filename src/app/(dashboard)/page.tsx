import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const perms = session.user.permissions ?? [];
  const shopId = session.user.shopId;

  const canApproveSellers = hasPermission(perms, "sellers.approve");
  const canQc = hasPermission(perms, "products.qc");
  const canReadSellers = hasPermission(perms, "sellers.read");
  const canReadAllOrders = hasPermission(perms, "orders.read_all");
  const isVendor = !canReadSellers && !canQc;

  // ---------- Vue VENDOR ----------
  if (isVendor) {
    const [productCount, pendingQc, orderCount] = await Promise.all([
      prisma.product.count({ where: shopId ? { shopId } : undefined }),
      prisma.product.count({ where: shopId ? { shopId, status: "PENDING_QC" } : { status: "PENDING_QC" } }),
      prisma.order.count({ where: shopId ? { shopId } : undefined }),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Vue de votre boutique</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Produits</CardDescription>
              <CardTitle className="text-3xl">{productCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>En validation</CardDescription>
              <CardTitle className="text-3xl">{pendingQc}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Commandes</CardDescription>
              <CardTitle className="text-3xl">{orderCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Vue KAM / ADMIN : données globales ----------
  const [sellers, pendingSellers, pendingQcCount, pendingDeletions, totalOrders, revenueByShop] = await Promise.all([
    prisma.seller.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        shops: {
          include: {
            _count: {
              select: {
                products: { where: { status: "ACTIVE" } },
                orders: true,
              },
            },
          },
        },
      },
    }),
    canApproveSellers ? prisma.seller.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    canQc ? prisma.product.count({ where: { status: "PENDING_QC" } }) : Promise.resolve(0),
    canQc ? prisma.product.count({ where: { status: "DELETION_PENDING" } }) : Promise.resolve(0),
    canReadAllOrders ? prisma.order.count() : Promise.resolve(0),
    canReadAllOrders
      ? prisma.order.groupBy({
          by: ["shopId"],
          where: { status: "DELIVERED" },
          _sum: { total: true },
        })
      : Promise.resolve([]),
  ]);

  const revenueMap = new Map(revenueByShop.map((r) => [r.shopId, Number(r._sum.total ?? 0)]));

  const kamMode = !canApproveSellers && !canQc;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {kamMode ? "Supervision du marketplace (Key Account Manager)" : "Vue globale du marketplace (Admin)"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Boutiques</CardDescription>
            <CardTitle className="text-3xl">{sellers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Commandes (toutes)</CardDescription>
            <CardTitle className="text-3xl">{totalOrders}</CardTitle>
          </CardHeader>
        </Card>
        {canApproveSellers && (
          <Card>
            <CardHeader>
              <CardDescription>Vendeurs en attente</CardDescription>
              <CardTitle className="text-3xl text-primary">{pendingSellers}</CardTitle>
            </CardHeader>
          </Card>
        )}
        {canQc && (
          <>
            <Card>
              <CardHeader>
                <CardDescription>Produits à valider</CardDescription>
                <CardTitle className="text-3xl text-primary">{pendingQcCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Suppressions en attente</CardDescription>
                <CardTitle className="text-3xl">{pendingDeletions}</CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      {(canApproveSellers || canQc) && (
        <div className="flex flex-wrap gap-2">
          {canApproveSellers && (
            <Link href="/admin/sellers">
              <Button variant="outline" size="sm">
                Valider les vendeurs ({pendingSellers})
              </Button>
            </Link>
          )}
          {canQc && (
            <>
              <Link href="/admin/products">
                <Button variant="outline" size="sm">
                  Valider les produits ({pendingQcCount})
                </Button>
              </Link>
              <Link href="/admin/products#suppressions">
                <Button variant="outline" size="sm">
                  Suppressions en attente ({pendingDeletions})
                </Button>
              </Link>
            </>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Vendeurs & boutiques
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendeur</TableHead>
              <TableHead>Boutique</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Produits actifs</TableHead>
              <TableHead>Commandes</TableHead>
              <TableHead>CA livré (FCFA)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map((seller) => {
              const shopIds = seller.shops.map((s) => s.id);
              const revenue = shopIds.reduce((sum, id) => sum + (revenueMap.get(id) ?? 0), 0);
              return (
              <TableRow key={seller.id}>
                <TableCell className="font-medium">{seller.name}</TableCell>
                <TableCell>{seller.shops.map((s) => s.name).join(", ") || "—"}</TableCell>
                <TableCell>
                  <Badge variant={seller.status === "ACTIVE" ? "default" : "secondary"}>
                    {seller.status === "ACTIVE" ? "Actif" : seller.status === "PENDING" ? "En attente" : "Suspendu"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {seller.shops.reduce((n, s) => n + s._count.products, 0)}
                </TableCell>
                <TableCell>
                  {seller.shops.reduce((n, s) => n + s._count.orders, 0)}
                </TableCell>
                <TableCell className="font-medium">
                  {revenue.toLocaleString("fr-FR")}
                </TableCell>
              </TableRow>
              );
            })}
            {sellers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Aucun vendeur.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
