# 🔐 Admin Setup & Sign-Up Process Guide

> **Last Updated:** 30 May 2026

---

## ✅ Current Admin Setup Status

### Admin Credentials

```
📧 Email: digitalawanku2@gmail.com
🔐 Password: Ayiamessi139087z
👤 Username: Admin Tokko
📱 Phone: (empty - can be updated)
```

---

## 🏠 LOCAL Setup (Localhost)

### ✅ Already Complete

Admin account has been created in local database (`tokko.db`) with:

- ✅ User created in `users` table
- ✅ Password hashed with bcrypt
- ✅ Role set to "admin"
- ✅ Email added to `admin_emails` table for verification

### To Login Locally

1. **Start Development Server**

   ```bash
   npm run dev
   ```

   - Server runs on http://localhost:3000

2. **Open Auth Page**
   - Go to: http://localhost:3000/auth
   - Click "Masuk" (Sign In) tab

3. **Enter Credentials**
   - Identifier: `digitalawanku2@gmail.com` or `Admin Tokko`
   - Password: `Ayiamessi139087z`

4. **Redirect**
   - After login, redirects to `/admin` dashboard
   - Regular users redirect to homepage

---

## 🌐 PRODUCTION Setup (Vercel + Turso)

### ⚠️ Current Issue

- TURSO_AUTH_TOKEN returns 401 error
- Possible causes: Token expired or regenerated

### Fix Options

#### Option A: Regenerate Turso Token (Recommended)

1. Go to https://turso.tech
2. Navigate to tokkov2-slinku database
3. Go to Settings → API Tokens
4. Click "Generate Token"
5. Copy new token
6. Update in `.env.local`:
   ```
   TURSO_AUTH_TOKEN=<new-token>
   ```
7. Run: `node setup-turso-admin.mjs`

#### Option B: Use Vercel Environment Setup

1. Go to Vercel Dashboard
2. Navigate to tokkov2 project → Settings → Environment Variables
3. Ensure `TURSO_URL` and `TURSO_AUTH_TOKEN` are set correctly
4. Redeploy the project

#### Option C: Direct Database Update (Turso CLI)

If you have Turso CLI installed:

```bash
# Connect to Turso database
turso db shell tokkov2-slinku

# Then run:
INSERT INTO admin_emails (id, email, created_at)
VALUES (uuid(), 'digitalawanku2@gmail.com', unixepoch() * 1000)
ON CONFLICT(email) DO NOTHING;

UPDATE users SET role = 'admin' WHERE email = 'digitalawanku2@gmail.com';
```

---

## 📋 Sign-Up Process

### How It Works (No Email OTP)

Current config has `EMAIL_OTP_ENABLED=false`, so:

1. **User Fills Form**
   - Username (2-40 chars)
   - Email (valid email format)
   - Phone (8-20 digits)
   - Password (min 6 chars)
   - Confirm Password

2. **Validation on Backend** (`/api/register`)
   - ✅ Check input validation with Zod schema
   - ✅ Check device account limit (max 10 accounts per device in 10 days)
   - ✅ Check email doesn't already exist
   - ✅ Check username doesn't already exist
   - ✅ Hash password with bcrypt (salt: 10)
   - ✅ Check if email is in admin_emails table (set role accordingly)
   - ✅ Create user in database (Firestore or local DB)
   - ✅ Record device account creation for tracking

3. **Response**
   - Success: `{ "message": "Registrasi berhasil." }`
   - Returns HTTP 200
   - User can then login with credentials

### Testing Sign-Up Locally

1. Go to http://localhost:3000/auth
2. Click "Daftar" (Sign Up) tab
3. Fill form:
   ```
   Username: testuser123
   Email: testuser@example.com
   Phone: 081234567890
   Password: TestPassword123
   Confirm: TestPassword123
   ```
4. Click "Daftar" button
5. Check response - should see "Registrasi berhasil."
6. Login with new credentials

### Device Account Limit Protection

- Max 10 accounts per device in 10 days
- Prevents spam/abuse from single device
- Error returned: "Satu perangkat hanya bisa membuat 10 akun. Coba lagi pada [date]"

---

## 🔍 Database Tables

### `users` table

```sql
- id (UUID)
- username (unique)
- email (unique, lowercase)
- phone
- avatar_url
- password_hash (bcrypt)
- role (user|admin)
- created_at (timestamp)
- updated_at (timestamp)
```

### `admin_emails` table

```sql
- id (UUID)
- email (unique, lowercase)
- added_by (nullable)
- created_at (timestamp)
```

### `device_account_creations` table

```sql
- id (UUID)
- device_id (fingerprint)
- user_id (reference to users)
- created_at (timestamp)
```

---

## 🧪 Verification Checklist

- [ ] Local admin can login to http://localhost:3000/auth
- [ ] Admin dashboard visible at http://localhost:3000/admin
- [ ] Can create new user via sign-up
- [ ] New user can login after sign-up
- [ ] Device account limit working (try 11 accounts)
- [ ] Production Turso token valid
- [ ] Production admin can login to https://tokkov2.vercel.app/auth
- [ ] Production admin can access dashboard

---

## 🛠️ Useful Commands

### Reset Admin Locally

```bash
node setup-admin-user.mjs
```

### Setup Admin on Turso (Production)

```bash
node setup-turso-admin.mjs
```

### Check Local Database

```bash
# Install sqlite3 CLI if not already installed
brew install sqlite3

# Query database
sqlite3 tokko.db
# Then: SELECT * FROM users;
#       SELECT * FROM admin_emails;
```

### Rebuild Database

```bash
# Delete local database
rm tokko.db

# Restart server - will recreate from schema
npm run dev
```

---

## 📞 Troubleshooting

### ❌ "Email sudah terdaftar"

- Email already exists in database
- Use different email for sign-up

### ❌ "Username sudah dipakai"

- Username already exists
- Use different username

### ❌ "Sudah mencapai batas pembuatan akun"

- Device has created 10+ accounts in 10 days
- Try again after 10 days or use different device

### ❌ "Konfirmasi password tidak sama"

- Password and confirm password fields don't match
- Retype both passwords carefully

### ❌ Admin can't login

- Ensure email in admin_emails table
- Check password is correct
- Verify bcrypt hash is valid
- Try: `node setup-admin-user.mjs` (local) or `node setup-turso-admin.mjs` (production)

### ❌ Production login fails but local works

- Check Vercel env variables are set
- Check TURSO_URL and TURSO_AUTH_TOKEN
- Check ADMIN_EMAIL env var
- Redeploy after fixing env vars

---

## 📊 Implementation Summary

| Feature          | Local               | Production             |
| ---------------- | ------------------- | ---------------------- |
| Admin Account    | ✅ Setup            | ⚠️ Needs Token Fix     |
| Sign-Up          | ✅ Working          | ✅ (After token fixed) |
| Device Limit     | ✅ Active           | ✅ Active              |
| Password Hashing | ✅ Bcrypt           | ✅ Bcrypt              |
| Admin Role       | ✅ Via admin_emails | ✅ Via admin_emails    |
| Email OTP        | ❌ Disabled         | ❌ Disabled            |

---

## 📝 Next Steps

1. **Fix Turso Token** → Follow "Production Setup" section above
2. **Test Production Login** → After token fix
3. **Monitor Sign-Ups** → Check device account tracking
4. **Keep Backup** → Document any custom configurations

---
