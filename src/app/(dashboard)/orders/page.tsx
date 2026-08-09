import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  READY_TO_SHIP: "Prêt à expédier",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  DELIVERED: "default",
  READY_TO_SHIP: "secondary",
  SHIPPED: "secondary",
  PENDING: "outline",
  CANCELLED: "outline",
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "SUPER_ADMIN";
  const shopId = session.user.shopId;

  const orders = await prisma.order.findMany({
    where: shopId ? { shopId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { shop: { select: { name: true } }, items: true },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
        <p className="text-sm text-zinc-500">{orders.length} commande(s)</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commande</TableHead>
              <TableHead>Client</TableHead>
              {isAdmin && <TableHead>Boutique</TableHead>}
              <TableHead>Articles</TableHead>
              <TableHead>Total (FCFA)</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                  Aucune commande pour le moment. Les commandes du shop apparaîtront ici.
                </TableCell>
              </TableRow>
            )}
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link href={`/orders/${order.id}`} className="font-medium underline underline-offset-2">
                    #{order.wooId ?? order.id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>{order.customerName}</TableCell>
                {isAdmin && <TableCell>{order.shop.name}</TableCell>}
                <TableCell>
                  {order.items.reduce((sum, i) => sum + i.qty, 0)}
                </TableCell>
                <TableCell>{Number(order.total).toLocaleString("fr-FR")}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[order.status] ?? "secondary"}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
