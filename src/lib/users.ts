// Gestion des utilisateurs : création par invitation, rôles, statuts, audit.
// Garde-fous : pas d'auto-modification, pas d'élévation de privilèges, boutique obligatoire
// pour les rôles vendeurs.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { invitationEmail } from "@/lib/email-templates";
import type { Role } from "@/generated/prisma/enums";

export const INVITATION_TTL_DAYS = 7;

// Rôles avec boutique obligatoire / interdite
const SHOP_ROLES: Role[] = ["SHOP_ADMIN", "SHOP_MANAGER"];
export const ASSIGNABLE_ROLES: Role[] = ["KAM", "SHOP_ADMIN", "SHOP_MANAGER"];

export const invitationSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(["KAM", "SHOP_ADMIN", "SHOP_MANAGER"]),
  shopId: z.string().optional().nullable(),
});

export type InvitationInput = z.infer<typeof invitationSchema>;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function appUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Garde-fou : un identifiant d'acteur absent (session/JWT incomplet) ferait échouer
// Prisma avec un message obscur → on échoue ici avec un code explicite.
function requireActor(actorUserId?: string | null): string {
  if (!actorUserId) throw new Error("ACTEUR_INVALIDE");
  return actorUserId;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

async function logAudit(input: {
  targetUserId: string;
  actorUserId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  await prisma.userAudit.create({
    data: {
      targetUserId: input.targetUserId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      details: input.details ? (input.details as object) : undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

// Crée un utilisateur en statut INVITED et envoie le lien de définition du mot de passe.
export async function createUserWithInvitation(
  input: InvitationInput & { actorUserId: string },
) {
  const data = invitationSchema.parse(input);
  const actorId = requireActor(input.actorUserId);
  const email = data.email.toLowerCase().trim();

  // Boutique obligatoire pour les rôles vendeurs, interdite sinon
  if (SHOP_ROLES.includes(data.role) && !data.shopId) {
    throw new Error("BOUTIQUE_REQUISE");
  }
  if (!SHOP_ROLES.includes(data.role) && data.shopId) {
    throw new Error("BOUTIQUE_INTERDITE");
  }
  if (data.shopId) {
    const shop = await prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) throw new Error("BOUTIQUE_INTROUVABLE");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("EMAIL_EXISTE");

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      // Mot de passe inutilisable jusqu'à l'acceptation (le statut INVITED bloque déjà le login)
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
      role: data.role,
      shopId: data.shopId ?? null,
      status: "INVITED",
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: expiresAt,
      invitedByUserId: actorId,
    },
  });

  await logAudit({
    targetUserId: user.id,
    actorUserId: actorId,
    action: "INVITED",
    details: { email, role: data.role, shopId: data.shopId ?? null },
  });

  const shop = data.shopId
    ? await prisma.shop.findUnique({ where: { id: data.shopId }, select: { name: true } })
    : null;
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { email: true },
  });

  const { subject, html } = invitationEmail({
    role: data.role,
    shopName: shop?.name ?? null,
    inviteUrl: `${appUrl()}/set-password?token=${token}`,
    expiresAt,
    invitedByEmail: actor?.email ?? "l'équipe Zariamall",
  });
  const mail = await sendEmail({ to: email, subject, html });

  return { user, emailSent: mail.sent, mailError: mail.error };
}

// Régénère un lien et renvoie l'invitation (utilisateur encore en INVITED).
export async function resendInvitation(userId: string, actorUserId: string) {
  const actorId = requireActor(actorUserId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("UTILISATEUR_INTROUVABLE");
  if (user.status !== "INVITED") throw new Error("DEJA_ACTIF");

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { inviteTokenHash: hashToken(token), inviteExpiresAt: expiresAt },
  });
  await logAudit({ targetUserId: userId, actorUserId: actorId, action: "INVITE_RESENT" });

  const shop = user.shopId
    ? await prisma.shop.findUnique({ where: { id: user.shopId }, select: { name: true } })
    : null;
  const { subject, html } = invitationEmail({
    role: user.role,
    shopName: shop?.name ?? null,
    inviteUrl: `${appUrl()}/set-password?token=${token}`,
    expiresAt,
    invitedByEmail: "l'équipe Zariamall",
  });
  const mail = await sendEmail({ to: user.email, subject, html });
  return { emailSent: mail.sent, mailError: mail.error };
}

