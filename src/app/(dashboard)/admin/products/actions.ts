"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/require-role";
import { approveProduct, rejectProduct } from "@/lib/products";
import { syncPendingProducts } from "@/lib/sync";

export async function approveProductAction(productId: string) {
  await requireRole(["SUPER_ADMIN"]);
  await approveProduct(productId);
  revalidatePath("/admin/products");
}

export async function rejectProductAction(productId: string, note: string) {
  await requireRole(["SUPER_ADMIN"]);
  await rejectProduct(productId, note);
  revalidatePath("/admin/products");
}

export async function syncNowAction(): Promise<{ result?: string; error?: string }> {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const result = await syncPendingProducts();
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { result: `${result.synced} synchronisé(s), ${result.failed} en échec` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur de synchronisation" };
  }
}
