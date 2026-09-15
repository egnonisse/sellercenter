"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  submitProductAction,
  delistProductAction,
  bulkProductsAction,
  bulkEditProductsAction,
  duplicateProductAction,
} from "@/app/(dashboard)/products/actions";
import { LOW_STOCK_THRESHOLD, productQualityScore } from "@/lib/product-quality";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/product-ui";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  ean: string | null;
  brand: string | null;
  description: string | null;
  categoryName: string;
  price: number;
  stockQty: number;
  status: string;
  syncStatus: string;
  syncError: string | null;
  images: string[];
  attributes: unknown;
  createdAt: string;
};

export type QueryState = Record<string, string | undefined>;

export type PageInfo = { page: number; perPage: number; total: number };

const STORAGE_KEY = "sc_products_columns";
const ALL_COLUMNS = [
  "image",
  "name",
  "sku",
  "ean",
  "category",
  "brand",
  "price",
  "stock",
  "status",
  "quality",
  "actions",
] as const;
const DEFAULT_COLUMNS = ["image", "name", "sku", "category", "price", "stock", "status", "actions"];
const SORTABLE: Record<string, string> = { name: "Nom", price: "Prix", stockQty: "Stock", createdAt: "Créé le" };

function loadColumns(): string[] {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    return ALL_COLUMNS.filter((c) => parsed.includes(c));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function withParams(query: QueryState, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...query, ...overrides })) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `/products?${s}` : "/products";
}

function QualityCell({ p }: { p: ProductRow }) {
  const q = productQualityScore({
    name: p.name,
    description: p.description,
    images: p.images,
    brand: p.brand,
    ean: p.ean,
    attributes: (p.attributes as {
      color?: string | null;
      size?: string | null;
      warranty?: string | null;
      custom?: { key: string; value: string }[] | null;
    } | null) ?? null,
    price: p.price,
  });
  const color =
    q.score >= 80 ? "text-emerald-600" : q.score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <span
      className={`text-xs font-semibold ${color}`}
      title={q.checks.filter((c) => !c.ok).map((c) => c.label).join(" · ") || "Annonce complète"}
    >
      {q.score}/100
    </span>
  );
}

