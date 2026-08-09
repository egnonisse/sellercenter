"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

// Commission par défaut de la plateforme
export async function updateDefaultCommissionAction(formData: FormData): Promise<void> {
  try {
    await requirePermissionDb("settings.manage");
    const rate = Number(formData.get("defaultCommissionRate") ?? "");
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;
    await prisma.settings.upsert({
      where: { id: "global" },
      update: { defaultCommissionRate: rate },
      create: { id: "global", defaultCommissionRate: rate },
    });
    revalidatePath("/admin/settings");
  } catch (e) {
    console.error("updateDefaultCommissionAction:", e);
  }
}

// Taux par catégorie (vide = hérite du parent / du défaut)
export async function updateCategoryCommissionsAction(formData: FormData): Promise<void> {
  try {
    await requirePermissionDb("settings.manage");
    const categories = await prisma.category.findMany({ select: { id: true } });
    for (const c of categories) {
      const raw = String(formData.get(`rate_${c.id}`) ?? "").trim();
      const rate = raw === "" ? null : Number(raw);
      if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) continue;
      await prisma.category.update({
        where: { id: c.id },
        data: { commissionRate: rate },
      });
    }
    revalidatePath("/admin/settings");
  } catch (e) {
    console.error("updateCategoryCommissionsAction:", e);
  }
}
