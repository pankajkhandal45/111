import { createClient } from "@libsql/client";
const client = createClient({ url: "file:./lib/db/sqlite.db" });

async function run() {
  const users = await client.execute("SELECT id, username FROM users");
  console.log("Users:", users.rows);
}
run();
