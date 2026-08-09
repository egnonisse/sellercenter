"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/require-role";
import { approveProduct, rejectProduct, confirmProductDeletion, restoreProduct } from "@/lib/products";
import { logProductHistory } from "@/lib/product-history";
import { syncPendingProducts } from "@/lib/sync";

// Déclenche la synchronisation WooCommerce (bouton admin)
export async function syncNowAction() {
  try {
    await requireRole(["SUPER_ADMIN"]);
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
    const user = await requireRole(["SUPER_ADMIN"]);
    await approveProduct(productId);
    await logProductHistory({ productId, action: "APPROVED", to: "ACTIVE", actorUserId: user.id });
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
    const user = await requireRole(["SUPER_ADMIN"]);
    const reason = String(formData.get("reason") ?? "");
    const note = String(formData.get("note") ?? "");
    if (!reason) return { error: "Choisissez une raison de rejet." };
    await rejectProduct(productId, reason, note);
    await logProductHistory({
      productId,
      action: "REJECTED",
      to: "REJECTED",
      note: `${reason}${note ? ` — ${note}` : ""}`,
      actorUserId: user.id,
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
    const user = await requireRole(["SUPER_ADMIN"]);
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
    const user = await requireRole(["SUPER_ADMIN"]);
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
