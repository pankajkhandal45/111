import { db } from "./index";
import { usersTable, ratingsTable } from "./schema";
import bcrypt from "bcrypt";

async function seed() {
  console.log("Seeding admin user...");
  const passwordHash = await bcrypt.hash("admin", 10);
  
  const [user] = await db.insert(usersTable).values({
    username: "admin",
    email: "admin@chesshub.com",
    passwordHash,
    role: "admin",
    isGuest: false,
  }).returning();

  await db.insert(ratingsTable).values({ userId: user.id });

  console.log("Admin user created!");
  console.log("Email: admin@chesshub.com");
  console.log("Password: admin");
  process.exit(0);
}

seed().catch(err => {
  console.error("Failed to seed", err);
  process.exit(1);
});
