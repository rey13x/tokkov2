import { getFirebaseFirestore } from "./firebase-admin";
import { ensureDatabase, run, updateOrderPayment } from "./db";
import {
  getOrderById as getStoreOrderById,
  getProductById,
  listOrderItemsByOrderId,
  updateOrderPayment as updateStoreOrderPayment,
} from "./store-data";
import { makeDynamicQris } from "./paygate/native";

// QRIS validity is limited to one hour for this payment flow.
export const QR_CODE_VALIDITY_SECONDS = 60 * 60;
const MERCHANT_QRIS_STATIC = "00020101021126610014COM.GO-JEK.WWW01189360091431684004790210G1684004790303UMI51440014ID.CO.QRIS.WWW0215ID10265745849200303UMI5204481453033605802ID5924Tokko Marketplace, Pulsa6006BEKASI61051742362070703A016304C2B4";
let firestoreUnavailable = false;

function isFirestorePermissionError(error: unknown) {
  const message = String(error || "").toLowerCase();
  return message.includes("permission_denied") || message.includes("permission denied");
}

function getPaymentFirestore() {
  return firestoreUnavailable ? null : getFirebaseFirestore();
}

export interface CreateQRPayload {
  orderId: string;
  amount: number;
  description: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  isDonation?: boolean;
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
  void userId;
  return { balance: 0, status: "internal" };
}

/**
 * Create a local PayGate transaction using the merchant's static QRIS.
 */
export async function createDynamicQRCode(
  payload: CreateQRPayload & { userId: string },
): Promise<QRCodeResponse> {
  void payload.userId;
  void payload.isDonation;
  const amount = Math.round(payload.amount);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + QR_CODE_VALIDITY_SECONDS * 1000);
  const qrString = makeDynamicQris(
    process.env.MERCHANT_QRIS_STATIC?.trim() || MERCHANT_QRIS_STATIC,
    amount,
  );
  const depositId = `qris-${payload.orderId}-${createdAt.getTime()}`;

  return {
    depositId,
    qrString,
    qrImage: "",
    amount,
    totalAmount: amount,
    uniqueCode: 0,
    expiresIn: QR_CODE_VALIDITY_SECONDS,
    createdAt: createdAt.toISOString(),
    expiredAt: expiresAt.toISOString(),
  };
}

/**
 * Verify payment status from the local order state. A trusted detector/admin
 * changes the order to paid through the internal webhook.
 */
