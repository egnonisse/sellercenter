import { auth } from "@/auth";
import type { Session } from "next-auth";

export type AppRole = "SUPER_ADMIN" | "SHOP_ADMIN" | "SHOP_MANAGER";

// Redirige vers /login si non connecté ; vérifie le rôle si fourni.
export async function requireRole(
  allowed: AppRole[],
): Promise<NonNullable<Session["user"]>> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("NON_CONNECTE");
  }
  if (allowed.length > 0 && !allowed.includes(session.user.role as AppRole)) {
    throw new Error("ACCES_REFUSE");
  }
  return session.user;
}

export const isSuperAdmin = (role?: string | null) => role === "SUPER_ADMIN";
export const isShopAdmin = (role?: string | null) => role === "SHOP_ADMIN";
