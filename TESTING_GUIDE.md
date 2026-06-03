# 🧪 Testing & Verification Guide untuk Testimoni Features

## 📋 Pre-Flight Checklist

### ✅ Environment Setup

- [ ] `OPENAI_API_KEY` sudah ditambahkan ke `.env.local`
- [ ] Database telah di-initialize (migration applied)
- [ ] `npm run dev` berjalan tanpa error
- [ ] Aplikasi accessible di `http://localhost:3000`

### ✅ Admin Access

- [ ] Admin sudah login dengan akun `digitalawanku2@gmail.com`
- [ ] Admin panel accessible di `/admin`
- [ ] `Testimonial section` muncul di admin panel

---

## 🧪 Feature Testing - Step by Step

### Test 1: Edit Rating Komentar

**Setup:**

1. Buka `/testimoni` di browser
2. Lihat sebuah testimoni dengan beberapa komentar

**Test Steps:**

```
1. Cari tombol "Edit" pada salah satu rating komentar
2. Klik "Edit" - seharusnya muncul star picker inline
3. Klik salah satu bintang (contoh: 4 bintang)
4. Klik tombol "OK" untuk simpan
   ✓ Rating harus berubah menjadi 4 bintang
   ✓ Tidak ada error di console
5. Refresh halaman
   ✓ Rating masih 4 bintang (save ke DB berhasil)
6. Coba rating 0 (jika ada)
   ✓ Rating harus di-clamp menjadi 0 (valid 0-5)
```

**Success Criteria:**

- Rating berubah instantly setelah OK
- Rating persist setelah refresh
- Tidak ada error di console
- Rating bounds 0-5 ditegakkan

---

### Test 2: Toggle Verified Badge (Admin Only)

**Setup:**

1. Login sebagai admin
2. Buka `/testimoni`
3. Lihat komentar-komentar

**Test Steps:**

```
1. Cari tombol "+ Badge" atau "✓ Hapus Badge" di samping nama komentar
2. Klik tombol tersebut (jika belum ada badge)
   ✓ Tombol text berubah dari "+ Badge" → "✓ Hapus Badge"
   ✓ Badge ✓ muncul di samping nama
3. Klik "✓ Hapus Badge" untuk toggle kembali
   ✓ Badge hilang
   ✓ Tombol text kembali ke "+ Badge"
4. Refresh halaman
   ✓ Status verified tetap sama (persist di DB)
```

**Success Criteria:**

- Badge toggle instantly
- Status persist setelah refresh
- Hanya admin bisa toggle (user biasa tidak melihat tombol)
- Loading state ditampilkan selama update

---

### Test 3: Generate AI Comments

**Setup:**

1. Login sebagai admin
2. Pergi ke Admin Panel → Testimonials section
3. Lihat daftar testimonial

**Test Steps:**

```
1. Cari field input dengan label "Jumlah Komentar" (atau sejenisnya)
2. Input jumlah: 3
3. Klik tombol "🤖 AI Komentar"
   ✓ Tombol menunjukkan loading state (disabled, text "Membuat...")
   ✓ Tidak ada error pada console
4. Tunggu beberapa detik
   ✓ Success message: "3 komentar AI berhasil dibuat!"
   ✓ Halaman di-refresh otomatis
5. Kembali ke `/testimoni`
   ✓ 3 komentar baru terlihat dengan user "Tokko AI"
   ✓ Setiap komentar memiliki rating (0-5)

Edge Cases to Test:
- Input 1 komentar → "1 komentar AI berhasil dibuat!"
- Input 20 komentar → harus berhasil (max limit)
- Input 21 → error (validation)
- Tanpa input (default) → 3 komentar dibuat
```

**Success Criteria:**

- AI comments berhasil dibuat dan terlihat
- Rating assignment berjalan (setiap komentar ada rating)
- Loading state menampilkan feedback yang jelas
- Error handling bekerja untuk invalid input
- OpenAI API key validation bekerja

---

### Test 4: Generate AI Replies

**Setup:**

1. Login sebagai admin
2. Pergi ke Admin Panel → Testimonial Comments section
3. Lihat daftar komentar dari testimoni

**Test Steps:**

