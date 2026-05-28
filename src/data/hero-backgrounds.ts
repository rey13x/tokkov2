/**
 * Hero Background Carousel Configuration
 *
 * ⚙️ PENGATURAN ANIMASI & CAROUSEL
 * - Fade Animation: 400ms (cepat)
 * - Pause Time: bisa berbeda per foto
 *
 * 📸 CARA MENAMBAH FOTO BARU:
 * 1. Upload file ke /public/assets/ (contoh: /assets/bg5.jpeg)
 * 2. Tambah ke array HERO_IMAGES dibawah
 * 3. Sesuaikan durasi pause di HERO_CONFIG jika perlu
 */

// ============================================================
// ANIMASI SETTINGS
// ============================================================

/** Durasi fade in/fade out dalam milidetik */
export const ANIMATION_DURATION_MS = 400; // Dipercepat dari ~800ms

/**
 * Konfigurasi durasi pause per foto
 * Key: path ke foto (contoh: "/assets/bg2.jpeg")
 * Value: durasi pause dalam milidetik sebelum ganti ke foto berikutnya
 */
export const HERO_CONFIG = {
  // Foto awal (selalu tampil duluan saat page load)
  "/assets/backgroundv2.png": {
    duration: 8000, // 8 detik
    label: "Background Default",
  },
  // Carousel photos dengan durasi pause
  "/assets/bg2.jpeg": {
    duration: 6000, // 6 detik - dipercepat
    label: "Background 2",
  },
  "/assets/bg3.jpeg": {
    duration: 8000, // 8 detik
    label: "Background 3",
  },
  "/assets/bg4.jpeg": {
    duration: 8000, // 8 detik
    label: "Background 4",
  },
} as const;

// ============================================================
// HERO IMAGES
// ============================================================

/** Foto awal yang ditampilkan saat page load */
const STARTING_PHOTO = "/assets/backgroundv2.png";

/**
 * Daftar foto untuk carousel (random)
 * Jangan ada duplikat dengan STARTING_PHOTO
 */
const CAROUSEL_PHOTOS = [
  "/assets/bg2.jpeg",
  "/assets/bg3.jpeg",
  "/assets/bg4.jpeg",
];

/** Semua foto hero termasuk starting photo */
export const HERO_BACKGROUND_URLS: string[] = [STARTING_PHOTO, ...CAROUSEL_PHOTOS];

// ============================================================
// EXPORTS
// ============================================================

/** Hanya foto carousel (exclude foto awal) */
export const CAROUSEL_PHOTOS_ONLY = CAROUSEL_PHOTOS;

/** Durasi pause default (fallback jika foto tidak ada di HERO_CONFIG) */
export const DEFAULT_PAUSE_DURATION_MS = 8000;

/**
 * Helper function: dapatkan durasi pause untuk foto tertentu
 * @param photoUrl - Path foto (contoh: "/assets/bg2.jpeg")
 * @returns Durasi pause dalam milidetik
 */
export function getPhotoDuration(photoUrl: string): number {
  return HERO_CONFIG[photoUrl as keyof typeof HERO_CONFIG]?.duration ?? DEFAULT_PAUSE_DURATION_MS;
}

/**
 * Daftar background yang tersedia untuk dipilih (admin/ui purposes)
 */
export const AVAILABLE_HERO_BACKGROUNDS = [
  { id: "backgroundv2", label: "Background Default", url: "/assets/backgroundv2.png" },
  { id: "bg2", label: "Background 2", url: "/assets/bg2.jpeg" },
  { id: "bg3", label: "Background 3", url: "/assets/bg3.jpeg" },
  { id: "bg4", label: "Background 4", url: "/assets/bg4.jpeg" },
];
