import type { NextAuthConfig } from "next-auth";

// Config compatible Edge (utilisée par le middleware — PAS de Prisma ici)
export const authConfig = {
  providers: [], // les vrais providers sont ajoutés dans auth.ts (Credentials + Prisma)
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.shopId = user.shopId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as "SUPER_ADMIN" | "SHOP_ADMIN" | "SHOP_MANAGER";
        session.user.shopId = (token.shopId as string) ?? null;
      }
      return session;
    },
    authorized({ auth }) {
      const isLoggedIn = !!auth?.user;
      // Pages protégées : tout sauf login/register
      if (!isLoggedIn) return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
