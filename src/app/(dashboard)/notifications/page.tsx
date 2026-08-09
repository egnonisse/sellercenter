import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markAllReadAction } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  PRODUCT_REJECTED: "Produit rejeté",
  PRODUCT_APPROVED: "Produit validé",
  ORDER_RECEIVED: "Nouvelle commande",
  SELLER_APPROVED: "Boutique validée",
  SETTLEMENT_PAID: "Relevé",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/");

  const notifications = await prisma.notification.findMany({
    where: { shopId: session.user.shopId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {notifications.filter((n) => !n.readAt).length} non lue(s)
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await markAllReadAction();
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Tout marquer comme lu
          </Button>
        </form>
      </div>

      {notifications.length === 0 && (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Aucune notification.
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`rounded-md border p-4 ${n.readAt ? "opacity-60" : "border-primary/30 bg-primary/5"}`}
          >
            <div className="flex items-center justify-between">
              <Badge variant={n.readAt ? "secondary" : "default"}>
                {TYPE_LABEL[n.type] ?? n.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleDateString("fr-FR")}{" "}
                {new Date(n.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium">{n.title}</p>
            {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
