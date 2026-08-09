"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { markAllRead } from "@/lib/notifications";

export async function markAllReadAction() {
  try {
    const user = await requirePermission("products.manage");
    if (!user.shopId) return;
    await markAllRead(user.shopId);
    revalidatePath("/notifications");
    return {};
  } catch (e) {
    console.error("markAllReadAction:", e);
    return { error: "Erreur." };
  }
}
