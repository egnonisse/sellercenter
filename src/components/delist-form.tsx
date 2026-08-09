"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { DELIST_REASONS } from "@/lib/qc-reasons";

type DelistAction = (
  productId: string,
  prevState: { error?: string } | undefined,
  formData: FormData,
) => Promise<{ error?: string } | undefined>;

export function DelistForm({ productId, action }: { productId: string; action: DelistAction }) {
  const [state, formAction, pending] = useActionState(action.bind(null, productId), undefined);

  return (
    <form action={formAction} className="space-y-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Retirer le produit du shop public</p>
      <select
        name="reason"
        defaultValue=""
        required
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950"
      >
        <option value="" disabled>
          Raison du retrait...
        </option>
        {DELIST_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        name="comment"
        placeholder="Commentaire (optionnel)"
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950"
      />
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Retrait..." : "Confirmer le retrait"}
      </Button>
    </form>
  );
}
