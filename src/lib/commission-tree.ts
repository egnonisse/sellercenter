// Arbre des commissions par catégorie avec taux effectifs calculés.
// Taux effectif = taux propre → héritage parent (récursif) → défaut global.

import { prisma } from "@/lib/prisma";

export type CommissionNode = {
  id: string;
  name: string;
  parentId: string | null;
  ownRate: number | null; // taux réglé sur la catégorie (null = hérite)
  effectiveRate: number; // taux réellement appliqué (après héritage)
  children: CommissionNode[];
};

// Charge toutes les catégories et calcule le taux effectif de chacune (une passe).
export async function loadCommissionTree(): Promise<{ defaultRate: number; tree: CommissionNode[] }> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const defaultRate = settings?.defaultCommissionRate ?? 10;

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const nodes = new Map<string, CommissionNode>();
  for (const c of categories) {
    nodes.set(c.id, {
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      ownRate: c.commissionRate,
      effectiveRate: defaultRate, // provisoire, recalculé ci-dessous
      children: [],
    });
  }

  // Construction de l'arbre
  const roots: CommissionNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Taux effectif par propagation (parents avant enfants)
  const visit = (node: CommissionNode, inherited: number) => {
    node.effectiveRate = node.ownRate ?? inherited;
    for (const child of node.children) visit(child, node.effectiveRate);
  };
  for (const root of roots) visit(root, defaultRate);

  return { defaultRate, tree: roots };
}
