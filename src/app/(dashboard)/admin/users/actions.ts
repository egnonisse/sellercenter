"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import {
  createUserWithInvitation,
  resendInvitation,
  setUserRole,
  setUserStatus,
} from "@/lib/users";
import type { Role } from "@/generated/prisma/enums";

export type UserActionState = { error?: string; result?: string } | undefined;

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTE: "Cet email est déjà utilisé.",
  BOUTIQUE_REQUISE: "Une boutique est obligatoire pour un rôle vendeur.",
  BOUTIQUE_INTERDITE: "Ce rôle ne doit pas être rattaché à une boutique.",
  BOUTIQUE_INTROUVABLE: "Boutique introuvable.",
  UTILISATEUR_INTROUVABLE: "Utilisateur introuvable.",
  AUTO_MODIFICATION_INTERDITE: "Vous ne pouvez pas modifier votre propre compte.",
  ROLE_NON_ASSIGNABLE: "Ce rôle ne peut pas être attribué.",
  STATUT_INVALIDE: "Statut invalide.",
  INVITATION_EN_ATTENTE: "Invitation en attente : l'utilisateur doit d'abord définir son mot de passe.",
  DEJA_ACTIF: "Ce compte est déjà actif.",
};

function toMessage(e: unknown, fallback: string): string {
  const code = e instanceof Error ? e.message : "";
  return ERROR_MESSAGES[code] ?? fallback;
}

// Création d'un utilisateur + envoi de l'invitation par email
export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const actor = await requirePermissionDb("users.manage");
    const { user, emailSent, mailError } = await createUserWithInvitation({
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "") as "KAM" | "SHOP_ADMIN" | "SHOP_MANAGER",
      shopId: String(formData.get("shopId") ?? "") || null,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/users");
    return {
      result: emailSent
        ? `Invitation envoyée à ${user.email}.`
        : `Compte créé pour ${user.email} — email NON envoyé (${mailError ?? "erreur"}).`,
    };
  } catch (e) {
    console.error("createUserAction:", e);
    return { error: toMessage(e, "Création impossible.") };
  }
}

export async function resendInvitationAction(userId: string): Promise<UserActionState> {
  try {
    const actor = await requirePermissionDb("users.manage");
    const { emailSent, mailError } = await resendInvitation(userId, actor.id);
    revalidatePath("/admin/users");
    return {
      result: emailSent ? "Invitation renvoyée." : `Renvoi impossible (${mailError ?? "erreur email"}).`,
    };
  } catch (e) {
    console.error("resendInvitationAction:", e);
    return { error: toMessage(e, "Renvoi impossible.") };
  }
}

export async function setUserRoleAction(
  userId: string,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const actor = await requirePermissionDb("users.manage");
    await setUserRole(userId, String(formData.get("role") ?? "") as Role, actor.id);
    revalidatePath("/admin/users");
    return { result: "Rôle mis à jour." };
  } catch (e) {
    console.error("setUserRoleAction:", e);
    return { error: toMessage(e, "Changement de rôle impossible.") };
  }
}

export async function setUserStatusAction(userId: string, status: string): Promise<void> {
  try {
    const actor = await requirePermissionDb("users.manage");
    await setUserStatus(userId, status, actor.id);
    revalidatePath("/admin/users");
  } catch (e) {
    console.error("setUserStatusAction:", e);
  }
}

// Version « void » pour les formulaires inline (le retour d'erreur n'est pas affiché)
export async function resendInvitationVoidAction(userId: string): Promise<void> {
  try {
    const actor = await requirePermissionDb("users.manage");
    await resendInvitation(userId, actor.id);
    revalidatePath("/admin/users");
  } catch (e) {
    console.error("resendInvitationVoidAction:", e);
  }
}
