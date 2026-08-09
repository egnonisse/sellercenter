import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/rbac";
import { logout, switchAccountAction } from "./actions";

// DEV ONLY : libellés des comptes de test pour le switcher (à retirer avant prod)
const DEV_ACCOUNT_LABELS: Record<string, string> = {
  "admin@zariamall.com": "Admin",
  "kam@zariamall.com": "KAM",
  "vendeur-test@example.com": "Vendor (test)",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const perms = session.user.permissions ?? [];
  const devSwitcher = process.env.ALLOW_ACCOUNT_SWITCHING === "true";

  const canProducts = hasPermission(perms, "products.manage") || hasPermission(perms, "products.manage_all");
  const canOrders = hasPermission(perms, "orders.read") || hasPermission(perms, "orders.read_all");
  const canSellers = hasPermission(perms, "sellers.read");
  const canQc = hasPermission(perms, "products.qc");
  const canRoles = hasPermission(perms, "roles.manage");

  const adminItems = [
    ...(canSellers ? [{ label: "Vendeurs", href: "/admin/sellers" }] : []),
    ...(canQc ? [{ label: "Produits à valider", href: "/admin/products" }] : []),
    ...(canRoles ? [{ label: "Rôles & permissions", href: "/admin/roles" }] : []),
  ];

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex h-14 items-center border-b border-border px-4 dark:border-zinc-800">
          <span className="text-sm font-semibold">SellerCenter</span>
          <span className="ml-2 text-xs text-zinc-400">Zariamall</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <Link
            href="/"
            className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Dashboard
          </Link>
          {canProducts && (
            <Link
              href="/products"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Produits
            </Link>
          )}
          {canOrders && (
            <Link
              href="/orders"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Commandes
            </Link>
          )}
          {[
            { label: "Promotions", href: "/promotions" },
            { label: "Finances", href: "/finances" },
            { label: "Paramètres", href: "/settings" },
          ].map((item) => (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400 opacity-60"
              title="Module à venir"
            >
              {item.label}
              <span className="text-[10px] uppercase tracking-wide">bientôt</span>
            </span>
          ))}
          {adminItems.length > 0 && (
            <div className="pt-3">
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Administration
              </p>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
        <div className="border-t border-border p-3">
          <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{session.user.email}</p>
          {devSwitcher && (
            <form action={switchAccountAction} className="mb-2 rounded-md border border-dashed border-amber-300 p-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-600">
                Dev : changer de compte
              </p>
              <select
                name="email"
                defaultValue={session.user.email ?? ""}
                className="mb-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs focus:outline-none"
              >
                {Object.entries(DEV_ACCOUNT_LABELS).map(([email, label]) => (
                  <option key={email} value={email}>
                    {label} — {email}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
              >
                Changer
              </button>
            </form>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
