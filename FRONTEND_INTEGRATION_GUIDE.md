# 🎨 Frontend Integration Guide - WhatsApp Payment Notifications

## 📌 Overview

Setelah user pembayaran berhasil, backend sekarang return `whatsappLink` yang bisa langsung dibuka. Panduan ini menunjukkan cara integrate di frontend.

---

## 🔗 Contoh Response dari Backend

```json
{
  "success": true,
  "status": "success",
  "depositId": "DEP_1234567890",
  "whatsappLink": "https://wa.me/62812345678?text=✅%20PEMBAYARAN%20BERHASIL...",
  "order": {
    "id": "ORDER_123",
    "status": "paid",
    "total": 33300,
    "paymentNotes": "Pembayaran via QRIS | Invoice: DEP_123456 | ..."
  }
}
```

---

## 💡 Implementation Options

### Option 1: Manual Button (User Click)
**Recommended untuk user experience yang lebih baik**

```jsx
// PaymentSuccessModal.tsx
import { useState } from 'react';

export function PaymentSuccessModal({ order, whatsappLink, orderId }) {
  const [downloading, setDownloading] = useState(false);

  const handleOpenWhatsApp = () => {
    window.open(whatsappLink, '_blank');
  };

  const handleDownloadReceipt = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/payments/orders/${orderId}/receipt`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `struk-${orderId}.html`;
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="payment-success-modal">
      <div className="modal-content">
        <div className="success-icon">✅</div>
        
        <h2>Pembayaran Berhasil!</h2>
        
        <div className="order-info">
          <p><strong>Order ID:</strong> {orderId}</p>
          <p><strong>Total:</strong> Rp {order.total.toLocaleString('id-ID')}</p>
          <p><strong>Status:</strong> <span className="badge-success">Terbayar</span></p>
        </div>

        <div className="action-buttons">
          <button 
            onClick={handleOpenWhatsApp}
            className="btn btn-whatsapp"
          >
            💬 Buka WhatsApp
          </button>
          
          <button 
            onClick={handleDownloadReceipt}
            disabled={downloading}
            className="btn btn-secondary"
          >
            📥 Download Struk
          </button>
        </div>

        <p className="info-text">
          Pesan pembayaran akan dikirim ke WhatsApp Anda
        </p>
      </div>
    </div>
  );
}
```

### Option 2: Auto-Open WhatsApp (Aggressive)
**Gunakan hanya jika user sudah confident dengan flow**

```jsx
// paymentHandler.ts
export async function verifyPayment(orderId: string, depositId: string) {
  try {
    const response = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, depositId })
    });

    const data = await response.json();

    if (data.success && data.status === 'success') {
      // Auto-open WhatsApp
      if (data.whatsappLink) {
        window.open(data.whatsappLink, '_blank');
      }

      // Show success modal (non-blocking)
      showPaymentSuccessModal(data.order);
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        window.location.href = '/status-pemesanan';
      }, 3000);
    }

    return data;
  } catch (error) {
    console.error('Payment verification failed:', error);
    throw error;
  }
}
```

### Option 3: Hybrid (Recommended)
**Show modal dengan options**

```jsx
// PaymentVerificationFlow.tsx
import { useEffect, useState } from 'react';

export function PaymentVerificationFlow({ orderId, depositId }) {
  const [status, setStatus] = useState('verifying');
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    verifyPayment();
  }, [orderId, depositId]);

  const verifyPayment = async () => {
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, depositId })
      });

      const data = await response.json();

      if (data.success && data.status === 'success') {
        setPaymentData(data);
        setStatus('success');
      } else if (data.status === 'pending') {
        setStatus('pending');
      } else if (data.status === 'expired') {
        setStatus('expired');
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  // Render based on status
  switch (status) {
    case 'verifying':
      return <LoadingSpinner />;
    
    case 'success':
      return (
        <div className="success-container">
          <h2>✅ Pembayaran Berhasil!</h2>
          
          <div className="button-group">
            <button 
              onClick={() => window.open(paymentData.whatsappLink, '_blank')}
              className="btn-primary"
            >
              💬 Buka WhatsApp
            </button>
            
            <button 
              onClick={() => window.location.href = '/status-pemesanan'}
              className="btn-secondary"
            >
              📋 Lihat Pesanan
            </button>
          </div>

          <a 
            href={`/api/payments/orders/${orderId}/receipt`}
            download={`struk-${orderId}.html`}
            className="download-link"
          >
            📥 Download Struk Pembayaran
          </a>
        </div>
      );

    case 'pending':
      return (
        <div className="pending-container">
          <h2>⏳ Pembayaran Belum Diterima</h2>
          <p>Silakan scan ulang QRIS atau tunggu beberapa saat</p>
          <button onClick={verifyPayment}>🔄 Cek Ulang</button>
        </div>
      );

    case 'expired':
      return (
        <div className="expired-container">
          <h2>❌ QR Code Telah Kadaluarsa</h2>
          <p>Silakan buat pesanan baru untuk mendapatkan QR code yang baru</p>
          <button onClick={() => window.location.href = '/troli'}>
            ↩️ Kembali ke Keranjang
          </button>
        </div>
      );

    case 'error':
      return (
        <div className="error-container">
          <h2>⚠️ Terjadi Kesalahan</h2>
          <p>{error}</p>
          <button onClick={verifyPayment}>🔄 Coba Lagi</button>
        </div>
      );
  }
}
```

---

## 🎨 CSS Styling Examples

```css
/* Payment Success Modal */
.payment-success-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.success-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 0.6s ease-in-out;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.order-info {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  margin: 24px 0;
  text-align: left;
}

