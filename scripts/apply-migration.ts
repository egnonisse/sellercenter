// Application manuelle d'une migration Prisma via pg (contournement IPv6 : le moteur Prisma
// tente IPv6 en premier et le réseau ne le route pas sur ce PC).
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import pg from "pg";

const NAME = process.argv[2];

async function main() {
  if (!NAME) {
    console.error("Usage : npx tsx scripts/apply-migration.ts <dossier_de_migration>");
    console.error("Exemple : npx tsx scripts/apply-migration.ts 20260915120000_shop_assignments_kam");
    process.exit(1);
  }
  const file = path.join("prisma", "migrations", NAME, "migration.sql");
  if (!fs.existsSync(file)) {
    console.error(`❌ Introuvable : ${file}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(file, "utf-8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const existing = await client.query(
    "SELECT migration_name FROM _prisma_migrations WHERE migration_name = $1",
    [NAME],
  );
  if (existing.rowCount) {
    console.log(`Migration ${NAME} déjà appliquée — rien à faire.`);
    await client.end();
    return;
  }

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
       VALUES ($1, $2, $3, NOW(), NOW(), 1)`,
      [crypto.randomUUID(), checksum, NAME],
    );
    await client.query("COMMIT");
    console.log(`✅ Migration ${NAME} appliquée (checksum ${checksum.slice(0, 12)}…)`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }

  await client.end();
  console.log("Enchaîner : npx prisma generate (le client doit connaître le nouveau modèle)");
}

main().catch((e) => {
  console.error("❌", e.message?.slice(0, 300));
  process.exit(1);
});
