import { isValidEan, normalizeEan, productQualityScore, LOW_STOCK_THRESHOLD } from "../src/lib/product-quality";

let ok = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) ok++;
  else fail++;
  console.log(`${pass ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (attendu: ${JSON.stringify(expected)})`);
}

// EAN-13 valides (checksum correct)
check("EAN-13 valide 5901234123457", isValidEan("5901234123457"), true);
check("EAN-13 valide 4006381333931", isValidEan("4006381333931"), true);
check("EAN-13 invalide 5901234123458", isValidEan("5901234123458"), false);
check("EAN-13 avec espaces/tirets", isValidEan("5 901234 123457"), true);
// EAN-8
check("EAN-8 valide 96385074", isValidEan("96385074"), true);
check("EAN-8 invalide 96385075", isValidEan("96385075"), false);
// GTIN-12 / GTIN-14 acceptés (numériques)
check("GTIN-12 012345678905", isValidEan("012345678905"), true);
check("GTIN-14 01234567890512", isValidEan("01234567890512"), true);
check("texte rejeté", isValidEan("abc123"), false);
check("trop court", isValidEan("123"), false);
check("vide", isValidEan(""), false);
check("normalizeEan", normalizeEan(" 5 901-234 123457 "), "5901234123457");

// Score qualité
const base = {
  name: "Smart TV 43 pouces Full HD",
  description: "Téléviseur avec écran 43 pouces, résolution Full HD, connectivité WiFi et ports HDMI.",
  images: [{ url: "https://img.test/tv.jpg" }],
  brand: "Samsung",
  ean: "5901234123457",
  attributes: { color: "Noir", size: "43\"", warranty: "12 mois" },
  price: 150000,
};
const qFull = productQualityScore(base);
check("score annonce complète = 100", qFull.score, 100);
check("label excellente", qFull.label, "Excellente");

const qMinimal = productQualityScore({
  name: "TV",
  description: "",
  images: null,
  brand: null,
  ean: null,
  attributes: null,
  price: 150000,
});
check("score annonce minimale = 0", qMinimal.score, 0);
check("label à améliorer", qMinimal.label, "À améliorer");

const qSansImage = productQualityScore({ ...base, images: [] });
check("sans image = 70 (perd 30)", qSansImage.score, 70);

check("seuil stock bas", LOW_STOCK_THRESHOLD, 5);

console.log(`\n${ok} passés, ${fail} échoués`);
process.exit(fail > 0 ? 1 : 0);
