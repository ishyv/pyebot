/**
 * Read-only audit of the live DB before any entity migration. Lists collections
 * with document counts, and — if a per-entity `users`/`guilds` document already
 * exists — samples one to show its top-level (component-field) keys. No writes.
 *
 *   bun scripts/entity-audit.ts
 */

import "dotenv/config";
import { disconnectDb, getDb } from "../src/core/db";

async function main(): Promise<void> {
  const db = await getDb();
  const cols = (await db.listCollections().toArray()).map((c) => c.name).sort();

  console.log(`collections in "${db.databaseName}":\n`);
  for (const name of cols) {
    const count = await db.collection(name).estimatedDocumentCount();
    console.log(`  ${name.padEnd(28)} ${count}`);
  }

  for (const name of ["users", "guilds"]) {
    if (!cols.includes(name)) {
      console.log(`\n${name}: collection does not exist`);
      continue;
    }
    const sample = await db.collection(name).findOne({});
    console.log(
      `\n${name}: sample top-level keys = ${sample ? Object.keys(sample).join(", ") : "(empty)"}`,
    );
  }

  await disconnectDb();
}

main().catch(async (err) => {
  await disconnectDb().catch(() => {});
  console.error(err);
  process.exit(1);
});
