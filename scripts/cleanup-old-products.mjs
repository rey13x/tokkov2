#!/usr/bin/env node

/**
 * Script untuk cleanup produk lama di Firestore
 * Usage: node scripts/cleanup-old-products.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

// Load service account
const serviceAccountPath = path.join(process.cwd(), "service-account.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ service-account.json tidak ditemukan!");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function cleanupProducts() {
  try {
    console.log("📋 Fetching semua produk...\n");

    const snapshot = await db.collection("products").get();
    const products = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (products.length === 0) {
      console.log("✅ Database sudah kosong!");
      process.exit(0);
    }

    console.log(`Total produk: ${products.length}\n`);
    console.log("📦 Daftar produk saat ini:\n");

    products.forEach((p, idx) => {
      const status = p.isActive ? "✅ AKTIF" : "❌ NONAKTIF";
      console.log(`${idx + 1}. ${p.name} (${p.category})`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Harga: Rp${p.price?.toLocaleString("id-ID") || 0}`);
      console.log(`   Status: ${status}\n`);
    });

    const inactiveCount = products.filter((p) => !p.isActive).length;

    if (inactiveCount === 0) {
      console.log("✅ Semua produk aktif. Tidak ada yang perlu dihapus.");
      process.exit(0);
    }

    console.log(`\n⚠️  Ada ${inactiveCount} produk NONAKTIF.`);
    console.log("Untuk menghapus, jalankan dengan flag: node scripts/cleanup-old-products.mjs --delete-inactive\n");

    // Check command line arguments
    if (process.argv.includes("--delete-inactive")) {
      console.log("🗑️  Menghapus produk nonaktif...\n");
      let deletedCount = 0;

      for (const product of products) {
        if (!product.isActive) {
          await db.collection("products").doc(product.id).delete();
          console.log(`✓ Dihapus: ${product.name}`);
          deletedCount++;
        }
      }

      console.log(`\n✅ Selesai! ${deletedCount} produk dihapus.`);
    }

    if (process.argv.includes("--delete-all")) {
      console.log("🗑️  MENGHAPUS SEMUA PRODUK...\n");

      for (const product of products) {
        await db.collection("products").doc(product.id).delete();
        console.log(`✓ Dihapus: ${product.name}`);
      }

      console.log(`\n✅ Selesai! ${products.length} produk dihapus.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

cleanupProducts();
