import { DatabaseProvider } from "./adapter";
import { SqliteDatabaseProvider } from "./sqlite";
import { PostgresDatabaseProvider } from "./postgres";

let dbInstance: DatabaseProvider | null = null;

export async function getDb(): Promise<DatabaseProvider> {
  if (dbInstance) return dbInstance;

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"))) {
    dbInstance = new PostgresDatabaseProvider(dbUrl);
  } else {
    dbInstance = new SqliteDatabaseProvider(process.env.SQLITE_DB_PATH || "./jobmapper.db");
  }

  await dbInstance.init();
  return dbInstance;
}

export * from "./adapter";
export * from "./sqlite";
export * from "./postgres";
