import { defineConfig } from "drizzle-kit";

const rawUrl = process.env.DATABASE_URL ?? "";
const isLibsqlUrl = rawUrl.startsWith("file:") || rawUrl.startsWith("libsql:") || rawUrl.startsWith("https://");
const dbUrl = isLibsqlUrl ? rawUrl : "file:../../sqlite.db";

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "turso",
  dbCredentials: {
    url: dbUrl,
    authToken: isLibsqlUrl ? process.env.DATABASE_AUTH_TOKEN : undefined,
  },
});
