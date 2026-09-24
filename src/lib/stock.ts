export type StockDeductionItem = {
  productName: string;
  productType?: string;
  quantity: number;
  previousStock: number;
  currentStock: number;
};

export function buildStockDeductionSummary(items: StockDeductionItem[]) {
  const productItems = items.filter((item) => item.productType === "jual_beli");

  if (productItems.length === 0) {
    return "";
  }

  return productItems
    .map((item) => `• ${item.productName} x${item.quantity} • stok ${item.previousStock} → ${item.currentStock}`)
    .join("\n");
}
