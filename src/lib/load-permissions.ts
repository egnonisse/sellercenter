import { prisma } from "@/lib/prisma";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_NAMES } from "@/lib/rbac-constants";
import type { Role } from "@/generated/prisma/enums";

// Charge les permissions d'un rôle (au login, pour le JWT)
export async function loadPermissionsForRole(role: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: role as Role, granted: true },
    select: { permission: true },
  });
  if (rows.length > 0) return rows.map((r) => r.permission);
  // Aucune ligne : retombe sur les défauts (seed pas encore passé)
  return DEFAULT_ROLE_PERMISSIONS[role] ?? [];
}

// Liste les permissions groupées pour la page d'administration
export async function listRolePermissions() {
  const rows = await prisma.rolePermission.findMany();
  const map: Record<string, Record<string, boolean>> = {};
  for (const role of ["SUPER_ADMIN", "KAM", "SHOP_ADMIN", "SHOP_MANAGER"]) {
    map[role] = {};
    for (const p of PERMISSION_NAMES) {
      map[role][p] = false;
    }
  }
  for (const r of rows) {
    if (map[r.role]) map[r.role][r.permission] = r.granted;
  }
  return map;
}
