"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createUserAction } from "@/app/(dashboard)/admin/users/actions";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/user-ui";

type ShopOption = { id: string; name: string };

const inputCls =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-950";

// Invitation d'un utilisateur (l'admin choisit le rôle et, si besoin, la boutique)
export function UserInviteForm({ shops }: { shops: ShopOption[] }) {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  const [role, setRole] = useState<string>("KAM");
  const needsShop = role === "SHOP_ADMIN" || role === "SHOP_MANAGER";

  return (
    <form action={action} className="space-y-3 rounded-md border p-4">
      <h2 className="text-sm font-semibold">Inviter un utilisateur</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="invite-email" className="text-xs">
            Email
          </Label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="prenom@exemple.ci"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role" className="text-xs">
            Rôle
          </Label>
          <select
            id="invite-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputCls}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-shop" className="text-xs">
            Boutique {needsShop ? "(obligatoire)" : "(sans objet)"}
          </Label>
          <select
            id="invite-shop"
            name="shopId"
            disabled={!needsShop}
            required={needsShop}
            className={inputCls + (needsShop ? "" : " opacity-50")}
          >
            <option value="">— choisir —</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Un email d&apos;invitation est envoyé : l&apos;utilisateur définit lui-même son mot de passe (lien
        valable 7 jours). Le compte reste inactif jusque-là.
      </p>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.result && <p className="text-xs text-emerald-600">{state.result}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Envoi..." : "Créer et envoyer l'invitation"}
      </Button>
    </form>
  );
}
