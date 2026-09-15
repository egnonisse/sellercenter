import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import {
  createUserWithInvitation,
  acceptInvitation,
  getInvitationByToken,
  setUserStatus,
} from "../src/lib/users";
import { verifyLogin } from "../src/lib/login-security";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  const shop = await prisma.shop.findFirst();
  if (!admin || !shop) throw new Error("admin ou boutique manquant");

  const createdIds: string[] = [];
  const stamp = Date.now();

  // ---- Test 1 : création + invitation (sans clé Brevo → email non envoyé, attendu)
  const email1 = `test-kam-${stamp}@example.ci`;
  const r1 = await createUserWithInvitation({ email: email1, role: "KAM", actorUserId: admin.id });
  createdIds.push(r1.user.id);
  console.log(`1. Création KAM → statut: ${r1.user.status} | email envoyé: ${r1.emailSent} (${r1.mailError ?? "-"})`);
  const auditOk = await prisma.userAudit.count({ where: { targetUserId: r1.user.id, action: "INVITED" } });
  console.log(`   Audit INVITED: ${auditOk > 0 ? "OK" : "MANQUANT"}`);

  // ---- Test 2 : garde-fous
  const guards: [string, () => Promise<unknown>][] = [
    ["rôle SUPER_ADMIN interdit", () => createUserWithInvitation({ email: `x-${stamp}@e.ci`, role: "SUPER_ADMIN" as never, actorUserId: admin.id })],
    ["boutique requise pour vendeur", () => createUserWithInvitation({ email: `v-${stamp}@e.ci`, role: "SHOP_ADMIN", actorUserId: admin.id })],
    ["boutique interdite pour KAM", () => createUserWithInvitation({ email: `k-${stamp}@e.ci`, role: "KAM", shopId: shop.id, actorUserId: admin.id })],
    ["auto-modification interdite", () => setUserStatus(admin.id, "SUSPENDED", admin.id)],
  ];
  for (const [label, fn] of guards) {
    try {
      await fn();
      console.log(`2. ❌ ${label} → AUTORISÉ (faille !)`);
    } catch (e) {
      console.log(`2. ✅ ${label} → bloqué (${(e as Error).message})`);
    }
  }

  // ---- Test 3 : acceptation d'invitation (token connu, injecté directement)
  const email3 = `test-accept-${stamp}@example.ci`;
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const user3 = await prisma.user.create({
    data: {
      email: email3,
      passwordHash: await bcrypt.hash("placeholder-inutilisable", 10),
      role: "SHOP_MANAGER",
      shopId: shop.id,
      status: "INVITED",
      inviteTokenHash: hash,
      inviteExpiresAt: new Date(Date.now() + 86_400_000),
      invitedByUserId: admin.id,
    },
  });
  createdIds.push(user3.id);

  const peek = await getInvitationByToken(token);
  console.log(`3. Token valide → ${peek ? `OK (${peek.email}, ${peek.role})` : "NON TROUVÉ"}`);

  const loginBefore = await verifyLogin(email3, "NouveauMdp123");
  console.log(`   Connexion avant acceptation (INVITED): ${loginBefore ? "❌ AUTORISÉE" : "✅ refusée"}`);

  await acceptInvitation(token, "NouveauMdp123");
  const after = await prisma.user.findUnique({ where: { id: user3.id } });
  console.log(`   Après acceptation → statut: ${after?.status} | token effacé: ${after?.inviteTokenHash === null}`);

  const loginAfter = await verifyLogin(email3, "NouveauMdp123");
  console.log(`   Connexion après acceptation: ${loginAfter ? "✅ OK" : "❌ refusée"}`);
  const loginWrong = await verifyLogin(email3, "MauvaisMdp");
  console.log(`   Connexion mauvais mot de passe: ${loginWrong ? "❌ AUTORISÉE" : "✅ refusée"}`);

  // ---- Test 4 : token réutilisé (doit échouer)
  try {
    await acceptInvitation(token, "AutreMdp123");
    console.log("4. ❌ Token réutilisé → AUTORISÉ (faille !)");
  } catch (e) {
    console.log(`4. ✅ Token réutilisé → bloqué (${(e as Error).message})`);
  }

  // ---- Nettoyage
  const targetIds = [...createdIds, user3.id];
  await prisma.userAudit.deleteMany({ where: { targetUserId: { in: targetIds } } });
  await prisma.user.deleteMany({ where: { id: { in: targetIds } } });
  console.log("\n✅ Nettoyage effectué");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e.message?.slice(0, 300));
  process.exit(1);
});
