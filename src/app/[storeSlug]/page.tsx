import { notFound } from "next/navigation";
import { getPayGateStoreBySlug, listPayGateProducts } from "@/server/paygate/native";
import StorefrontClient from "./StorefrontClient";

export default async function PayGateStorefrontPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const store = await getPayGateStoreBySlug(storeSlug);
  if (!store) notFound();
  const products = await listPayGateProducts(store.id);
  return <StorefrontClient store={store} products={products} />;
}
