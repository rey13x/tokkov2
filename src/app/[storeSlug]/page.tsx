import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { getPayGateStoreBySlug, listPayGateProducts } from "@/server/paygate/native";
import { getOrderById } from "@/server/store-data";
import StorefrontClient from "./StorefrontClient";

export default async function PayGateStorefrontPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storeSlug)) {
    redirect(`/api/orders/${encodeURIComponent(storeSlug)}/receipt`);
  }
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
