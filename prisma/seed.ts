import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_NAMES } from "../src/lib/rbac-constants";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Paramètres globaux
  await prisma.settings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", defaultCommissionRate: 10, signupOpen: true },
  });

  // Permissions par rôle (RBAC) — idempotent
  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const permission of PERMISSION_NAMES) {
      await prisma.rolePermission.upsert({
        where: { role_permission: { role: role as never, permission } },
        update: { granted: perms.includes(permission) },
        create: { role: role as never, permission, granted: perms.includes(permission) },
      });
    }
  }
  console.log("Permissions RBAC à jour (4 rôles × 14 permissions).");

  // Super admin (LEO)
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Définissez SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD dans .env puis relancez.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Super admin créé : ${email}`);
  } else {
    console.log("Super admin déjà présent, rien à faire.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
