import { createClient } from "@libsql/client";

const client = createClient({ url: "file:../../sqlite.db" });

async function run() {
  await client.execute({
    sql: "UPDATE users SET email = '2004pankajsharma@gmail.com' WHERE username = 'admin'",
    args: []
  });
  console.log("Updated admin email successfully!");
}

run().catch(console.error);
