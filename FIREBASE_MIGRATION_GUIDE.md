# Firebase Migration Guide for Tokko Marketplace

Dokumen ini adalah inventaris Firebase berdasarkan kode repository saat ini. Jangan menyalin secret ke Git, browser, dokumentasi publik, atau chat.

## 1. Ringkasan Arsitektur Saat Ini

Target project baru: `tokkov2-a4603`.

Public web config target:

- Auth domain: `tokkov2-a4603.firebaseapp.com`
- Messaging sender ID: `916208995900`
- App ID: `1:916208995900:web:4cea547611e7dc8b273d39`
- Storage bucket: `tokkov2-a4603.firebasestorage.app`

Config public sudah diperbarui di local environment dan `.env.vercel.example`. Credential Admin lama dari `tokko-ramadhan` sengaja tidak dipasangkan ke project baru karena private key dan project harus berasal dari service account yang sama.

Tokko tidak memakai Firebase sebagai database transaksi utama.

- **Transaksi/order/user utama:** Turso/libSQL melalui `src/server/db/index.ts`.
- **Firestore Admin SDK:** dipakai server untuk beberapa konfigurasi, reset token, LMS, dan fallback/fitur tertentu.
- **Firebase client SDK:** hanya Firebase Cloud Messaging untuk web push.
- **Firebase Storage Admin SDK:** upload asset/profile/media/receipt pada route server tertentu.
- **Firebase Realtime Database:** tidak dipakai oleh source aktif. `database.rules.json` saat ini deny-all.
- **Firebase Authentication:** tidak menjadi provider login utama. Login aplikasi memakai NextAuth credentials/Google. Admin Firebase session helper ada, tetapi implementasinya saat ini mengembalikan `firebase_not_configured`/`null` dan perlu diselesaikan sebelum migrasi admin auth.

Konsekuensinya: migrasi Firebase penuh membutuhkan migrasi data Turso ke Firestore atau layanan database baru, bukan hanya mengganti konfigurasi Firebase.

## 2. Firebase SDK dan Paket

Package yang digunakan:

- `firebase`: client SDK.
- `firebase-admin`: server Admin SDK.

Inisialisasi client ada di `src/lib/firebase-client.ts`:

- `firebase/app`
- `firebase/messaging`

Inisialisasi server ada di `src/server/firebase-admin.ts`:

- `firebase-admin`
- Admin Firestore
- Admin Storage
- Admin credential service account

## 3. Environment Variables

### Public client variables

Dipakai browser untuk Firebase Messaging:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_VAPID_KEY
```

Nilai `NEXT_PUBLIC_*` memang masuk bundle browser. Firebase API key bukan password, tetapi domain restrictions, App Check, dan Firebase Security Rules tetap wajib dikonfigurasi.

### Server-only service account options

Server memilih credential dengan urutan berikut:

1. `FIREBASE_SERVICE_ACCOUNT_JSON`
2. `FIREBASE_SERVICE_ACCOUNT_BASE64`
3. Credential terpisah:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_PRIVATE_KEY_ID   # optional
FIREBASE_CLIENT_ID        # optional
```

Server juga mencoba membaca file lokal `service-account.json`. File ini tidak boleh masuk repository atau deployment artifact publik. Gunakan Vercel Environment Variables untuk production.

### Related non-Firebase variables

Untuk migrasi lengkap, jangan tertukar dengan:

```text
TURSO_URL
TURSO_AUTH_TOKEN
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
EMAIL_OTP_ENABLED
NEXT_PUBLIC_EMAIL_OTP_ENABLED
```

Turso tetap menjadi sumber transaksi sampai migrasi data selesai dan diverifikasi.

## 4. Firebase Services yang Dipakai

### Firestore

Client server menggunakan Admin Firestore dari `getFirebaseFirestore()`.

Koleksi yang terlihat pada rules atau route aktif:

