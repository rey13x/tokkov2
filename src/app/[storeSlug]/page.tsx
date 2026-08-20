import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { getPayGateStoreBySlug, listPayGateProducts } from "@/server/paygate/native";
import { getOrderById } from "@/server/store-data";
import StorefrontClient from "./StorefrontClient";

export default async function PayGateStorefrontPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await getPayGateStoreBySlug(storeSlug);
  if (!store) {
    // Keep old receipt/QR links usable when they contain the order UUID at root.
    const order = await getOrderById(storeSlug);
    if (order) {
      redirect(`/api/orders/${encodeURIComponent(storeSlug)}/receipt`);
    }
    notFound();
  }
  const products = await listPayGateProducts(store.id);
  return <StorefrontClient store={store} products={products} />;
}
