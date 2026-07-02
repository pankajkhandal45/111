import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import * as relations from "./relations";
const dbPath = process.env.DATABASE_URL || "file:../../sqlite.db";

const client = createClient({ url: dbPath });
export const db = drizzle(client, { schema: { ...schema, ...relations } });

export * from "./schema";
export * from "./relations";
