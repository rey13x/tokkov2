export type Voucher = {
  id: string;
  code: string;
  description: string;
  percentage: number;
  isActive: boolean;
  validUntil: string | null;
  createdAt: string;
};

export function normalizeVoucherCode(value: string) {
  return value.trim().toUpperCase();
}

export function isVoucherActive(voucher?: Partial<Voucher> | null) {
  if (!voucher) return false;
  if (!voucher.isActive) return false;

  if (!voucher.validUntil) return true;

  const validUntil = new Date(voucher.validUntil).getTime();
  if (!Number.isFinite(validUntil)) return true;

  return Date.now() <= validUntil;
}

export function isVoucherCodeValid(voucher?: Partial<Voucher> | null) {
  if (!voucher) return false;
  if (!voucher.code || !voucher.percentage || voucher.percentage <= 0) return false;
  return isVoucherActive(voucher);
}

export function calculateVoucherDiscount(subtotal: number, voucher?: Partial<Voucher> | null) {
  if (!voucher || !isVoucherCodeValid(voucher)) return 0;
  const safeSubtotal = Math.max(0, Number(subtotal ?? 0));
  const percentage = Math.max(0, Number(voucher.percentage ?? 0));
  return Math.floor((safeSubtotal * percentage) / 100);
}
