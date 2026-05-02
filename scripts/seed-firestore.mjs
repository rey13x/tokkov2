import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, "../service-account.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Sample data
const sampleProducts = [
  {
    name: "Netflix Private 1 Bulan",
    slug: "netflix-private-1-bulan",
    slugLower: "netflix-private-1-bulan",
    category: "App Premium",
    shortDescription: "Akun private HD + garansi",
    description: "Akun private siap pakai kualitas HD dengan garansi. Cocok untuk nonton santai dan bebas iklan.",
    price: 59000,
    duration: "1 bulan",
    imageUrl: "/assets/Background.jpg",
    isActive: true,
    productType: "jual_beli",
    jobApplicationLink: "",
    maxApplicants: 0,
    applicantCount: 0,
  },
  {
    name: "Spotify Premium Family",
    slug: "spotify-premium-family",
    slugLower: "spotify-premium-family",
    category: "App Premium",
    shortDescription: "Anti iklan, mode offline",
    description: "Upgrade akun Spotify tanpa iklan, mode offline aktif, dan kualitas audio maksimal.",
    price: 25000,
    duration: "1 bulan",
    imageUrl: "/assets/Prime Vidio.jpg",
    isActive: true,
    productType: "jual_beli",
    jobApplicationLink: "",
    maxApplicants: 0,
    applicantCount: 0,
  },
  {
    name: "YouTube Premium Share",
    slug: "youtube-premium-share",
    slugLower: "youtube-premium-share",
    category: "App Premium",
    shortDescription: "No ads, aktivasi cepat",
    description: "Nikmati YouTube tanpa iklan dengan dukungan login aman dan panduan aktivasi cepat.",
    price: 28000,
    duration: "1 bulan",
    imageUrl: "/assets/Canva.jpg",
    isActive: true,
    productType: "jual_beli",
    jobApplicationLink: "",
    maxApplicants: 0,
    applicantCount: 0,
  },
  {
    name: "Canva Pro Team",
    slug: "canva-pro-team",
    slugLower: "canva-pro-team",
    category: "App Premium",
    shortDescription: "Template premium lengkap",
    description: "Fitur premium Canva lengkap untuk desain konten, presentasi, dan kebutuhan promosi.",
    price: 32000,
    duration: "1 bulan",
    imageUrl: "/assets/Canva.jpg",
    isActive: true,
    productType: "jual_beli",
    jobApplicationLink: "",
    maxApplicants: 0,
    applicantCount: 0,
  },
  {
    name: "Boost Instagram Followers",
    slug: "boost-instagram-followers",
    slugLower: "boost-instagram-followers",
    category: "My SMM",
    shortDescription: "Followers bertahap dan stabil",
    description: "Paket penambahan followers bertahap, stabil, dan cocok untuk kebutuhan branding akun.",
    price: 45000,
    duration: "2 minggu",
    imageUrl: "/assets/Logo.png",
    isActive: true,
    productType: "jual_beli",
    jobApplicationLink: "",
    maxApplicants: 0,
    applicantCount: 0,
  },
];

const sampleInformations = [
  {
    type: "berita",
    title: "Promo Spesial Bulan Ini",
    body: "Dapatkan diskon hingga 50% untuk produk pilihan sepanjang bulan ini. Buruan sebelum kehabisan!",
    imageUrl: "/assets/Background.jpg",
    pollOptions: [],
    pollVotes: {},
  },
  {
    type: "pengumuman",
    title: "Update Fitur Baru Book Spirit",
    body: "Kami dengan bangga mengumumkan peluncuran fitur Book Spirit untuk berbagi cerita dan pengalaman Anda bersama komunitas Tokko.",
    imageUrl: "/assets/Logo.png",
    pollOptions: [],
    pollVotes: {},
  },
];

const sampleTestimonials = [
  {
    name: "Andi Wijaya",
    country: "Indonesia",
    roleLabel: "Entrepreneur",
    message: "Layanan di Tokko sangat membantu bisniku. Produk berkualitas dan support team responsif!",
    rating: 5,
    mediaUrl: "/assets/Logo.png",
    audioUrl: "/assets/notif.mp3",
  },
  {
    name: "Siti Nurhaliza",
    country: "Indonesia",
    roleLabel: "Content Creator",
    message: "Paket SMM dari Tokko benar-benar membantu grow akun saya. Rekomendasi banget!",
    rating: 5,
    mediaUrl: "/assets/Background.jpg",
    audioUrl: "/assets/notif.mp3",
  },
];

async function seedFirestore() {
  try {
    console.log("🌱 Starting Firestore seed...\n");

    const now = Date.now();

    // Seed Products
    console.log("📦 Seeding products...");
    for (const product of sampleProducts) {
      const docId = product.slug;
      await db.collection("products").doc(docId).set({
        ...product,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  ✅ ${product.name}`);
    }

    // Seed Informations
    console.log("\n📰 Seeding informations...");
    for (const info of sampleInformations) {
      const docId = crypto.randomUUID();
      await db.collection("informations").doc(docId).set({
        ...info,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  ✅ ${info.title}`);
    }

    // Seed Testimonials
    console.log("\n⭐ Seeding testimonials...");
    for (const testimonial of sampleTestimonials) {
      const docId = crypto.randomUUID();
      await db.collection("testimonials").doc(docId).set({
        ...testimonial,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  ✅ ${testimonial.name}`);
    }

    // Seed System Settings
    console.log("\n⚙️  Seeding system settings...");
    await db.collection("systemSettings").doc("main").set({
      maintenanceMode: false,
      maintenanceModeMessage: "Sistem sedang dalam pemeliharaan. Mohon coba beberapa saat lagi.",
      updatedAt: now,
    });
    console.log("  ✅ System settings");

    console.log("\n✨ Firestore seed complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seedFirestore();
