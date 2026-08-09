"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export type ShopSettingsState = { error?: string } | undefined;

// Mise à jour des infos de la boutique
export async function updateShopAction(formData: FormData): Promise<void> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return;

    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 2) return;

    await prisma.shop.update({
      where: { id: user.shopId },
      data: {
        name,
        description: String(formData.get("description") ?? "") || null,
        logoUrl: String(formData.get("logoUrl") ?? "") || null,
      },
    });
    revalidatePath("/settings");
  } catch (e) {
    console.error("updateShopAction:", e);
  }
}

// Toggle mode vacances (pattern Jumia holidayMode)
export async function toggleHolidayAction() {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const shop = await prisma.shop.findUnique({ where: { id: user.shopId } });
    if (!shop) return { error: "Boutique introuvable." };
    await prisma.shop.update({
      where: { id: user.shopId },
      data: { holidayMode: !shop.holidayMode },
    });
    revalidatePath("/settings");
    return {};
  } catch (e) {
    console.error("toggleHolidayAction:", e);
    return { error: "Erreur." };
  }
}
