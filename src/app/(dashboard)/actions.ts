"use server";

import { signIn, signOut } from "@/auth";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// ===================== DEV ONLY : switcher de compte =====================
// Actif uniquement si ALLOW_ACCOUNT_SWITCHING=true (à retirer avant la production réelle).
const DEV_ACCOUNTS: Record<string, string> = {
  "admin@zariamall.com": process.env.SEED_ADMIN_PASSWORD ?? "",
  "kam@zariamall.com": process.env.DEV_TEST_PASSWORD ?? "",
  "vendeur-test@example.com": process.env.DEV_TEST_PASSWORD ?? "",
};

export async function switchAccountAction(formData: FormData) {
  if (process.env.ALLOW_ACCOUNT_SWITCHING !== "true") {
    throw new Error("SWITCH_DESACTIVE");
  }
  const email = String(formData.get("email") ?? "");
  const password = DEV_ACCOUNTS[email];
  if (!password) return;
  await signIn("credentials", { email, password, redirectTo: "/" });
}
