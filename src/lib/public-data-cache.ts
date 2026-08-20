const memoryCache = new Map<string, unknown>();
const pendingRequests = new Map<string, Promise<unknown>>();

export const PUBLIC_DATA_CACHE_KEY = {
  store: "tokko_store_data_cache_v2",
  heroBackgrounds: "tokko_hero_backgrounds_cache_v1",
  portfolio: "tokko_portfolio_cache_v1",
  bookStories: "tokko_book_stories_cache_v1",
} as const;

function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as T;
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
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Continue with the in-memory cache when browser storage is unavailable.
  }
}

export function fetchSessionCached<T>(key: string, url: string, init?: RequestInit): Promise<T> {
  const memoryValue = memoryCache.get(key) as T | undefined;
  if (memoryValue !== undefined) {
    return Promise.resolve(memoryValue);
  }

  const sessionValue = readSessionCache<T>(key);
  if (sessionValue !== null) {
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
  pendingRequests.delete(key);
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(key);
  }
}
