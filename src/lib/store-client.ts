import type {
  StoreInformation,
  StoreMarqueeItem,
  StorePaymentSettings,
  StorePrivacyPolicyPage,
  StoreProduct,
    DonationActivity,
  StoreStoryReel,
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
  storyReels?: StoreStoryReel[];
  paymentSettings?: StorePaymentSettings | null;
  privacyPolicy?: StorePrivacyPolicyPage | null;
  donationActivities?: DonationActivity[];
};

export const EMPTY_STORE_DATA: StoreData = {
  products: [],
  informations: [],
  testimonials: [],
  marquees: [],
  storyReels: [],
  paymentSettings: null,
  privacyPolicy: null,
  donationActivities: [],
};

export function fetchStoreData(): Promise<StoreData> {
  return fetchSessionCached<StoreData>(PUBLIC_DATA_CACHE_KEY.store, "/api/store", {
    cache: "no-store",
  });
}

export function clearStoreDataCache() {
  clearSessionCached(PUBLIC_DATA_CACHE_KEY.store);
}
