import { describe, expect, it, vi } from "vitest";
import { buildReceiptPurchases, prepareReceiptPhoto } from "./receipt";

describe("phone receipt preparation", () => {
  it("resizes without upscaling and returns the existing upload contract", async () => {
    const transform = vi.fn().mockResolvedValue({ uri: "photo.jpg", base64: "aGVsbG8=" });
    expect(await prepareReceiptPhoto({ uri: "original.heic", width: 4000, height: 3000 }, transform)).toEqual({
      uri: "photo.jpg", fileData: "data:image/jpeg;base64,aGVsbG8=", fileName: "receipt.jpg",
    });
    expect(transform).toHaveBeenCalledWith("original.heic", { width: 2000, height: 1500 }, 0.85);
    await prepareReceiptPhoto({ uri: "small.png", width: 800, height: 600 }, transform);
    expect(transform).toHaveBeenLastCalledWith("small.png", { width: 800, height: 600 }, 0.85);
  });

  it("retries compression and rejects images still exceeding the server limit", async () => {
    const transform = vi.fn().mockResolvedValue({ uri: "large.jpg", base64: "a".repeat(5_600_000) });
    await expect(prepareReceiptPhoto({ uri: "large.png", width: 4000, height: 3000 }, transform)).rejects.toThrow("4 MB");
    expect(transform).toHaveBeenCalledTimes(3);
  });

  it("creates linked purchases using the shared allocation policy", () => {
    const purchases = buildReceiptPurchases(
      { id: "receipt-1", merchant: "Shop", date: "2026-11-01", amount: 10.9, currency: "SGD" },
      [{ id: "line-1", description: "Apples", amount: 6, categoryId: "food" },
        { id: "line-2", description: "Soap", amount: 4, categoryId: "food" }],
      [{ id: "food", type: "expense" }],
    );
    expect(purchases.map((purchase) => purchase.amount)).toEqual([6.54, 4.36]);
    expect(purchases.every((purchase) => purchase.receiptId === "receipt-1")).toBe(true);
    expect(purchases[0].receiptCategorySource).toBe("manual");
  });
});