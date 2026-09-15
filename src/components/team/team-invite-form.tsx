"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createTeamMemberAction } from "@/app/(dashboard)/team/actions";

const inputCls =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-950";

// Invitation d'un employé (rôle « Employé boutique », rattaché à la boutique du vendeur connecté)
export function TeamInviteForm() {
  const [state, action, pending] = useActionState(createTeamMemberAction, undefined);

  return (
    <form action={action} className="space-y-3 rounded-md border p-4">
      <h2 className="text-sm font-semibold">Inviter un employé</h2>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1 space-y-1">
          <Label htmlFor="member-email" className="text-xs">
            Email de l&apos;employé
          </Label>
          <input
            id="member-email"
            name="email"
            type="email"
            required
            placeholder="employe@exemple.ci"
            className={inputCls}
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Envoi..." : "Envoyer l'invitation"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        L&apos;employé reçoit un lien pour définir son mot de passe (7 jours). Il pourra gérer les produits
        et les commandes de votre boutique — sans accès aux finances.
      </p>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.result && <p className="text-xs text-emerald-600">{state.result}</p>}
    </form>
  );
}
