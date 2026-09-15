"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionDb } from "@/lib/rbac";
import {
  createTeamMember,
  resendTeamInvitation,
  setTeamMemberStatus,
} from "@/lib/users";

export type TeamActionState = { error?: string; result?: string } | undefined;

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTE: "Cet email est déjà utilisé.",
  UTILISATEUR_INTROUVABLE: "Membre introuvable dans votre boutique.",
  CIBLE_NON_GEERABLE: "Vous ne pouvez gérer que les employés de votre boutique.",
  DEJA_ACTIF: "Ce compte est déjà actif.",
  INVITATION_EN_ATTENTE: "Invitation en attente : le membre doit d'abord définir son mot de passe.",
  AUTO_MODIFICATION_INTERDITE: "Vous ne pouvez pas modifier votre propre compte.",
};

function toMessage(e: unknown, fallback: string): string {
  const code = e instanceof Error ? e.message : "";
  return ERROR_MESSAGES[code] ?? fallback;
}

// Invite un employé (SHOP_MANAGER) pour SA boutique — le shopId vient de la session, jamais du formulaire
export async function createTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  try {
    const actor = await requirePermissionDb("team.manage");
    if (!actor.shopId) return { error: "Aucune boutique rattachée à votre compte." };
    const { user, emailSent, mailError } = await createTeamMember(
      actor.shopId,
      String(formData.get("email") ?? ""),
      actor.id,
    );
    revalidatePath("/team");
    return {
      result: emailSent
        ? `Invitation envoyée à ${user.email}.`
        : `Compte créé pour ${user.email} — email NON envoyé (${mailError ?? "erreur"}).`,
    };
  } catch (e) {
    console.error("createTeamMemberAction:", e);
    return { error: toMessage(e, "Invitation impossible.") };
  }
}

export async function resendTeamInvitationVoidAction(userId: string): Promise<void> {
  try {
    const actor = await requirePermissionDb("team.manage");
    if (!actor.shopId) return;
    await resendTeamInvitation(userId, actor.shopId, actor.id);
    revalidatePath("/team");
  } catch (e) {
    console.error("resendTeamInvitationVoidAction:", e);
  }
}

export async function setTeamMemberStatusAction(userId: string, status: string): Promise<void> {
  try {
    const actor = await requirePermissionDb("team.manage");
    if (!actor.shopId) return;
    await setTeamMemberStatus(userId, actor.shopId, status, actor.id);
    revalidatePath("/team");
  } catch (e) {
    console.error("setTeamMemberStatusAction:", e);
  }
}
