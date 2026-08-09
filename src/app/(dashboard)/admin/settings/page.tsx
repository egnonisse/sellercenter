import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDefaultCommissionAction, updateCategoryCommissionsAction } from "./actions";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.permissions ?? [], "settings.manage")) redirect("/");

  const [settings, categories] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "global" } }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { parent: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages plateforme</h1>
        <p className="text-sm text-muted-foreground">
          Commissions : taux par défaut + taux par catégorie (vide = hérite du parent / du défaut).
        </p>
      </div>

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

      <form action={updateCategoryCommissionsAction} className="space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-semibold">Taux par catégorie</h2>
        <div className="max-h-[420px] space-y-1 overflow-y-auto">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-muted">
              <span className="text-sm">
                {c.name}
                {c.parent && (
                  <span className="ml-1 text-xs text-muted-foreground">→ {c.parent.name}</span>
                )}
              </span>
              <Input
                name={`rate_${c.id}`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={c.commissionRate ?? ""}
                placeholder="hérite"
                className="w-24 text-right"
              />
            </div>
          ))}
        </div>
        <Button type="submit" size="sm">Enregistrer les taux par catégorie</Button>
      </form>
    </div>
  );
}
