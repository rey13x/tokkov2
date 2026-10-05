import type { OrderSummary, StoreProduct } from "@/types/store";

export type FinanceAdjustmentDirection = "add" | "subtract";
export type FinanceAdjustmentEffect = "revenue" | "hpp" | "expense" | "profit" | "cash";

export type FinanceAdjustment = {
  id: string;
  date: string;
  description: string;
  direction: FinanceAdjustmentDirection;
  affects: FinanceAdjustmentEffect;
  amount: number;
  createdAt: string;
};

export type FinanceSettings = {
  costByProductId: Record<string, number>;
  adjustments: FinanceAdjustment[];
};

export type FinanceSummary = {
  paidOrderCount: number;
  revenue: number;
  hpp: number;
  grossProfit: number;
  operatingExpenses: number;
  directProfitAdjustments: number;
  netProfit: number;
  cashAdjustments: number;
};

const RECOGNIZED_PAID_STATUSES = new Set(["paid", "done", "delivered", "sent", "cancelled"]);

export function isOrderPaid(order: Pick<OrderSummary, "status">) {
  return RECOGNIZED_PAID_STATUSES.has(order.status.trim().toLowerCase());
}

export function getOrderHpp(order: OrderSummary, costByProductId: Record<string, number>) {
  if (!isOrderPaid(order)) {
    return 0;
  }

  return (order.items ?? []).reduce((sum, item) => {
    const unitCost = Math.max(0, Number(costByProductId[item.productId] ?? 0));
    return sum + unitCost * Math.max(0, Number(item.quantity ?? 0));
  }, 0);
}

export function calculateFinanceSummary(
  orders: OrderSummary[],
  costByProductId: Record<string, number>,
  adjustments: FinanceAdjustment[],
): FinanceSummary {
  const paidOrders = orders.filter(isOrderPaid);
  let revenue = paidOrders.reduce((sum, order) => sum + Math.max(0, Number(order.total ?? 0)), 0);
  let hpp = paidOrders.reduce((sum, order) => sum + getOrderHpp(order, costByProductId), 0);
  let operatingExpenses = 0;
  let directProfitAdjustments = 0;
  let cashAdjustments = 0;

  for (const adjustment of adjustments) {
    const signedAmount = Math.max(0, Number(adjustment.amount) || 0) * (adjustment.direction === "subtract" ? -1 : 1);
    if (adjustment.affects === "revenue") revenue += signedAmount;
    if (adjustment.affects === "hpp") hpp += signedAmount;
    if (adjustment.affects === "expense") operatingExpenses += signedAmount;
    if (adjustment.affects === "profit") directProfitAdjustments += signedAmount;
    if (adjustment.affects === "cash") cashAdjustments += signedAmount;
  }

  revenue = Math.max(0, revenue);
  hpp = Math.max(0, hpp);
  operatingExpenses = Math.max(0, operatingExpenses);
  const grossProfit = revenue - hpp;

  return {
    paidOrderCount: paidOrders.length,
    revenue,
    hpp,
    grossProfit,
    operatingExpenses,
    directProfitAdjustments,
    netProfit: grossProfit - operatingExpenses + directProfitAdjustments,
    cashAdjustments,
  };
}

export function buildFinanceOrderRows(
  orders: OrderSummary[],
  products: StoreProduct[],
  costByProductId: Record<string, number>,
) {
  const productById = new Map(products.map((product) => [product.id, product]));
  return orders.map((order) => {
    const paid = isOrderPaid(order);
    const orderHpp = getOrderHpp(order, costByProductId);
    const revenue = paid ? Math.max(0, Number(order.total ?? 0)) : 0;
    const items = order.items ?? [];
    const itemLabel = items.map((item) => `${item.productName} ×${item.quantity}`).join("; ");
    const productTypes = [...new Set(items.map((item) => item.productType ?? productById.get(item.productId)?.productType ?? "jual_beli"))];

    return {
      order,
      paid,
      itemLabel,
      productTypes: productTypes.join(", "),
      orderAmount: Math.max(0, Number(order.total ?? 0)),
      revenue,
      hpp: orderHpp,
      grossProfit: revenue - orderHpp,
    };
  });
}