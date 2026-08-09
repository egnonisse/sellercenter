"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importProductsAction, type ImportState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ImportHistoryRow = {
  id: string;
  type: string;
  fileName: string;
  created: number;
  updated: number;
  failed: number;
  createdAt: Date;
};

const IMPORT_TYPES = [
  { value: "CREATION", label: "Création de produits", hint: "nom, catégorie, prix, stock... (sans slug → nouveau produit)" },
  { value: "UPDATE", label: "Mise à jour", hint: "modifie les produits existants (repasse en brouillon)" },
  { value: "STOCK", label: "Stock uniquement", hint: "colonnes : slug, sku, stock" },
  { value: "PRICE", label: "Prix uniquement", hint: "colonnes : slug, sku, price, compare_at_price, dates promo" },
];

const TYPE_LABEL: Record<string, string> = {
  CREATION: "Création",
  UPDATE: "Mise à jour",
  STOCK: "Stock",
  PRICE: "Prix",
};

export function ImportClient({ history }: { history: ImportHistoryRow[] }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importProductsAction,
    undefined,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importer des produits</h1>
        <p className="text-sm text-muted-foreground">
          Choisissez un type d&apos;import, téléchargez le template correspondant puis envoyez
          votre fichier CSV.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/api/products/export">
          <Button type="button" variant="outline" size="sm">
            Exporter mes produits (CSV)
          </Button>
        </Link>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label>Type d&apos;import</Label>
          <div className="space-y-2">
            {IMPORT_TYPES.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  defaultChecked={t.value === "CREATION"}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/api/products/template?type=CREATION">
            <Button type="button" variant="outline" size="sm">
              Template création
            </Button>
          </Link>
          <Link href="/api/products/template?type=UPDATE">
            <Button type="button" variant="outline" size="sm">
              Template mise à jour
            </Button>
          </Link>
          <Link href="/api/products/template?type=STOCK">
            <Button type="button" variant="outline" size="sm">
              Template stock
            </Button>
          </Link>
          <Link href="/api/products/template?type=PRICE">
            <Button type="button" variant="outline" size="sm">
              Template prix
            </Button>
          </Link>
        </div>

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
              Import terminé : {state.result.created} créé(s), {state.result.updated} mis à jour,
              {state.result.failed} en erreur
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

      {history.length > 0 && (
        <div className="rounded-md border">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Historique des imports
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Fichier</th>
                <th className="px-4 py-2 font-medium">Créés</th>
                <th className="px-4 py-2 font-medium">MàJ</th>
                <th className="px-4 py-2 font-medium">Erreurs</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{TYPE_LABEL[h.type] ?? h.type}</td>
                  <td className="max-w-[160px] truncate px-4 py-2">{h.fileName}</td>
                  <td className="px-4 py-2">{h.created}</td>
                  <td className="px-4 py-2">{h.updated}</td>
                  <td className={`px-4 py-2 ${h.failed > 0 ? "text-red-600" : ""}`}>{h.failed}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleDateString("fr-FR")}{" "}
                    {new Date(h.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
