/**
 * Test d'intégration ad-hoc — rate limiting login (SellerCenter).
 * Lancement : npx tsx scripts/test-login-rate-limit.ts
 * Crée un compte éphémère, teste le cycle complet, puis le supprime.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { verifyLogin, MAX_FAILED_ATTEMPTS } from "../src/lib/login-security";
import bcrypt from "bcryptjs";

const EMAIL = `ratelimit-test-${Date.now()}@test.local`;
const GOOD = "correct-password";
const BAD = "wrong-password";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`[${ok ? "OK " : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) passed++;
  else failed++;
}

async function main() {
  // 1. Compte éphémère
  const hash = await bcrypt.hash(GOOD, 10);
  const user = await prisma.user.create({
    data: { email: EMAIL, passwordHash: hash, role: "SHOP_ADMIN", status: "ACTIVE" },
  });
  console.log(`Compte test créé : ${EMAIL}`);

  try {
    // 2. Login correct → succès
    check("login correct", (await verifyLogin(EMAIL, GOOD)) !== null);

    // 3. 4 mauvais mots de passe → failedAttempts incrémente, pas de lockout
    for (let i = 1; i <= MAX_FAILED_ATTEMPTS - 1; i++) {
      const res = await verifyLogin(EMAIL, BAD);
      check(`échec #${i} refusé`, res === null);
    }
    let u = await prisma.user.findUnique({ where: { email: EMAIL } });
    check("failedAttempts = 4", u?.failedAttempts === MAX_FAILED_ATTEMPTS - 1, `actuel: ${u?.failedAttempts}`);

    // 4. 5e échec → lockout activé
    await verifyLogin(EMAIL, BAD);
    u = await prisma.user.findUnique({ where: { email: EMAIL } });
    check("lockout activé après 5e échec", !!u?.lockoutUntil && u.lockoutUntil > new Date());
    check("failedAttempts remis à 0", u?.failedAttempts === 0, `actuel: ${u?.failedAttempts}`);

    // 5. Pendant le lockout : refusé même avec le bon mot de passe
    check("bon mdp refusé pendant lockout", (await verifyLogin(EMAIL, GOOD)) === null);

    // 6. Lockout expiré → login correct → reset complet
    await prisma.user.update({
      where: { id: user.id },
      data: { lockoutUntil: new Date(Date.now() - 1000) },
    });
    check("login correct après expiration", (await verifyLogin(EMAIL, GOOD)) !== null);
    u = await prisma.user.findUnique({ where: { email: EMAIL } });
    check("compteur reset après succès", u?.failedAttempts === 0 && u?.lockoutUntil === null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`\nCompte test supprimé. Résultat : ${passed} OK, ${failed} FAIL`);
    if (failed > 0) process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERREUR:", e);
  process.exit(1);
});