```
1. Cari salah satu komentar
2. Cari field input dan tombol "🤖 AI Balas" di bawahnya
3. Input jumlah: 2
4. Klik "🤖 AI Balas"
   ✓ Tombol menunjukkan loading state
   ✓ Tidak ada error di console
5. Tunggu beberapa detik
   ✓ Success message: "2 balasan AI berhasil dibuat!"
6. Kembali ke `/testimoni`
   ✓ Lihat komentar yang original
   ✓ 2 balasan (reply) terlihat dengan tag @[nama komentar original]
   ✓ Balasan dibuat oleh "Tokko AI"

Edge Cases:
- Input 1 balasan → harus berhasil
- Input 5 balasan → harus berhasil (max)
- Input 6 → error (validation)
```

**Success Criteria:**

- AI replies berhasil dibuat dan tertampil
- Reply correctly tagged dengan @username dari parent comment
- Loading state berfungsi
- Error handling untuk invalid input

---

### Test 5: Full Integration Test

**Test Scenario:**
Simulasi workflow user + admin + AI

```
STEP 1: User membuat komentar
- Pergi ke /testimoni
- Buka komentar section dari testimoni
- Tulis komentar baru
✓ Komentar muncul dengan rating 0

STEP 2: Admin edit rating
- Admin login dan buka /testimoni
- Edit rating komentar user ke 5 bintang
✓ Rating berubah menjadi 5

STEP 3: Admin toggle verified
- Admin toggle verified untuk komentar user
✓ Badge muncul

STEP 4: Admin generate reply
- Admin pergi ke /admin → Testimonial Comments
- Generate 1 AI reply untuk komentar user
✓ Reply muncul di /testimoni dengan tag @username

STEP 5: Verify persistence
- Refresh /testimoni
✓ Rating = 5, verified badge = ada, reply = ada
```

**Success Criteria:**

- Semua state persist setelah refresh
- No race conditions
- All operations complete without error

---

## 🔍 Error Scenarios to Test

### Scenario 1: Missing OpenAI API Key

```
Action: Hapus OPENAI_API_KEY dari .env.local
Try: Generate AI comment
Expected Error: "OpenAI API key tidak dikonfigurasi."
Recovery: Tambah API key kembali, restart server
```

### Scenario 2: Invalid API Key

```
Action: Ganti OPENAI_API_KEY dengan dummy string
Try: Generate AI comment
Expected Error: "Gagal memanggil OpenAI API."
Recovery: Ganti API key dengan yang valid
```

### Scenario 3: Malformed OpenAI Response

```
(This is hard to test naturally - would need API mocking)
Expected Error: "Gagal memproses respons AI."
```

### Scenario 4: Permission Test

```
Action: Logout, coba toggle verified badge
Expected: Tombol tidak muncul atau error unauthorized
Action: Logout, coba generate AI comments
Expected: Error 403 "Hanya admin yang bisa membuat komentar AI"
```

---

## 📊 Performance Checklist

- [ ] Generate 3 AI comments: < 10 detik
- [ ] Generate 5 AI replies: < 8 detik
- [ ] Edit rating: instant (< 1 detik)
- [ ] Toggle verified: instant (< 1 detik)
- [ ] Page load with 10+ comments: smooth (< 2 detik)
- [ ] Rating click responsiveness: instant feedback

---

## 🐛 Bug Checklist

After all tests pass, check for these common issues:

- [ ] No console errors (except intentional)
- [ ] No memory leaks (open DevTools, generate comments 10x, check memory)
- [ ] All loading states disappear after operation
- [ ] All success/error messages display correctly
- [ ] Rating field resets after edit
- [ ] No duplicate comments created
- [ ] Pagination/infinite scroll works with new comments
- [ ] Admin panel doesn't break with large comment counts

---

## 📋 Test Execution Log

Copy this template and fill as you test:

```
Date: __________
Tester: __________
Environment: localhost / production

TEST 1 - Edit Rating: [ ] PASS [ ] FAIL
Issues: _________________________

TEST 2 - Toggle Verified: [ ] PASS [ ] FAIL
Issues: _________________________

TEST 3 - Generate AI Comments: [ ] PASS [ ] FAIL
Issues: _________________________

TEST 4 - Generate AI Replies: [ ] PASS [ ] FAIL
Issues: _________________________

TEST 5 - Full Integration: [ ] PASS [ ] FAIL
Issues: _________________________

Error Scenarios: [ ] PASSED [ ] FAILED
Issues: _________________________

Performance: [ ] ACCEPTABLE [ ] NEEDS OPTIMIZATION
Issues: _________________________

Overall Result: [ ] READY FOR PRODUCTION [ ] NEEDS FIXES
```

---

## 🚀 Sign-Off

When ALL tests pass and no critical bugs found:

- [ ] Features ready for production
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Performance acceptable
- [ ] Error handling robust
