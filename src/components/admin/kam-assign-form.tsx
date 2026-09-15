"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { assignKamAction } from "@/app/(dashboard)/admin/sellers/actions";

type Kam = { id: string; email: string };

// Attribution d'une boutique à un chargé de comptes (KAM).
// Le KAM actuellement en poste est toujours proposé, même s'il n'est plus actif.
export function KamAssignForm({
  shopId,
  kams,
  currentKamId,
}: {
  shopId: string;
  kams: Kam[];
  currentKamId: string | null;
}) {
  const [state, formAction, pending] = useActionState(assignKamAction.bind(null, shopId), undefined);
  const options =
    currentKamId && !kams.some((k) => k.id === currentKamId)
      ? [...kams, { id: currentKamId, email: "KAM actuel (désactivé)" }]
      : kams;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        name="kamUserId"
        defaultValue={currentKamId ?? ""}
        className="h-7 rounded-md border border-border bg-transparent px-1.5 text-xs"
      >
        <option value="">— Aucun —</option>
        {options.map((k) => (
          <option key={k.id} value={k.id}>
            {k.email}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Attribuer"}
      </Button>
      {state?.error && <span className="text-[11px] text-red-600">{state.error}</span>}
      {state?.result && <span className="text-[11px] text-green-700">{state.result}</span>}
    </form>
  );
}
