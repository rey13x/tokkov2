const memoryCache = new Map<string, unknown>();
const memoryCacheTimes = new Map<string, number>();
const pendingRequests = new Map<string, Promise<unknown>>();

export const PUBLIC_DATA_CACHE_KEY = {
  store: "tokko_store_data_cache_v2",
  heroBackgrounds: "tokko_hero_backgrounds_cache_v1",
  portfolio: "tokko_portfolio_cache_v1",
  bookStories: "tokko_book_stories_cache_v1",
} as const;

function readSessionCache<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as { value?: T; cachedAt?: number };
    if (typeof parsed.cachedAt === "number" && Date.now() - parsed.cachedAt < ttlMs) {
      return parsed.value as T;
    }
    window.sessionStorage.removeItem(key);
    return null;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify({ value, cachedAt: Date.now() }));
  } catch {
    // Continue with the in-memory cache when browser storage is unavailable.
  }
}

export function fetchSessionCached<T>(key: string, url: string, init?: RequestInit): Promise<T> {
  const ttlMs = key === PUBLIC_DATA_CACHE_KEY.heroBackgrounds
    ? 0
    : key === PUBLIC_DATA_CACHE_KEY.store
    ? 30_000
      : 5 * 60_000;
  const memoryValue = memoryCache.get(key) as T | undefined;
  const memoryCachedAt = memoryCacheTimes.get(key) ?? 0;
  const memoryIsEmptyStore = key === PUBLIC_DATA_CACHE_KEY.store
    && Array.isArray((memoryValue as { products?: unknown[] } | undefined)?.products)
    && (memoryValue as { products: unknown[] }).products.length === 0;
  if (memoryValue !== undefined && !memoryIsEmptyStore && Date.now() - memoryCachedAt < ttlMs) {
    return Promise.resolve(memoryValue);
  }
  memoryCache.delete(key);
  memoryCacheTimes.delete(key);

  const sessionValue = readSessionCache<T>(key, ttlMs);
  const sessionIsEmptyStore = key === PUBLIC_DATA_CACHE_KEY.store
    && Array.isArray((sessionValue as { products?: unknown[] } | null)?.products)
    && (sessionValue as { products: unknown[] }).products.length === 0;
  if (sessionValue !== null && !sessionIsEmptyStore) {
    memoryCache.set(key, sessionValue);
    return Promise.resolve(sessionValue);
  }

  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const request = fetch(url, init)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}`);
      }

      const value = (await response.json()) as T;
      memoryCache.set(key, value);
      memoryCacheTimes.set(key, Date.now());
      writeSessionCache(key, value);
      return value;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);
  return request;
}

export function clearSessionCached(key: string) {
  memoryCache.delete(key);
  memoryCacheTimes.delete(key);
  pendingRequests.delete(key);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(key);
  }
}

export function updateCachedStoreData(update: (data: import("@/lib/store-client").StoreData) => import("@/lib/store-client").StoreData) {
  const current = memoryCache.get(PUBLIC_DATA_CACHE_KEY.store) as import("@/lib/store-client").StoreData | undefined
    ?? readSessionCache<import("@/lib/store-client").StoreData>(PUBLIC_DATA_CACHE_KEY.store, Number.MAX_SAFE_INTEGER);
  if (!current) {
    return;
  }
  const next = update(current);
  memoryCache.set(PUBLIC_DATA_CACHE_KEY.store, next);
  memoryCacheTimes.set(PUBLIC_DATA_CACHE_KEY.store, Date.now());
  writeSessionCache(PUBLIC_DATA_CACHE_KEY.store, next);
}
