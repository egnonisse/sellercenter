"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerSeller, type RegisterState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerSeller,
    undefined,
  );

  if (state?.success) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Compte créé !</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Votre demande d&apos;inscription est en attente de validation par l&apos;équipe
            Zariamall. Vous recevrez un accès dès activation.
          </p>
          <Link href="/login">
            <Button className="mt-6 w-full" variant="outline">
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Devenir vendeur</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ouvrez votre boutique sur Zariamall
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" name="name" placeholder="Ex : Kouassi Jean" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="vous@boutique.ci"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone (WhatsApp)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+225 07 00 00 00 00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopName">Nom de la boutique</Label>
            <Input id="shopName" name="shopName" placeholder="Ex : Tech Abidjan" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="8 caractères minimum"
              autoComplete="new-password"
              required
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Création du compte..." : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
