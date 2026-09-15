// Historique des taux de commission : audit (qui/quand/old→new) + validité bi-temporelle.
// Une ligne = un taux appliqué sur une période ; la ligne active a validTo = null.
// categoryId null = taux global (Settings.defaultCommissionRate).

import { prisma } from "@/lib/prisma";

// Ferme la ligne active (si elle existe) et crée la nouvelle période.
// À appeler APRÈS la mise à jour de Category.commissionRate / Settings.defaultCommissionRate.
export async function recordRateChange(
  categoryId: string | null,
  newRate: number,
  actorUserId?: string | null,
) {
  const now = new Date();

  // 1. Fermer la ligne active éventuelle (même taux ou non — on journalise chaque période)
  await prisma.commissionRateHistory.updateMany({
    where: { categoryId: categoryId ?? null, validTo: null },
    data: { validTo: now },
  });

  // 2. Créer la nouvelle période
  await prisma.commissionRateHistory.create({
    data: {
      categoryId: categoryId ?? null,
      rate: newRate,
      validFrom: now,
      validTo: null,
      actorUserId: actorUserId ?? null,
    },
  });
}

// Ferme la ligne active d'une catégorie (passage à « hérite » : plus de taux propre).
export async function closeActiveRate(categoryId: string) {
  await prisma.commissionRateHistory.updateMany({
    where: { categoryId, validTo: null },
    data: { validTo: new Date() },
  });
}

// Taux effectif à une date donnée (consultation rétroactive).
// Retourne le taux de la ligne active à cette date, sinon null (aucune ligne enregistrée).
export async function getRateAt(categoryId: string | null, date: Date): Promise<number | null> {
  const line = await prisma.commissionRateHistory.findFirst({
    where: {
      categoryId: categoryId ?? null,
      validFrom: { lte: date },
      OR: [{ validTo: null }, { validTo: { gte: date } }],
    },
    orderBy: { validFrom: "desc" },
  });
  return line?.rate ?? null;
}

export type RateHistoryEntry = {
  id: string;
  rate: number;
  validFrom: Date;
  validTo: Date | null;
  categoryName: string | null; // null = taux global
  actorEmail: string | null;
};

// Historique récent pour la vue admin (trié du plus récent au plus ancien).
export async function listRateHistory(take = 50): Promise<RateHistoryEntry[]> {
  const rows = await prisma.commissionRateHistory.findMany({
    orderBy: { validFrom: "desc" },
    take,
    include: {
      category: { select: { name: true } },
      actor: { select: { email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    rate: r.rate,
    validFrom: r.validFrom,
    validTo: r.validTo,
    categoryName: r.category?.name ?? null,
    actorEmail: r.actor?.email ?? null,
  }));
}
