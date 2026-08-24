import {
  getPaymentSettings,
  getPrivacyPolicyPage,
  listDonationActivities,
  listInformations,
  listMarquees,
  listProducts,
  listStoryReels,
  listTestimonials,
} from "@/server/store-data";
import type { StoreData } from "@/lib/store-client";
import { ensureDatabase } from "@/server/db";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const PUBLIC_DATA_TIMEOUT_MS = 3_000;
const MAX_PUBLIC_INLINE_MEDIA_LENGTH = 20_000;
const PUBLIC_DATA_CACHE_FILE = path.join(process.cwd(), "storage", "cache", "public-store.json");
let localSnapshot: { data: StoreData; cachedAt: number } | null = null;
let refreshPromise: Promise<StoreData> | null = null;

function compactInlineMedia(value: StoreData): StoreData {
  const fallbackForMediaField = (key: string) => {
    if (/audio/i.test(key)) {
      return "/assets/notif.mp3";
    }
    return "/assets/Background.jpg";
  };

  const compact = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(compact);
    }
    if (!item || typeof item !== "object") {
      return item;
    }

    return Object.fromEntries(
      Object.entries(item).map(([key, nestedValue]) => {
        const isMediaField = /url|image|media|audio|video/i.test(key);
        if (isMediaField && typeof nestedValue === "string" && nestedValue.startsWith("data:") && nestedValue.length > MAX_PUBLIC_INLINE_MEDIA_LENGTH) {
          return [key, fallbackForMediaField(key)];
        }
        return [key, compact(nestedValue)];
      }),
    );
  };

  return compact(value) as StoreData;
}

function withTimeout<T>(promise: Promise<T>, fallback: T, name: string, timeoutMs = PUBLIC_DATA_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`Public store data timed out: ${name}`);
      resolve(fallback);
    }, timeoutMs);
  });

  return Promise.race([
    promise.catch((error) => {
      console.error(`Failed to load public store data: ${name}`, error);
      return fallback;
    }),
    timeout,
  ]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function loadPublicStoreData(): Promise<StoreData> {
  const [products, informations, testimonials, marquees, storyReels, paymentSettings, privacyPolicy, donationActivities] = await Promise.all([
    withTimeout(listProducts(), [], "products", 15_000),
    withTimeout(listInformations(), [], "informations"),
    withTimeout(listTestimonials(), [], "testimonials"),
    withTimeout(listMarquees(), [], "marquees"),
    withTimeout(listStoryReels(), [], "storyReels"),
    withTimeout(getPaymentSettings(), null, "paymentSettings"),
    withTimeout(getPrivacyPolicyPage(), null, "privacyPolicy"),
    withTimeout(listDonationActivities(), [], "donationActivities"),
  ]);

  const data = compactInlineMedia({ products, informations, testimonials, marquees, storyReels, paymentSettings, privacyPolicy, donationActivities });
  if (products.length > 0 || informations.length > 0 || testimonials.length > 0) {
    localSnapshot = { data, cachedAt: Date.now() };
    await mkdir(path.dirname(PUBLIC_DATA_CACHE_FILE), { recursive: true }).catch(() => undefined);
    await writeFile(PUBLIC_DATA_CACHE_FILE, JSON.stringify(localSnapshot), "utf8").catch(() => undefined);
  }
  return data;
}

function readLocalSnapshot() {
  if (localSnapshot) {
    return localSnapshot;
  }

  try {
    const raw = readFileSync(PUBLIC_DATA_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { data?: StoreData; cachedAt?: number };
    const hasCatalog = Boolean(parsed.data?.products && parsed.data.products.length > 0);
    if (parsed.data && typeof parsed.cachedAt === "number" && hasCatalog) {
      localSnapshot = { data: compactInlineMedia(parsed.data), cachedAt: parsed.cachedAt };
      return localSnapshot;
    }
  } catch {
    // The first request populates the local snapshot.
  }
  return null;
}

function refreshLocalSnapshot() {
  if (!refreshPromise) {
    refreshPromise = loadPublicStoreData().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function refreshPublicStoreData() {
  void refreshLocalSnapshot();
}

export function getPublicStoreData(): Promise<StoreData> {
  void ensureDatabase().catch((error) => {
    console.error("Failed to bootstrap local database mirror:", error);
  });
  const snapshot = readLocalSnapshot();
  if (snapshot) {
    if (Date.now() - snapshot.cachedAt >= 30_000) {
      void refreshLocalSnapshot();
    }
    return Promise.resolve(snapshot.data);
  }
  void refreshLocalSnapshot();
  return refreshLocalSnapshot();
}
