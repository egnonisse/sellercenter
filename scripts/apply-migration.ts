// Application manuelle d'une migration Prisma via pg (contournement IPv6 : le moteur Prisma
// tente IPv6 en premier et le réseau ne le route pas sur ce PC).
import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import pg from "pg";

const NAME = "20260820170000_user_invitations_audit";

async function main() {
  const file = path.join("prisma", "migrations", NAME, "migration.sql");
  const sql = fs.readFileSync(file, "utf-8");
  const checksum = crypto.createHash("sha256").update(sql).digest("hex");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const existing = await client.query(
    "SELECT migration_name FROM _prisma_migrations WHERE migration_name = $1",
    [NAME],
  );
  if (existing.rowCount) {
    console.log("Migration déjà appliquée — rien à faire.");
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

  // Vérification : colonnes + table
  const cols = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('inviteTokenHash','inviteExpiresAt','invitedByUserId') ORDER BY column_name",
  );
  console.log("Nouvelles colonnes User:", cols.rows.map((r) => r.column_name).join(", "));
  const t = await client.query("SELECT to_regclass('public.\"UserAudit\"') AS t");
  console.log("Table UserAudit:", t.rows[0].t);

  await client.end();
}

main().catch((e) => {
  console.error("❌", e.message?.slice(0, 300));
  process.exit(1);
});
