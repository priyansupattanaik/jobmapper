import { getDb } from "../lib/db";

async function main() {
  console.log("Starting database initialization and migrations...");
  try {
    const db = await getDb();
    console.log(`Database initialized successfully using provider: ${db.name}`);
    const health = await db.getSystemHealth();
    console.log("Database Health:", health);
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error("Database migration error:", error);
    process.exit(1);
  }
}

main();
