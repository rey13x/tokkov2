import { describe, expect, it } from "vitest";
import { calculateFinanceSummary, getOrderHpp, isOrderPaid } from "../src/lib/finance-report";
import type { OrderSummary } from "../src/types/store";

const paidOrder: OrderSummary = {
  id: "order-1",
  userName: "Sobat",
  userEmail: "sobat@example.com",
  userPhone: "081200000000",
  total: 20_000,
  status: "paid",
  createdAt: "2026-10-01T10:00:00.000Z",
  items: [
    { id: "item-1", orderId: "order-1", productId: "product-1", productName: "Paket A", productDuration: "1 bulan", quantity: 2, unitPrice: 10_000 },
  ],
};

const pendingOrder: OrderSummary = {
  ...paidOrder,
  id: "order-2",
  status: "process",
  createdAt: "2026-10-02T10:00:00.000Z",
};

describe("finance report calculations", () => {
  it("counts only confirmed sales and calculates HPP from units sold", () => {
    expect(isOrderPaid(paidOrder)).toBe(true);
    expect(isOrderPaid(pendingOrder)).toBe(false);
    expect(getOrderHpp(paidOrder, { "product-1": 4_000 })).toBe(8_000);
    expect(getOrderHpp(pendingOrder, { "product-1": 4_000 })).toBe(0);
  });

  it("applies add/subtract entries to the selected ledger without mixing cash-only changes into profit", () => {
    const summary = calculateFinanceSummary(
      [paidOrder, pendingOrder],
      { "product-1": 4_000 },
      [
        { id: "income", date: "2026-10-01T12:00:00.000Z", description: "Extra income", direction: "add", affects: "revenue", amount: 2_000, createdAt: "2026-10-01T12:00:00.000Z" },
        { id: "cost", date: "2026-10-01T12:00:00.000Z", description: "Packing", direction: "add", affects: "expense", amount: 1_000, createdAt: "2026-10-01T12:00:00.000Z" },
        { id: "profit", date: "2026-10-01T12:00:00.000Z", description: "Correction", direction: "subtract", affects: "profit", amount: 500, createdAt: "2026-10-01T12:00:00.000Z" },
        { id: "cash", date: "2026-10-01T12:00:00.000Z", description: "Cash out", direction: "subtract", affects: "cash", amount: 3_000, createdAt: "2026-10-01T12:00:00.000Z" },
      ],
    );

    expect(summary).toEqual({
      paidOrderCount: 1,
      revenue: 22_000,
      hpp: 8_000,
      grossProfit: 14_000,
      operatingExpenses: 1_000,
      directProfitAdjustments: -500,
      netProfit: 12_500,
      cashAdjustments: -3_000,
    });
  });
});