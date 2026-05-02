# 📋 Panduan Upload Environment Variables ke Vercel

## ⚡ Quick Start

Semua env vars yang diperlukan untuk Vercel sudah tersedia di file ini.

### File Referensi:

- 🔍 Lihat semua variable di: **`.env.vercel.example`**
- 🛡️ Backup lokal: **`.env`** (jangan di-push ke GitHub!)

---

## 📝 Step-by-Step Upload ke Vercel

### 1️⃣ Buka Vercel Dashboard

```
https://vercel.com → tokkov2 project → Settings → Environment Variables
```

### 2️⃣ Copy Variables Satu Per Satu

**Kategori A: NEXTAUTH (Production)**

```
NEXTAUTH_URL = https://tokkov2.vercel.app
NEXTAUTH_SECRET = [COPY DARI .env]
```

**Kategori B: FIREBASE - Frontend (Public - aman untuk client)**

```
NEXT_PUBLIC_FIREBASE_API_KEY = [COPY DARI .env.local]
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = [COPY DARI .env.local]
NEXT_PUBLIC_FIREBASE_PROJECT_ID = [COPY DARI .env.local]
NEXT_PUBLIC_FIREBASE_APP_ID = [COPY DARI .env.local]
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = [COPY DARI .env.local]
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = [COPY DARI .env.local]
```

**Kategori C: FIREBASE - Backend (Secret - JANGAN di-share)**

```
FIREBASE_PROJECT_ID = [COPY DARI .env]
FIREBASE_CLIENT_EMAIL = [COPY DARI .env]
FIREBASE_PRIVATE_KEY = [COPY DARI .env - SELURUH PRIVATE KEY]
```

⚠️ Untuk `FIREBASE_PRIVATE_KEY`: Salin SELURUH isi dari `.env` file, termasuk spasi dan `\n`

**Kategori D: DATABASE (Turso)**

```
TURSO_URL = [COPY DARI .env]
TURSO_AUTH_TOKEN = [COPY DARI .env]
```

**Kategori E: GOOGLE OAUTH**

```
GOOGLE_CLIENT_ID = [COPY DARI .env]
GOOGLE_CLIENT_SECRET = [COPY DARI .env]
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED = true
```

**Kategori F: ADMIN**

```
ADMIN_EMAIL = [COPY DARI .env]
```

**Kategori G: FEATURE FLAGS**

```
FILE_UPLOAD_ENABLED = false
NEXT_PUBLIC_FILE_UPLOAD_ENABLED = false
EMAIL_OTP_ENABLED = false
NEXT_PUBLIC_EMAIL_OTP_ENABLED = false
```

**Kategori H: TELEGRAM (Optional)**

```
TELEGRAM_BOT_TOKEN = [COPY DARI .env JIKA ADA]
TELEGRAM_CHAT_ID = [KOSONGKAN ATAU ISI SESUAI KEBUTUHAN]
```

---

## 🎯 Verifikasi Setelah Upload

### 3️⃣ Redeploy di Vercel

Setelah semua variables di-upload:

1. Buka Vercel Dashboard → **Deployments**
2. Klik tiga titik (kebab menu) di deployment terbaru
3. Pilih **Redeploy**
4. Tunggu build selesai

### 4️⃣ Cek Hasil

```bash
# Buka site di: https://tokkov2.vercel.app

# Cek di browser console:
window.__FIREBASE_CONFIG__ # Harus ada Firebase config
```

---

## ⚠️ Hal-hal Penting

### Jangan Lakukan ❌

- ❌ **Jangan** push `.env` ke GitHub
- ❌ **Jangan** share `FIREBASE_PRIVATE_KEY` / `GOOGLE_CLIENT_SECRET` secara publik
- ❌ **Jangan** copy-paste dari `.env.local` (itu untuk lokal dev saja)

### Pastikan ✅

- ✅ Semua `NEXT_PUBLIC_*` variables di-set di Vercel
- ✅ Semua credentials tersembunyi (private) sudah di-set
- ✅ Build berhasil setelah redeploy
- ✅ Site bisa load product dari Firestore

---

## 🔍 Mana Ambil Value-nya?

| Variable                  | Ambil dari              | File Lokal                            |
| ------------------------- | ----------------------- | ------------------------------------- |
| `NEXTAUTH_URL`            | Manual (production URL) | `.env`                                |
| `NEXTAUTH_SECRET`         | `.env` file             | Line dengan SECRET                    |
| `NEXT_PUBLIC_FIREBASE_*`  | `.env.local` file       | FIREBASE PUBLIC KEYS section          |
| `FIREBASE_PROJECT_ID`     | `.env` file             | FIREBASE_PROJECT_ID                   |
| `FIREBASE_CLIENT_EMAIL`   | `.env` file             | FIREBASE_CLIENT_EMAIL                 |
| `FIREBASE_PRIVATE_KEY`    | `.env` file             | FIREBASE_PRIVATE_KEY (seluruh isinya) |
| `TURSO_URL`               | `.env` file             | TURSO_URL                             |
| `TURSO_AUTH_TOKEN`        | `.env` file             | TURSO_AUTH_TOKEN                      |
| `GOOGLE_CLIENT_ID/SECRET` | `.env` file             | Google OAuth section                  |
| `ADMIN_EMAIL`             | `.env` file             | ADMIN_EMAIL                           |

---

## 🚀 Setelah Semua Selesai

### Cleanup Data Lama

Setelah Vercel berhasil redeploy dengan config baru, bisa cleanup data produk lama:

```bash
# 1. Lihat semua produk
node scripts/cleanup-old-products.mjs

# 2. Hapus yang nonaktif
node scripts/cleanup-old-products.mjs --delete-inactive

# 3. Atau hapus SEMUA produk (untuk reset total)
node scripts/cleanup-old-products.mjs --delete-all
```

---

## 📞 Bantuan

Jika ada masalah:

1. Cek build logs di Vercel Deployments tab
2. Pastikan semua variables sudah benar (terutama `FIREBASE_PRIVATE_KEY`)
3. Cek network tab di browser console saat akses tokkov2.vercel.app
