"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { REJECT_REASONS } from "@/lib/qc-reasons";

type RejectAction = (
  productId: string,
  prevState: { error?: string } | undefined,
  formData: FormData,
) => Promise<{ error?: string } | undefined>;

export function RejectForm({ productId, action }: { productId: string; action: RejectAction }) {
  const [state, formAction, pending] = useActionState(action.bind(null, productId), undefined);

  return (
    <form action={formAction} className="space-y-2">
      <select
        name="reason"
        defaultValue=""
        required
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950"
      >
        <option value="" disabled>
          Raison du rejet...
        </option>
        {REJECT_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        name="note"
        placeholder="Commentaire (optionnel)"
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950"
      />
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Rejet..." : "Rejeter"}
      </Button>
    </form>
  );
}
