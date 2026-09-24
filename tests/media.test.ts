import { describe, expect, it } from 'vitest';
import { DEFAULT_MEDIA_IMAGE, getOptimizedImageSrc, resolveMediaUrl } from '../src/lib/media';
import { shouldNotifyOrderCancellation } from '../src/lib/order-cancel';
import { DEFAULT_IMAGE_MAX_SIZE_BYTES, getImageUploadError } from '../src/lib/upload-constraints';

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
  it('limits logo upload size so heavy images are rejected early', () => {
    const file = { type: 'image/png', size: DEFAULT_IMAGE_MAX_SIZE_BYTES + 1 } as File;
    expect(getImageUploadError(file)).toContain('Maksimal');

    const validFile = { type: 'image/webp', size: 120 * 1024 } as File;
    expect(getImageUploadError(validFile)).toBe('');
  });
});
