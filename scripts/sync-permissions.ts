// Ajoute les permissions manquantes en base (idempotent, n'écrase jamais un choix existant).
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/rbac-constants";
import type { Role } from "../src/generated/prisma/enums";

async function main() {
  let created = 0;
  let skipped = 0;

  for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const permission of perms) {
      const existing = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: role as Role, permission } },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.rolePermission.create({
        data: { role: role as Role, permission, granted: true },
      });
      created++;
      console.log(`+ ${role} ← ${permission}`);
    }
  }
  console.log(`\n${created} permissions ajoutées, ${skipped} déjà présentes`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌", e.message?.slice(0, 300));
  process.exit(1);
});
