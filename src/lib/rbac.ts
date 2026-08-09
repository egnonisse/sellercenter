import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SENSITIVE_PERMISSIONS } from "@/lib/rbac-constants";
import type { Role } from "@/generated/prisma/enums";

export { PERMISSIONS, PERMISSION_NAMES, DEFAULT_ROLE_PERMISSIONS, SENSITIVE_PERMISSIONS, type AppRole } from "@/lib/rbac-constants";
export { loadPermissionsForRole, listRolePermissions } from "@/lib/load-permissions";

// Vérifie une permission depuis la session (JWT). Jette une erreur si absente.
export async function requirePermission(permission: string) {
  const session = await auth();
  const perms: string[] = session?.user?.permissions ?? [];
  if (!session?.user || !perms.includes(permission)) {
    throw new Error("ACCES_REFUSE");
  }
  return session.user;
}

// Vérifie une permission en base (garde-fou pour les actions sensibles) :
// la session peut être périmée (JWT), la DB est la source de vérité.
export async function requirePermissionDb(permission: string) {
  const session = await auth();
  if (!session?.user) throw new Error("NON_CONNECTE");
  const granted = await prisma.rolePermission.findUnique({
    where: { role_permission: { role: session.user.role as Role, permission } },
  });
  if (!granted?.granted) throw new Error("ACCES_REFUSE");
  return session.user;
}

export const hasPermission = (permissions: string[] | undefined, permission: string) =>
  (permissions ?? []).includes(permission);

// Vérifie si la permission est sensible (re-vérification DB requise)
export const isSensitive = (permission: string) => SENSITIVE_PERMISSIONS.has(permission);