export async function verifyPaymentStatus(
  depositId: string,
  userId: string,
  isDonation = false,
): Promise<PaymentVerificationResponse> {
  void isDonation;

  const order = await getOrderByTransactionId(depositId);
  if (order && order.userId === userId) {
    if (["paid", "sent"].includes(order.status)) {
      return {
        status: "success",
        amount: Number(order.totalAmount ?? order.total ?? 0),
        paidAmount: Number(order.paidAmount ?? order.totalAmount ?? order.total ?? 0),
        createdAt: order.paidAt ?? order.updatedAt ?? undefined,
      };
    }

    const paymentExpiresAt = order.paymentExpiresAt;
    if (paymentExpiresAt && new Date(paymentExpiresAt).getTime() <= Date.now()) {
      return { status: "expired" };
    }
  }

  return { status: "pending" };
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
    paymentExpiresAt?: string;
    customerEmail: string;
    customerPhone: string;
  },
) {
  try {
    const db = getPaymentFirestore();
    if (!db) {
      await updateOrderPayment(orderData.orderId, {
        paymentMethod: "dynamic_qris",
        qrCode: orderData.qrString,
        qrImage: orderData.qrImage,
        totalAmount: orderData.totalAmount,
        uniqueCode: orderData.uniqueCode,
        depositId: orderData.depositId,
        paymentExpiresAt: orderData.paymentExpiresAt,
      });
      return orderData.orderId;
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

export async function createQRCodeForExistingOrder(orderId: string, userId: string) {
  const order = await getStoreOrderById(orderId);

  if (!order) {
    throw new Error("Order tidak ditemukan.");
  }
  if (order.userId !== userId) {
    throw new Error("Kamu tidak punya akses ke order ini.");
  }
  if (order.status === "paid") {
    throw new Error("Order ini sudah dibayar.");
  }

  const qrResponse = await createDynamicQRCode({
    userId,
    orderId,
    amount: Math.round(order.total),
    description: `Pembayaran Tokko - Order ${orderId}`,
    customerName: order.userName,
    customerEmail: order.userEmail,
    customerPhone: order.userPhone,
  });

  await updateStoreOrderPayment(orderId, {
    paymentMethod: "dynamic_qris",
    qrCode: qrResponse.qrString,
    qrImage: qrResponse.qrImage,
    totalAmount: qrResponse.totalAmount,
    uniqueCode: qrResponse.uniqueCode,
    depositId: qrResponse.depositId,
    paymentExpiresAt: qrResponse.expiredAt,
  });

  return qrResponse;
}

export async function isDonationOrder(order: { id: string }) {
  const items = await listOrderItemsByOrderId(order.id);
  if (!items.length) {
    return false;
  }

  const products = await Promise.all(items.map((item) => getProductById(item.productId)));
  return products.some((product) => product?.productType === "donation");
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
    const db = getPaymentFirestore();
    if (!db) {
      await ensureDatabase();
      const updatedAt = new Date().toISOString();
      const paidAt = status === "paid" ? updatedAt : null;
      const depositId = transactionData?.depositId ?? null;
      const paidAmount = transactionData?.paidAmount ?? null;
      const paymentNotes = transactionData?.paymentNotes ?? null;
      await run(
        `UPDATE orders SET status = ?, updated_at = ?, paid_at = ?, deposit_id = COALESCE(?, deposit_id), paid_amount = ?, payment_notes = ? WHERE id = ?`,
        [
          status,
          updatedAt,
          paidAt,
          depositId,
          paidAmount,
          paymentNotes,
          orderId,
        ],
      );
      return;
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
    if (isFirestorePermissionError(error)) {
      firestoreUnavailable = true;
      await ensureDatabase();
      const updatedAt = new Date().toISOString();
      const paidAt = status === "paid" ? updatedAt : null;
      await run(
        `UPDATE orders SET status = ?, updated_at = ?, paid_at = ?, deposit_id = COALESCE(?, deposit_id), paid_amount = ?, payment_notes = ? WHERE id = ?`,
        [
          status,
          updatedAt,
          paidAt,
          transactionData?.depositId ?? null,
          transactionData?.paidAmount ?? null,
          transactionData?.paymentNotes ?? null,
          orderId,
        ],
      );
      return;
    }
    console.error("Error updating order status:", error);
    throw error;
  }
}

/**
 * Get order details by ID
 */
export async function getOrderById(orderId: string) {
  try {
    const db = getPaymentFirestore();
    if (!db) {
      await ensureDatabase();
      const result = await run("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: String(row.id),
        userId: String(row.user_id ?? ""),
        userName: String(row.user_name ?? ""),
        userEmail: String(row.user_email ?? ""),
        userPhone: String(row.user_phone ?? ""),
        total: Number(row.total ?? 0),
        status: String(row.status ?? "new"),
        items: [],
        depositId: String(row.deposit_id ?? ""),
        qrString: String(row.qr_code ?? ""),
        qrImage: String(row.qr_image ?? ""),
        totalAmount: Number(row.total_amount ?? 0),
        uniqueCode: Number(row.unique_code ?? 0),
        paidAmount: Number(row.paid_amount ?? 0),
      };
    }

    const orderRef = await db.collection("orders").doc(orderId).get();
    if (!orderRef.exists) {
      return null;
    }
    return { id: orderRef.id, ...orderRef.data() };
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      firestoreUnavailable = true;
      await ensureDatabase();
      const result = await run("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: String(row.id),
        userId: String(row.user_id ?? ""),
        userName: String(row.user_name ?? ""),
        userEmail: String(row.user_email ?? ""),
        userPhone: String(row.user_phone ?? ""),
        total: Number(row.total ?? 0),
        status: String(row.status ?? "new"),
        items: [],
        depositId: String(row.deposit_id ?? ""),
        qrString: String(row.qr_code ?? ""),
        qrImage: String(row.qr_image ?? ""),
        totalAmount: Number(row.total_amount ?? 0),
        uniqueCode: Number(row.unique_code ?? 0),
        paidAmount: Number(row.paid_amount ?? 0),
      };
    }
    console.error("Error fetching order:", error);
    throw error;
  }
}

export async function getOrderByTransactionId(transactionId: string) {
  const db = getPaymentFirestore();
  if (!db) {
    await ensureDatabase();
    const result = await run("SELECT * FROM orders WHERE deposit_id = ? LIMIT 1", [transactionId]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? { id: String(row.id), ...row } : null;
  }
  try {
    const snapshot = await db.collection("orders").where("depositId", "==", transactionId).limit(1).get();
    const order = snapshot.docs[0];
    return order ? { id: order.id, ...order.data() } : null;
  } catch (error) {
    if (!isFirestorePermissionError(error)) throw error;
    firestoreUnavailable = true;
    await ensureDatabase();
    const result = await run("SELECT * FROM orders WHERE deposit_id = ? LIMIT 1", [transactionId]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? { id: String(row.id), ...row } : null;
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
