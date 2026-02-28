# Firebase Rules (Tokkov2)

Project ini memakai **Cloud Firestore** untuk data utama Firebase (`users`, `orders`, `products`, dll).

## File yang dipakai

- `firestore.rules`: rules Firestore
- `firestore.indexes.json`: index Firestore
- `database.rules.json`: rules Realtime Database (default deny all)
- `firebase.json`: mapping config deploy rules

## Deploy rules ke Firebase

1. Login Firebase CLI:

```bash
firebase login
```

2. Pilih project:

```bash
firebase use tokkov2-a4603
```

3. Deploy rules + index:

```bash
firebase deploy --only firestore:rules,firestore:indexes,database
```

## Kenapa aman untuk sistem ini

- Akses data sensitif (`users`, `orders`) dari client langsung diblokir.
- Website tetap jalan karena API server memakai `firebase-admin` (bypass rules secara server-side).
- Konten publik storefront (`products`, `informations`, `testimonials`, `marquees`, `privacyPolicyPages`) bisa dibaca publik.

## Catatan penting

- Jika kamu belum pakai Realtime Database, biarkan `database.rules.json` tetap deny all.
- Jangan commit credential rahasia:
  - `service-account.json`
  - private key Firebase admin

