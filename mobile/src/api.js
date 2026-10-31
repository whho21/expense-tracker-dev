function baseUrl(value) {
  if (!value || !/^https?:\/\//.test(value)) throw new Error("Configure absolute receipt and transaction API URLs.");
  return value.replace(/\/+$/, "");
}

export function createReceiptClient(config) {
  const receiptUrl = baseUrl(config.receiptBaseUrl);
  const transactionUrl = baseUrl(config.transactionBaseUrl);
  let saving = false;

  const request = async (url, options = {}, timeout = 30_000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  };
  const post = (url, data) => request(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });

  return {
    async transactions() {
      const records = await request(`${transactionUrl}/transactions`);
      if (!Array.isArray(records)) throw new Error("Could not load transactions.");
      return records;
    },
    async categories() {
      const categories = await request(`${transactionUrl}/categories`);
      if (!Array.isArray(categories)) throw new Error("Could not load expense categories.");
      return categories.filter((category) => category.type === "expense");
    },
    parse: (photo) => post(`${receiptUrl}/api/receipt/parse`, { fileData: photo.fileData, fileName: photo.fileName }),
    categorize: (receipt, items, categories) => post(`${receiptUrl}/api/receipt/categorize`, {
      merchant: receipt.merchant,
      items: items.map((item) => ({ id: item.id, description: item.description })),
      categories: categories.map((category) => ({
        id: category.id, name: category.name, type: category.type,
        ...(category.description ? { description: category.description } : {}),
      })),
    }),
    async save(purchases) {
      if (saving) return { saved: [], error: "A receipt save is already in progress." };
      saving = true;
      const saved = [];
      let uncertain = false;
      try {
        for (const purchase of purchases) {
          let record;
          try {
            record = await post(`${transactionUrl}/transactions`, purchase);
          } catch (error) {
            try {
              const records = await request(`${transactionUrl}/transactions`);
              if (!Array.isArray(records)) throw new Error("Could not verify purchases.", { cause: error });
              record = records.find((candidate) => candidate.receiptId === purchase.receiptId &&
                candidate.receiptLineId === purchase.receiptLineId);
            } catch {
              uncertain = true;
            }
            if (!record) throw error;
          }
          saved.push({ ...purchase, ...record });
        }
        return { saved, error: null };
      } catch (error) {
        return { saved, error: error.message, uncertain };
      } finally {
        saving = false;
      }
    },
  };
}