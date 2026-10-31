import { afterEach, describe, expect, it, vi } from "vitest";
import { createReceiptClient } from "./api";

const client = () => createReceiptClient({ receiptBaseUrl: "http://192.168.1.2:3002", transactionBaseUrl: "http://192.168.1.2:3000" });
const response = (data) => ({ ok: true, json: async () => data });
const purchases = [
  { receiptId: "receipt", receiptLineId: "line-1", amount: 5 },
  { receiptId: "receipt", receiptLineId: "line-2", amount: 10 },
];
afterEach(() => vi.unstubAllGlobals());

describe("mobile receipt API", () => {
  it("uses explicit phone-reachable URLs and existing endpoint contracts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ amount: 5 }));
    vi.stubGlobal("fetch", fetchMock);
    await client().parse({ fileData: "data:image/jpeg;base64,aA==", fileName: "receipt.jpg" });
    expect(fetchMock.mock.calls[0][0]).toBe("http://192.168.1.2:3002/api/receipt/parse");
    expect(() => createReceiptClient({})).toThrow("absolute");
  });

  it("keeps confirmed saves when a later purchase fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ id: "first", ...purchases[0] }))
      .mockRejectedValueOnce(new Error("network failure")).mockResolvedValueOnce(response([purchases[0]])));
    const result = await client().save(purchases);
    expect(result.saved).toHaveLength(1);
    expect(result.uncertain).toBe(false);
  });

  it("recovers a committed purchase after a lost response", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("lost response"))
      .mockResolvedValueOnce(response([{ id: "first", ...purchases[0] }]))
      .mockResolvedValueOnce(response({ id: "second", ...purchases[1] }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await client().save(purchases)).saved).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(2);
  });

  it("reports an uncertain save if verification fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await client().save(purchases)).uncertain).toBe(true);
  });
});