# Admin Account Setup Guide

## Cara Setup Akun Admin

### Method 1: Via Environment Variable (Recommended - Saat Deploy)

1. **Set Email di `.env` atau environment production:**

```env
ADMIN_EMAIL=email@gmail.com
```

2. **Restart aplikasi**
   - Email tersebut akan otomatis ditambahkan ke `admin_emails` table
   - Ketika user dengan email tersebut login (baik Credentials/Google), role otomatis menjadi `admin`

---

### Method 2: Via Admin Dashboard (Jika Sudah Punya 1 Admin)

1. Login ke `/admin` dengan akun admin pertama
2. Pergi ke menu "Admin" > "Email Admin"
3. Input email yang ingin dijadikan admin
4. Klik "Tambah"
5. User dengan email tersebut otomatis jadi admin saat login berikutnya

---

## How It Works (Logika)

### Saat Register:

```
1. User daftar dengan email: abc@gmail.com
2. System check: apakah abc@gmail.com ada di admin_emails table?
3. Jika YA → User otomatis dibuat dengan role="admin"
4. Jika TIDAK → User dibuat dengan role="user"
```

### Saat Login (Credentials):

```
1. User login dengan username/email + password
2. Validasi username/email + password ✓
3. Cek database: apakah email ada di admin_emails?
4. Jika YA → Update user role ke "admin" + login as admin
5. Jika TIDAK → Stay as "user"
```

### Saat Login (Google OAuth):

```
1. User login dengan Google
2. Extract email dari Google profile
3. Cek: apakah email sudah ada di database users?
4. Jika ADA → Check admin_emails:
   - Jika di admin_emails → Update role ke "admin"
   - Jika tidak → Stay as "user"
5. Jika TIDAK ADA → Create user baru:
   - Check admin_emails:
   - Jika email ada di admin_emails → Create dengan role="admin"
   - Jika tidak → Create dengan role="user"
```

---

## Important Notes ⚠️

### ✅ Keamanan:

- Password terenkripsi dengan bcryptjs (10 rounds)
- Reset password token valid hanya 1 jam
- One-time use password reset token
- Security headers di-enforce (HSTS, CSP, X-Frame-Options, dll)
- Admin akses ke Firestore dibatasi strict via rules

### ✅ Email Admin Management:

- Bisa add/remove admin email kapan saja
- Sudah terdaftar di admin_emails = otomatis admin saat login
- Bukan manual per-user, tapi per-email (lebih fleksibel)

### ⚠️ First Admin Setup:

**Masalah:** Bagaimana bikin admin pertama kalau belum ada admin?

**Solusi 1 (Recommended):**

```bash
# Di production, set env var:
ADMIN_EMAIL=your-email@gmail.com

# Lalu restart. Email otomatis ditambah ke admin_emails table.
# Saat first login, role langsung jadi admin.
```

**Solusi 2:**
Langsung edit database admin_emails table:

```sql
INSERT INTO admin_emails (id, email, created_at)
VALUES ('unique-id', 'your-email@gmail.com', unix_timestamp);
```

---

## Testing

### Test 1: Register sebagai Admin

1. Pastikan email ada di `admin_emails` table
2. Register dengan email itu
3. Login
4. Cek: Role harus `admin`
5. Akses `/admin` - seharusnya bisa

### Test 2: Upgrade User ke Admin

1. Register user biasa (email tidak di admin_emails)
2. Add email ke admin_emails via admin dashboard
3. User login ulang
4. Role otomatis berubah ke `admin`

### Test 3: Downgrade Admin ke User

1. Remove email dari admin_emails
2. Admin login ulang
3. Role otomatis berubah ke `user`

---

## Database Queries

### Lihat semua admin emails:

```sql
SELECT * FROM admin_emails;
```

### Tambah email ke admin:

```sql
INSERT INTO admin_emails (id, email, added_by, created_at)
VALUES (lower(hex(randomblob(4))), 'email@gmail.com', 'admin@gmail.com', unixepoch('now'));
```

### Hapus admin:

```sql
DELETE FROM admin_emails WHERE email = 'email@gmail.com';
```

### Lihat semua users + roles:

```sql
SELECT id, username, email, role FROM users;
```

---

## Summary

| Method                | Waktu Setup | Notes                     |
| --------------------- | ----------- | ------------------------- |
| Env var `ADMIN_EMAIL` | Deploy time | Otomatis saat app start   |
| Admin dashboard       | Runtime     | Perlu sudah punya 1 admin |
| Direct DB query       | Immediate   | Untuk emergency           |

**Recommended:** Set `ADMIN_EMAIL=your-email@gmail.com` di env saat deploy pertama, biar admin pertama langsung bisa login.
