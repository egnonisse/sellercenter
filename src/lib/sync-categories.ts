// Synchronisation des catégories WooCommerce ↔ SellerCenter.
// - Import (WC → SellerCenter) : idempotent, mappage parent/enfant par wooId.
// - Poussée (SellerCenter → WC) : les catégories sans wooId sont créées côté WooCommerce.
// Aucune suppression : on ajoute / on met à jour, jamais on détruit (les produits référencent les catégories).

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  wooCreateCategory,
  wooGetCategoryBySlug,
  wooListAllCategories,
  wooUpdateCategory,
} from "@/lib/woocommerce";

export type CategorySyncResult = {
  total: number;
  created: number;
  updated: number;
  errors: number;
};

// ---------------------------------------------------------------------------
// Import WooCommerce → SellerCenter
// ---------------------------------------------------------------------------

async function upsertCategoryFromWoo(
  wc: { id: number; name: string; slug: string; parent: number },
  parentLocalId: string | null,
): Promise<{ id: string; created: boolean }> {
  // 1. Existe déjà par wooId → mise à jour (name, slug, parent)
  const byWoo = await prisma.category.findUnique({ where: { wooId: wc.id } });
  if (byWoo) {
    await prisma.category.update({
      where: { id: byWoo.id },
      data: { name: wc.name, slug: wc.slug, parentId: parentLocalId },
    });
    return { id: byWoo.id, created: false };
  }

  // 2. Même slug localement (catégorie créée côté SellerCenter) → on la lie à WooCommerce
  const bySlug = await prisma.category.findUnique({ where: { slug: wc.slug } });
  if (bySlug) {
    await prisma.category.update({
      where: { id: bySlug.id },
      data: { wooId: wc.id, name: wc.name, parentId: parentLocalId },
    });
    return { id: bySlug.id, created: false };
  }

  // 3. Nouvelle catégorie
  const created = await prisma.category.create({
    data: { wooId: wc.id, name: wc.name, slug: wc.slug, parentId: parentLocalId },
  });
  return { id: created.id, created: true };
}

export async function syncCategoriesFromWoo(): Promise<CategorySyncResult> {
  const wooCats = await wooListAllCategories();
  const result: CategorySyncResult = { total: wooCats.length, created: 0, updated: 0, errors: 0 };

  // Pré-charge les wooId déjà connus localement : les parents existants sont résolus immédiatement
  const localWithWoo = await prisma.category.findMany({
    where: { wooId: { not: null } },
    select: { id: true, wooId: true },
  });
  const idByWoo = new Map<number, string>();
  for (const c of localWithWoo) if (c.wooId) idByWoo.set(c.wooId, c.id);

  // Passe 1 : racines (les parents doivent exister avant les enfants)
  for (const wc of wooCats) {
    if (wc.parent) continue;
    try {
      const { id, created } = await upsertCategoryFromWoo(wc, null);
      idByWoo.set(wc.id, id);
      if (created) result.created++;
      else result.updated++;
    } catch (e) {
      result.errors++;
      console.error(`syncCategoriesFromWoo (racine ${wc.name}):`, e);
    }
  }

  // Passe 2 : enfants, en itérant tant qu'il y a des progrès (hiérarchies profondes)
  const children = wooCats.filter((wc) => wc.parent);
  let remaining = children;
  for (let round = 0; round < 10 && remaining.length > 0; round++) {
    const next: typeof remaining = [];
    for (const wc of remaining) {
      const parentLocalId = idByWoo.get(wc.parent);
      if (!parentLocalId) {
        next.push(wc); // parent pas encore résolu — nouvelle tentative au tour suivant
        continue;
      }
      try {
        const { id, created } = await upsertCategoryFromWoo(wc, parentLocalId);
        idByWoo.set(wc.id, id);
        if (created) result.created++;
        else result.updated++;
      } catch (e) {
        result.errors++;
        console.error(`syncCategoriesFromWoo (enfant ${wc.name}):`, e);
      }
    }
    remaining = next;
  }
  result.errors += remaining.length;
  for (const wc of remaining) {
    console.error(`syncCategoriesFromWoo: parent ${wc.parent} non résolu pour ${wc.name}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Poussée SellerCenter → WooCommerce
// ---------------------------------------------------------------------------

// Crée (ou réutilise par slug) une catégorie côté WooCommerce, stocke le wooId.
export async function pushCategoryToWoo(categoryId: string): Promise<{ wooId: number; created: boolean }> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: { select: { wooId: true } } },
  });
  if (!category) throw new Error("CATEGORIE_INTROUVABLE");

  const payload: Record<string, unknown> = { name: category.name };
  if (category.slug !== slugify(category.name)) payload.slug = category.slug;
  if (category.parent?.wooId) payload.parent = category.parent.wooId;

  const bySlug = await wooGetCategoryBySlug(category.slug);
  let wooId: number;
  let created: boolean;
  if (bySlug) {
    wooId = bySlug.id;
    created = false;
    await wooUpdateCategory(wooId, payload);
  } else {
    const createdCat = await wooCreateCategory(payload);
    wooId = createdCat.id;
    created = true;
  }

  await prisma.category.update({ where: { id: category.id }, data: { wooId } });
  return { wooId, created };
}

// Pousse toutes les catégories locales sans wooId (racines d'abord, puis enfants).
export async function pushCategoriesToWoo(): Promise<CategorySyncResult> {
  const local = await prisma.category.findMany({
    where: { wooId: null },
    include: { parent: { select: { wooId: true } } },
  });
  const result: CategorySyncResult = { total: local.length, created: 0, updated: 0, errors: 0 };

  const push = async (id: string) => {
    try {
      const { created } = await pushCategoryToWoo(id);
      if (created) result.created++;
      else result.updated++;
    } catch (e) {
      result.errors++;
      console.error(`pushCategoriesToWoo(${id}):`, e);
    }
  };

  // Passe 1 : racines ; passe 2 : enfants (parent poussé avant)
  for (const cat of local.filter((c) => !c.parentId)) await push(cat.id);
  for (const cat of local.filter((c) => c.parentId)) await push(cat.id);

  return result;
}

// Création locale + poussée immédiate vers WooCommerce (formulaire admin).
export async function createCategoryAndPush(data: {
  name: string;
  parentId?: string | null;
  commissionRate?: number | null;
}): Promise<{ id: string; wooId: number | null }> {
  const name = data.name.trim();
  if (!name) throw new Error("NOM_REQUIS");

  const slug = await uniqueCategorySlug(slugify(name));
  const category = await prisma.category.create({
    data: {
      name,
      slug,
      parentId: data.parentId || null,
      commissionRate: data.commissionRate ?? null,
    },
  });

  let wooId: number | null = null;
  try {
    const res = await pushCategoryToWoo(category.id);
    wooId = res.wooId;
  } catch (e) {
    // La création locale est conservée (elle pourra être poussée plus tard)
    console.error(`createCategoryAndPush: poussée WC échouée pour ${name}`, e);
  }
  return { id: category.id, wooId };
}

async function uniqueCategorySlug(base: string): Promise<string> {
  const root = base || "categorie";
  const existing = await prisma.category.findMany({
    where: { slug: { startsWith: root } },
    select: { slug: true },
  });
  if (!existing.some((c) => c.slug === root)) return root;
  return `${root}-${existing.length + 1}`;
}
