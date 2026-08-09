import type { NextAuthConfig } from "next-auth";

// Config de base NextAuth — les callbacks réels (JWT + session) sont dans auth.ts
export const authConfig = {
  providers: [], // les vrais providers sont ajoutés dans auth.ts (Credentials + Prisma)
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // token court (8 h) : les permissions changées prennent effet rapidement
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
