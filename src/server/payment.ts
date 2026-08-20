import { getFirebaseFirestore } from "./firebase-admin";
import crypto from "crypto";

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

function getPayGateStaticQr() {
  const qrString = process.env.PAYGATE_STATIC_QRIS?.trim();
  if (!qrString) {
    throw new Error("PAYGATE_STATIC_QRIS belum dikonfigurasi.");
  }
  return qrString;
}

/**
 * Check account balance
 */
export async function checkBalance(userId: string): Promise<{ balance: number; status: string }> {
  void userId;
  return { balance: 0, status: "internal" };
}

/**
 * Create a local PayGate transaction using the merchant's static QRIS.
 */
export async function createDynamicQRCode(
  payload: CreateQRPayload & { userId: string },
): Promise<QRCodeResponse> {
  try {
    void payload.userId;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + QR_CODE_VALIDITY_SECONDS * 1000);
    const transactionId = `PG-${crypto.randomUUID()}`;
    const qrString = getPayGateStaticQr();
    const uniqueCode = crypto.randomInt(100, 1000);
    const totalAmount = Math.round(payload.amount) + uniqueCode;
    return {
      depositId: transactionId,
      qrString,
      qrImage: "",
      amount: Math.round(payload.amount),
      totalAmount,
      uniqueCode,
      expiresIn: QR_CODE_VALIDITY_SECONDS,
      createdAt: now.toISOString(),
      expiredAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error("Error creating QRIS QR Code:", error);
    throw error;
  }
}

/**
 * Verify payment status from the local order state. A trusted detector/admin
 * changes the order to paid through the internal webhook.
 */
export async function verifyPaymentStatus(
  depositId: string,
  userId: string,
): Promise<PaymentVerificationResponse> {
  try {
    const order = await getOrderByTransactionId(depositId);
    void userId;
    if (!order) return { status: "failed" };
    if (order.status === "paid") {
      return { status: "success", amount: Number(order.total), paidAmount: Number(order.paidAmount ?? order.total) };
    }
    if (order.status === "expired") return { status: "expired" };
    return { status: "pending", amount: Number(order.total) };

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

export async function getOrderByTransactionId(transactionId: string) {
  const db = getFirebaseFirestore();
  if (!db) throw new Error("Firebase is not configured");
  const snapshot = await db.collection("orders").where("depositId", "==", transactionId).limit(1).get();
  const order = snapshot.docs[0];
  return order ? { id: order.id, ...order.data() } : null;
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
