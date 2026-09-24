import { describe, expect, it } from 'vitest';
import { DEFAULT_MEDIA_IMAGE, getOptimizedImageSrc, resolveMediaUrl } from '../src/lib/media';
import { shouldNotifyOrderCancellation } from '../src/lib/order-cancel';

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
