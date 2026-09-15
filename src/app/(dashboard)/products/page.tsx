import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveShopScope, scopeFilter } from "@/lib/shop-assignment";
import { Button } from "@/components/ui/button";
import { loadCategoryOptions } from "@/lib/products";
import { formatSyncDelay } from "@/lib/sync-timing";
import { STATUS_FILTERS } from "@/lib/product-ui";
import {
  buildProductOrderBy,
  buildProductWhere,
  expandCategoryIds,
  parsePagination,
  type ProductListParams,
} from "@/lib/product-query";
import { ProductsTable, type ProductRow, type QueryState } from "@/components/products/products-table";

const inputCls =
  "rounded-md border border-border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring dark:bg-zinc-950";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductListParams>;
}) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Périmètre de visibilité : admin = tout · KAM = son portefeuille · vendeur = sa boutique
  const scope = await resolveShopScope({
    id: session.user.id,
    role: session.user.role,
    shopId: session.user.shopId,
  });
  const isGlobal = scope.isGlobal;
  const scopeWhere = scopeFilter(scope);
  const q = params.q?.trim() ?? "";

  const categoryIds = await expandCategoryIds(params.categoryId);
  const [categories, countByStatus, totalFiltered, rejectionStats] = await Promise.all([
    loadCategoryOptions(),
    prisma.product.groupBy({
      by: ["status"],
      where: scopeWhere,
      _count: true,
    }),
    prisma.product.count({
      where: buildProductWhere(scopeWhere, params, categoryIds),
    }),
    prisma.product.groupBy({
      by: ["qcReason"],
      where: { ...scopeWhere, status: "REJECTED", qcReason: { not: null } },
      _count: true,
      orderBy: { _count: { qcReason: "desc" } },
      take: 5,
    }),
  ]);

  const where = buildProductWhere(scopeWhere, params, categoryIds);
  const pageInfo = parsePagination(params, totalFiltered);

  const products = await prisma.product.findMany({
    where,
    orderBy: buildProductOrderBy(params),
    include: { category: { select: { name: true } } },
    skip: pageInfo.skip,
    take: pageInfo.take,
  });

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    ean: p.ean,
    brand: p.brand,
    description: p.description,
    categoryName: p.category.name,
    price: Number(p.price),
    stockQty: p.stockQty,
    status: p.status,
    syncStatus: p.syncStatus,
    syncError: p.syncError,
    images: Array.isArray(p.images) ? (p.images as { url: string }[]).map((i) => i.url) : [],
    attributes: p.attributes,
    createdAt: p.createdAt.toISOString(),
  }));

  const countByStatusMap: Record<string, number> = {};
  for (const c of countByStatus) countByStatusMap[c.status] = c._count;
  const totalAll = countByStatus.reduce((acc, c) => acc + c._count, 0);
  const syncDelay = formatSyncDelay();

  const query: QueryState = {
    status: params.status || undefined,
    q: q || undefined,
    category: params.categoryId || undefined,
    brand: params.brand || undefined,
    priceMin: params.priceMin || undefined,
    priceMax: params.priceMax || undefined,
    stockMax: params.stockMax || undefined,
    hasImage: params.hasImage || undefined,
    sort: params.sort || undefined,
    dir: params.dir || undefined,
    page: params.page || undefined,
    perPage: params.perPage || undefined,
  };

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...query, ...overrides })) if (v) merged.set(k, v);
    const s = merged.toString();
    return s ? `/products?${s}` : "/products";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestion des produits</h1>
          <p className="text-sm text-muted-foreground">
            {totalFiltered} produit(s)
            {q && ` · recherche « ${q} »`}
            {pageInfo.total > pageInfo.perPage && ` · page ${pageInfo.page}`}
          </p>
        </div>
        {!isGlobal && (
          <div className="flex gap-2">
            <Link href="/products/import">
              <Button type="button" variant="outline" size="sm">
                Importer
              </Button>
            </Link>
            <Link href="/api/products/export">
              <Button type="button" variant="outline" size="sm">
                Exporter CSV
              </Button>
            </Link>
            <Link href="/products/new">
              <Button>Ajouter un produit</Button>
            </Link>
          </div>
        )}
      </div>

      {/* KPI produits (pattern Jumia getProductKpis) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total produits", value: totalAll, accent: false },
          { label: "Actifs", value: countByStatusMap.ACTIVE ?? 0, accent: true },
          { label: "En validation", value: countByStatusMap.PENDING_QC ?? 0, accent: false },
          { label: "Rejetés", value: countByStatusMap.REJECTED ?? 0, accent: false },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-md border p-3 ${kpi.accent ? "border-primary/40 bg-primary/5" : ""}`}
          >
            <div className={`text-2xl font-semibold ${kpi.accent ? "text-primary" : ""}`}>{kpi.value}</div>
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Stats rejets (pattern : comprendre pourquoi mes produits sont rejetés) */}
      {rejectionStats.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <strong>Pourquoi mes produits sont rejetés ?</strong>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
            {rejectionStats.map((r) => (
              <li key={r.qcReason}>
                {r.qcReason} ({r._count})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtres statut (pills) */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = (params.status ?? "") === f.value;
          const count = f.value ? countByStatusMap[f.value] ?? 0 : totalAll;
          return (
            <Link
              key={f.value || "all"}
              href={buildHref({ status: f.value || undefined, page: undefined })}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f.label}
              <span className="ml-1 text-xs opacity-70">({count})</span>
            </Link>
          );
        })}
      </div>

      {/* Recherche + filtres avancés */}
      <form method="GET" action="/products" className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">
              Rechercher (nom, SKU, EAN, marque)
            </label>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Ex : GLTV5 ou 5901234123457..."
              className={inputCls + " w-full"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Catégorie</label>
            <select name="categoryId" defaultValue={params.categoryId ?? ""} className={inputCls}>
              <option value="">Toutes</option>
              {categories.map((cat) => (
                <optgroup key={cat.id} label={cat.name}>
                  {cat.children.length > 0 ? (
                    cat.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))
                  ) : (
                    <option value={cat.id}>{cat.name}</option>
                  )}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Marque</label>
            <input name="brand" defaultValue={params.brand ?? ""} placeholder="Ex : Samsung" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prix min</label>
            <input name="priceMin" type="number" min="0" defaultValue={params.priceMin ?? ""} placeholder="0" className={inputCls + " w-28"} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prix max</label>
            <input name="priceMax" type="number" min="0" defaultValue={params.priceMax ?? ""} placeholder="∞" className={inputCls + " w-28"} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Stock ≤</label>
            <input name="stockMax" type="number" min="0" defaultValue={params.stockMax ?? ""} placeholder="faible" className={inputCls + " w-24"} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Images</label>
            <select name="hasImage" defaultValue={params.hasImage ?? ""} className={inputCls}>
              <option value="">Tous</option>
              <option value="yes">Avec image</option>
              <option value="no">Sans image</option>
            </select>
          </div>
          <Button type="submit" size="sm" variant="outline">
            Filtrer
          </Button>
          {Object.values(query).some(Boolean) && (
            <Button type="button" size="sm" variant="ghost">
              <Link href="/products">Effacer</Link>
            </Button>
          )}
        </div>
      </form>

      <ProductsTable
        products={rows}
        isGlobal={isGlobal}
        syncDelay={syncDelay}
        query={query}
        pageInfo={pageInfo}
      />
    </div>
  );
}
