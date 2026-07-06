import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:../../sqlite.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
