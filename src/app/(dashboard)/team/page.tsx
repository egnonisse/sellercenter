import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { listTeamMembers } from "@/lib/users";
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
import { TeamInviteForm } from "@/components/team/team-invite-form";
import { resendTeamInvitationVoidAction, setTeamMemberStatusAction } from "./actions";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.shopId) redirect("/");
  if (!hasPermission(session.user.permissions ?? [], "team.manage")) redirect("/");

  const members = await listTeamMembers(session.user.shopId);
  const currentUserId = session.user.id;
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon équipe</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} membre(s) — les employés accèdent aux produits et commandes de votre boutique
          (pas aux finances).
        </p>
      </div>

      <TeamInviteForm />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Ajouté le</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucun membre pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.email}
                  {m.id === currentUserId && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(vous)</span>
                  )}
                </TableCell>
                <TableCell>{roleLabel(m.role)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[m.status] ?? "secondary"}>
                    {userStatusLabel(m.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmt(m.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {m.status === "INVITED" && (
                      <form action={resendTeamInvitationVoidAction.bind(null, m.id)}>
                        <Button type="submit" size="sm" variant="outline">
                          Renvoyer l&apos;invitation
                        </Button>
                      </form>
                    )}
                    {m.status !== "INVITED" && m.role === "SHOP_MANAGER" && m.id !== currentUserId && (
                      <form
                        action={setTeamMemberStatusAction.bind(
                          null,
                          m.id,
                          m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                        )}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          {m.status === "ACTIVE" ? "Désactiver" : "Activer"}
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
