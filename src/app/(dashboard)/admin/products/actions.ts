"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/require-role";
import { approveProduct, rejectProduct } from "@/lib/products";

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
