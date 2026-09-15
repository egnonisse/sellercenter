import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyLogin } from "@/lib/login-security";
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

        const user = await verifyLogin(email, password);
        if (!user) return null;

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
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // L'identifiant n'est PAS recopié automatiquement par NextAuth : sans cette ligne
        // session.user.id vaut undefined à l'exécution (le type le déclare pourtant).
        session.user.id = (token.uid as string | undefined) ?? token.sub ?? "";
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.role = (token.role as Role) ?? session.user.role;
        session.user.shopId = (token.shopId as string | null) ?? session.user.shopId;
      }
      return session;
    },
  },
});
