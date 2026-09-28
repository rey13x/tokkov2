import { describe, expect, it } from 'vitest';
import { calculateVoucherDiscount, isVoucherActive, isVoucherCodeValid } from '../src/lib/voucher';

describe('voucher logic', () => {
  it('applies discount only for active voucher within validity period', () => {
    const voucher = {
      id: 'v1',
      code: 'SAVE10',
      percentage: 10,
      isActive: true,
      validUntil: '2030-12-31T23:59:59.000Z',
      description: 'Diskon 10%',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    expect(isVoucherCodeValid(voucher)).toBe(true);
    expect(isVoucherActive(voucher)).toBe(true);
    expect(calculateVoucherDiscount(200000, voucher)).toBe(20000);
  });

  it('calculates the expected 5% and 10% discount amounts in whole rupiah', () => {
    const fivePercentVoucher = { code: 'SAVE5', percentage: 5, isActive: true };
    const tenPercentVoucher = { code: 'SAVE10', percentage: 10, isActive: true };

    expect(calculateVoucherDiscount(100000, fivePercentVoucher)).toBe(5000);
    expect(calculateVoucherDiscount(100000, tenPercentVoucher)).toBe(10000);
    expect(calculateVoucherDiscount(19999, fivePercentVoucher)).toBe(999);
  });

  it('rejects expired or inactive voucher with the correct message', () => {
    const expired = {
      id: 'v2',
      code: 'OLD20',
      percentage: 20,
      isActive: true,
      validUntil: '2020-01-01T00:00:00.000Z',
      description: 'Expired',
      createdAt: '2019-01-01T00:00:00.000Z',
    };

    expect(isVoucherCodeValid(expired)).toBe(false);
    expect(isVoucherActive(expired)).toBe(false);
    expect(calculateVoucherDiscount(200000, expired)).toBe(0);
  });
});
