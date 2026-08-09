// Raisons structurées (pattern Jumia : rejectionReasons, delistReason)

export const REJECT_REASONS = [
  "Photos non conformes ou manquantes",
  "Prix invalide ou incohérent",
  "Description incomplète",
  "Catégorie incorrecte",
  "Marque non autorisée ou contrefaite",
  "Stock indisponible",
  "Nom du produit non conforme",
  "Autre",
] as const;

export const DELIST_REASONS = [
  "Produit en rupture définitive",
  "Produit remplacé",
  "Prix à revoir",
  "Image à corriger",
  "Erreur de saisie",
  "Autre",
] as const;
