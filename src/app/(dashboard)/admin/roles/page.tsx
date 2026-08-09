import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac-constants";
import { listRolePermissions } from "@/lib/load-permissions";
import { Button } from "@/components/ui/button";
import { updateRolePermissionsAction } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Admin",
  KAM: "Key Account Manager",
  SHOP_ADMIN: "Vendor (propriétaire)",
  SHOP_MANAGER: "Staff (employé vendeur)",
};

const ROLE_HINTS: Record<string, string> = {
  SUPER_ADMIN: "Toutes les validations, tous les droits",
  KAM: "Supervision multi-boutiques + actions que l'admin lui accorde",
  SHOP_ADMIN: "Gère sa boutique : produits, commandes, finances",
  SHOP_MANAGER: "Employé : produits + commandes, pas les finances",
};

export default async function AdminRolesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.permissions ?? [], "roles.manage")) redirect("/");

  const map = await listRolePermissions();
  const roles = ["SUPER_ADMIN", "KAM", "SHOP_ADMIN", "SHOP_MANAGER"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rôles & permissions</h1>
        <p className="text-sm text-muted-foreground">
          Configurez les actions autorisées pour chaque rôle. Les changements prennent effet à la
          prochaine connexion des utilisateurs concernés.
        </p>
      </div>

      <form action={updateRolePermissionsAction} className="space-y-6">
        {roles.map((role) => (
          <div key={role} className="rounded-md border">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{ROLE_LABELS[role]}</h2>
                <span className="text-xs text-muted-foreground">{ROLE_HINTS[role]}</span>
              </div>
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {PERMISSIONS.map((p) => (
                <label
                  key={p.name}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name={`perm_${role}_${p.name}`}
                    defaultChecked={map[role]?.[p.name] ?? false}
                    className="h-4 w-4 rounded border-input text-primary"
                  />
                  <span>
                    {p.label}
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      {p.group} · {p.name}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <Button type="submit">Enregistrer les permissions</Button>
        </div>
      </form>
    </div>
  );
}