- `heroBackgrounds/config`
- `passwordResetTokens/{tokenId}`
- `products/{productId}` dan `products/{productId}/ratings/{ratingId}`
- `informations/{informationId}`
- `testimonials/{testimonialId}`
- `marquees/{marqueeId}`
- `privacyPolicyPages/{pageId}`
- `users/{userId}` dan subcollection `profile`, `preferences`, `activityLog`
- `orders/{orderId}` dan subcollections `items`, `timeline`, `payments`
- `jobApplications/{applicationId}` dan subcollections `status`, `interviews`
- `adminAuditLog/{logId}`
- `adminSessions/{sessionId}`
- `activityLogs/{logId}`
- `systemSettings/{settingId}`
- `emailLogs/{logId}`
- `bookStories/{storyId}`
- `portfolioItems/{itemId}`
- `homepageConfig/{configId}`
- `servicesConfig/{serviceId}` dan `children/{childId}`
- `lmsChapters/{chapterId}`
- `lmsLessons/{lessonId}`
- `userCourseProgress/{progressId}`
- `userCourseAccess/{accessId}`
- `paygateAccounts/{accountId}`
- `apiKeys/{keyId}`
- `deposits/{depositId}`
- `withdrawals/{withdrawalId}`
- `transactions/{transactionId}`
- `ledger/{ledgerId}`
- `webhookEvents/{eventId}`

Catatan: tidak semua koleksi di rules terbukti dipakai oleh route aktif. Sebelum migrasi, export Firestore dan audit collection usage melalui Firebase Console, logs, dan source search.

### Cloud Storage

Admin SDK Storage dipakai oleh route berikut:

- `src/app/api/admin/profile-photos/route.ts`
- `src/app/api/admin/upload/route.ts`
- `src/app/api/me/avatar/route.ts`
- `src/app/api/story-media/upload/route.ts`
- `src/app/api/admin/products/upload-file/route.ts`
- `src/app/api/orders/[id]/upload-receipt-image/route.ts`

Bucket saat ini dibentuk dari `${project_id}.appspot.com` pada `src/server/firebase-admin.ts`. Saat migrasi bucket, pertahankan path, content type, cache policy, dan signed URL behavior.

### Cloud Messaging

Implementasi web push:

- `src/lib/firebase-client.ts`
- `src/lib/push-notifications.ts`
- `public/firebase-messaging-sw.js`

Alur:

1. Browser meminta permission Notification.
2. Service worker `/firebase-messaging-sw.js` didaftarkan.
3. FCM token dibuat dengan `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. Token dikirim ke endpoint profile/user dan disimpan pada user data.
5. Server mengirim FCM melalui Admin Messaging di `src/server/notifications.ts`.

Pastikan Web Push certificate/VAPID key dan service worker memakai project Firebase yang sama.

### Firebase Authentication

Tidak ada pemakaian aktif Firebase client Auth (`firebase/auth`) pada source saat ini. Google login menggunakan NextAuth Google provider. Jika akan pindah ke Firebase Auth:

- Migrasikan credential/password dengan proses reset password, jangan mencoba membaca password hash lama sebagai password Firebase.
- Migrasikan Google provider dan redirect URI.
- Tentukan mapping `uid` ke `users.id`.
- Ganti validasi session API dan callback NextAuth secara bertahap.
- Implementasikan ulang `createAdminSessionFromIdToken()` dan `verifyAdminSessionCookie()` sebelum mematikan NextAuth.

## 5. Rules Saat Ini

### Firestore

File sumber: `firestore.rules`.

Helper:

- `signedIn()` berarti `request.auth != null`.
- `isAdmin()` menerima custom claim `admin == true` atau `role == "admin"`.
- Ada helper validasi email/password, tetapi tidak semua helper digunakan.

Kebijakan utama:

- Public read: products, informations, testimonials, marquees, privacy policy, portfolio, homepage config, services, LMS catalog.
- Admin write: content/config, products, testimonials, orders, payment/financial collections, audit logs.
- Owner read/write terbatas: profile/preferences, activity log milik user, course progress/access milik user, paygate account/deposit/withdrawal/transaction/ledger milik user.
- Password reset token: create public dengan field minimum, read/update terbatas user/admin, delete admin.
- Job applications: create public dengan field minimum, read/update/delete admin.
- Book stories: create signed-in user atau server request tanpa auth, read/update/delete admin.
- Catch-all terakhir menolak semua akses yang tidak didefinisikan.

Penting: Admin SDK bypasses Firestore Security Rules. Rules melindungi akses client SDK; route server tetap harus melakukan authentication/authorization sendiri.

### Realtime Database

File sumber: `database.rules.json`:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

Tidak ada fitur aktif yang boleh mengandalkan Realtime Database sebelum rules dan client path baru dibuat.

### Storage Rules

Tidak ada `storage.rules` di repository saat ini. Ini gap migrasi yang harus ditutup sebelum Storage client dipakai langsung. Buat rules terpisah dengan prinsip:

- Public read hanya untuk asset yang memang public.
- Upload/update/delete hanya user pemilik atau admin.
- Batasi ukuran dan content type.
- Jangan izinkan client mengubah path user lain.
- Gunakan signed URL/server upload untuk receipt dan file berbayar.

## 6. Indexes

`firestore.indexes.json` saat ini kosong:

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

Jika migrasi menambah query compound, generate index dari error Firestore atau deklarasikan manual. Jangan menebak index sebelum query final dipetakan.

## 7. Deploy dan Firebase CLI

`firebase.json` saat ini hanya menunjuk:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "database": {
    "rules": "database.rules.json"
  }
}
```

