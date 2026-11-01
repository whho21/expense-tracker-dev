import { readFile } from "node:fs/promises";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL in .env before importing data.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const data = JSON.parse(await readFile(new URL("../data/db.json", import.meta.url), "utf8"));
const coreFields = new Set(["id", "date", "description", "categoryId", "amount"]);
const client = await pool.connect();

try {
  await client.query("BEGIN");
  for (const category of data.categories) {
    await client.query(
      `INSERT INTO categories (id, name, type, icon)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, icon = EXCLUDED.icon`,
      [String(category.id), category.name.trim(), category.type, category.icon],
    );
  }
  for (const transaction of data.transactions) {
    const metadata = Object.fromEntries(Object.entries(transaction).filter(([key]) => !coreFields.has(key)));
    await client.query(
      `INSERT INTO transactions (id, transaction_date, description, category_id, amount, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET transaction_date = EXCLUDED.transaction_date,
         description = EXCLUDED.description, category_id = EXCLUDED.category_id,
         amount = EXCLUDED.amount, metadata = EXCLUDED.metadata, updated_at = now()`,
      [String(transaction.id), transaction.date, transaction.description.trim(), String(transaction.categoryId),
        transaction.amount, JSON.stringify(metadata)],
    );
  }
  await client.query("COMMIT");
  console.log(`Imported ${data.categories.length} categories and ${data.transactions.length} transactions.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}