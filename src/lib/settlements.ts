import { prisma } from "@/lib/prisma";

// ===================== Commissions =====================

// Taux de commission d'une catégorie : son taux → héritage parent → défaut global
export async function getCommissionRate(categoryId: string): Promise<number> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const def = settings?.defaultCommissionRate ?? 10;

  let cat = await prisma.category.findUnique({ where: { id: categoryId } });
  let guard = 0;
  while (cat) {
    if (cat.commissionRate !== null) return cat.commissionRate;
    if (!cat.parentId) break;
    cat = await prisma.category.findUnique({ where: { id: cat.parentId } });
    if (++guard > 20) break;
  }
  return def;
}

// ===================== Relevés (Settlements) =====================

// Génère le relevé d'UNE boutique pour une période (commandes DELIVERED).
// Idempotent : un relevé existant pour la même période n'est pas dupliqué.
export async function generateSettlement(shopId: string, periodStart: Date, periodEnd: Date) {
  const existing = await prisma.settlement.findFirst({
    where: {
      shopId,
      periodStart: { gte: periodStart },
      periodEnd: { lte: periodEnd },
    },
  });
  if (existing) return existing;

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        shopId,
        status: "DELIVERED",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    },
    include: { product: true },
  });
  if (items.length === 0) return null;

  let grossSales = 0;
  let commission = 0;
  const lines = [];

  for (const item of items) {
    // Taux figé au moment de la vente (webhook) ; fallback pour les items antérieurs à cette feature
    const rate = item.commissionRate ?? (await getCommissionRate(item.product.categoryId));
    const gross = Number(item.total);
    const comm = (gross * rate) / 100;
    grossSales += gross;
    commission += comm;
    lines.push({ orderItemId: item.id, gross, commission: comm, net: gross - comm });
  }

  return prisma.settlement.create({
    data: {
      shopId,
      periodStart,
      periodEnd,
      grossSales,
      commission,
      netPayable: grossSales - commission,
      status: "OPEN",
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

// Génère les relevés de toutes les boutiques actives pour une période.
export async function generateAllSettlements(periodStart: Date, periodEnd: Date) {
  const shops = await prisma.shop.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const results = [];
  for (const s of shops) {
    const r = await generateSettlement(s.id, periodStart, periodEnd);
    if (r) results.push(r);
  }
  return results;
}

// Relevés selon le périmètre : `null` = toutes les boutiques (admin),
// un tableau = les boutiques du périmètre (portefeuille KAM ou boutique du vendeur).
export async function listSettlements(shopIds: string[] | null) {
  return prisma.settlement.findMany({
    where: shopIds ? { shopId: { in: shopIds } } : undefined,
    orderBy: { periodEnd: "desc" },
    include: { shop: { select: { name: true } }, _count: { select: { lines: true } } },
  });
}

// Relevés groupés par boutique (vue admin)
export async function listSettlementsByShop() {
  const settlements = await prisma.settlement.findMany({
    orderBy: { periodEnd: "desc" },
    include: { shop: { select: { name: true } } },
  });
  const byShop: Record<string, typeof settlements> = {};
  for (const s of settlements) {
    (byShop[s.shop.name] ??= []).push(s);
  }
  return byShop;
}
