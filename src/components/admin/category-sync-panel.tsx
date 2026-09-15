"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  syncCategoriesAction,
  pushCategoriesAction,
  createCategoryAction,
  syncBrandsAction,
} from "@/app/(dashboard)/admin/settings/actions";

type CategoryOption = { id: string; name: string; parentName: string | null };

const inputCls =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-950";

// Panneau de synchronisation des catégories WooCommerce ↔ SellerCenter
// (import, poussée, création locale synchronisée)
export function CategorySyncPanel({ categories }: { categories: CategoryOption[] }) {
  const [syncState, syncAction, syncPending] = useActionState(syncCategoriesAction, undefined);
  const [pushState, pushAction, pushPending] = useActionState(pushCategoriesAction, undefined);
  const [createState, createAction, createPending] = useActionState(createCategoryAction, undefined);
  const [brandState, brandAction, brandPending] = useActionState(syncBrandsAction, undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form action={syncAction}>
          <Button type="submit" size="sm" variant="outline" disabled={syncPending}>
            {syncPending ? "Synchronisation..." : "Importer / mettre à jour les catégories (WooCommerce)"}
          </Button>
        </form>
        <form action={brandAction}>
          <Button type="submit" size="sm" variant="outline" disabled={brandPending}>
            {brandPending ? "Import marques..." : "Importer les marques (WooCommerce)"}
          </Button>
        </form>
        <form action={pushAction}>
          <Button type="submit" size="sm" variant="outline" disabled={pushPending}>
            {pushPending ? "Poussée..." : "Pousser les nouvelles catégories vers WooCommerce"}
          </Button>
        </form>
      </div>
      {syncState?.error && <p className="text-xs text-red-600">{syncState.error}</p>}
      {syncState?.result && <p className="text-xs text-emerald-600">{syncState.result}</p>}
      {brandState?.error && <p className="text-xs text-red-600">{brandState.error}</p>}
      {brandState?.result && <p className="text-xs text-emerald-600">{brandState.result}</p>}
      {pushState?.error && <p className="text-xs text-red-600">{pushState.error}</p>}
      {pushState?.result && <p className="text-xs text-emerald-600">{pushState.result}</p>}

      <form action={createAction} className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="cat-name" className="text-xs">
            Nouvelle catégorie
          </Label>
          <input id="cat-name" name="name" required placeholder="Ex : Électroménager" className={inputCls} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cat-parent" className="text-xs">
            Catégorie parente
          </Label>
          <select id="cat-parent" name="parentId" className={inputCls}>
            <option value="">— Aucune (racine) —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentName ? `${c.parentName} → ${c.name}` : c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cat-rate" className="text-xs">
            Commission % (optionnel)
          </Label>
          <div className="flex gap-2">
            <input
              id="cat-rate"
              name="commissionRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="hérite"
              className={inputCls}
            />
            <Button type="submit" size="sm" disabled={createPending}>
              {createPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </div>
        {createState?.error && <p className="text-xs text-red-600 sm:col-span-3">{createState.error}</p>}
        {createState?.result && <p className="text-xs text-emerald-600 sm:col-span-3">{createState.result}</p>}
      </form>
    </div>
  );
}
