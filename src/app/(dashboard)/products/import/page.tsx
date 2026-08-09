"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importProductsAction, type ImportState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function ImportProductsPage() {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importProductsAction,
    undefined,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importer des produits</h1>
        <p className="text-sm text-muted-foreground">
          Format CSV identique à l&apos;export. Le champ{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">slug</code> permet de
          mettre à jour un produit existant de votre boutique ; sans slug, le produit est créé.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/api/products/template">
          <Button type="button" variant="outline" size="sm">
            Télécharger le template
          </Button>
        </Link>
        <Link href="/api/products/export">
          <Button type="button" variant="outline" size="sm">
            Exporter mes produits (CSV)
          </Button>
        </Link>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">Fichier CSV</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        {state?.result && (
          <div className="rounded-md border p-4 text-sm">
            <p className="font-medium">
              Import terminé : {state.result.created} créé(s), {state.result.updated} mis à jour
            </p>
            {state.result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-red-600">
                {state.result.errors.map((e, i) => (
                  <li key={i}>
                    Ligne {e.line} : {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Import en cours..." : "Importer"}
          </Button>
          <Link href="/products">
            <Button type="button" variant="outline">
              Retour
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
