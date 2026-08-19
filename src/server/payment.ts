import { getFirebaseFirestore } from "./firebase-admin";
import { getRamashopAccountByUserId, callRamashopApi } from "@/server/integrations/ramashop";

// QR Code validity: standard 5 minutes (300 seconds)
export const QR_CODE_VALIDITY_SECONDS = 300;

export interface CreateQRPayload {
  orderId: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface QRCodeResponse {
  depositId: string;
  qrString: string;
  qrImage: string;
  amount: number;
  totalAmount: number;
  uniqueCode: number;
  expiresIn: number; // seconds
  createdAt: string;
  expiredAt?: string;
}

export interface PaymentVerificationResponse {
  status: "success" | "pending" | "expired" | "failed";
  amount?: number;
  paidAmount?: number;
  createdAt?: string;
  whatsappLink?: string; // Link untuk WhatsApp notification
}

/**
 * Check account balance
 */
export async function checkBalance(userId: string): Promise<{ balance: number; status: string }> {
  try {
    const account = await getRamashopAccountByUserId(userId);
    if (!account) throw new Error("PayGate akun ini belum aktif.");
    const response = await callRamashopApi(userId, "/balance", "GET");
    if (response.status !== 200 || !response.data) throw new Error("Gagal memuat saldo PayGate.");
    const data = response.data;
    return {
      balance: data.data?.balance || 0,
      status: data.status,
    };
  } catch (error) {
    console.error("Error checking balance:", error);
    throw error;
  }
}

/**
 * Create dynamic QRIS for payment using Rama Shop API
 */
export async function createDynamicQRCode(
  payload: CreateQRPayload & { userId: string },
): Promise<QRCodeResponse> {
  try {
    const acct = await getRamashopAccountByUserId(payload.userId);
    if (!acct) {
      throw new Error("PayGate akun ini belum aktif. Aktifkan PayGate dulu sebelum membuat QRIS.");
    }

    const res = await callRamashopApi(payload.userId, "/deposit/create", "POST", {
      amount: Math.round(payload.amount),
      method: "qris",
      reference: payload.orderId,
    });
    if (!res || res.status !== 200 || !res.data) {
      throw new Error("Ramashop API returned error when creating deposit");
    }
    const data = res.data;
    return {
      depositId: data.data?.depositId,
      qrString: data.data?.qrString || data.data?.qr_string,
      qrImage: data.data?.qrImage,
      amount: data.data?.amount,
      totalAmount: data.data?.totalAmount,
      uniqueCode: data.data?.uniqueCode,
      expiresIn: QR_CODE_VALIDITY_SECONDS,
      createdAt: new Date().toISOString(),
      expiredAt: data.data?.expiredAt,
    };
  } catch (error) {
    console.error("Error creating QRIS QR Code:", error);
    throw error;
  }
}

/**
 * Verify payment status using Rama Shop API
 */
export async function verifyPaymentStatus(
  depositId: string,
  userId: string,
): Promise<PaymentVerificationResponse> {
  try {
    const acct = await getRamashopAccountByUserId(userId);
    if (!acct) {
      throw new Error("PayGate akun ini belum aktif.");
    }

    const res = await callRamashopApi(userId, `/deposit/status/${depositId}`, "GET");
    if (res && res.status === 200 && res.data) {
      const data = res.data;
      const depositStatus = data.data?.status;

      if (depositStatus === "success") {
        return {
          status: "success",
          amount: data.data?.amount,
          paidAmount: data.data?.paid_amount,
          createdAt: data.data?.created_at,
        };
      }

      if (depositStatus === "expired") {
        return { status: "expired" };
      }

      if (depositStatus === "already") {
        return { status: "success", amount: data.data?.amount };
      }

      return { status: "pending", amount: data.data?.amount };
    }

    throw new Error("Ramashop API returned error when verifying deposit");

  } catch (error) {
    console.error("Error verifying payment status:", error);
    throw error;
  }
}

/**
 * Save order to database with payment info
 */
export async function saveOrder(
  userId: string,
  orderData: {
    orderId: string;
    depositId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    qrString: string;
    qrImage: string;
    totalAmount: number;
    uniqueCode: number;
    customerEmail: string;
    customerPhone: string;
  },
) {
  try {
    const db = getFirebaseFirestore();
    if (!db) {
      throw new Error("Firebase is not configured");
    }

    // Save to Firestore
    const orderRef = db.collection("orders").doc(orderData.orderId);
    await orderRef.set({
      userId,
      ...orderData,
      status: "pending_payment",
      paymentMethod: "dynamic_qris",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return orderData.orderId;
  } catch (error) {
    console.error("Error saving order:", error);
    throw error;
  }
}

/**
 * Update order status after payment verification
 */
export async function updateOrderStatus(
  orderId: string,
  status: "paid" | "pending" | "expired" | "failed",
  transactionData?: {
    depositId?: string;
    paidAmount?: number;
    paymentNotes?: string;
  },
) {
  try {
    const db = getFirebaseFirestore();
    if (!db) {
      throw new Error("Firebase is not configured");
    }

    const updatePayload: {
      status: "paid" | "pending" | "expired" | "failed";
      updatedAt: string;
      paidAt?: string;
      depositId?: string;
      paidAmount?: number;
      paymentNotes?: string;
    } = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === "paid") {
      updatePayload.paidAt = new Date().toISOString();
      if (transactionData) {
        updatePayload.depositId = transactionData.depositId;
        updatePayload.paidAmount = transactionData.paidAmount;
        if (transactionData.paymentNotes) {
          updatePayload.paymentNotes = transactionData.paymentNotes;
        }
      }
    }

    await db.collection("orders").doc(orderId).update(updatePayload);
  } catch (error) {
    console.error("Error updating order status:", error);
    throw error;
  }
}

/**
 * Get order details by ID
 */
export async function getOrderById(orderId: string) {
  try {
    const db = getFirebaseFirestore();
    if (!db) {
      throw new Error("Firebase is not configured");
    }

    const orderRef = await db.collection("orders").doc(orderId).get();
    if (!orderRef.exists) {
      return null;
    }
    return { id: orderRef.id, ...orderRef.data() };
  } catch (error) {
    console.error("Error fetching order:", error);
    throw error;
  }
}

/**
 * Generate payment notes for transaction
 */
export function generatePaymentNotes(payload: {
  depositId: string;
  amount: number;
  method: string;
  timestamp: string;
}): string {
  const date = new Date(payload.timestamp).toLocaleString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    `Pembayaran via ${payload.method.toUpperCase()} | ` +
    `Invoice: ${payload.depositId} | ` +
    `Nominal: Rp ${payload.amount.toLocaleString("id-ID")} | ` +
    `Waktu: ${date}`
  );
}

/**
 * Generate WhatsApp link for paid order
 */
export async function generateOrderWhatsAppLink(orderId: string, customerPhone: string) {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status !== "paid") {
    throw new Error(`Order ${orderId} has not been paid yet`);
  }

  const { getWhatsAppNotificationLink } = await import("./notifications");

  return getWhatsAppNotificationLink({
    phoneNumber: customerPhone,
    orderId: order.id,
    items: order.items,
    subtotal: order.subtotal,
    tax: order.tax,
    total: order.total,
    depositId: order.depositId,
    paidAmount: order.paidAmount,
  });
}
