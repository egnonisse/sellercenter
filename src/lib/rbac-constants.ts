// Constantes RBAC — aucun import externe (utilisables par le seed et le runtime)

export const PERMISSIONS: { name: string; label: string; group: string }[] = [
  { name: "products.manage", label: "Gérer ses produits", group: "Produits" },
  { name: "products.manage_all", label: "Gérer les produits de toutes les boutiques", group: "Produits" },
  { name: "products.qc", label: "Valider / rejeter les produits (QC)", group: "Produits" },
  { name: "products.sync", label: "Synchroniser vers WooCommerce", group: "Produits" },
  { name: "sellers.read", label: "Voir tous les vendeurs", group: "Vendeurs" },
  { name: "sellers.approve", label: "Approuver / rejeter les inscriptions", group: "Vendeurs" },
  { name: "sellers.suspend", label: "Suspendre / activer un vendeur", group: "Vendeurs" },
  { name: "orders.read", label: "Voir les commandes de sa boutique", group: "Commandes" },
  { name: "orders.manage", label: "Changer le statut des commandes", group: "Commandes" },
  { name: "orders.read_all", label: "Voir les commandes de toutes les boutiques", group: "Commandes" },
  { name: "orders.manage_all", label: "Gérer les commandes de toutes les boutiques", group: "Commandes" },
  { name: "finance.read_all", label: "Voir les finances de toutes les boutiques", group: "Finances" },
  { name: "finance.manage_all", label: "Gérer les relevés (marquer payé)", group: "Finances" },
  { name: "settings.manage", label: "Configurer la plateforme", group: "Plateforme" },
  { name: "roles.manage", label: "Gérer les rôles & permissions", group: "Plateforme" },
];

export const PERMISSION_NAMES = PERMISSIONS.map((p) => p.name);

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [...PERMISSION_NAMES],
  KAM: [
    "products.manage_all",
    "sellers.read",
    "sellers.suspend",
    "orders.read_all",
    "orders.manage_all",
    "finance.read_all",
  ],
  SHOP_ADMIN: ["products.manage", "orders.read", "orders.manage", "finance.read_all"],
  SHOP_MANAGER: ["products.manage", "orders.read", "orders.manage"],
};

// Actions sensibles : re-vérifiées en base (pas seulement le JWT) — garde-fou
export const SENSITIVE_PERMISSIONS = new Set([
  "products.qc",
  "sellers.suspend",
  "sellers.approve",
  "roles.manage",
  "products.sync",
]);

export type AppRole = "SUPER_ADMIN" | "KAM" | "SHOP_ADMIN" | "SHOP_MANAGER";
