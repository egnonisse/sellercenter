"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export type PromotionState = { error?: string } | undefined;

// Création d'une promotion (réduction % ou fixe) sur des produits de la boutique
export async function createPromotionAction(formData: FormData): Promise<void> {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return;

    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "PERCENTAGE");
    const value = Number(formData.get("value") ?? "");
    const startAt = String(formData.get("startAt") ?? "");
    const endAt = String(formData.get("endAt") ?? "");
    const productIds = formData.getAll("productIds").map(String);

    if (name.length < 2 || !Number.isFinite(value) || value <= 0 || !startAt || !endAt) return;
    if (type === "PERCENTAGE" && value > 100) return;
    if (new Date(endAt) <= new Date(startAt)) return;
    if (productIds.length === 0) return;

    // Vérifier que les produits appartiennent à la boutique
    const owned = await prisma.product.count({
      where: { id: { in: productIds }, shopId: user.shopId },
    });
    if (owned !== productIds.length) return;

    await prisma.promotion.create({
      data: {
        shopId: user.shopId,
        name,
        type,
        value,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        status: "DRAFT",
        products: { create: productIds.map((productId) => ({ productId })) },
      },
    });
    revalidatePath("/promotions");
  } catch (e) {
    console.error("createPromotionAction:", e);
  }
}

// Termine une promotion
export async function endPromotionAction(promotionId: string) {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return { error: "Boutique introuvable." };
    const promo = await prisma.promotion.findFirst({
      where: { id: promotionId, shopId: user.shopId },
    });
    if (!promo) return { error: "Promotion introuvable." };
    await prisma.promotion.update({
      where: { id: promotionId },
      data: { status: "ENDED" },
    });
    revalidatePath("/promotions");
    return {};
  } catch (e) {
    console.error("endPromotionAction:", e);
    return { error: "Erreur." };
  }
}
