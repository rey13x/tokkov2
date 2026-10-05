import type {
  StoreInformation,
  StoreMarqueeItem,
  StorePaymentSettings,
  StorePrivacyPolicyPage,
  StoreProduct,
    DonationActivity,
  PublicStoreStoryReel,
  StoreTestimonial,
} from "@/types/store";
import {
  clearSessionCached,
  fetchSessionCached,
  PUBLIC_DATA_CACHE_KEY,
} from "@/lib/public-data-cache";

export type StoreData = {
  products: StoreProduct[];
  informations: StoreInformation[];
  testimonials: StoreTestimonial[];
  marquees?: StoreMarqueeItem[];
  storyReels?: PublicStoreStoryReel[];
  paymentSettings?: StorePaymentSettings | null;
  privacyPolicy?: StorePrivacyPolicyPage | null;
  donationActivities?: DonationActivity[];
};

export function fetchStoreData(): Promise<StoreData> {
  return fetchSessionCached<StoreData>(PUBLIC_DATA_CACHE_KEY.store, "/api/store", {
    cache: "no-store",
  });
}

export function fetchStoreProducts(): Promise<Pick<StoreData, "products">> {
  return fetchSessionCached<Pick<StoreData, "products">>(
    PUBLIC_DATA_CACHE_KEY.storeProducts,
    "/api/store?productsOnly=1",
    { cache: "no-store" },
  );
}

export function fetchStoreSupportingData(): Promise<Omit<StoreData, "products">> {
  return fetchSessionCached<Omit<StoreData, "products">>(
    PUBLIC_DATA_CACHE_KEY.storeSupporting,
    "/api/store?withoutProducts=1",
    { cache: "no-store" },
  );
}

export function clearStoreDataCache(broadcastInvalidation = true) {
  clearSessionCached(PUBLIC_DATA_CACHE_KEY.store, false);
  clearSessionCached(PUBLIC_DATA_CACHE_KEY.storeProducts, false);
  clearSessionCached(PUBLIC_DATA_CACHE_KEY.storeSupporting, false);
  if (broadcastInvalidation && typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("tokko:store-data-invalidated", String(Date.now()));
  }
}
