"use server";

import { acceptInvitation } from "@/lib/users";

export type SetPasswordState = { error?: string; success?: boolean } | undefined;

export async function acceptInvitationAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };
  if (password.length < 8) return { error: "Mot de passe : 8 caractères minimum." };

  try {
    await acceptInvitation(token, password);
    return { success: true };
  } catch (e) {
    if (e instanceof Error && e.message === "INVITATION_INVALIDE") {
      return { error: "Ce lien d'invitation est invalide ou expiré. Demandez-en un nouveau." };
    }
    console.error("acceptInvitationAction:", e);
    return { error: "Impossible d'enregistrer le mot de passe. Réessayez." };
  }
}
