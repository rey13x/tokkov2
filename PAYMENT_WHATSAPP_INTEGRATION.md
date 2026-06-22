# WhatsApp Payment Integration - Dokumentasi

## 🎯 Overview
Sistem pembayaran QRIS Tokko sekarang terintegrasi dengan WhatsApp untuk mengirim notifikasi pembayaran otomatis ke pelanggan. Ketika pembayaran berhasil, sistem akan:
1. Menghasilkan link WhatsApp dengan detail pesanan
2. Mengirim struk pembayaran otomatis
3. Menyimpan catatan pembayaran untuk referensi

---

## 📋 Fitur Baru

### 1. WhatsApp Notification Link
Setelah pembayaran berhasil, API mengembalikan `whatsappLink` yang dapat langsung dibuka oleh user.

**Contoh link yang dihasilkan:**
```
https://wa.me/62812345678?text=✅%20PEMBAYARAN%20BERHASIL...
```

**Isi pesan:**
```
✅ PEMBAYARAN BERHASIL

🛍️ Order ID: ORDER_123
💳 Invoice: DEP_1234567890

Produk yang Dibeli:
1. Product A x1 - Rp 10.000
2. Product B x2 - Rp 20.000

Detail Pembayaran:
Subtotal: Rp 30.000
Pajak: Rp 3.300
💰 Total: Rp 33.300
Terbayar: Rp 33.300

Terima kasih telah berbelanja! 🙏
```

### 2. Payment Receipt HTML
Struk pembayaran sekarang mencakup:
- ✅ Invoice number (deposit ID)
- ✅ Metode pembayaran (QRIS Dynamic)
- ✅ Status pembayaran terbaru
- ✅ Tanggal pembayaran
- ✅ Catatan pembayaran (payment notes)

### 3. Payment Notes
Sistem secara otomatis menyimpan catatan pembayaran dengan format:
```
Pembayaran via QRIS | Invoice: DEP_123456 | Nominal: Rp 33.300 | Waktu: 22 Juni 2026 14:55:30
```

---

## 🔄 Payment Verification Flow

```
1. User klik "Cek Transaksi"
   ↓
2. POST /api/payments/verify
   {
     "orderId": "ORDER_123",
     "depositId": "DEP_1234567890"
   }
   ↓
3. Backend verify status ke Rama Shop API
   ↓
4. IF status = "success":
   ├─ Update order status → "paid"
   ├─ Generate payment notes
   ├─ Generate WhatsApp link
   └─ Return whatsappLink in response
   ↓
5. Frontend bisa:
   ├─ Buka WhatsApp link secara otomatis: window.open(whatsappLink)
   ├─ atau tampilkan button "Buka WhatsApp"
   └─ Download struk: GET /api/payments/orders/[orderId]/receipt
```

---

## 💻 API Response

### Success Response
```json
{
  "success": true,
  "status": "success",
  "depositId": "DEP_1234567890",
  "whatsappLink": "https://wa.me/62812345678?text=✅%20PEMBAYARAN%20BERHASIL...",
  "order": {
    "id": "ORDER_123",
    "status": "paid",
    "depositId": "DEP_1234567890",
    "total": 33300,
    "paidAmount": 33300,
    "items": [...],
    "createdAt": "2026-06-22T14:30:00Z",
    "paidAt": "2026-06-22T14:35:00Z",
    "paymentNotes": "Pembayaran via QRIS | Invoice: DEP_123456 | Nominal: Rp 33.300 | Waktu: 22 Juni 2026 14:35:45"
  }
}
```

---

## 🎯 Frontend Implementation Examples

### 1. Auto-Open WhatsApp After Payment Success
```javascript
// After payment verified as successful
if (response.data.whatsappLink) {
  // Option 1: Auto-open WhatsApp
  window.open(response.data.whatsappLink, '_blank');
  
  // Option 2: Show button for user to click
  // <button onClick={() => window.open(whatsappLink)}>
  //   Buka WhatsApp
  // </button>
}
```

### 2. Download Receipt
```javascript
const downloadReceipt = (orderId) => {
  const link = document.createElement('a');
  link.href = `/api/payments/orders/${orderId}/receipt`;
  link.download = `struk-${orderId}.html`;
  link.click();
};
```

### 3. Get Full Order Details
```javascript
const fetchOrderDetails = async (orderId) => {
  const response = await fetch(`/api/payments/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

---

## 🛠️ Backend Functions

