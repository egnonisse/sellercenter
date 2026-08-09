import { prisma } from "@/lib/prisma";

// Référentiel marques : retrouve ou crée une marque par nom
export async function getOrCreateBrand(name: string): Promise<string> {
  const clean = name.trim();
  if (!clean) return "";
  const existing = await prisma.brand.findUnique({ where: { name: clean } });
  if (existing) return existing.id;
  const created = await prisma.brand.create({ data: { name: clean } });
  return created.id;
}

// Toutes les marques (pour le formulaire)
export async function listBrands() {
  return prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
