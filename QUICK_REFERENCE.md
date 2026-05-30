# ⚡ Quick Reference Card

## 👤 Admin Credentials

```
📧 digitalawanku2@gmail.com
🔐 Ayiamessi139087z
```

## 🚀 Start Server

```bash
npm run dev
```

→ Opens on http://localhost:3000

## 🔑 Login Locally

1. Go to: http://localhost:3000/auth
2. Tab: "Masuk"
3. Email/Username: `digitalawanku2@gmail.com` or `Admin Tokko`
4. Password: `Ayiamessi139087z`
5. Click: "Masuk"
6. Redirects to: `/admin`

## ✍️ Test Sign-Up

1. Go to: http://localhost:3000/auth
2. Tab: "Daftar"
3. Fill:
   - Username: `testuser_abc123`
   - Email: `testuser@example.com`
   - Phone: `081234567890`
   - Password: `Test123456`
   - Confirm: `Test123456`
4. Click: "Daftar"
5. Result: "Registrasi berhasil." ✅

## 🔍 Verify Setup

```bash
node verify-setup.mjs
```

Should show: ✅ All checks passed!

## 🛠️ Troubleshooting

| Problem           | Solution                                        |
| ----------------- | ----------------------------------------------- |
| Admin won't login | `node setup-admin-user.mjs`                     |
| Sign-up fails     | Check device account limit (10 max per 10 days) |
| DB not found      | `npm run dev` (auto-creates)                    |
| Build fails       | `rm -rf .next && npm run build`                 |

## 📊 Key Files

- **Setup Guide**: `SETUP_ADMIN_AND_SIGNUP.md`
- **Full Details**: `SETUP_COMPLETE.md`
- **Verify Script**: `verify-setup.mjs`
- **Local DB**: `tokko.db` (SQLite)

## 🌍 Production Login

After fixing Turso token:

- URL: https://tokkov2.vercel.app/auth
- Credentials: same as local

## ⚙️ Environment Variables

| Variable         | Value                       |
| ---------------- | --------------------------- |
| ADMIN_EMAIL      | digitalawanku2@gmail.com ✅ |
| NEXTAUTH_SECRET  | ✅ Set                      |
| NEXTAUTH_URL     | http://localhost:3000       |
| TURSO_URL        | ✅ Set                      |
| TURSO_AUTH_TOKEN | ⚠️ Needs regenerate         |

---

**Everything is ready!** 🎉
