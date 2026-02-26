import type { StaticImageData } from "next/image";
import backgroundImage from "@/app/assets/Background.jpg";
import canvaImage from "@/app/assets/Canva.jpg";
import logoImage from "@/app/assets/Logo.png";
import primeVideoImage from "@/app/assets/Prime Vidio.jpg";

export type ProductCategory =
  | "App Premium"
  | "My SMM"
  | "Seller"
  | "Jasa Website"
  | "Jasa Aplikasi"
  | "Jasa Editing";

export type ProductItem = {
  id: number;
  slug: string;
  name: string;
  category: ProductCategory;
  description: string;
  shortDescription: string;
  price: number;
  image: StaticImageData;
  popular?: boolean;
};

export type InformationItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  image: StaticImageData;
};

export const categories: ProductCategory[] = [
  "App Premium",
  "Jasa Website",
  "Jasa Aplikasi",
  "Jasa Editing",
  "My SMM",
  "Seller",
];

export const products: ProductItem[] = [
  {
    id: 1,
    slug: "netflix-private-1-bulan",
    name: "Netflix Private 1 Bulan",
    category: "App Premium",
    description:
      "Akun private siap pakai kualitas HD dengan garansi. Cocok untuk nonton santai dan bebas iklan.",
    shortDescription: "Akun private HD + garansi",
    price: 59000,
    image: backgroundImage,
    popular: true,
  },
  {
    id: 2,
    slug: "spotify-premium-family",
    name: "Spotify Premium Family",
    category: "App Premium",
    description:
      "Upgrade akun Spotify tanpa iklan, mode offline aktif, dan kualitas audio maksimal.",
    shortDescription: "Anti iklan, mode offline",
    price: 25000,
    image: primeVideoImage,
    popular: true,
  },
  {
    id: 3,
    slug: "youtube-premium-share",
    name: "YouTube Premium Share",
    category: "App Premium",
    description:
      "Nikmati YouTube tanpa iklan dengan dukungan login aman dan panduan aktivasi cepat.",
    shortDescription: "No ads, aktivasi cepat",
    price: 28000,
    image: canvaImage,
    popular: true,
  },
  {
    id: 4,
    slug: "canva-pro-team",
    name: "Canva Pro Team",
    category: "App Premium",
    description:
      "Fitur premium Canva lengkap untuk desain konten, presentasi, dan kebutuhan promosi.",
    shortDescription: "Template premium lengkap",
    price: 32000,
    image: canvaImage,
    popular: true,
  },
  {
    id: 5,
    slug: "boost-instagram-followers",
    name: "Boost Instagram Followers",
    category: "My SMM",
    description:
      "Paket penambahan followers bertahap, stabil, dan cocok untuk kebutuhan branding akun.",
    shortDescription: "Followers bertahap dan stabil",
    price: 45000,
    image: logoImage,
  },
  {
    id: 6,
    slug: "boost-instagram-likes",
    name: "Boost Instagram Likes",
    category: "My SMM",
    description:
      "Tingkatkan engagement postingan dengan likes real mix untuk konten personal maupun bisnis.",
    shortDescription: "Engagement postingan naik",
    price: 15000,
    image: primeVideoImage,
  },
  {
    id: 7,
    slug: "tiktok-views-50k",
    name: "TikTok Views 50K",
    category: "My SMM",
    description:
      "Paket views cepat masuk untuk memperkuat momentum konten dan mempercepat reach.",
    shortDescription: "Views cepat masuk",
    price: 39000,
    image: backgroundImage,
  },
  {
    id: 8,
    slug: "jasa-admin-marketplace",
    name: "Jasa Admin Marketplace",
    category: "Seller",
    description:
      "Layanan admin toko online untuk upload produk, optimasi judul, dan respons chat customer.",
    shortDescription: "Kelola toko lebih efisien",
    price: 350000,
    image: logoImage,
  },
  {
    id: 9,
    slug: "optimasi-listing-shopee",
    name: "Optimasi Listing Shopee",
    category: "Seller",
    description:
      "Perbaikan tampilan listing agar conversion naik melalui copywriting, visual, dan penataan katalog.",
    shortDescription: "Listing siap jual",
    price: 180000,
    image: canvaImage,
  },
  {
    id: 10,
    slug: "paket-foto-produk",
    name: "Paket Foto Produk Seller",
    category: "Seller",
    description:
      "Foto produk clean dan profesional untuk kebutuhan toko online, iklan, dan katalog brand.",
    shortDescription: "Foto produk profesional",
    price: 275000,
    image: primeVideoImage,
  },
  {
    id: 11,
    slug: "landing-page-konversi",
    name: "Landing Page Konversi",
    category: "Jasa Website",
    description:
      "Pembuatan landing page fokus conversion dengan struktur copy, CTA, dan performa cepat.",
    shortDescription: "Desain conversion-oriented",
    price: 650000,
    image: backgroundImage,
    popular: true,
  },
  {
    id: 12,
    slug: "website-company-profile",
    name: "Website Company Profile",
    category: "Jasa Website",
    description:
      "Website profil bisnis modern, mobile-first, dan SEO-ready untuk membangun kepercayaan brand.",
    shortDescription: "Website bisnis modern",
    price: 1250000,
    image: logoImage,
  },
  {
    id: 13,
    slug: "website-toko-online",
    name: "Website Toko Online",
    category: "Jasa Website",
    description:
      "Bangun toko online dengan fitur katalog, checkout, dan integrasi pembayaran.",
    shortDescription: "Toko online siap jual",
    price: 2100000,
    image: canvaImage,
  },
  {
    id: 14,
    slug: "maintenance-website-bulanan",
    name: "Maintenance Website Bulanan",
    category: "Jasa Website",
    description:
      "Paket maintenance berkala untuk update plugin, backup data, dan pemantauan performa.",
    shortDescription: "Backup, update, monitoring",
    price: 550000,
    image: primeVideoImage,
  },
  {
    id: 15,
    slug: "jasa-aplikasi-kasir",
    name: "Jasa Aplikasi Kasir",
    category: "Jasa Aplikasi",
    description:
      "Pengembangan aplikasi kasir custom untuk UMKM dengan dashboard laporan transaksi real-time.",
    shortDescription: "Aplikasi kasir custom",
    price: 3500000,
    image: backgroundImage,
    popular: true,
  },
  {
    id: 16,
    slug: "jasa-aplikasi-reservasi",
    name: "Jasa Aplikasi Reservasi",
    category: "Jasa Aplikasi",
    description:
      "Aplikasi reservasi untuk klinik, salon, dan jasa booking lain dengan notifikasi otomatis.",
    shortDescription: "Booking otomatis",
    price: 4200000,
    image: canvaImage,
  },
  {
    id: 17,
    slug: "jasa-dashboard-internal",
    name: "Jasa Dashboard Internal",
    category: "Jasa Aplikasi",
    description:
      "Pembuatan dashboard internal untuk monitoring data operasional secara aman dan terstruktur.",
    shortDescription: "Dashboard data internal",
    price: 2800000,
    image: logoImage,
  },
  {
    id: 18,
    slug: "jasa-integrasi-api",
    name: "Jasa Integrasi API",
    category: "Jasa Aplikasi",
    description:
      "Integrasi antar sistem melalui API untuk sinkronisasi data order, stok, dan laporan.",
    shortDescription: "Sinkronisasi data sistem",
    price: 1750000,
    image: primeVideoImage,
  },
  {
    id: 19,
    slug: "jasa-editing-feed-instagram",
    name: "Jasa Editing Feed Instagram",
    category: "Jasa Editing",
    description:
      "Desain feed rapi dengan style konsisten agar branding akun terlihat profesional.",
    shortDescription: "Feed branding profesional",
    price: 250000,
    image: canvaImage,
  },
  {
    id: 20,
    slug: "jasa-video-short-form",
    name: "Jasa Video Short Form",
    category: "Jasa Editing",
    description:
      "Editing video pendek untuk Reels dan TikTok dengan transisi halus dan subtitle clean.",
    shortDescription: "Video reels cepat jadi",
    price: 300000,
    image: backgroundImage,
  },
  {
    id: 21,
    slug: "jasa-editing-iklan-produk",
    name: "Jasa Editing Iklan Produk",
    category: "Jasa Editing",
    description:
      "Paket editing iklan dengan pacing tajam untuk meningkatkan click-through rate kampanye.",
    shortDescription: "Editing iklan performa",
    price: 450000,
    image: primeVideoImage,
  },
  {
    id: 22,
    slug: "jasa-thumbnail-youtube",
    name: "Jasa Thumbnail YouTube",
    category: "Jasa Editing",
    description:
      "Desain thumbnail CTR-friendly dengan komposisi visual tajam dan headline kuat.",
    shortDescription: "Thumbnail CTR-friendly",
    price: 120000,
    image: logoImage,
  },
  {
    id: 23,
    slug: "jasa-booster-penjualan-live",
    name: "Booster Penjualan Live",
    category: "Seller",
    description:
      "Strategi dan eksekusi live shopping agar traffic dan konversi penjualan naik konsisten.",
    shortDescription: "Optimasi performa live",
    price: 600000,
    image: backgroundImage,
  },
  {
    id: 24,
    slug: "paket-smm-all-platform",
    name: "Paket SMM All Platform",
    category: "My SMM",
    description:
      "Paket gabungan untuk Instagram, TikTok, dan YouTube dalam satu dashboard pemesanan.",
    shortDescription: "Satu paket multi platform",
    price: 89000,
    image: canvaImage,
  },
];

export const featuredProducts = products.filter((product) => product.popular).slice(0, 8);

export const mixedProducts = [...products].slice(8, 20);

export const informationItems: InformationItem[] = [
  {
    id: "info-1",
    title: "Pesan Promo Mingguan",
    description:
      "Admin bisa mengisi pesan campaign terbaru, update voucher, atau instruksi pembelian.",
    date: "5 Juni 2025",
    image: backgroundImage,
  },
  {
    id: "info-2",
    title: "Polling Produk Favorit",
    description:
      "Gunakan polling ini untuk vote layanan favorit dan masukan pelanggan.",
    date: "10 Juli 2025",
    image: canvaImage,
  },
];

export const getProductBySlug = (slug: string) =>
  products.find((product) => product.slug === slug);

export const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
