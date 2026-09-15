"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermissionDb } from "@/lib/rbac";
import { approveSeller, rejectSeller, suspendSeller, activateSeller } from "@/lib/sellers";
import { assignShopToKam, unassignShop } from "@/lib/shop-assignment";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export type AssignState = { error?: string; result?: string } | undefined;

const ASSIGN_ERRORS: Record<string, string> = {
  KAM_INTROUVABLE: "Ce chargé de comptes est introuvable.",
  ROLE_NON_KAM: "Cet utilisateur n'a pas le rôle de chargé de comptes (KAM).",
  KAM_INACTIF: "Ce chargé de comptes est désactivé.",
  BOUTIQUE_INTROUVABLE: "Boutique introuvable.",
  DEJA_ASSIGNE: "Cette boutique est déjà attribuée à ce chargé de comptes.",
  AUCUNE_AFFECTATION: "Aucun chargé de comptes n'est actuellement attribué à cette boutique.",
  ACTEUR_INVALIDE: "Session incomplète : reconnectez-vous puis réessayez.",
};

function toAssignMessage(e: unknown, fallback: string): string {
  const code = e instanceof Error ? e.message : "";
  if (ASSIGN_ERRORS[code]) return ASSIGN_ERRORS[code];
  if (e instanceof z.ZodError) return `Données invalides : ${e.issues[0]?.message ?? "valeur refusée"}`;
  return code && code.length <= 120 ? `${fallback} [${code}]` : fallback;
}

// Attribution d'une boutique à un KAM (ou retrait si aucun KAM sélectionné)
export async function assignKamAction(
  shopId: string,
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  try {
    const actor = await requirePermissionDb("shops.assign");
    const kamUserId = String(formData.get("kamUserId") ?? "");
    if (!kamUserId) {
      await unassignShop(shopId, actor.id);
      revalidatePath("/admin/sellers");
      return { result: "Chargé de comptes retiré." };
    }
    const res = await assignShopToKam(shopId, kamUserId, actor.id);
    revalidatePath("/admin/sellers");
    return {
      result: res.replaced ? `« ${res.shop} » réattribuée à ${res.kam}.` : `« ${res.shop} » attribuée à ${res.kam}.`,
    };
  } catch (e) {
    console.error("assignKamAction:", e);
    return { error: toAssignMessage(e, "Attribution impossible.") };
  }
}

export async function approveSellerAction(sellerId: string) {
  await requirePermissionDb("sellers.approve");
  await approveSeller(sellerId);
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (seller) {
    const shop = await prisma.shop.findFirst({ where: { sellerId } });
    if (shop) {
      await createNotification({
        shopId: shop.id,
        type: "SELLER_APPROVED",
        title: "Boutique validée",
        message: "Votre boutique est active. Vous pouvez créer vos produits.",
      });
    }
  }
  revalidatePath("/admin/sellers");
}

export async function rejectSellerAction(sellerId: string) {
  await requirePermissionDb("sellers.approve");
  await rejectSeller(sellerId);
  revalidatePath("/admin/sellers");
}

// Suspension (KAM / admin) : bloque le login + coupe la boutique
export async function suspendSellerAction(sellerId: string) {
  await requirePermissionDb("sellers.suspend");
  await suspendSeller(sellerId);
  revalidatePath("/admin/sellers");
}

// Réactivation (KAM / admin)
export async function activateSellerAction(sellerId: string) {
  await requirePermissionDb("sellers.suspend");
  await activateSeller(sellerId);
  revalidatePath("/admin/sellers");
}
