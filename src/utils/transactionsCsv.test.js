import { describe, expect, it } from "vitest";
import { transactionsToCsv } from "./transactionsCsv";

describe("transactionsToCsv", () => {
  it("exports standard and receipt transaction fields as UTF-8 CSV", () => {
    const csv = transactionsToCsv([{
      date: "2026-11-01", description: 'Lunch, "team"', category: "Food", type: "expense",
      amount: 12.5, receiptCurrency: "SGD", merchant: "Cafe",
    }]);
    expect(csv).toBe('\uFEFF"Date","Description","Category","Type","Amount","Currency","Merchant"\r\n' +
      '"2026-11-01","Lunch, ""team""","Food","expense","12.50","SGD","Cafe"\r\n');
  });

  it.each(["=SUM(1,1)", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "neutralizes spreadsheet formulas beginning with %j",
    (value) => {
      expect(transactionsToCsv([{ description: value }])).toContain(`"'${value.replaceAll('"', '""')}"`);
    },
  );

  it("returns a header-only document for no matching transactions", () => {
    expect(transactionsToCsv([])).toBe('\uFEFF"Date","Description","Category","Type","Amount","Currency","Merchant"\r\n');
  });
});