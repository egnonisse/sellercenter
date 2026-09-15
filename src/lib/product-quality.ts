// Qualité produit : score d'annonce, validation EAN/GTIN, seuil de stock bas.
// Calqué sur le pattern Jumia (score qualité d'annonce, barcodeEAN/gtinBarcode).

export const LOW_STOCK_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// EAN / GTIN
// ---------------------------------------------------------------------------

export function normalizeEan(raw: string): string {
  return raw.replace(/[\s-]/g, "").trim();
}

// Valide un code-barres EAN-8 / EAN-13 (checksum) ou GTIN-12 / GTIN-14 (numérique).
export function isValidEan(raw: string): boolean {
  const ean = normalizeEan(raw);
  if (!/^\d+$/.test(ean)) return false;
  if (ean.length === 13 || ean.length === 8) return checkDigitOk(ean);
  if (ean.length === 12 || ean.length === 14) return true; // UPC-A / GTIN-14 (pas de checksum vérifié ici)
  return false;
}

function checkDigitOk(ean: string): boolean {
  const digits = ean.split("").map(Number);
  const check = digits[digits.length - 1];
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const weight = i % 2 === 0 ? 1 : 3; // position impaire (1-based) → poids 3
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10 === check;
}

// ---------------------------------------------------------------------------
// Score qualité d'annonce (0-100)
// ---------------------------------------------------------------------------

export type QualityCheck = { label: string; ok: boolean };

export type QualityScore = {
  score: number;
  label: "Excellente" | "Correcte" | "À améliorer";
  checks: QualityCheck[];
};

type QualityInput = {
  name: string;
  description: string | null;
  images: unknown;
  brand: string | null;
  ean: string | null;
  attributes: { color?: string | null; size?: string | null; warranty?: string | null; custom?: { key: string; value: string }[] | null } | null;
  price: number | { toString(): string };
};

export function productQualityScore(p: QualityInput): QualityScore {
  const checks: QualityCheck[] = [
    { label: "Nom détaillé (10+ caractères)", ok: (p.name ?? "").trim().length >= 10 },
    { label: "Description complète (50+ caractères)", ok: (p.description ?? "").trim().length >= 50 },
    { label: "Au moins 1 image", ok: Array.isArray(p.images) && p.images.length > 0 },
    { label: "Marque renseignée", ok: Boolean(p.brand) },
    { label: "Code-barres EAN/GTIN renseigné", ok: Boolean(p.ean) },
    {
      label: "Caractéristiques renseignées",
      ok: Boolean(
        p.attributes &&
          (p.attributes.color || p.attributes.size || p.attributes.warranty ||
            (Array.isArray(p.attributes.custom) && p.attributes.custom.length > 0)),
      ),
    },
  ];

  // Pondération alignée sur ce qui compte pour la vitrine (total 100)
  const weights: [number, number][] = [
    [0, 10], // nom
    [1, 20], // description
    [2, 30], // image (le plus important pour le e-commerce)
    [3, 10], // marque
    [4, 15], // EAN
    [5, 15], // caractéristiques
  ];
  const score = weights.reduce((acc, [i, w]) => acc + (checks[i].ok ? w : 0), 0);
  const label: QualityScore["label"] = score >= 80 ? "Excellente" : score >= 50 ? "Correcte" : "À améliorer";
  return { score, label, checks };
}

export function qualityLabel(score: number): QualityScore["label"] {
  return score >= 80 ? "Excellente" : score >= 50 ? "Correcte" : "À améliorer";
}
