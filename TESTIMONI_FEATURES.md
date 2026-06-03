# 🎯 Fitur Testimoni & Komentar - Dokumentasi Lengkap

## 📋 Ringkasan Fitur yang Diimplementasikan

### 1. ✅ Edit Rating Komentar (1-5 Bintang)

- **Lokasi:** [src/app/testimoni/TestimoniClient.tsx](src/app/testimoni/TestimoniClient.tsx)
- **Deskripsi:** Pengguna yang memiliki komentar atau admin dapat mengubah rating (bintang) pada setiap komentar
- **UI:** Tombol "Edit" untuk mengubah rating, tampilkan bintang yang dipilih
- **Database:** Field `rating` ditambahkan ke tabel `testimonial_comments`

### 2. ✅ Toggle Verified Badge per Komentar

- **Lokasi:** [src/app/testimoni/TestimoniClient.tsx](src/app/testimoni/TestimoniClient.tsx) & [src/app/api/testimonials/[id]/comments/route.ts](src/app/api/testimonials/[id]/comments/route.ts)
- **Deskripsi:** Admin dapat mengaktifkan/menonaktifkan badge verified (✓) untuk setiap komentar
- **Akses:** Hanya admin yang dapat toggle verified status
- **UI:** Tombol "+ Badge" atau "✓ Hapus Badge" di samping nama pengguna komentar

### 3. ✅ Auto-Generate Komentar dengan AI

- **Lokasi:**
  - API: [src/app/api/testimonials/[id]/ai-comments/route.ts](src/app/api/testimonials/[id]/ai-comments/route.ts)
  - Admin UI: [src/app/admin/page.tsx](src/app/admin/page.tsx) (Testimonials section)
- **Deskripsi:** Admin dapat mengklik tombol "🤖 AI Komentar" untuk membuat 1-20 komentar otomatis
- **AI Model:** OpenAI GPT-3.5-turbo
- **Konfigurasi:** Input field untuk jumlah komentar yang ingin dibuat
- **Format:** Komentar dibuat dengan nama "Tokko AI", rating acak 0-5

### 4. ✅ AI Reply ke Komentar

- **Lokasi:**
  - API: [src/app/api/testimonials/[id]/ai-replies/route.ts](src/app/api/testimonials/[id]/ai-replies/route.ts)
  - Admin UI: [src/app/admin/page.tsx](src/app/admin/page.tsx) (Testimonial Comments section)
- **Deskripsi:** Admin dapat membuat balasan otomatis (reply) ke komentar tertentu
- **Fitur:**
  - Setiap komentar memiliki tombol "🤖 AI Balas"
  - Input untuk jumlah balasan (1-5)
  - Balasan akan ter-tag dengan @username komentar yang dibalas

## 🔧 Setup & Konfigurasi

### 1. Environment Variable

Tambahkan ke `.env.local` (JANGAN push ke GitHub):

