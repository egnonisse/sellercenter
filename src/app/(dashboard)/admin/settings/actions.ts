"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  syncCategoriesFromWoo,
  pushCategoriesToWoo,
  createCategoryAndPush,
} from "@/lib/sync-categories";
import { recordRateChange, closeActiveRate } from "@/lib/commission-history";
import { syncBrandsFromWoo } from "@/lib/sync-brands";

export type CategoryActionState = { error?: string; result?: string } | undefined;

// Commission par défaut de la plateforme
export async function updateDefaultCommissionAction(formData: FormData): Promise<void> {
  try {
    const user = await requirePermissionDb("settings.manage");
    const rate = Number(formData.get("defaultCommissionRate") ?? "");
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;
    const before = await prisma.settings.findUnique({ where: { id: "global" } });
    await prisma.settings.upsert({
      where: { id: "global" },
      update: { defaultCommissionRate: rate },
      create: { id: "global", defaultCommissionRate: rate },
    });
    // Journalise uniquement si le taux a réellement changé
    if (before?.defaultCommissionRate !== rate) {
      await recordRateChange(null, rate, user.id);
    }
    revalidatePath("/admin/settings");
  } catch (e) {
    console.error("updateDefaultCommissionAction:", e);
  }
}

// Taux par catégorie (vide = hérite du parent / du défaut)
// Ne met à jour QUE les catégories présentes dans le formulaire : les catégories
// masquées par la recherche/filtre ne sont pas soumises → leurs taux restent inchangés.
export async function updateCategoryCommissionsAction(formData: FormData): Promise<void> {
  try {
    const user = await requirePermissionDb("settings.manage");
    const entries: { id: string; rate: number | null }[] = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("rate_")) continue;
      const id = key.slice(5);
      const raw = String(value).trim();
      const rate = raw === "" ? null : Number(raw);
      if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return;
      entries.push({ id, rate });
    }
    if (entries.length === 0) return;

    // Taux actuels en une requête (évite le N+1)
    const cats = await prisma.category.findMany({
      where: { id: { in: entries.map((e) => e.id) } },
      select: { id: true, commissionRate: true },
    });
    const catMap = new Map(cats.map((c) => [c.id, c.commissionRate]));

    for (const e of entries) {
      const oldRate = catMap.get(e.id);
      if (oldRate === undefined || oldRate === e.rate) continue; // inchangé
      await prisma.category.update({ where: { id: e.id }, data: { commissionRate: e.rate } });
      if (e.rate === null) {
        await closeActiveRate(e.id); // passage à « hérite »
      } else {
        await recordRateChange(e.id, e.rate, user.id);
      }
    }
    revalidatePath("/admin/settings");
  } catch (e) {
    console.error("updateCategoryCommissionsAction:", e);
  }
}

// Import des catégories WooCommerce → SellerCenter (idempotent)
export async function syncCategoriesAction(_prev: CategoryActionState): Promise<CategoryActionState> {
  try {
    await requirePermissionDb("settings.manage");
    const r = await syncCategoriesFromWoo();
    revalidatePath("/admin/settings");
    return { result: `${r.total} catégories traitées · ${r.created} créées · ${r.updated} mises à jour${r.errors ? ` · ${r.errors} erreurs` : ""}` };
  } catch (e) {
    console.error("syncCategoriesAction:", e);
    return { error: "Synchronisation impossible. Vérifier la connexion WooCommerce." };
  }
}

// Poussée des catégories locales sans wooId → WooCommerce
export async function pushCategoriesAction(_prev: CategoryActionState): Promise<CategoryActionState> {
  try {
    await requirePermissionDb("settings.manage");
    const r = await pushCategoriesToWoo();
    revalidatePath("/admin/settings");
    return { result: `${r.total} catégorie(s) à pousser · ${r.created} créées · ${r.updated} liées${r.errors ? ` · ${r.errors} erreurs` : ""}` };
  } catch (e) {
    console.error("pushCategoriesAction:", e);
    return { error: "Poussée impossible. Vérifier la connexion WooCommerce." };
  }
}

// Création d'une catégorie côté SellerCenter + poussée immédiate vers WooCommerce
export async function createCategoryAction(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  try {
    const user = await requirePermissionDb("settings.manage");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Nom requis." };
    const parentId = String(formData.get("parentId") ?? "") || null;
    const rawCommission = String(formData.get("commissionRate") ?? "").trim();
    const commissionRate = rawCommission === "" ? null : Number(rawCommission);
    if (commissionRate !== null && (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)) {
      return { error: "Commission invalide." };
    }
    const { id: categoryId, wooId } = await createCategoryAndPush({ name, parentId, commissionRate });
    // Journalise le taux propre si la catégorie en a un
    if (commissionRate !== null) {
      await recordRateChange(categoryId, commissionRate, user.id);
    }
    revalidatePath("/admin/settings");
    return {
      result: wooId
        ? `Catégorie « ${name} » créée et synchronisée (WooCommerce id ${wooId}).`
        : `Catégorie « ${name} » créée localement (poussée WooCommerce à refaire).`,
    };
  } catch (e) {
    console.error("createCategoryAction:", e);
    return { error: "Création impossible." };
  }
}

// Import des marques WooCommerce (taxonomie product_brand) → SellerCenter
export async function syncBrandsAction(_prev: CategoryActionState): Promise<CategoryActionState> {
  try {
    await requirePermissionDb("settings.manage");
    const r = await syncBrandsFromWoo();
    revalidatePath("/admin/settings");
    return {
      result: `${r.total} marques traitées · ${r.created} créées · ${r.updated} liées/mises à jour${r.errors ? ` · ${r.errors} erreurs` : ""}`,
    };
  } catch (e) {
    console.error("syncBrandsAction:", e);
    return { error: "Synchronisation des marques impossible. Vérifier WP_USER / WP_APP_PASSWORD." };
  }
}
