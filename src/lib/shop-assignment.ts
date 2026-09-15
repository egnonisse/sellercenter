// Affectation des boutiques aux KAM + calcul du périmètre de visibilité.
//
// Règle métier (décision LEO) :
//   - UN SEUL KAM responsable par boutique (les mandats précédents sont conservés)
//   - Cloisonnement STRICT : un KAM ne voit QUE son portefeuille
//   - Le SUPER_ADMIN voit tout ; un vendeur ne voit que sa boutique

import { prisma } from "@/lib/prisma";

export type ShopScope = {
  // true = aucune restriction (SUPER_ADMIN)
  isGlobal: boolean;
  // boutiques visibles (vide si aucune : le KAM sans portefeuille ne voit rien)
  shopIds: string[];
};

// Périmètre de visibilité d'un utilisateur connecté.
export async function resolveShopScope(user: {
  id: string;
  role: string;
  shopId: string | null;
}): Promise<ShopScope> {
  if (user.role === "SUPER_ADMIN") return { isGlobal: true, shopIds: [] };

  if (user.role === "KAM") {
    const rows = await prisma.shopAssignment.findMany({
      where: { kamUserId: user.id, unassignedAt: null },
      select: { shopId: true },
    });
    return { isGlobal: false, shopIds: rows.map((r) => r.shopId) };
  }

  return { isGlobal: false, shopIds: user.shopId ? [user.shopId] : [] };
}

// Filtre Prisma réutilisable : `{ shopId: ... }` selon le périmètre.
// Un périmètre vide doit renvoyer une condition impossible (jamais tout).
export function scopeFilter(scope: ShopScope): { shopId?: { in: string[] } } {
  if (scope.isGlobal) return {};
  return { shopId: { in: scope.shopIds } };
}

export function canAccessShop(scope: ShopScope, shopId: string | null | undefined): boolean {
  if (!shopId) return false;
  return scope.isGlobal || scope.shopIds.includes(shopId);
}

// ---------------------------------------------------------------------------
// Affectation (SUPER_ADMIN)
// ---------------------------------------------------------------------------

// Assigne une boutique à un KAM. Ferme le mandat en cours avant d'ouvrir le nouveau.
export async function assignShopToKam(shopId: string, kamUserId: string, actorUserId: string) {
  if (!actorUserId) throw new Error("ACTEUR_INVALIDE");

  const kam = await prisma.user.findUnique({
    where: { id: kamUserId },
    select: { role: true, status: true, email: true },
  });
  if (!kam) throw new Error("KAM_INTROUVABLE");
  if (kam.role !== "KAM") throw new Error("ROLE_NON_KAM");
  if (kam.status !== "ACTIVE") throw new Error("KAM_INACTIF");

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } });
  if (!shop) throw new Error("BOUTIQUE_INTROUVABLE");

  const current = await prisma.shopAssignment.findFirst({
    where: { shopId, unassignedAt: null },
    select: { id: true, kamUserId: true },
  });
  if (current?.kamUserId === kamUserId) throw new Error("DEJA_ASSIGNE");

  await prisma.$transaction([
    ...(current
      ? [
          prisma.shopAssignment.update({
            where: { id: current.id },
            data: { unassignedAt: new Date() },
          }),
        ]
      : []),
    prisma.shopAssignment.create({
      data: { shopId, kamUserId, assignedByUserId: actorUserId },
    }),
  ]);

  return { shop: shop.name, kam: kam.email, replaced: Boolean(current) };
}

// Retire le KAM en poste (la boutique redevient non affectée).
export async function unassignShop(shopId: string, actorUserId: string) {
  if (!actorUserId) throw new Error("ACTEUR_INVALIDE");
  const current = await prisma.shopAssignment.findFirst({
    where: { shopId, unassignedAt: null },
    select: { id: true },
  });
  if (!current) throw new Error("AUCUNE_AFFECTATION");
  await prisma.shopAssignment.update({
    where: { id: current.id },
    data: { unassignedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

// KAM actuellement responsable d'une boutique.
export async function getShopKam(shopId: string) {
  const row = await prisma.shopAssignment.findFirst({
    where: { shopId, unassignedAt: null },
    include: { kam: { select: { id: true, email: true, status: true } } },
  });
  return row?.kam ?? null;
}

// KAM disponibles (pour le sélecteur d'assignation).
export async function listActiveKams() {
  return prisma.user.findMany({
    where: { role: "KAM", status: "ACTIVE" },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });
}

// Boutiques du portefeuille d'un KAM, avec leurs indicateurs.
export async function listKamPortfolio(kamUserId: string) {
  return prisma.shop.findMany({
    where: { assignments: { some: { kamUserId, unassignedAt: null } } },
    include: {
      seller: { select: { name: true, email: true } },
      _count: { select: { products: { where: { status: "ACTIVE" } }, orders: true } },
    },
    orderBy: { name: "asc" },
  });
}

// Historique des affectations d'une boutique (qui, quand, par qui).
export async function listShopAssignmentHistory(shopId: string) {
  return prisma.shopAssignment.findMany({
    where: { shopId },
    include: {
      kam: { select: { email: true } },
      assignedBy: { select: { email: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

// Toutes les affectations actives (vue admin : qui suit quoi).
export async function listActiveAssignments() {
  return prisma.shopAssignment.findMany({
    where: { unassignedAt: null },
    include: { kam: { select: { id: true, email: true } } },
  });
}
