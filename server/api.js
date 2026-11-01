import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Pool } from "pg";
import { pathToFileURL } from "node:url";

const BODY_LIMIT = 1024 * 1024;
const CORE_FIELDS = new Set(["id", "date", "description", "categoryId", "amount"]);

export function extractMetadata(body) {
  return Object.fromEntries(Object.entries(body).filter(([key]) => !CORE_FIELDS.has(key)));
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function parseTransaction(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !validDate(input.date) || typeof input.description !== "string" ||
      !input.description.trim() || input.description.trim().length > 100 ||
      typeof input.categoryId !== "string" || !input.categoryId || input.categoryId.length > 100) return null;
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 9_999_999_999.99 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) return null;
  return {
    id: typeof input.id === "string" && input.id.length > 0 && input.id.length <= 100 ? input.id : randomUUID(),
    date: input.date,
    description: input.description.trim(),
    categoryId: input.categoryId,
    amount,
    metadata: extractMetadata(input),
  };
}

function parseCategory(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100 ||
      !["income", "expense"].includes(input.type) ||
      typeof input.icon !== "string" || !input.icon.trim() || input.icon.length > 32) return null;
  return {
    id: typeof input.id === "string" && input.id.length > 0 && input.id.length <= 100 ? input.id : randomUUID(),
    name: input.name.trim(), type: input.type, icon: input.icon,
  };
}

function transactionFromRow(row) {
  if (!row) return null;
  return {
    ...(row.metadata ?? {}),
    id: row.id,
    date: row.date,
    description: row.description,
    categoryId: row.categoryId,
    amount: Number(row.amount),
  };
}

function sendJson(response, status, data, extraHeaders = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  response.end(data === undefined ? undefined : JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > BODY_LIMIT) throw Object.assign(new Error("Request body is too large."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object.");
    return body;
  } catch {
    throw Object.assign(new Error("Send a valid JSON object."), { status: 400 });
  }
}

function databaseError(error) {
  if (error.code === "23503") return { status: 400, message: "The category does not exist or is still in use." };
  if (error.code === "23505") return { status: 409, message: "A record with that id already exists." };
  return { status: 500, message: "The database request failed." };
}

function corsHeaders(origin, allowedOrigins) {
  if (!origin || (!allowedOrigins.includes("*") && !allowedOrigins.includes(origin))) return {};
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes("*") ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function createApiServer(pool, { allowedOrigins = [] } = {}) {
  return createServer(async (request, response) => {
    const headers = corsHeaders(request.headers.origin, allowedOrigins);
    if (request.method === "OPTIONS") {
      response.writeHead(204, headers);
      response.end();
      return;
    }
    const url = new URL(request.url, "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (segments.length === 1 && segments[0] === "categories") {
        if (request.method === "GET") {
          const result = await pool.query("SELECT id, name, type, icon FROM categories ORDER BY name, id");
          sendJson(response, 200, result.rows, headers);
          return;
        }
        if (request.method === "POST") {
          const category = parseCategory(await readJson(request));
          if (!category) {
            sendJson(response, 400, { error: "Enter a category name, a valid type, and an icon." }, headers);
            return;
          }
          const result = await pool.query(
            "INSERT INTO categories (id, name, type, icon) VALUES ($1, $2, $3, $4) RETURNING id, name, type, icon",
            [category.id, category.name, category.type, category.icon],
          );
          sendJson(response, 201, result.rows[0], headers);
          return;
        }
      }

      if (segments.length === 2 && segments[0] === "categories" && request.method === "DELETE") {
        const result = await pool.query("DELETE FROM categories WHERE id = $1", [segments[1]]);
        if (!result.rowCount) {
          sendJson(response, 404, { error: "Category not found." }, headers);
          return;
        }
        response.writeHead(204, headers);
        response.end();
        return;
      }

      if (segments.length === 1 && segments[0] === "transactions") {
        if (request.method === "GET") {
          const result = await pool.query(
            `SELECT id, transaction_date::text AS date, description,
                    category_id AS "categoryId", amount::text AS amount, metadata
             FROM transactions ORDER BY transaction_date DESC, created_at DESC, id`,
          );
          sendJson(response, 200, result.rows.map(transactionFromRow), headers);
          return;
        }
        if (request.method === "POST") {
          const transaction = parseTransaction(await readJson(request));
          if (!transaction) {
            sendJson(response, 400, { error: "Enter a valid date, description, category, and non-negative amount." }, headers);
            return;
          }
          const result = await pool.query(
            `INSERT INTO transactions (id, transaction_date, description, category_id, amount, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)
             RETURNING id, transaction_date::text AS date, description,
                       category_id AS "categoryId", amount::text AS amount, metadata`,
            [transaction.id, transaction.date, transaction.description, transaction.categoryId,
              transaction.amount, JSON.stringify(transaction.metadata)],
          );
          sendJson(response, 201, transactionFromRow(result.rows[0]), headers);
          return;
        }
      }

      if (segments.length === 2 && segments[0] === "transactions") {
        const id = segments[1];
        if (request.method === "PUT") {
          const patch = await readJson(request);
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const currentResult = await client.query(
              `SELECT id, transaction_date::text AS date, description,
                      category_id AS "categoryId", amount::text AS amount, metadata
               FROM transactions WHERE id = $1 FOR UPDATE`, [id],
            );
            if (!currentResult.rows[0]) {
              await client.query("ROLLBACK");
              sendJson(response, 404, { error: "Transaction not found." }, headers);
              return;
            }
            const current = transactionFromRow(currentResult.rows[0]);
            const transaction = parseTransaction({ ...current, ...patch, id });
            if (!transaction) {
              await client.query("ROLLBACK");
              sendJson(response, 400, { error: "Enter a valid date, description, category, and non-negative amount." }, headers);
              return;
            }
            const metadata = { ...currentResult.rows[0].metadata, ...transaction.metadata };
            const result = await client.query(
              `UPDATE transactions SET transaction_date = $2, description = $3,
                 category_id = $4, amount = $5, metadata = $6::jsonb, updated_at = now()
               WHERE id = $1
               RETURNING id, transaction_date::text AS date, description,
                         category_id AS "categoryId", amount::text AS amount, metadata`,
              [id, transaction.date, transaction.description, transaction.categoryId,
                transaction.amount, JSON.stringify(metadata)],
            );
            await client.query("COMMIT");
            sendJson(response, 200, transactionFromRow(result.rows[0]), headers);
            return;
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          } finally {
            client.release();
          }
        }
        if (request.method === "DELETE") {
          const result = await pool.query("DELETE FROM transactions WHERE id = $1", [id]);
          if (!result.rowCount) {
            sendJson(response, 404, { error: "Transaction not found." }, headers);
            return;
          }
          response.writeHead(204, headers);
          response.end();
          return;
        }
      }

      sendJson(response, 404, { error: "Not found." }, headers);
    } catch (error) {
      const { status, message } = error.status
        ? { status: error.status, message: error.message }
        : databaseError(error);
      if (status === 500) console.error(error);
      sendJson(response, status, { error: message }, headers);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env before starting the API.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const host = process.env.API_HOST || "127.0.0.1";
  const port = Number(process.env.API_PORT || 3000);
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  const server = createApiServer(pool, { allowedOrigins });
  pool.query("SELECT 1").then(() => {
    server.listen(port, host, () => console.log(`PostgreSQL API listening on http://${host}:${port}`));
  }).catch((error) => {
    console.error("Could not connect to PostgreSQL.", error.message);
    process.exitCode = 1;
    void pool.end();
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => void pool.end()));
  }
}