```bash
# Dapatkan dari https://platform.openai.com/api-keys
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Database Migration

Kolom `rating` secara otomatis ditambahkan saat aplikasi pertama kali dijalankan melalui migration:

```sql
ALTER TABLE testimonial_comments ADD COLUMN rating INTEGER NOT NULL DEFAULT 0
```

## 📱 Cara Penggunaan

### Di Halaman Testimoni (`/testimoni`)

#### Edit Rating Komentar:

1. Lihat komentar di bawah setiap testimoni
2. Klik tombol "Edit" di bagian rating
3. Pilih bintang (1-5) yang diinginkan
4. Klik "OK" untuk simpan atau "Batal" untuk batal

#### Toggle Verified Badge (Admin Only):

1. Login sebagai admin
2. Lihat komentar
3. Klik tombol "+ Badge" untuk menambah atau "✓ Hapus Badge" untuk menghapus
4. Status akan langsung berubah

### Di Panel Admin (`/admin`) - Testimonials Section

#### Generate Komentar AI:

1. Pergi ke Admin → Testimonial section
2. Lihat daftar testimonial
3. Input jumlah komentar (1-20) di field input
4. Klik tombol "🤖 AI Komentar"
5. Tunggu sampai selesai (menampilkan "Membuat...")
6. Komentar otomatis akan muncul di halaman testimoni

### Di Panel Admin - Testimonial Comments Section

#### Generate Balasan AI:

1. Pergi ke Admin → Komentar Testimoni section
2. Lihat daftar komentar di halaman testimoni
3. Untuk setiap komentar, input jumlah balasan (1-5)
4. Klik tombol "🤖 AI Balas"
5. Balasan akan langsung ditambahkan dengan tag @username

## 🛡️ Security & Permission

### Rating Edit

- **Owner:** Pengguna dapat edit rating komentar mereka sendiri
- **Admin:** Admin dapat edit rating komentar siapapun

### Verified Badge

- **Admin Only:** Hanya admin (user dengan role "admin" atau email "digitalawanku2@gmail.com") yang dapat toggle verified

### AI Features

- **Admin Only:** Hanya admin yang dapat generate komentar dan balasan AI

## ⚠️ Error Handling

### AI API Errors

| Error                                | Solusi                                   |
| ------------------------------------ | ---------------------------------------- |
| "OpenAI API key tidak dikonfigurasi" | Tambahkan OPENAI_API_KEY ke .env.local   |
| "Gagal memanggil OpenAI API"         | Periksa validitas API key, quota OpenAI  |
| "Gagal memproses respons AI"         | Response dari OpenAI tidak sesuai format |

### Validation Errors

- Rating harus 0-5 (otomatis di-clamp)
- Komentar max 500 karakter
- Jumlah AI komentar: 1-20
- Jumlah AI balasan: 1-5

## 🔄 API Endpoints

### GET `/api/testimonials/[id]/comments`

Ambil semua komentar untuk testimoni

### POST `/api/testimonials/[id]/comments`

Tambah komentar baru (perlu login)

### PATCH `/api/testimonials/[id]/comments`

Edit komentar (text, rating, atau verified)

```json
{
  "commentId": "...",
  "text": "new text", // optional
  "rating": 4, // optional
  "verified": true // optional (admin only)
}
```

### DELETE `/api/testimonials/[id]/comments`

Hapus komentar

### POST `/api/testimonials/[id]/ai-comments`

Generate AI comments (admin only)

```json
{
  "count": 3,
  "tone": "positive",
  "topics": ["quality", "service"]
}
```

### POST `/api/testimonials/[id]/ai-replies`

Generate AI replies (admin only)

```json
{
  "commentId": "...",
  "count": 2
}
```

## 🗄️ Database Schema Changes

### testimonial_comments Table

```sql
ALTER TABLE testimonial_comments ADD COLUMN rating INTEGER NOT NULL DEFAULT 0;
```

**Kolom baru:**

- `rating`: INTEGER (0-5), default 0

## 📝 Notes

1. **AI Model Selection:** Menggunakan `gpt-3.5-turbo` untuk cost efficiency dan speed
2. **Username AI:** Semua komentar/balasan AI dibuat dengan username "Tokko AI"
3. **Auto-tags:** Balasan AI otomatis ter-tag dengan @username dari komentar yang dibalas
4. **Tone Options:** "positive", "neutral", "constructive"
5. **Character Limit:** Semua teks dibatasi max 500 karakter

## 🎨 UI/UX Improvements

- Rating edit UI menggunakan inline stars selector
- Verified badge toggle dengan loading state
- AI button dengan emoji dan loading indicator
- Input field untuk jumlah (inline dengan tombol)
- Success/error messages di admin panel

## ✅ Testing Checklist

- [ ] Edit rating pada komentar sebagai owner
- [ ] Toggle verified badge sebagai admin
- [ ] Generate 3 komentar AI untuk testimoni
- [ ] Generate 1 balasan AI untuk komentar
- [ ] Verify OPENAI_API_KEY ada di .env.local
- [ ] Check error handling saat API key tidak valid
- [ ] Verify rating tidak bisa lebih dari 5
- [ ] Verify hanya admin bisa edit verified status

## 🚀 Next Steps (Optional)

1. Add custom prompts untuk AI generation
2. Add AI generation history/log
3. Add batch operations untuk multiple testimonials
4. Add scheduling untuk auto-generate komentar
5. Add sentiment analysis untuk AI-generated comments
6. Add moderation queue untuk AI comments sebelum publish
