# Payment Gateway QRIS - Rama Shop API Integration

## Overview
Integrasi payment gateway QRIS menggunakan **Rama Shop API** (bukan Midtrans). Sistem ini menghasilkan QR code dinamis per transaksi dengan countdown timer 5 menit dan auto-verification.

## API Configuration

### Base URL
```
https://ramashop.my.id/api/public
```

### Authentication
```
Header: X-API-Key
Value: rg_1f74fe1557a731a5516593969972d9
```

---

## Flow Pembayaran

### 1️⃣ User Checkout → Create Deposit (QRIS)

**Endpoint:** `POST /ramashop.my.id/api/public/deposit/create`

**Request:**
```javascript
{
  "amount": 11100,           // Total amount (integer, Rupiah)
  "method": "qris",          // Payment method (fixed: qris)
  "reference": "ORDER_123"   // Optional: order ID reference
}
```

**Headers:**
```
X-API-Key: rg_1f74fe1557a731a5516593969972d9
Content-Type: application/json
```

**Response (Success):**
```javascript
{
  "status": "ok",
  "data": {
    "depositId": "DEP_1234567890",
    "amount": 11100,
    "qr_string": "00020126360014id.co.qris...",  // QR Code data (scannable)
    "created_at": "2026-06-03T10:30:00Z"
  }
}
```

---

### 2️⃣ Display QR Modal → Show to User

**What to display:**
- ✅ QR Code (generated from qr_string dengan qrcode.react)
- ✅ Total amount: Rp 11.100
- ✅ Countdown timer: 5:00 → 0:00
- ✅ Order ID
- ✅ Button: "Cek Transaksi"

---

### 3️⃣ User Scan → Payment (Outside App)

User membuka e-wallet (OVO, DANA, GCash, etc) dan scan QR code. Sistem pembayaran (bank/e-wallet) akan memproses transfernya.

---

### 4️⃣ Verify Payment Status

**Endpoint:** `GET /ramashop.my.id/api/public/deposit/status/{depositId}`

**Headers:**
```
X-API-Key: rg_1f74fe1557a731a5516593969972d9
```

**Response:**
```javascript
{
  "status": "ok",
  "data": {
    "depositId": "DEP_1234567890",
    "amount": 11100,
    "paid_amount": 11100,      // Atau 0 jika belum bayar
    "status": "success",        // success, pending, expired, already
    "created_at": "2026-06-03T10:30:00Z",
    "paid_at": "2026-06-03T10:31:45Z"
  }
}
```

**Status Meanings:**
- `success`: ✅ Pembayaran berhasil
- `pending`: ⏳ Belum ada transfer masuk
- `expired`: ❌ QR code sudah expire (> 5 menit)
- `already`: ℹ️ Deposit sudah pernah diproses sebelumnya

---

## Implementation in App

### User Journey

```
1. User di halaman TROLI
   ↓
2. Klik "Lanjut ke Pembayaran"
   ↓
3. POST /api/payments/create-qr
   ├─ Create order di Firestore
   ├─ Call Rama Shop: POST /deposit/create
   └─ Return: qrCode + depositId
   ↓
4. PaymentQRModal muncul
   ├─ Show QR code (scannable)
   ├─ Show Rp amount
   ├─ Start countdown 5:00 → 0:00
   └─ "Cek Transaksi" button
   ↓
5. User scan QR pake e-wallet & bayar
   ↓
6. User klik "Cek Transaksi"
   ├─ POST /api/payments/verify
   ├─ Call Rama Shop: GET /deposit/status/{depositId}
   └─ Check status
   ↓
   IF PAID (status = success):
   ├─ Update order status → "paid"
   ├─ Auto-download file (if applicable)
   └─ Redirect ke /status-pemesanan
   
   ELIF PENDING:
   ├─ Show: "Segera scan dan bayar QRIS diatas"
   └─ User bisa klik "Cek Transaksi" lagi
   
   ELIF EXPIRED:
   └─ Show: "QR Code telah kadaluarsa"
```

---

## API Endpoints (Backend)

### 1. Create QR Code
```
POST /api/payments/create-qr

Request:
{
  "orderId": "ORDER_123",
  "items": [ { productId, productName, quantity, price } ],
  "subtotal": 10000,
  "tax": 1100,
  "total": 11100,
  "customerName": "John Doe",
  "customerEmail": "john@email.com",
  "customerPhone": "081234567890"
}

Response:
{
  "success": true,
  "orderId": "ORDER_123",
  "depositId": "DEP_1234567890",
  "qrCode": "00020126360014id.co.qris...",
  "amount": 11100,
  "expiresIn": 300,
  "createdAt": "2026-06-03T10:30:00Z"
}
```

### 2. Verify Payment
```
POST /api/payments/verify

Request:
{
  "orderId": "ORDER_123",
  "depositId": "DEP_1234567890"
}

Response:
{
  "success": true,
  "status": "success",        // success, pending, expired
  "depositId": "DEP_1234567890",
  "order": { ...order details }
}
```

### 3. Get Order Details
```
GET /api/payments/orders/[orderId]

Response:
{
  "order": {
    "id": "ORDER_123",
    "status": "paid",
    "depositId": "DEP_1234567890",
    "total": 11100,
    "items": [...],
    "createdAt": "2026-06-03T10:30:00Z",
    "paidAt": "2026-06-03T10:31:45Z"
  }
}
```