.order-info p {
  margin: 8px 0;
  font-size: 14px;
}

.badge-success {
  background: #28a745;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin: 24px 0;
}

.btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-whatsapp {
  background: #25D366;
  color: white;
}

.btn-whatsapp:hover {
  background: #1fb854;
  transform: translateY(-2px);
}

.btn-secondary {
  background: #e9ecef;
  color: #333;
}

.btn-secondary:hover {
  background: #dee2e6;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-text {
  font-size: 12px;
  color: #666;
  margin-top: 16px;
}

.download-link {
  display: inline-block;
  margin-top: 16px;
  padding: 8px 16px;
  color: #0066cc;
  text-decoration: none;
  border-bottom: 1px solid #0066cc;
  font-size: 14px;
  transition: color 0.3s;
}

.download-link:hover {
  color: #0052a3;
}
```

---

## 📱 React Hook Example

```typescript
// usePaymentVerification.ts
import { useState, useCallback } from 'react';

export function usePaymentVerification(orderId: string, depositId: string) {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'pending' | 'expired' | 'error'>('idle');
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setStatus('verifying');
    setError(null);

    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, depositId })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setPaymentData(data);
        setStatus(data.status);
      } else {
        setError(data.error || 'Unknown error');
        setStatus('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment verification failed');
      setStatus('error');
    }
  }, [orderId, depositId]);

  return { status, paymentData, error, verify };
}

// Usage in component
function MyComponent({ orderId, depositId }) {
  const { status, paymentData, verify } = usePaymentVerification(orderId, depositId);

  return (
    <div>
      {status === 'success' && (
        <button onClick={() => window.open(paymentData.whatsappLink, '_blank')}>
          Buka WhatsApp
        </button>
      )}
      {status === 'error' && <p>Error</p>}
    </div>
  );
}
```

---

## 🔗 API Integration Checklist

- [ ] Call `/api/payments/verify` after user clicks "Check Payment"
- [ ] Handle response status: success, pending, expired, error
- [ ] Display `whatsappLink` to user
- [ ] Allow user to download receipt from `/api/payments/orders/[orderId]/receipt`
- [ ] Show loading state while verifying
- [ ] Show error messages clearly
- [ ] Add phone number validation before creating order

---

## 🧪 Testing Steps

1. **Create Order**
   - Add products to cart
   - Click "Lanjut ke Pembayaran"
   - Verify QRIS modal shows

2. **Verify Payment**
   - Click "Cek Transaksi"
   - See payment success modal
   - Verify whatsappLink in console: `response.data.whatsappLink`

3. **WhatsApp Link**
   - Click "Buka WhatsApp" button
   - Should open WhatsApp with message
   - Verify message includes order details

4. **Download Receipt**
   - Click "Download Struk"
   - HTML file should download
   - Open and verify payment details show

---

## 🐛 Debugging Tips

### Check WhatsApp Link in Console
```javascript
// After payment verification
const response = await fetch('/api/payments/verify', ...);
const data = await response.json();
console.log('WhatsApp Link:', data.whatsappLink);
console.log('Payment Notes:', data.order.paymentNotes);
```

### Test WhatsApp Link Directly
```javascript
// Open WhatsApp link manually
const testLink = "https://wa.me/62812345678?text=Test%20Message";
window.open(testLink, '_blank');
```

### Check Order Status
```javascript
// Fetch order details
const response = await fetch(`/api/payments/orders/${orderId}`);
const { order } = await response.json();
console.log('Order status:', order.status);
console.log('Payment notes:', order.paymentNotes);
```

---

## 📋 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| WhatsApp link not opening | Install WhatsApp on device, check browser console |
| Receipt download fails | Verify orderId is correct, check API response |
| Payment notes empty | Check payment status is "paid", verify depositId |
| Phone number format wrong | System auto-normalizes, but verify format in console |

---

**Last Updated:** June 22, 2026
**Status:** Ready for Integration ✅
