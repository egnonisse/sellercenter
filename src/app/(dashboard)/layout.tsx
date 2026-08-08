import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout } from "./actions";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", active: true },
  { label: "Produits", href: "/products", soon: true },
  { label: "Commandes", href: "/orders", soon: true },
  { label: "Promotions", href: "/promotions", soon: true },
  { label: "Finances", href: "/finances", soon: true },
  { label: "Paramètres", href: "/settings", soon: true },
];

const ADMIN_ITEMS = [{ label: "Vendeurs", href: "/admin/sellers" }];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex h-14 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
          <span className="text-sm font-semibold">SellerCenter</span>
          <span className="ml-2 text-xs text-zinc-400">Zariamall</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) =>
            item.soon ? (
              <span
                key={item.href}
                className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400 opacity-60"
                title="Module à venir"
              >
                {item.label}
                <span className="text-[10px] uppercase tracking-wide">bientôt</span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                  item.active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            ),
          )}
          {session.user.role === "SUPER_ADMIN" && (
            <div className="pt-3">
              <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Administration
              </p>
              {ADMIN_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <p className="mb-2 truncate px-3 text-xs text-zinc-500">{session.user.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
