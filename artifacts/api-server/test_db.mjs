import { createClient } from "@libsql/client";

const client = createClient({ url: "file:../../sqlite.db" });

async function run() {
  try {
    const ratings = await client.execute("SELECT * FROM ratings WHERE user_id = 3");
    console.log("Ratings for user 3:", ratings.rows);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
