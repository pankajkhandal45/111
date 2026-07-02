import { db, usersTable, ratingsTable } from "@workspace/db";
import bcrypt from "bcrypt";

async function run() {
  try {
    const passwordHash = await bcrypt.hash("admin", 10);
    const [user] = await db.insert(usersTable).values({
      username: "admin",
      email: "admin@chesshub.com",
      passwordHash,
      role: "admin",
      isGuest: false,
    }).returning();
    console.log("Inserted user", user);
    await db.insert(ratingsTable).values({ userId: user.id });
    console.log("Success");
  } catch(e) {
    console.error(e);
  }
}

run();
