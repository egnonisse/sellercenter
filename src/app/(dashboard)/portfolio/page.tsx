import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listKamPortfolio } from "@/lib/shop-assignment";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const SHOP_STATUS: Record<string, string> = {
  PENDING: "En attente",
  ACTIVE: "Active",
  SUSPENDED: "Suspendue",
};

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Réservé aux chargés de comptes : leur périmètre est leur portefeuille
  if (session.user.role !== "KAM") redirect("/");

  const shops = await listKamPortfolio(session.user.id);
  const shopIds = shops.map((s) => s.id);

  // Chiffre d'affaires livré, par boutique du portefeuille
  const revenue = shopIds.length
    ? await prisma.order.groupBy({
        by: ["shopId"],
        where: { status: "DELIVERED", shopId: { in: shopIds } },
        _sum: { total: true },
      })
    : [];
  const revenueMap = new Map(revenue.map((r) => [r.shopId, Number(r._sum.total ?? 0)]));

  const totalRevenue = [...revenueMap.values()].reduce((a, b) => a + b, 0);
  const totalProducts = shops.reduce((a, s) => a + s._count.products, 0);
  const totalOrders = shops.reduce((a, s) => a + s._count.orders, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon portefeuille</h1>
        <p className="text-sm text-muted-foreground">
          Les boutiques dont vous êtes le chargé de comptes. Vous n&apos;avez accès qu&apos;à ces
          boutiques.
        </p>
      </div>

      {shops.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Boutiques</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{shops.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Produits actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{totalProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">CA livré</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{totalRevenue.toLocaleString("fr-FR")} F</p>
              <p className="text-xs text-muted-foreground">{totalOrders} commande(s)</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Boutique</TableHead>
              <TableHead>Vendeur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Produits actifs</TableHead>
              <TableHead className="text-right">Commandes</TableHead>
              <TableHead className="text-right">CA livré</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aucune boutique ne vous est attribuée pour le moment. Contactez
                  l&apos;administrateur de la plateforme.
                </TableCell>
              </TableRow>
            )}
            {shops.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link href={`/products?shopId=${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{s.seller.name}</div>
                  <div className="text-xs text-muted-foreground">{s.seller.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>
                    {SHOP_STATUS[s.status] ?? s.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{s._count.products}</TableCell>
                <TableCell className="text-right">{s._count.orders}</TableCell>
                <TableCell className="text-right">
                  {(revenueMap.get(s.id) ?? 0).toLocaleString("fr-FR")} F
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
