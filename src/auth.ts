import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loadPermissionsForRole } from "@/lib/load-permissions";
import type { Role } from "@/generated/prisma/enums";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.email,
          role: user.role,
          shopId: user.shopId,
        };
      },
    }),
  ],
  callbacks: {
    // Au login : charge les permissions du rôle dans le JWT (checks instantanés ensuite)
    async jwt({ token, user }) {
      if (user) {
        const permissions = await loadPermissionsForRole(String(user.role));
        token.permissions = permissions;
        token.role = user.role;
        token.shopId = user.shopId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.role = (token.role as Role) ?? session.user.role;
        session.user.shopId = (token.shopId as string | null) ?? session.user.shopId;
      }
      return session;
    },
  },
});
