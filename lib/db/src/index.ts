import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import * as relations from "./relations";

// Use DATABASE_URL only when it's a libsql/turso/file URL.
// Fall back to local SQLite file if it's a PostgreSQL URL (env misconfiguration).
const rawUrl = process.env.DATABASE_URL ?? "";
const isLibsqlUrl = rawUrl.startsWith("file:") || rawUrl.startsWith("libsql:") || rawUrl.startsWith("https://");
const dbPath = isLibsqlUrl ? rawUrl : "file:../../sqlite.db";

const client = createClient({ 
  url: dbPath,
  ...(isLibsqlUrl && process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {})
});
export const db = drizzle(client, { schema: { ...schema, ...relations } });

export * from "./schema";
export * from "./relations";
