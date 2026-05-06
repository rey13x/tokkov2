import { NextResponse } from "next/server";
import { getFirebaseFirestore } from "@/server/firebase-admin";

export async function POST(request: Request) {
  // Dev-only endpoint - only works in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { message: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const firestore = getFirebaseFirestore() as any;
  if (!firestore) {
    return NextResponse.json(
      { message: "Firestore not available" },
      { status: 500 }
    );
  }

  try {
    const now = Date.now();

    // Sample Products
    const products = [
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

    const informations = [
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

    const testimonials = [
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

    const portfolioItems = [
      {
        title: "Portfolio Raihaan Bp",
        description: "Portfolio profesional Raihaan Bp dalam bidang digital marketing dan development.",
        imageUrl: "/assets/bagas.jpg",
        category: "Portfolio",
        link: "",
        sortOrder: 1,
        isActive: true,
      },
    ];

    // Seed products
    for (const product of products) {
      await firestore
        .collection("products")
        .doc(product.slug)
        .set({
          ...product,
          createdAt: now,
          updatedAt: now,
        });
    }

    // Seed informations
    for (const info of informations) {
      const docId = crypto.randomUUID();
      await firestore.collection("informations").doc(docId).set({
        ...info,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Seed testimonials
    for (const testimonial of testimonials) {
      const docId = crypto.randomUUID();
      await firestore.collection("testimonials").doc(docId).set({
        ...testimonial,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Seed portfolio items
    for (const item of portfolioItems) {
      const docId = crypto.randomUUID();
      await firestore.collection("portfolioItems").doc(docId).set({
        ...item,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Seed system settings
    await firestore.collection("systemSettings").doc("main").set({
      maintenanceMode: false,
      maintenanceModeMessage: "Sistem sedang dalam pemeliharaan. Mohon coba beberapa saat lagi.",
      updatedAt: now,
    });

    return NextResponse.json(
      {
        message: "✅ Firestore seed successful!",
        summary: {
          products: products.length,
          informations: informations.length,
          testimonials: testimonials.length,
          portfolioItems: portfolioItems.length,
          systemSettings: 1,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Seed failed:", error);
    return NextResponse.json(
      {
        message: `Seed failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
