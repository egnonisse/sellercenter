"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { approveProduct, rejectProduct, confirmProductDeletion, restoreProduct } from "@/lib/products";
import { logProductHistory } from "@/lib/product-history";
import { createNotification } from "@/lib/notifications";
import { syncPendingProducts } from "@/lib/sync";

// Déclenche la synchronisation WooCommerce (bouton admin)
export async function syncNowAction() {
  try {
    await requirePermissionDb("products.sync");
    const result = await syncPendingProducts();
    console.log("syncNowAction:", result.total, "traité(s),", result.synced, "ok,", result.failed, "échec(s)");
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return {};
  } catch (e) {
    console.error("syncNowAction:", e);
    return { error: "Erreur lors de la synchronisation." };
  }
}

export async function approveProductAction(productId: string) {
  try {
    const user = await requirePermissionDb("products.qc");
    // On ne publie pas les produits d'une boutique non validée (ou suspendue)
    const target = await prisma.product.findUnique({
      where: { id: productId },
      select: { shop: { select: { status: true, name: true } } },
    });
    if (!target) return { error: "Produit introuvable." };
    if (target.shop.status !== "ACTIVE") {
      return {
        error: `La boutique « ${target.shop.name} » n'est pas validée : approuvez le vendeur avant ses produits.`,
      };
    }
    const product = await approveProduct(productId);
    await logProductHistory({ productId, action: "APPROVED", to: "ACTIVE", actorUserId: user.id });
    await createNotification({
      shopId: product.shopId,
      type: "PRODUCT_APPROVED",
      title: "Produit validé",
      message: `« ${product.name} » est maintenant actif sur la vitrine.`,
    });
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return {};
  } catch (e) {
    console.error("approveProductAction:", e);
    return { error: "Erreur lors de l'approbation." };
  }
}

// Rejet motivé : raison structurée + note libre
export async function rejectProductAction(
  productId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  try {
    const user = await requirePermissionDb("products.qc");
    const reason = String(formData.get("reason") ?? "");
    const note = String(formData.get("note") ?? "");
    if (!reason) return { error: "Choisissez une raison de rejet." };
    const product = await rejectProduct(productId, reason, note);
    await logProductHistory({
      productId,
      action: "REJECTED",
      to: "REJECTED",
      note: `${reason}${note ? ` — ${note}` : ""}`,
      actorUserId: user.id,
    });
    await createNotification({
      shopId: product.shopId,
      type: "PRODUCT_REJECTED",
      title: "Produit rejeté",
      message: `« ${product.name} » : ${reason}${note ? ` — ${note}` : ""}`,
    });
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return {};
  } catch (e) {
    console.error("rejectProductAction:", e);
    return { error: "Erreur lors du rejet." };
  }
}

// Confirmation admin de la suppression d'un produit en retention
export async function confirmDeletionAction(productId: string) {
  try {
    const user = await requirePermissionDb("products.qc");
    await confirmProductDeletion(productId);
    await logProductHistory({
      productId,
      action: "DELETED",
      to: "DELETED",
      actorUserId: user.id,
    }).catch(() => {}); // l'historique est supprimé avec le produit — le log peut échouer
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return {};
  } catch (e) {
    console.error("confirmDeletionAction:", e);
    return { error: "Erreur lors de la suppression." };
  }
}

// Restauration admin d'un produit en retention
export async function restoreProductAction(productId: string) {
  try {
    const user = await requirePermissionDb("products.qc");
    await restoreProduct(productId);
    await logProductHistory({ productId, action: "RESTORED", to: "DRAFT", actorUserId: user.id });
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return {};
  } catch (e) {
    console.error("restoreProductAction:", e);
    return { error: "Erreur lors de la restauration." };
  }
}
