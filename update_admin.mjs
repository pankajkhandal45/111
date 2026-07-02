import { createClient } from "@libsql/client";

const client = createClient({ url: "file:./sqlite.db" });

async function run() {
  await client.execute({
    sql: "UPDATE users SET role = 'admin' WHERE email = 'admin@chesshub.com'",
    args: []
  });
  console.log("Updated admin role successfully!");
}

run().catch(console.error);
