import type { DefaultSession } from "next-auth";

type AppRole = "SUPER_ADMIN" | "SHOP_ADMIN" | "SHOP_MANAGER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      shopId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    shopId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    shopId?: string | null;
  }
}
