import type { OrderSummary } from "@/types/store";

type PurchaseOrder = Pick<OrderSummary, "userEmail" | "status" | "paidAt" | "items">;

export type TestimonialProduct = { id: string; name: string };

const PURCHASED_ORDER_STATUSES = new Set(["paid", "done", "delivered", "sent"]);

export function getTestimonialPurchasedProducts(
  orders: PurchaseOrder[],
  userEmail: string,
): TestimonialProduct[] {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const products = new Map<string, string>();

  for (const order of orders) {
    const isPaidOrder = PURCHASED_ORDER_STATUSES.has(order.status.toLowerCase()) ||
      (order.status.toLowerCase() === "cancelled" && Boolean(order.paidAt));
    if (!isPaidOrder || order.userEmail.trim().toLowerCase() !== normalizedEmail) {
      continue;
    }

    for (const item of order.items ?? []) {
      if (item.productType === "donation" || !item.productId || !item.productName.trim()) {
        continue;
      }
      products.set(item.productId, item.productName.trim());
    }
  }

  return Array.from(products, ([id, name]) => ({ id, name }));
}
