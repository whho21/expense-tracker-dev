import { readFile } from "node:fs/promises";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL in .env before running the database migration.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const migration = await readFile(new URL("./migrations/001_initial.sql", import.meta.url), "utf8");
  await pool.query(migration);
  console.log("PostgreSQL schema is ready.");
} finally {
  await pool.end();
}