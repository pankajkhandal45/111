import { db } from "./artifacts/api-server/node_modules/@workspace/db/dist/index.js";
import { usersTable } from "./artifacts/api-server/node_modules/@workspace/db/dist/schema/users.js";
import { eq } from "drizzle-orm";

async function run() {
  try {
    const users = await db.select().from(usersTable);
    console.log("Users:", users.map(u => ({ id: u.id, username: u.username })));
    
    // Pick the last user
    if (users.length === 0) return console.log("No users");
    const lastUser = users[users.length - 1];
    console.log("Attempting to delete user:", lastUser.id);

    await db.delete(usersTable).where(eq(usersTable.id, lastUser.id));
    console.log("User deleted successfully!");
  } catch (err) {
    console.error("Error deleting user:", err);
  }
}

run();
