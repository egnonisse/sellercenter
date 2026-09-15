"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitationAction } from "@/app/set-password/actions";

// Définition du mot de passe après invitation (lien à usage unique, 7 jours)
export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitationAction, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm">
          ✅ Votre mot de passe est enregistré et votre compte est actif.
        </p>
        <Link href="/login">
          <Button className="w-full">Se connecter</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="8 caractères minimum"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmer le mot de passe</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enregistrement..." : "Définir mon mot de passe"}
      </Button>
    </form>
  );
}
