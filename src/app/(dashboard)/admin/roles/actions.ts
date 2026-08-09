"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PERMISSION_NAMES } from "@/lib/rbac-constants";
import type { Role } from "@/generated/prisma/enums";

// L'admin (ou qui a roles.manage) coche les permissions de chaque rôle.
export async function updateRolePermissionsAction(formData: FormData): Promise<void> {
  try {
    await requirePermissionDb("roles.manage");

    const roles = ["SUPER_ADMIN", "KAM", "SHOP_ADMIN", "SHOP_MANAGER"] as Role[];
    for (const role of roles) {
      for (const permission of PERMISSION_NAMES) {
        const granted = formData.get(`perm_${role}_${permission}`) === "on";
        await prisma.rolePermission.upsert({
          where: { role_permission: { role, permission } },
          update: { granted },
          create: { role, permission, granted },
        });
      }
    }

    revalidatePath("/admin/roles");
  } catch (e) {
    console.error("updateRolePermissionsAction:", e);
  }
}