// Acceptation : définit le mot de passe et active le compte.
export async function acceptInvitation(token: string, password: string) {
  const parsed = z.string().min(8, "Mot de passe : 8 caractères minimum").parse(password);
  const user = await prisma.user.findFirst({
    where: { inviteTokenHash: hashToken(token), inviteExpiresAt: { gt: new Date() } },
  });
  if (!user) throw new Error("INVITATION_INVALIDE");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed, 10),
      status: "ACTIVE",
      inviteTokenHash: null,
      inviteExpiresAt: null,
      failedAttempts: 0,
      lockoutUntil: null,
    },
  });
  await logAudit({ targetUserId: user.id, action: "PASSWORD_SET" });
  return user;
}

// Vérifie qu'un token d'invitation est encore valide (affichage de la page).
export async function getInvitationByToken(token: string) {
  if (!token) return null;
  return prisma.user.findFirst({
    where: { inviteTokenHash: hashToken(token), inviteExpiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, shop: { select: { name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Gestion (rôles / statuts)
// ---------------------------------------------------------------------------

export async function setUserRole(userId: string, role: Role, actorUserId: string) {
  requireActor(actorUserId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("UTILISATEUR_INTROUVABLE");
  if (user.id === actorUserId) throw new Error("AUTO_MODIFICATION_INTERDITE");
  if (role === "SUPER_ADMIN") throw new Error("ROLE_NON_ASSIGNABLE");
  if (SHOP_ROLES.includes(role) && !user.shopId) throw new Error("BOUTIQUE_REQUISE");
  if (!SHOP_ROLES.includes(role) && user.shopId) throw new Error("BOUTIQUE_INTERDITE");

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await logAudit({
    targetUserId: userId,
    actorUserId,
    action: "ROLE_CHANGED",
    details: { before: user.role, after: role },
  });
}

export async function setUserStatus(userId: string, status: string, actorUserId: string) {
  requireActor(actorUserId);
  if (!["ACTIVE", "SUSPENDED"].includes(status)) throw new Error("STATUT_INVALIDE");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("UTILISATEUR_INTROUVABLE");
  if (user.id === actorUserId) throw new Error("AUTO_MODIFICATION_INTERDITE");
  if (user.status === "INVITED") throw new Error("INVITATION_EN_ATTENTE");

  await prisma.user.update({ where: { id: userId }, data: { status } });
  await logAudit({
    targetUserId: userId,
    actorUserId,
    action: "STATUS_CHANGED",
    details: { before: user.status, after: status },
  });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listUsers(filters: {
  role?: string;
  status?: string;
  shopId?: string;
  q?: string;
}) {
  return prisma.user.findMany({
    where: {
      ...(filters.role ? { role: filters.role as Role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
      ...(filters.q ? { email: { contains: filters.q.trim(), mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { shop: { select: { name: true } } },
    take: 200,
  });
}

export async function listUserAudit(targetUserId: string, take = 20) {
  return prisma.userAudit.findMany({
    where: { targetUserId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { email: true } } },
  });
}

// ---------------------------------------------------------------------------
// Espace équipe (vendeur) — actions limitées à SA boutique
// ---------------------------------------------------------------------------

// Vérifie que la cible est bien un membre gérable de la boutique (employé, pas responsable).
async function assertManageableTeamMember(targetUserId: string, shopId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.shopId !== shopId) throw new Error("UTILISATEUR_INTROUVABLE");
  if (target.role !== "SHOP_MANAGER") throw new Error("CIBLE_NON_GEERABLE");
  return target;
}

// Invitation d'un employé (SHOP_MANAGER) pour SA boutique.
export async function createTeamMember(
  shopId: string,
  email: string,
  actorUserId: string,
) {
  return createUserWithInvitation({
    email,
    role: "SHOP_MANAGER",
    shopId,
    actorUserId,
  });
}

export async function resendTeamInvitation(targetUserId: string, shopId: string, actorUserId: string) {
  await assertManageableTeamMember(targetUserId, shopId);
  return resendInvitation(targetUserId, actorUserId);
}

export async function setTeamMemberStatus(
  targetUserId: string,
  shopId: string,
  status: string,
  actorUserId: string,
) {
  await assertManageableTeamMember(targetUserId, shopId);
  return setUserStatus(targetUserId, status, actorUserId);
}

export async function listTeamMembers(shopId: string) {
  return prisma.user.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
  });
}
