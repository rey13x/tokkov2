import type {
  StoreInformation,
  StoreMarqueeItem,
  StoreProduct,
  StoreTestimonial,
} from "@/types/store";

export async function fetchStoreData() {
  const response = await fetch("/api/store");
  if (!response.ok) {
    throw new Error("Failed to fetch store");
  }

  const data = (await response.json()) as {
    products: StoreProduct[];
    informations: StoreInformation[];
    testimonials: StoreTestimonial[];
    marquees?: StoreMarqueeItem[];
  };

  return data;
}
