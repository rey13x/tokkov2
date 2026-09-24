import { describe, expect, it } from 'vitest';
import { DEFAULT_MEDIA_IMAGE, getOptimizedImageSrc, resolveMediaUrl } from '../src/lib/media';
import { shouldNotifyOrderCancellation } from '../src/lib/order-cancel';
import { DEFAULT_IMAGE_MAX_SIZE_BYTES, getImageUploadError } from '../src/lib/upload-constraints';
import { buildStockDeductionSummary } from '../src/lib/stock';

describe('media fallback behavior', () => {
  it('keeps empty media values empty instead of forcing the Sobat Profil fallback', () => {
    expect(DEFAULT_MEDIA_IMAGE).toBe('/assets/sobatprofil.jpg');
    expect(resolveMediaUrl('')).toBe('');
    expect(resolveMediaUrl('   ')).toBe('');
  });

  it('keeps optimization enabled for remote media URLs', () => {
    expect(getOptimizedImageSrc('https://example.com/image.jpg')).toBe(
      '/api/media/optimized?url=https%3A%2F%2Fexample.com%2Fimage.jpg',
    );
  });
});

describe('order cancellation notifications', () => {
  it('suppresses telegram cancellation alert for QRIS expiry cleanup', () => {
    expect(shouldNotifyOrderCancellation('expired_qris_cleanup')).toBe(false);
    expect(shouldNotifyOrderCancellation('user')).toBe(true);
  });
});

describe('image upload constraints', () => {
  it('accepts smaller images and only rejects files above the 450KB cap', () => {
    const tooLargeFile = { type: 'image/png', size: DEFAULT_IMAGE_MAX_SIZE_BYTES + 1 } as File;
    expect(getImageUploadError(tooLargeFile)).toContain('Maksimal');

    const tinyFile = { type: 'image/webp', size: 300 * 1024 } as File;
    expect(getImageUploadError(tinyFile)).toBe('');

    const validFile = { type: 'image/webp', size: 450 * 1024 } as File;
    expect(getImageUploadError(validFile)).toBe('');
  });
});

describe('stock deduction notifications', () => {
  it('summarizes paid-order stock deductions for admin telegram alerts', () => {
    const summary = buildStockDeductionSummary([
      { productName: 'Kopi Premium', productType: 'jual_beli', quantity: 2, previousStock: 7, currentStock: 5 },
      { productName: 'Donasi Dukungan', productType: 'donation', quantity: 1, previousStock: 0, currentStock: 0 },
    ]);

    expect(summary).toContain('Kopi Premium');
    expect(summary).toContain('7 → 5');
    expect(summary).not.toContain('Donasi Dukungan');
  });
});
