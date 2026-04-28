import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __db__: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (globalThis.__db__) {
    return globalThis.__db__;
  }

  const client = postgres(process.env.DATABASE_URL, {
    prepare: false,
  });

  const db = drizzle(client, { schema });
  globalThis.__db__ = db;

  return db;
}
