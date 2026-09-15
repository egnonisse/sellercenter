// Constantes UI utilisateurs (partagées client/serveur — aucune dépendance serveur).

export const ASSIGNABLE_ROLES = ["KAM", "SHOP_ADMIN", "SHOP_MANAGER"] as const;

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Admin",
  KAM: "KAM",
  SHOP_ADMIN: "Responsable boutique",
  SHOP_MANAGER: "Employé boutique",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Actif",
  INVITED: "Invitation en attente",
  SUSPENDED: "Désactivé",
};

export const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  INVITED: "secondary",
  SUSPENDED: "outline",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

export function userStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
