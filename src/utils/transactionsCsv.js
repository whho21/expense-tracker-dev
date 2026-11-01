const COLUMNS = ["Date", "Description", "Category", "Type", "Amount", "Currency", "Merchant"];

function csvCell(value) {
  const text = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function transactionsToCsv(transactions) {
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.description,
    transaction.category,
    transaction.type,
    Number.isFinite(Number(transaction.amount)) ? Number(transaction.amount).toFixed(2) : transaction.amount,
    transaction.receiptCurrency,
    transaction.merchant,
  ]);
  return `\uFEFF${[COLUMNS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function downloadTransactionsCsv(transactions, date = new Date()) {
  if (!transactions.length) return false;
  const csv = transactionsToCsv(transactions);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `transactions-${date.toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}