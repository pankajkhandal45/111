import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/src/schema/index";
import { usersTable } from "../lib/db/src/schema/index";

async function makeAdmin() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide the email of the user to make admin.");
    console.error("Usage: pnpm tsx make-admin.ts <email>");
    process.exit(1);
  }

  const dbPath = process.env.DATABASE_URL;
  if (!dbPath) {
    console.error("Missing DATABASE_URL environment variable.");
    process.exit(1);
  }

  const client = createClient({ 
    url: dbPath,
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {})
  });
  
  const db = drizzle(client, { schema });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    console.error(`User with email ${email} not found!`);
    process.exit(1);
  }

  await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, user.id));
  console.log(`Success! User ${email} is now an admin.`);
  process.exit(0);
}

makeAdmin().catch(console.error);
