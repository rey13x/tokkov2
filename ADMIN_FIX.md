# Fix Admin Access untuk digitalawanku2@gmail.com

## Masalah yang Diperbaiki

Email `digitalawanku2@gmail.com` sudah dikonfigurasi sebagai `ADMIN_EMAIL` di `.env.local`, tetapi tidak bisa login sebagai admin. Masalahnya adalah:

1. Email harus ditambahkan ke tabel `admin_emails` di database agar user dengan email itu bisa menjadi admin
2. Function `ensureAdminEmailIfNotExists()` tidak dipanggil dengan konsisten saat user login

## Solusi yang Diterapkan

### 1. Export Function untuk Inisialisasi Admin Email

- File: `src/server/db/index.ts`
- Tambah function `ensureAdminEmailExists()` yang bisa diakses dari modul lain
- Function ini memastikan email dari `ADMIN_EMAIL` env var otomatis ditambahkan ke tabel `admin_emails`

### 2. Panggil Function Saat User Login

- File: `src/server/auth.ts`
- Panggil `ensureAdminEmailExists()` di dua tempat:
  - **Credentials Provider**: Saat user login dengan username/email + password
  - **Google OAuth Callback**: Saat user login dengan Google

Ini memastikan bahwa setiap kali ada user login, email admin otomatis di-setup di database.

### 3. Tambah Pengecekan Role yang Lebih Robust

- Setelah email admin di-setup, sistem otomatis mengecek apakah email user ada di tabel `admin_emails`
- Jika ada, user role otomatis berubah menjadi `admin`

## Cara Menggunakan Perbaikan Ini

### Step 1: Pastikan Email Admin Sudah di `.env.local`

```env
ADMIN_EMAIL=digitalawanku2@gmail.com
```

✅ Sudah dikonfigurasi di `.env.local`

### Step 2: User Harus Register Dulu (Jika Belum Ada Account)

Jika belum pernah register dengan email `digitalawanku2@gmail.com`:

1. Pergi ke halaman `/auth`
2. Click "Sign Up"
3. Register dengan email `digitalawanku2@gmail.com`
4. Setelah register, pada saat login, email otomatis ditambahkan ke `admin_emails` table
5. Role otomatis berubah menjadi `admin`
6. User bisa akses `/admin`

### Step 3: User Yang Sudah Ada

Jika user dengan email `digitalawanku2@gmail.com` sudah terdaftar:

1. Login sekali dengan email dan password
2. Atau login dengan Google (jika sudah connect)
3. Pada saat login pertama kali setelah perbaikan ini, email otomatis ditambahkan ke `admin_emails`
4. Refresh halaman atau logout-login lagi
5. Role akan berubah menjadi `admin`
6. Bisa akses `/admin`

### Step 4: Verifikasi di Database (Optional)

Jika ingin verifikasi email sudah ditambahkan ke tabel:

```sql
SELECT * FROM admin_emails WHERE email = 'digitalawanku2@gmail.com';
```

Seharusnya ada 1 row dengan email `digitalawanku2@gmail.com`

## Testing

### Test Credentials Login

1. Buka `/auth`
2. Klik "Sign In"
3. Login dengan:
   - Email: `digitalawanku2@gmail.com`
   - Password: (password yang sudah di-set)
4. Seharusnya auto redirect ke `/admin`

### Test Google OAuth Login

1. Buka `/auth`
2. Klik "Sign in with Google"
3. Login dengan Google account `digitalawanku2@gmail.com`
4. Seharusnya auto redirect ke `/admin`

### Test Dashboard

1. Login sebagai admin
2. Buka `http://localhost:3000/admin`
3. Seharusnya bisa akses dashboard admin dengan menu:
   - Kelola Admin
   - CRUD Produk
   - Lihat Orders
   - dll

## Troubleshooting

### Masih Tidak Bisa Akses Admin?

1. **Pastikan .env.local sudah benar:**

   ```
   ADMIN_EMAIL=digitalawanku2@gmail.com
   ```

2. **Restart dev server:**

   ```bash
   pkill -9 node
   npm run dev
   ```

3. **Clear database (jika perlu reset):**

   ```bash
   rm -rf tokko.db  # Hapus database
   npm run dev      # Buat ulang dengan fresh state
   ```

4. **Check database langsung:**
   - Pastikan email sudah ada di tabel `admin_emails`
   - Pastikan user sudah ada di tabel `users` dengan email `digitalawanku2@gmail.com`
   - Check bahwa role user di tabel `users` adalah `admin`

## Summary

✅ **Masalah Sudah Diperbaiki**

- Email `digitalawanku2@gmail.com` akan otomatis di-setup saat user login
- User tidak perlu manual add email ke admin list
- Semuanya otomatis dan transparan

📝 **Yang Perlu Dilakukan User**

1. Pastikan user sudah register/ada account dengan email `digitalawanku2@gmail.com`
2. Login dengan email dan password tersebut (atau Google OAuth)
3. Seharusnya langsung bisa akses `/admin`