Sebelum deploy:

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

Untuk Realtime Database rules hanya deploy jika service benar-benar akan dipakai:

```bash
firebase deploy --only database
```

Storage rules sekarang terdaftar di `storage.rules` dan `firebase.json`.

Deploy rules baru setelah project target dan service account sudah benar:

```bash
firebase use tokkov2-a4603
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 8. Migrasi Non-Destruktif

Script migrasi tidak menghapus data destination. Default-nya dry run.

### Salin semua Firestore project lama ke project baru

Isi credential terpisah di environment, jangan di file tracked:

```bash
export SOURCE_FIREBASE_SERVICE_ACCOUNT_FILE=/secure/old-tokko-ramadhan.json
export DEST_FIREBASE_SERVICE_ACCOUNT_FILE=/secure/new-tokkov2-a4603.json
MIGRATION_MODE=firestore npm run migrate:firebase
MIGRATION_WRITE=true MIGRATION_MODE=firestore npm run migrate:firebase
```

### Salin seluruh tabel Turso ke collection Firestore baru

Mode ini mempertahankan nama tabel sebagai nama collection, ID row tetap dipakai jika ada, dan row yang sama di-merge:

```bash
export TURSO_URL="..."
export TURSO_AUTH_TOKEN="..."
export DEST_FIREBASE_SERVICE_ACCOUNT_FILE=/secure/new-tokkov2-a4603.json
MIGRATION_MODE=turso npm run migrate:firebase
MIGRATION_WRITE=true MIGRATION_MODE=turso npm run migrate:firebase
```

Script hanya menyalin data. Aplikasi tetap membaca Turso sampai adapter Firestore diuji dan feature flag cutover dibuat. Ini sengaja agar produk, user, order, pembayaran, komentar, Book Spirit, PayGate, dan history tidak hilang ketika migrasi gagal.

## 9. Checklist Migrasi Terbaru

1. Backup/export Turso dan Firestore.
2. Pastikan project ID, bucket, Messaging sender ID, dan VAPID key berada di project yang sama.
3. Rotasi service account yang pernah tersimpan sebagai file lokal atau secret yang bocor.
4. Pindahkan credential server ke Vercel Environment Variables untuk Production, Preview, dan Development sesuai kebutuhan.
5. Tambahkan Storage Rules sebelum membuka upload client.
6. Verifikasi Firestore Rules dengan Firebase Emulator Suite.
7. Buat index berdasarkan query production.
8. Migrasikan user dengan reset password, bukan menyalin password plaintext.
9. Uji order create, QRIS verify, admin status update, receipt, hero CRUD, profile update, dan web push.
10. Uji dua browser/user: perubahan status admin harus muncul di status user dan sebaliknya.
11. Uji rollback dengan feature flag atau dual-write sementara.
12. Setelah data dan monitoring stabil, baru matikan sumber data lama.

## 10. Pemeriksaan Konfigurasi Hero

Hero admin menyimpan daftar pada Firestore `heroBackgrounds/config` melalui:

- Admin CRUD: `src/app/api/admin/hero-backgrounds/route.ts`
- Public read: `src/app/api/hero-backgrounds/route.ts`
- Homepage consumer: `src/components/home/HomeClient.tsx`

Jika daftar kosong atau tidak muncul di production, periksa:

- `FIREBASE_SERVICE_ACCOUNT_JSON` atau credential individual tersedia di Vercel Production.
- Service account memiliki akses Firestore.
- URL foto dapat diakses browser dan menggunakan HTTPS untuk URL external.
- `heroBackgrounds/config` benar-benar berada pada project yang sama dengan `FIREBASE_PROJECT_ID`.
- Firebase rules tidak relevan untuk Admin SDK, tetapi IAM/service account permission relevan.
