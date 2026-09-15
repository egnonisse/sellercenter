import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listUsers } from "@/lib/users";
import { roleLabel, userStatusLabel, STATUS_VARIANT } from "@/lib/user-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserInviteForm } from "@/components/admin/user-invite-form";
import { resendInvitationVoidAction, setUserStatusAction } from "./actions";

const inputCls =
  "rounded-md border border-border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; status?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.permissions ?? [], "users.manage")) redirect("/");

  const params = await searchParams;
  const [users, shops] = await Promise.all([
    listUsers({
      role: params.role,
      status: params.status,
      q: params.q,
    }),
    prisma.shop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  const fmt = (d: Date) => d.toLocaleDateString("fr-FR");
  const currentUserId = session.user.id;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">
          Créer des accès et attribuer des rôles. {users.length} utilisateur(s).
        </p>
      </div>

      <UserInviteForm shops={shops} />

      <form method="GET" action="/admin/users" className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rechercher (email)</label>
          <input name="q" defaultValue={params.q ?? ""} placeholder="vendeur@..." className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rôle</label>
          <select name="role" defaultValue={params.role ?? ""} className={inputCls}>
            <option value="">Tous</option>
            {["SUPER_ADMIN", "KAM", "SHOP_ADMIN", "SHOP_MANAGER"].map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Statut</label>
          <select name="status" defaultValue={params.status ?? ""} className={inputCls}>
            <option value="">Tous</option>
            <option value="ACTIVE">Actif</option>
            <option value="INVITED">Invitation en attente</option>
            <option value="SUSPENDED">Désactivé</option>
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          Filtrer
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Boutique</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aucun utilisateur avec ces critères.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.email}
                  {u.id === currentUserId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(vous)</span>
                  )}
                </TableCell>
                <TableCell>{roleLabel(u.role)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.shop?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[u.status] ?? "secondary"}>
                    {userStatusLabel(u.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmt(u.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {u.status === "INVITED" && (
                      <form action={resendInvitationVoidAction.bind(null, u.id)}>
                        <Button type="submit" size="sm" variant="outline">
                          Renvoyer l&apos;invitation
                        </Button>
                      </form>
                    )}
                    {u.status !== "INVITED" && u.id !== currentUserId && (
                      <form
                        action={setUserStatusAction.bind(
                          null,
                          u.id,
                          u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                        )}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          {u.status === "ACTIVE" ? "Désactiver" : "Activer"}
                        </Button>
                      </form>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