### 1. Generate WhatsApp Message
```typescript
import { generateWhatsAppMessage } from "@/server/notifications";

const message = generateWhatsAppMessage({
  orderId: "ORDER_123",
  items: [
    { productName: "Product A", quantity: 1, unitPrice: 10000 },
  ],
  subtotal: 10000,
  tax: 1100,
  total: 11100,
  depositId: "DEP_123456",
  paidAmount: 11100
});
```

### 2. Generate WhatsApp Link
```typescript
import { generateWhatsAppLink } from "@/server/notifications";

const link = generateWhatsAppLink("08123456789", message);
// Returns: https://wa.me/62812345678?text=...
```

### 3. Get WhatsApp Link for Order
```typescript
import { generateOrderWhatsAppLink } from "@/server/payment";

const link = await generateOrderWhatsAppLink("ORDER_123", "08123456789");
```

### 4. Generate Payment Notes
```typescript
import { generatePaymentNotes } from "@/server/payment";

const notes = generatePaymentNotes({
  depositId: "DEP_123456",
  amount: 11100,
  method: "qris",
  timestamp: new Date().toISOString()
});
// Returns: "Pembayaran via QRIS | Invoice: DEP_123456 | ..."
```

---

## 📊 Database Updates

### Order Collection Schema
Order document sekarang memiliki field baru:
```javascript
{
  id: "ORDER_123",
  // ... existing fields ...
  
  // Baru:
  paymentNotes: "Pembayaran via QRIS | Invoice: DEP_123456 | Nominal: Rp 33.300 | Waktu: 22 Juni 2026 14:35:45",
  paidAmount: 33300,
  paidAt: "2026-06-22T14:35:00Z"
}
```

---

## 🔐 WhatsApp Link Format

Format link WhatsApp yang dihasilkan:
```
https://wa.me/{PHONE_NUMBER}?text={ENCODED_MESSAGE}

Contoh:
https://wa.me/62812345678?text=✅%20PEMBAYARAN%20BERHASIL%0A%0A🛍️%20Order%20ID:%20ORDER_123...
```

**Phone Number Format:**
- Input: `08123456789`, `+6281234567890`, `6281234567890`
- Output: `62812345678` (untuk wa.me link)

---

## ✅ Checklist Implementasi

- ✅ WhatsApp message generation
- ✅ WhatsApp link generation
- ✅ Payment notes generation
- ✅ Receipt HTML dengan payment details
- ✅ Verify endpoint dengan WhatsApp link
- ✅ Payment status integration

---

## 📌 Testing

### Manual Test
```bash
# 1. Create payment QR
curl -X POST http://localhost:3000/api/payments/create-qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "TEST_123",
    "items": [{"productId": "1", "productName": "Test", "quantity": 1, "price": 10000}],
    "subtotal": 10000,
    "tax": 1100,
    "total": 11100,
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "customerPhone": "08123456789"
  }'

# 2. Verify payment (setelah user bayar)
curl -X POST http://localhost:3000/api/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "TEST_123",
    "depositId": "DEP_1234567890"
  }'

# Response akan include whatsappLink
```

---

## 🚀 Production Notes

1. **Phone Number Validation**
   - System secara otomatis memformat nomor telepon ke format wa.me
   - Support format: `08xx`, `+628xx`, `628xx`

2. **WhatsApp Link Security**
   - Link tidak menyimpan informasi sensitif
   - URL encode semua teks pesan
   - Tidak ada token/API key dalam link

3. **Receipt Download**
   - User dapat download struk langsung dari modal pembayaran
   - Format: HTML (dapat diprint/save as PDF dari browser)
   - Fitur: Responsive, print-friendly styling

4. **Payment Notes Storage**
   - Auto-generated untuk audit trail
   - Disimpan dalam Firestore order document
   - Ditampilkan di receipt HTML

---

## 🐛 Troubleshooting

**WhatsApp link tidak terbuka?**
- Pastikan user sudah install WhatsApp di device
- Check browser console untuk error message
- Verifikasi phone number format

**Receipt tidak menampilkan payment details?**
- Check order status harus "paid"
- Verifikasi depositId tersimpan di database
- Check payment notes field

**Payment notes tidak tersimpan?**
- Check timestamp format (ISO 8601)
- Verifikasi order update berhasil di Firestore
- Check error logs di server

---

## 📱 WhatsApp Integration Benefits

✅ Automatic payment confirmation to customer
✅ Reduces customer support inquiries
✅ Improves customer experience
✅ Builds trust with transparent receipt
✅ Mobile-friendly payment notification
✅ Compliant with Indonesian customer preferences

---

**Last Updated:** 22 Juni 2026
**Status:** Production Ready ✅
