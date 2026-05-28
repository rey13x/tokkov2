# 🔐 Hardcoded Admin Development Setup

> **Status:** ✅ IMPLEMENTED & VERIFIED  
> **Date:** 30 May 2026  
> **Build:** ✓ Compiled successfully

---

## 🎯 Overview

Admin credentials are now hardcoded untuk development/testing untuk memastikan login **always works** di localhost, regardless of database state.

**This is DEVELOPMENT ONLY** - tidak akan work di production.

---

## 📝 Implementation Details

### Hardcoded Admin Credentials
```
📧 Email: digitalawanku2@gmail.com
    atau: Admin Tokko (username)
🔐 Password: Ayiamessi139087z
👤 Role: admin
```

### Where It's Implemented
File: `src/server/auth.ts` (CredentialsProvider authorize function)

```typescript
// DEV ONLY: Hardcoded admin for development/testing
if (
  process.env.NODE_ENV !== "production" &&
  (identifier === "digitalawanku2@gmail.com" || identifier === "Admin Tokko") &&
  password === "Ayiamessi139087z"
) {
  console.log("✅ DEV: Hardcoded admin login used");
  return {
    id: "dev-admin-hardcoded",
    email: "digitalawanku2@gmail.com",
    name: "Admin Tokko",
    image: null,
    role: "admin",
    phone: "",
  };
}
```

### JWT & Session Handling
- ✅ JWT callback preserves admin role
- ✅ Session callback includes admin in user.role
- ✅ Skips database lookups for hardcoded admin (no errors)
- ✅ API admin/session endpoint recognizes hardcoded admin as admin

---

## ✅ Login Flow

### Step 1: Go to Auth Page
```
URL: http://localhost:3000/auth
Tab: "Masuk" (Sign In)
```

### Step 2: Enter Credentials
```
Identifier: digitalawanku2@gmail.com
            atau: Admin Tokko
Password: Ayiamessi139087z
```

### Step 3: Click "Masuk"
```
✅ Hardcoded auth triggers
✅ JWT created with role: "admin"
✅ Session includes admin role
✅ Redirects to /admin dashboard
```

### Step 4: Admin Dashboard
```
✅ Page loads successfully
✅ All admin sections accessible
✅ Can manage products, orders, users, etc.
```

---

## 🧪 Testing Verification

### Test Login
```bash
1. npm run dev
2. Go to: http://localhost:3000/auth
3. Login with: digitalawanku2@gmail.com / Ayiamessi139087z
4. Should redirect to /admin
5. Admin dashboard fully functional
```

### Expected Behavior
- ✅ Console log: "✅ DEV: Hardcoded admin login used"
- ✅ Instant login (no database query)
- ✅ Admin role active
- ✅ Can access all admin features

### Fallback to Database
If credentials don't match hardcoded:
- Falls back to database user lookup
- Compares password with bcrypt hash
- Works for real database users

---

## 🛡️ Security Notes

### Development Only ⚠️
```
✅ Only activates when: NODE_ENV !== "production"
✅ Production (vercel): NODE_ENV="production" → hardcoded IGNORED
✅ No risk of hardcoded creds in production
```

### Database Still Supported
- Database users still login normally
- Hardcoded admin is just a fallback/convenience
- Both methods work simultaneously

### Session Protection
- All other endpoints still require valid session
- Admin session check works properly
- CSRF & security features intact

---

## 🚀 Login Options Now Available

### Option 1: Hardcoded Admin (Development)
```
Email: digitalawanku2@gmail.com
Password: Ayiamessi139087z
→ Instant login, always works
```

### Option 2: Database Users
```
Any user created via sign-up or setup script
→ Database lookup, bcrypt comparison
```

### Option 3: Google OAuth
```
If GOOGLE_CLIENT_ID configured
→ Firebase Google authentication
```

---

## 📊 Implementation Status

| Component | Status |
|-----------|--------|
| Hardcoded auth | ✅ Implemented |
| JWT handling | ✅ Updated |
| Session callback | ✅ Updated |
| Build | ✅ Success |
| Admin dashboard | ✅ Works |
| Database fallback | ✅ Works |
| Production safety | ✅ Secured |

---

## 🎓 Summary

✅ **Admin dijamin bisa login di localhost**
✅ **Password hardcoded untuk convenience**
✅ **Tidak affect production**
✅ **Database users still work**
✅ **Admin dashboard fully accessible**

---

## ⚡ Quick Commands

```bash
# Start dev server
npm run dev

# Build (admin won't login in build)
npm run build

# Login credentials
# Email: digitalawanku2@gmail.com
# Password: Ayiamessi139087z
# URL: http://localhost:3000/auth
```

---

## 🔍 Troubleshooting

### Admin still can't login?
1. Make sure `NODE_ENV !== "production"` (localhost is OK)
2. Check browser console for error messages
3. Verify password exact: `Ayiamessi139087z`
4. Try email: `digitalawanku2@gmail.com`
5. Or try username: `Admin Tokko`

### Getting production error?
- This is normal - hardcoded only works in development
- Production uses database + google oauth
- Check `/api/admin/session` endpoint

### Can't see admin dashboard after login?
- Check `/admin` page loads
- Check browser console for errors
- Verify role is "admin" in NextAuth session

---

**Sekarang admin bisa login dijamin!** ✅
