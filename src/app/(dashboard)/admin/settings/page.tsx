import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDefaultCommissionAction } from "./actions";
import { CategorySyncPanel } from "@/components/admin/category-sync-panel";
import { CategoryCommissionTree } from "@/components/admin/category-commission-tree";
import { loadCommissionTree } from "@/lib/commission-tree";
import { listRateHistory } from "@/lib/commission-history";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.permissions ?? [], "settings.manage")) redirect("/");

  const [settings, categories, commission, rateHistory] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "global" } }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { parent: { select: { name: true } } },
    }),
    loadCommissionTree(),
    listRateHistory(50),
  ]);

  const fmt = (d: Date) =>
    `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages plateforme</h1>
        <p className="text-sm text-muted-foreground">
          Commissions : taux par défaut + taux par catégorie (vide = hérite du parent / du défaut).
        </p>
      </div>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-semibold">Catalogue & WooCommerce</h2>
        <CategorySyncPanel
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            parentName: c.parent?.name ?? null,
          }))}
        />
      </section>

      <form action={updateDefaultCommissionAction} className="space-y-3 rounded-md border p-4">
        <div className="space-y-2">
          <Label htmlFor="defaultCommissionRate">Commission par défaut (%)</Label>
          <Input
            id="defaultCommissionRate"
            name="defaultCommissionRate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue={settings?.defaultCommissionRate ?? 10}
            className="max-w-[200px]"
          />
        </div>
        <Button type="submit" size="sm">Enregistrer le taux par défaut</Button>
      </form>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-semibold">Taux par catégorie</h2>
        <CategoryCommissionTree tree={commission.tree} defaultRate={commission.defaultRate} />
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-semibold">Historique des commissions</h2>
        <p className="text-xs text-muted-foreground">
          Qui a modifié quel taux, quand (validité de chaque période). Les 50 derniers changements.
        </p>
        {rateHistory.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun changement enregistré pour l&apos;instant.
          </p>
        ) : (
          <div className="max-h-[420px] space-y-1 overflow-y-auto">
            {rateHistory.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="font-medium">{h.categoryName ?? "Taux global"}</span>
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                    {h.rate}%
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {h.actorEmail ?? "—"} · {fmt(h.validFrom)}
                  {h.validTo ? ` → ${fmt(h.validTo)}` : " · actif"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
