import { reconcileReceiptItems } from "../../src/utils/receiptItems.js";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function prepareReceiptPhoto(asset, transform) {
  if (!asset?.uri || !asset.width || !asset.height) throw new Error("Choose a valid receipt image.");
  const scale = Math.min(1, 2000 / Math.max(asset.width, asset.height));
  const size = { width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) };
  for (const quality of [0.85, 0.65, 0.45]) {
    const result = await transform(asset.uri, size, quality);
    const base64 = result.base64;
    if (typeof base64 !== "string" || !base64.length) throw new Error("Could not prepare the receipt photo.");
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    const bytes = Math.floor(base64.length * 3 / 4) - padding;
    if (bytes <= MAX_IMAGE_BYTES) {
      return { uri: result.uri, fileData: `data:image/jpeg;base64,${base64}`, fileName: "receipt.jpg" };
    }
  }
  throw new Error("The image is still larger than 4 MB. Choose a smaller or more closely framed photo.");
}

export function buildReceiptPurchases(receipt, items, categories) {
  const reconciliation = reconcileReceiptItems(items, receipt.amount);
  if (reconciliation.error) throw new Error(reconciliation.error);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt.date)) throw new Error("Enter the receipt date as YYYY-MM-DD.");
  if (items.some((item) => !item.description.trim() || item.description.length > 100 ||
      !categories.some((category) => category.id === item.categoryId && category.type === "expense"))) {
    throw new Error("Enter a description and choose an expense category for every purchase.");
  }
  return items.map((item, index) => ({
    date: receipt.date,
    description: item.description.trim(),
    categoryId: item.categoryId,
    amount: reconciliation.amounts[index],
    receiptId: receipt.id,
    receiptLineId: item.id,
    merchant: receipt.merchant,
    receiptCurrency: receipt.currency,
    receiptTotal: Number(receipt.amount),
    receiptSubtotal: receipt.subtotal ?? null,
    receiptTax: receipt.tax ?? null,
    receiptDiscount: receipt.discount ?? null,
    receiptAdjustmentPolicy: "proportional-net",
    receiptLineAmount: Number(item.amount),
    receiptLineAdjustment: Number((reconciliation.amounts[index] - Number(item.amount)).toFixed(2)),
    quantity: item.quantity ?? null,
    unitPrice: item.unitPrice ?? null,
    receiptLineTax: item.tax ?? null,
    receiptLineDiscount: item.discount ?? null,
    receiptCategorySource: item.categorySource || "manual",
    receiptCategorySuggestion: item.suggestion ? {
      model: item.suggestion.model,
      categoryId: item.suggestion.categoryId,
      confidence: item.suggestion.confidence,
      probability: item.suggestion.probability,
    } : null,
  }));
}