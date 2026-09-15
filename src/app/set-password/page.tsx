import Link from "next/link";
import { getInvitationByToken } from "@/lib/users";
import { roleLabel } from "@/lib/user-ui";
import { SetPasswordForm } from "@/components/set-password-form";
import { Button } from "@/components/ui/button";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const invitation = token ? await getInvitationByToken(token) : null;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">SellerCenter</h1>
          <p className="mt-1 text-sm text-muted-foreground">Zariamall — portail vendeurs</p>
        </div>

        {invitation ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">{invitation.email}</p>
              <p className="text-muted-foreground">
                {roleLabel(invitation.role)}
                {invitation.shop ? ` · ${invitation.shop.name}` : ""}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Choisissez votre mot de passe pour activer votre compte.
            </p>
            <SetPasswordForm token={token} />
          </div>
        ) : (
          <div className="space-y-4 rounded-md border p-4 text-center">
            <p className="text-sm">
              ⚠️ Ce lien d&apos;invitation est <strong>invalide ou expiré</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Demandez un nouveau lien à la personne qui vous a invité, ou reconnectez-vous si votre
              compte est déjà actif.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Aller à la connexion
              </Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