### 4. Get Download Files
```
GET /api/payments/orders/[orderId]/download

Response:
{
  "success": true,
  "orderId": "ORDER_123",
  "fileUrls": [
    { 
      "productName": "YouTube Music",
      "fileUrl": "data:application/pdf;base64,..." 
    }
  ]
}
```

### 5. Generate Receipt
```
GET /api/payments/orders/[orderId]/receipt

Response:
HTML document (can be printed/downloaded)
```

---

## Database Schema

### Orders Collection
```javascript
{
  id: "ORDER_123",
  userId: "USER_ID",
  status: "paid",                    // pending_payment, paid, expired, failed
  paymentMethod: "dynamic_qris",
  depositId: "DEP_1234567890",
  qrString: "00020126360014...",
  
  items: [
    {
      productId: "PROD_123",
      productName: "YouTube Music",
      quantity: 1,
      unitPrice: 10000
    }
  ],
  
  subtotal: 10000,
  tax: 1100,
  total: 11100,
  
  customerName: "John Doe",
  customerEmail: "john@email.com",
  customerPhone: "081234567890",
  
  paidAmount: 11100,
  
  createdAt: "2026-06-03T10:30:00Z",
  updatedAt: "2026-06-03T10:31:45Z",
  paidAt: "2026-06-03T10:31:45Z"
}
```

---

## Timer & Expiry Logic

### QR Code Validity
- **Duration:** 5 minutes (300 seconds)
- **Standard:** Rama Shop API sets this automatically
- **UI:** Show countdown timer on modal
- **Warning:** Timer turns red when < 60 seconds
- **Expired:** Show "QR Code telah kadaluarsa" message

### Timer Implementation
```javascript
useEffect(() => {
  if (!isOpen || paymentStatus !== "pending") return;

  const interval = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(interval);
        setPaymentStatus("expired");
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isOpen, paymentStatus]);
```

---

## Error Handling

### Common Errors & Solutions

**1. "Failed to create QR code"**
- Check API Key is correct: `rg_1f74fe1557a731a5516593969972d9`
- Check network connection to `ramashop.my.id`
- Verify amount is integer (Rupiah)
- Check API endpoint is exactly: `/api/public/deposit/create`

**2. "Failed to verify payment"**
- Ensure depositId is stored in order
- Check Rama Shop API status endpoint works
- Verify API Key header is set

**3. "QR Code telah kadaluarsa"**
- This is normal after 5 minutes
- User needs to create new order

### Logging
```javascript
// Enable detailed logging during development
console.log("Creating QRIS with amount:", amount);
console.log("Rama Shop response:", data);
console.log("Status check for depositId:", depositId);
```

---

## Files Modified

**Backend:**
- `src/server/payment.ts` - Rama Shop API integration
- `src/app/api/payments/create-qr/route.ts` - Create QR endpoint
- `src/app/api/payments/verify/route.ts` - Verify payment endpoint
- `src/app/api/payments/orders/[orderId]/route.ts` - Get order
- `src/app/api/payments/orders/[orderId]/download/route.ts` - Download files
- `src/app/api/payments/orders/[orderId]/receipt/route.ts` - Generate receipt

**Frontend:**
- `src/components/payment/PaymentQRModal.tsx` - QR payment modal UI
- `src/components/payment/PaymentQRModal.module.css` - Modal styling
- `src/app/troli/page.tsx` - Cart integration

**Config:**
- `src/types/store.ts` - Added payment fields to types
- `package.json` - Added `qrcode.react` package

---

## Testing

### Manual Test Flow

1. **Create Order:**
   - Go to cart page
   - Add item to cart
   - Click "Lanjut ke Pembayaran"

2. **Verify QR Creation:**
   - Check browser console for API response
   - QR modal should appear with QR code
   - Timer should start at 5:00

3. **Verify Payment:**
   - In production: Scan with real e-wallet (OVO, DANA, etc.)
   - In development: Just click "Cek Transaksi" (will show pending)
   - Check Rama Shop dashboard for actual payment

4. **Check Status:**
   - Click "Cek Transaksi" button
   - Should show payment status

### API Testing (curl)

```bash
# 1. Create Deposit
curl -X POST https://ramashop.my.id/api/public/deposit/create \
  -H "X-API-Key: rg_1f74fe1557a731a5516593969972d9" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "method": "qris"
  }'

# 2. Check Status
curl -X GET https://ramashop.my.id/api/public/deposit/status/DEP_1234567890 \
  -H "X-API-Key: rg_1f74fe1557a731a5516593969972d9"

# 3. Check Balance
curl -X GET https://ramashop.my.id/api/public/balance \
  -H "X-API-Key: rg_1f74fe1557a731a5516593969972d9"
```

---

## Build Status
✅ **Build Successful** (3 June 2026)
- All TypeScript errors fixed
- All API routes working
- Payment modal integrated with cart
- Rama Shop API integration complete

---

## Support & Documentation
- **Rama Shop Dashboard:** https://ramashop.my.id
- **API Key:** rg_1f74fe1557a731a5516593969972d9
- **Status:** Production Ready ✅
