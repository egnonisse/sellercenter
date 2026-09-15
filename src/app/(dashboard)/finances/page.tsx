import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { resolveShopScope } from "@/lib/shop-assignment";
import { listSettlements } from "@/lib/settlements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateSettlementsAction, markSettlementPaidAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouvert",
  PROCESSING: "En traitement",
  PAID: "Payé",
  FAILED: "Échec",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  PAID: "default",
  OPEN: "secondary",
  PROCESSING: "secondary",
  FAILED: "outline",
};

function fmt(n: unknown) {
  return Number(n).toLocaleString("fr-FR");
}

export default async function FinancesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const perms = session.user.permissions ?? [];
  if (!hasPermission(perms, "finance.read_all")) redirect("/");

  const scope = await resolveShopScope({
    id: session.user.id,
    role: session.user.role,
    shopId: session.user.shopId,
  });
  const isGlobal = scope.isGlobal;
  const canManage = hasPermission(perms, "finance.manage_all");

  const settlements = await listSettlements(isGlobal ? null : scope.shopIds);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finances & relevés</h1>
          <p className="text-sm text-muted-foreground">
            {isGlobal ? "Relevés de toutes les boutiques" : "Relevés de votre boutique"}
          </p>
        </div>
        {canManage && (
          <form
            action={async () => {
              "use server";
              await generateSettlementsAction();
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Générer les relevés du mois
            </Button>
          </form>
        )}
      </div>

      {settlements.length === 0 && (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Aucun relevé disponible.
          {canManage && " Cliquez sur « Générer les relevés du mois » pour créer ceux de la période courante."}
        </div>
      )}

      {settlements.map((s) => (
        <div key={s.id} className="rounded-md border">
          <div className="flex flex-wrap items-center justify-between border-b border-border px-4 py-3">
            <div>
              <span className="text-sm font-semibold">
                {s.shop.name} — {new Date(s.periodStart).toLocaleDateString("fr-FR")} au{" "}
                {new Date(s.periodEnd).toLocaleDateString("fr-FR")}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {s._count.lines} ligne(s) de vente
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                {STATUS_LABEL[s.status] ?? s.status}
              </Badge>
              {canManage && s.status !== "PAID" && (
                <form
                  action={async () => {
                    "use server";
                    await markSettlementPaidAction(s.id);
                  }}
                >
                  <Button type="submit" size="sm">
                    Marquer payé
                  </Button>
                </form>
              )}
              {s.status === "PAID" && s.paidAt && (
                <span className="text-xs text-muted-foreground">
                  Payé le {new Date(s.paidAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border text-center text-sm">
            <div className="p-3">
              <div className="text-xs text-muted-foreground">CA brut</div>
              <div className="font-semibold">{fmt(s.grossSales)} FCFA</div>
            </div>
            <div className="p-3">
              <div className="text-xs text-muted-foreground">Commission</div>
              <div className="font-semibold">− {fmt(s.commission)} FCFA</div>
            </div>
            <div className="p-3">
              <div className="text-xs text-muted-foreground">Net à percevoir</div>
              <div className="font-semibold text-primary">{fmt(s.netPayable)} FCFA</div>
            </div>
          </div>
          <div className="border-t border-border px-4 py-2">
            <Link href={`/finances/${s.id}`} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Voir le détail des ventes →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