export function ProductsTable({
  products,
  isGlobal,
  syncDelay,
  query,
  pageInfo,
}: {
  products: ProductRow[];
  isGlobal: boolean;
  syncDelay: string;
  query: QueryState;
  pageInfo: PageInfo;
}) {
  const [cols, setCols] = useState<string[]>(loadColumns());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editState, editAction, editPending] = useActionState(bulkEditProductsAction, undefined);

  function toggleCol(key: string) {
    setCols((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage indisponible (SSR/privé) : on garde l'état en mémoire
      }
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))));
  }

  const show = (key: string) => cols.includes(key);
  const sort = query.sort ?? "";
  const dir = query.dir === "asc" ? "asc" : "desc";
  const start = pageInfo.total === 0 ? 0 : (pageInfo.page - 1) * pageInfo.perPage + 1;
  const end = Math.min(pageInfo.page * pageInfo.perPage, pageInfo.total);
  const isLowStock = (p: ProductRow) => p.stockQty <= LOW_STOCK_THRESHOLD;

  return (
    <div className="space-y-3">
      {/* Barre bulk actions + édition en masse */}
      {!isGlobal && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <form action={bulkProductsAction} className="flex items-center gap-2">
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <Button type="submit" name="bulkAction" value="submit" size="sm" variant="outline" disabled={selected.size === 0}>
              Soumettre la sélection ({selected.size})
            </Button>
            <Button type="submit" name="bulkAction" value="delist" size="sm" variant="outline" disabled={selected.size === 0}>
              Retirer la sélection
            </Button>
          </form>

          <form action={editAction} className="flex flex-wrap items-center gap-2">
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Modifier en masse
              </summary>
              <div className="mt-2 grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-5">
                <input
                  name="bulkPrice"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Nouveau prix FCFA"
                  className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
                />
                <input
                  name="bulkCompareAt"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Ancien prix (promo)"
                  className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
                />
                <input
                  name="bulkStock"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Nouveau stock"
                  className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
                />
                <input
                  name="bulkSaleStart"
                  type="date"
                  className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
                />
                <input
                  name="bulkSaleEnd"
                  type="date"
                  className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
                />
                <div className="sm:col-span-2 lg:col-span-5">
                  <Button type="submit" size="sm" disabled={selected.size === 0 || editPending}>
                    {editPending ? "Application..." : "Appliquer aux produits cochés"}
                  </Button>
                  {editState?.error && <span className="ml-2 text-xs text-red-600">{editState.error}</span>}
                  <span className="ml-2 text-xs text-muted-foreground">
                    champs laissés vides = inchangés · les produits repassent en validation
                  </span>
                </div>
              </div>
            </details>
          </form>

          {/* Colonnes configurables */}
          <details className="ml-auto text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Gérer les colonnes
            </summary>
            <div className="absolute z-10 mt-2 grid w-56 gap-1 rounded-md border bg-background p-3 shadow-md">
              {ALL_COLUMNS.filter((c) => c !== "actions" && c !== "image").map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                  <input
                    type="checkbox"
                    checked={cols.includes(c)}
                    onChange={() => toggleCol(c)}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  {c === "name" ? "Nom" : c === "sku" ? "SKU" : c === "ean" ? "EAN" : c === "quality" ? "Qualité" : c}
                </label>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Tri */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Trier :</span>
        {Object.entries(SORTABLE).map(([key, label]) => {
          const active = sort === key;
          const nextDir = active && dir === "asc" ? "desc" : "asc";
          return (
            <Link
              key={key}
              href={withParams(query, { sort: key, dir: nextDir, page: undefined })}
              className={`rounded-full px-2 py-0.5 ${active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
            >
              {label} {active ? (dir === "asc" ? "↑" : "↓") : ""}
            </Link>
          );
        })}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {!isGlobal && show("image") && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selected.size === products.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input"
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
              )}
              {show("image") && <TableHead className="w-12">Image</TableHead>}
              {show("name") && <TableHead>Nom</TableHead>}
              {show("sku") && <TableHead>SKU</TableHead>}
              {show("ean") && <TableHead>EAN</TableHead>}
              {show("category") && <TableHead>Catégorie</TableHead>}
              {show("brand") && <TableHead>Marque</TableHead>}
              {show("price") && <TableHead>Prix (FCFA)</TableHead>}
              {show("stock") && <TableHead>Stock</TableHead>}
              {show("status") && <TableHead>Statut</TableHead>}
              {show("quality") && <TableHead>Qualité</TableHead>}
              {show("actions") && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={cols.length + 1}
                  className="py-8 text-center text-muted-foreground"
                >
                  Aucun produit avec ces critères.{" "}
                  {!isGlobal && (
                    <Link href="/products/new" className="underline">
                      Ajoutez votre premier produit
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id}>
                {!isGlobal && show("image") && (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="h-4 w-4 rounded border-input"
                      aria-label={`Sélectionner ${p.name}`}
                    />
                  </TableCell>
                )}
                {show("image") && (
                  <TableCell>
                    {p.images[0] ? (
                      <img
                        src={p.images[0]}
                        alt=""
                        className="h-10 w-10 rounded-md border object-contain"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
                        ∅
                      </div>
                    )}
                  </TableCell>
                )}
                {show("name") && (
                  <TableCell className="max-w-[260px] font-medium">
                    <Link href={`/products/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                    {p.syncStatus === "PENDING" && (
                      <div className="text-[10px] text-amber-600">Passe en ligne dans {syncDelay}</div>
                    )}
                    {p.syncStatus === "ERROR" && (
                      <div className="text-[10px] text-red-600" title={p.syncError ?? undefined}>
                        Erreur de synchronisation
                      </div>
                    )}
                  </TableCell>
                )}
                {show("sku") && <TableCell className="text-xs text-muted-foreground">{p.sku || "—"}</TableCell>}
                {show("ean") && <TableCell className="text-xs text-muted-foreground">{p.ean || "—"}</TableCell>}
                {show("category") && <TableCell>{p.categoryName}</TableCell>}
                {show("brand") && <TableCell className="text-xs">{p.brand || "—"}</TableCell>}
                {show("price") && <TableCell>{Number(p.price).toLocaleString("fr-FR")}</TableCell>}
                {show("stock") && (
                  <TableCell>
                    <span className={isLowStock(p) ? "font-semibold text-amber-600" : ""}>
                      {p.stockQty}
                    </span>
                    {isLowStock(p) && (
                      <Badge variant="outline" className="ml-1 border-amber-300 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-400">
                        faible
                      </Badge>
                    )}
                  </TableCell>
                )}
                {show("status") && (
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                )}
                {show("quality") && (
                  <TableCell>
                    <QualityCell p={p} />
                  </TableCell>
                )}
                {show("actions") && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!isGlobal && p.status !== "DELISTED" && p.status !== "DELETION_PENDING" && (
                        <>
                          <Link href={`/products/${p.id}/edit`}>
                            <Button type="button" size="sm" variant="outline">
                              Modifier
                            </Button>
                          </Link>
                          {p.status === "DRAFT" || p.status === "REJECTED" ? (
                            <form action={submitProductAction.bind(null, p.id)}>
                              <Button type="submit" size="sm">
                                Soumettre
                              </Button>
                            </form>
                          ) : (
                            <form action={delistProductAction.bind(null, p.id)}>
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  if (!confirm("Retirer ce produit du shop public ?")) e.preventDefault();
                                }}
                              >
                                Retirer
                              </Button>
                            </form>
                          )}
                          <form action={duplicateProductAction.bind(null, p.id)}>
                            <Button type="submit" size="sm" variant="ghost" title="Dupliquer (copie en brouillon)">
                              Dupliquer
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pageInfo.total > pageInfo.perPage && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {start}–{end} sur {pageInfo.total}
          </span>
          <div className="flex gap-2">
            <Link href={withParams(query, { page: String(pageInfo.page - 1) })}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pageInfo.page <= 1}
                aria-disabled={pageInfo.page <= 1}
              >
                ← Précédent
              </Button>
            </Link>
            <Link href={withParams(query, { page: String(pageInfo.page + 1) })}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={end >= pageInfo.total}
                aria-disabled={end >= pageInfo.total}
              >
                Suivant →
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
