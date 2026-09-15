// Labels et variantes UI des statuts produit (partagés page liste / fiche / table).

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_QC: "En validation",
  ACTIVE: "Actif",
  REJECTED: "Rejeté",
  DELISTED: "Retiré",
  DELETION_PENDING: "Suppression en attente",
};

export const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "PENDING_QC", label: "En validation" },
  { value: "ACTIVE", label: "Actif" },
  { value: "REJECTED", label: "Rejeté" },
  { value: "DELISTED", label: "Retiré" },
  { value: "DELETION_PENDING", label: "Suppression en attente" },
];

export type StatusVariant = "default" | "secondary" | "outline";

export const STATUS_VARIANT: Record<string, StatusVariant> = {
  ACTIVE: "default",
  PENDING_QC: "secondary",
  REJECTED: "outline",
  DELISTED: "outline",
  DELETION_PENDING: "outline",
  DRAFT: "secondary",
};
