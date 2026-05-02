/**
 * Generate a device fingerprint based on browser/device characteristics
 * This is used to track account creation attempts per device
 */

export function generateDeviceFingerprint(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency?.toString() || "",
    (navigator as any).deviceMemory?.toString() || "",
    screen.width?.toString() || "",
    screen.height?.toString() || "",
    screen.colorDepth?.toString() || "",
    new Date().getTimezoneOffset().toString(),
    navigator.plugins?.length?.toString() || "",
  ];

  const combined = components.join("|");
  return hashString(combined);
}

/**
 * Simple hash function for fingerprint
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get or create persisted device ID using localStorage
 * Falls back to session storage, then to temporary fingerprint
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    // Try localStorage first (persists across sessions)
    const stored = localStorage.getItem("__device_id");
    if (stored) {
      return stored;
    }

    // Generate new device ID
    const fingerprint = generateDeviceFingerprint();
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const deviceId = `${fingerprint}-${timestamp}-${random}`;

    // Try to store it
    localStorage.setItem("__device_id", deviceId);
    return deviceId;
  } catch (error) {
    // If localStorage fails, use sessionStorage
    try {
      const stored = sessionStorage.getItem("__device_id");
      if (stored) {
        return stored;
      }

      const fingerprint = generateDeviceFingerprint();
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const deviceId = `${fingerprint}-${timestamp}-${random}`;

      sessionStorage.setItem("__device_id", deviceId);
      return deviceId;
    } catch {
      // If all storage fails, return a temporary fingerprint
      return generateDeviceFingerprint();
    }
  }
}
