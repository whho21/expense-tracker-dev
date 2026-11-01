// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiServer } from "./api.js";

async function serve(pool, options) {
  const server = createApiServer(pool, options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

afterEach(() => vi.restoreAllMocks());

describe("PostgreSQL REST API", () => {
  it("returns categories from PostgreSQL", async () => {
    const rows = [{ id: "food", name: "Food", type: "expense", icon: "F" }];
    const pool = { query: vi.fn().mockResolvedValue({ rows }) };
    const { server, baseUrl } = await serve(pool);
    try {
      const response = await fetch(`${baseUrl}/categories`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(rows);
    } finally { await close(server); }
  });

  it("creates receipt transactions using parameterized SQL and returns receipt metadata", async () => {
    const row = {
      id: "tx-1", date: "2026-11-01", description: "Coffee", categoryId: "food",
      amount: "4.50", metadata: { receiptId: "receipt-1", receiptLineId: "line-1" },
    };
    const body = { id: row.id, date: row.date, description: row.description, categoryId: row.categoryId,
      amount: 4.5, ...row.metadata };
    const pool = { query: vi.fn().mockResolvedValue({ rows: [row] }) };
    const { server, baseUrl } = await serve(pool);
    try {
      const response = await fetch(`${baseUrl}/transactions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(201);
      const { metadata, ...coreRow } = row;
      expect(await response.json()).toEqual({ ...metadata, ...coreRow, amount: 4.5 });
      const [sql, values] = pool.query.mock.calls[0];
      expect(sql).toContain("VALUES ($1, $2, $3, $4, $5, $6::jsonb)");
      expect(values).toContain("Coffee");
      expect(values).toContain(JSON.stringify(row.metadata));
      expect(sql).not.toContain("Coffee");
    } finally { await close(server); }
  });

  it("rejects invalid transactions before querying the database", async () => {
    const pool = { query: vi.fn() };
    const { server, baseUrl } = await serve(pool);
    try {
      const response = await fetch(`${baseUrl}/transactions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-02-30", description: "bad", categoryId: "food", amount: 2 }),
      });
      expect(response.status).toBe(400);
      expect(pool.query).not.toHaveBeenCalled();
    } finally { await close(server); }
  });

  it("preserves receipt metadata during a partial transaction update", async () => {
    const current = {
      id: "tx-1", date: "2026-11-01", description: "Coffee", categoryId: "food",
      amount: "4.50", metadata: { receiptId: "receipt-1", receiptLineId: "line-1", quantity: 2 },
    };
    const client = {
      query: vi.fn().mockImplementation((sql) => {
        if (sql.includes("SELECT id, transaction_date")) return { rows: [current] };
        if (sql.includes("UPDATE transactions")) return { rows: [{ ...current, description: "Coffee edited", amount: "5.00" }] };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const { server, baseUrl } = await serve(pool);
    try {
      const response = await fetch(`${baseUrl}/transactions/tx-1`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Coffee edited", amount: 5 }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        description: "Coffee edited", receiptId: "receipt-1", receiptLineId: "line-1", quantity: 2,
      });
      const update = client.query.mock.calls.find(([sql]) => sql.includes("UPDATE transactions"));
      expect(JSON.parse(update[1][5])).toEqual(current.metadata);
      expect(client.release).toHaveBeenCalledOnce();
    } finally { await close(server); }
  });

  it("protects in-use categories and reports foreign-key conflicts", async () => {
    const pool = { query: vi.fn().mockRejectedValue({ code: "23503" }) };
    const { server, baseUrl } = await serve(pool);
    try {
      const response = await fetch(`${baseUrl}/categories/food`, { method: "DELETE" });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/category/i);
    } finally { await close(server); }
  });

  it("only grants CORS to configured origins", async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const { server, baseUrl } = await serve(pool, { allowedOrigins: ["http://localhost:5173"] });
    try {
      const allowed = await fetch(`${baseUrl}/categories`, { headers: { Origin: "http://localhost:5173" } });
      const denied = await fetch(`${baseUrl}/categories`, { headers: { Origin: "https://unexpected.example" } });
      expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
      expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    } finally { await close(server); }
  });
});