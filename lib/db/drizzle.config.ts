import { defineConfig } from "drizzle-kit";

const isRemote = process.env.DATABASE_URL?.startsWith("libsql://");

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: isRemote ? "turso" : "sqlite",
  dbCredentials: isRemote
    ? {
        url: process.env.DATABASE_URL!,
        authToken: process.env.DATABASE_AUTH_TOKEN,
      }
    : {
        url: process.env.DATABASE_URL || "file:../../sqlite.db",
      },
});
