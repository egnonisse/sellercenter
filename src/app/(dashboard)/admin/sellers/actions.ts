"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import { approveSeller, rejectSeller, suspendSeller, activateSeller } from "@/lib/sellers";

export async function approveSellerAction(sellerId: string) {
  await requirePermissionDb("sellers.approve");
  await approveSeller(sellerId);
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
