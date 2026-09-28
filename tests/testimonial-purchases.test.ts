import { describe, expect, it } from "vitest";
import { getTestimonialPurchasedProducts } from "../src/lib/testimonial-purchases";

describe("testimonial purchased products", () => {
  it("returns unique products from paid orders belonging to the user", () => {
    const orders = [
      {
        userEmail: "sobat@example.com",
        status: "paid",
        items: [
          { productId: "p1", productName: "Canva Pro", quantity: 1, unitPrice: 1000 },
          { productId: "p2", productName: "CapCut Pro", productType: "lms" as const, quantity: 1, unitPrice: 1000 },
        ],
      },
      {
        userEmail: "SOBAT@example.com",
        status: "sent",
        items: [{ productId: "p1", productName: "Canva Pro", quantity: 1, unitPrice: 1000 }],
      },
      {
        userEmail: "other@example.com",
        status: "paid",
        items: [{ productId: "p3", productName: "Netflix", quantity: 1, unitPrice: 1000 }],
      },
      {
        userEmail: "sobat@example.com",
        status: "process",
        items: [{ productId: "p4", productName: "Unpaid", quantity: 1, unitPrice: 1000 }],
      },
    ];

    expect(getTestimonialPurchasedProducts(orders, "sobat@example.com")).toEqual([
      { id: "p1", name: "Canva Pro" },
      { id: "p2", name: "CapCut Pro" },
    ]);
  });

  it("ignores donations and unpaid or unrelated orders", () => {
    expect(getTestimonialPurchasedProducts([
      {
        userEmail: "sobat@example.com",
        status: "paid",
        items: [{ productId: "donation", productName: "Donasi", productType: "donation", quantity: 1, unitPrice: 1000 }],
      },
    ], "sobat@example.com")).toEqual([]);
  });
});
