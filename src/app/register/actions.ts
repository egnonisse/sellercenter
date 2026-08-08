"use server";

import { createSellerWithShop } from "@/lib/sellers";
import { ZodError } from "zod";

export type RegisterState = { error?: string; success?: boolean } | undefined;

export async function registerSeller(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  try {
    await createSellerWithShop({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      shopName: String(formData.get("shopName") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    return { success: true };
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: error.issues[0]?.message ?? "Formulaire invalide." };
    }
    if (error instanceof Error && error.message === "EMAIL_EXISTE") {
      return { error: "Cet email est déjà utilisé." };
    }
    console.error("registerSeller:", error);
    return { error: "Erreur lors de l'inscription. Réessayez." };
  }
}
