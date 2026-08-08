import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const shopId = session.user.shopId;

  const [productCount, orderCount, pendingSellers, shopCount] = await Promise.all([
    prisma.product.count({ where: shopId ? { shopId } : undefined }),
    prisma.order.count({ where: shopId ? { shopId } : undefined }),
    isSuperAdmin ? prisma.seller.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    isSuperAdmin ? prisma.shop.count() : Promise.resolve(1),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500">
          {isSuperAdmin ? "Vue globale du marketplace" : "Vue de votre boutique"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Produits</CardDescription>
            <CardTitle className="text-3xl">{productCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Commandes</CardDescription>
            <CardTitle className="text-3xl">{orderCount}</CardTitle>
          </CardHeader>
        </Card>
        {isSuperAdmin ? (
          <>
            <Card>
              <CardHeader>
                <CardDescription>Boutiques</CardDescription>
                <CardTitle className="text-3xl">{shopCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Vendeurs en attente</CardDescription>
                <CardTitle className="text-3xl">{pendingSellers}</CardTitle>
              </CardHeader>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardDescription>Statut boutique</CardDescription>
              <CardTitle className="text-3xl">Active</CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
