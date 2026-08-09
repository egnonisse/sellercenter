import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateOrderStatusAction } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  READY_TO_SHIP: "Prêt à expédier",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

// Boutons de transition selon le statut actuel
const NEXT_ACTIONS: Record<string, { status: string; label: string }[]> = {
  READY_TO_SHIP: [
    { status: "SHIPPED", label: "Marquer expédiée" },
    { status: "CANCELLED", label: "Annuler" },
  ],
  SHIPPED: [{ status: "DELIVERED", label: "Marquer livrée" }],
  PENDING: [{ status: "CANCELLED", label: "Annuler" }],
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "SUPER_ADMIN";
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      shop: true,
      items: { include: { product: { select: { name: true } } } },
      history: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) redirect("/orders");
  if (!isAdmin && order.shopId !== session.user.shopId) redirect("/orders");

  const actions = isAdmin ? [] : (NEXT_ACTIONS[order.status] ?? []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Commande #{order.wooId ?? order.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.shop.name} · {new Date(order.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Badge>{STATUS_LABEL[order.status] ?? order.status}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border p-4">
          <h2 className="mb-2 text-sm font-semibold">Client</h2>
          <p className="text-sm">{order.customerName}</p>
          <p className="text-sm text-muted-foreground">{order.phone}</p>
          {order.address && <p className="text-sm text-muted-foreground">{order.address}</p>}
        </div>
        <div className="rounded-md border p-4">
          <h2 className="mb-2 text-sm font-semibold">Paiement</h2>
          <p className="text-sm">{order.paymentMethod || "—"}</p>
          <p className="mt-2 text-sm">
            Total :{" "}
            <span className="font-semibold">{Number(order.total).toLocaleString("fr-FR")} FCFA</span>
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <div className="border-b px-4 py-2 text-sm font-semibold">Articles</div>
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-0">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.qty} × {Number(item.unitPrice).toLocaleString("fr-FR")} FCFA
              </p>
            </div>
            <span>{Number(item.total).toLocaleString("fr-FR")} FCFA</span>
          </div>
        ))}
      </div>

      {actions.length > 0 && (
        <div className="flex gap-3">
          {actions.map((a) => (
            <form
              key={a.status}
              action={async () => {
                "use server";
                await updateOrderStatusAction(id, a.status);
              }}
            >
              <Button type="submit" variant={a.status === "CANCELLED" ? "outline" : "default"}>
                {a.label}
              </Button>
            </form>
          ))}
        </div>
      )}

      <div className="rounded-md border">
        <div className="border-b px-4 py-2 text-sm font-semibold">Historique</div>
        {order.history.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">Aucun changement de statut.</p>
        )}
        {order.history.map((h) => (
          <div key={h.id} className="flex items-center justify-between border-b px-4 py-2 text-sm last:border-0">
            <span>
              {STATUS_LABEL[h.from ?? ""] ?? h.from ?? "—"} → {STATUS_LABEL[h.to] ?? h.to}
            </span>
            <span className="text-xs text-muted-foreground">
              {h.actor?.email ?? "système"} · {new Date(h.createdAt).toLocaleString("fr-FR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
