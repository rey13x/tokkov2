export const CART_STORAGE_KEY = "tokko_cart";

export type CartEntry = {
  slug: string;
  quantity: number;
};

function clampQuantity(value: number) {
  return Math.min(99, Math.max(1, value));
}

export function readCart(): CartEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<CartEntry>>;
    return parsed
      .filter((item) => typeof item.slug === "string" && item.slug.length > 0)
      .map((item) => ({
        slug: item.slug as string,
        quantity: clampQuantity(
          typeof item.quantity === "number" ? item.quantity : Number(item.quantity ?? 1),
        ),
      }));
  } catch {
    return [];
  }
}

export function saveCart(items: CartEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(slug: string, quantity: number) {
  const cart = readCart();
  const existing = cart.find((item) => item.slug === slug);

  if (existing) {
    existing.quantity = clampQuantity(existing.quantity + quantity);
    saveCart(cart);
    return;
  }

  cart.push({ slug, quantity: clampQuantity(quantity) });
  saveCart(cart);
}

export function updateCartQuantity(slug: string, quantity: number) {
  const cart = readCart();
  const target = cart.find((item) => item.slug === slug);

  if (!target) {
    return;
  }

  target.quantity = clampQuantity(quantity);
  saveCart(cart);
}

export function removeFromCart(slug: string) {
  const cart = readCart().filter((item) => item.slug !== slug);
  saveCart(cart);
}

export function clearCart() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(CART_STORAGE_KEY);
}

export function getCartCount() {
  return readCart().reduce((total, item) => total + item.quantity, 0);
}

