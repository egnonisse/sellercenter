"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/require-role";
import { approveSeller, rejectSeller } from "@/lib/sellers";

export async function approveSellerAction(sellerId: string) {
  await requireRole(["SUPER_ADMIN"]);
  await approveSeller(sellerId);
  revalidatePath("/admin/sellers");
}

export async function rejectSellerAction(sellerId: string) {
  await requireRole(["SUPER_ADMIN"]);
  await rejectSeller(sellerId);
  revalidatePath("/admin/sellers");
}
