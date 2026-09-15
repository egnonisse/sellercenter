"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { updateCategoryCommissionsAction } from "@/app/(dashboard)/admin/settings/actions";
import type { CommissionNode } from "@/lib/commission-tree";

const inputCls =
  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-950";

// <details> avec état initial contrôlé mais toggle natif préservé (onToggle).
function Details({ open: initialOpen, children }: { open: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      {children}
    </details>
  );
}

// Un nœud (ou l'un de ses descendants) correspond-il aux filtres actifs ?
function nodeMatches(node: CommissionNode, q: string, onlyCustom: boolean): boolean {
  const self =
    (q === "" || node.name.toLowerCase().includes(q)) && (!onlyCustom || node.ownRate !== null);
  return self || node.children.some((c) => nodeMatches(c, q, onlyCustom));
}

function countCategories(node: CommissionNode): number {
  return 1 + node.children.reduce((acc, c) => acc + countCategories(c), 0);
}

function NodeRow({
  node,
  q,
  onlyCustom,
  depth,
}: {
  node: CommissionNode;
  q: string;
  onlyCustom: boolean;
  depth: number;
}) {
  const selfMatch =
    (q === "" || node.name.toLowerCase().includes(q)) && (!onlyCustom || node.ownRate !== null);
  const visibleChildren = node.children.filter((c) => nodeMatches(c, q, onlyCustom));
  if (!selfMatch && visibleChildren.length === 0) return null;

  const hasChildren = visibleChildren.length > 0;
  const inherited = node.ownRate === null;

  const row = (
    <div className="flex items-center gap-2" style={{ paddingLeft: depth * 18 }}>
      <span className="min-w-0 flex-1 truncate text-sm">{node.name}</span>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
          inherited
            ? "bg-muted text-muted-foreground"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
        }`}
        title={inherited ? "Taux hérité (parent ou défaut)" : "Taux propre"}
      >
        {node.effectiveRate}%
      </span>
      <input
        name={`rate_${node.id}`}
        type="number"
        min="0"
        max="100"
        step="0.1"
        defaultValue={node.ownRate ?? ""}
        placeholder={String(node.effectiveRate)}
        title="Laisser vide pour hériter du parent / du défaut"
        className="w-20 shrink-0 rounded-md border border-border bg-transparent px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950"
      />
    </div>
  );

  if (!hasChildren) return row;

  return (
    <Details open={!selfMatch}>
      <summary className="cursor-pointer rounded-md px-1 py-0.5 hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span className="mr-1 text-[10px] text-muted-foreground group-open:hidden">▶</span>
        <span className="mr-1 hidden text-[10px] text-muted-foreground group-open:inline">▼</span>
        {row}
      </summary>
      <div className="ml-3 mt-1 space-y-1 border-l border-border pl-2">
        {visibleChildren.map((c) => (
          <NodeRow key={c.id} node={c} q={q} onlyCustom={onlyCustom} depth={depth + 1} />
        ))}
      </div>
    </Details>
  );
}

// Vue arborescente des commissions par catégorie : taux effectif + réglage direct.
// Les catégories masquées par la recherche/filtre ne sont pas soumises → inchangées.
export function CategoryCommissionTree({
  tree,
  defaultRate,
}: {
  tree: CommissionNode[];
  defaultRate: number;
}) {
  const [q, setQ] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const total = tree.reduce((acc, n) => acc + countCategories(n), 0);

  return (
    <form action={updateCategoryCommissionsAction} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.toLowerCase())}
          placeholder={`Rechercher parmi ${total} catégories...`}
          className={inputCls + " max-w-xs"}
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyCustom}
            onChange={(e) => setOnlyCustom(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Taux personnalisés uniquement
        </label>
        <Button type="submit" size="sm" className="ml-auto">
          Enregistrer les taux
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Taux effectif = taux réglé → héritage du parent → défaut ({defaultRate}%). Laisser vide =
        hériter. Badge <span className="font-medium text-emerald-600">vert</span> = taux propre,{" "}
        <span className="font-medium">gris</span> = hérité.
      </p>
      <div
        key={`${q}|${onlyCustom}`}
        className="max-h-[520px] space-y-1 overflow-y-auto rounded-md border p-2"
      >
        {tree.map((n) => (
          <NodeRow key={n.id} node={n} q={q} onlyCustom={onlyCustom} depth={0} />
        ))}
        {tree.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucune catégorie. Importez d&apos;abord les catégories depuis WooCommerce.
          </p>
        )}
      </div>
    </form>
  );
}
