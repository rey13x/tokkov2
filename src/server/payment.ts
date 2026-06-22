import { getFirebaseFirestore } from "./firebase-admin";

// Rama Shop API Configuration
const RAMA_API_KEY = "rg_1f74fe1557a731a5516593969972d9";
const RAMA_API_BASE_URL = "https://ramashop.my.id/api/public";

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
export async function checkBalance(): Promise<{ balance: number; status: string }> {
  try {
    const response = await fetch(`${RAMA_API_BASE_URL}/balance`, {
      method: "GET",
      headers: {
        "X-API-Key": RAMA_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check balance: ${response.statusText}`);
    }

    const data = await response.json();
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
  payload: CreateQRPayload,
): Promise<QRCodeResponse> {
  try {
    const response = await fetch(`${RAMA_API_BASE_URL}/deposit/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": RAMA_API_KEY,
      },
      body: JSON.stringify({
        amount: Math.round(payload.amount), // Ensure integer
        method: "qris",
        // Optional: Add reference/order ID
        reference: payload.orderId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Failed to create QR Code: ${errorData.message || response.statusText}`,
      );
    }

    const data = await response.json();

    if (!data.data || (!data.data.qrImage && !data.data.qr_string)) {
      throw new Error("Invalid response from Rama Shop API");
    }

    return {
      depositId: data.data.depositId,
      qrString: data.data.qrString || data.data.qr_string,
      qrImage: data.data.qrImage,
      amount: data.data.amount,
      totalAmount: data.data.totalAmount,
      uniqueCode: data.data.uniqueCode,
      expiresIn: QR_CODE_VALIDITY_SECONDS,
      createdAt: new Date().toISOString(),
      expiredAt: data.data.expiredAt,
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
): Promise<PaymentVerificationResponse> {
  try {
    const response = await fetch(
      `${RAMA_API_BASE_URL}/deposit/status/${depositId}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": RAMA_API_KEY,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { status: "pending" };
      }
      throw new Error(`Failed to verify payment: ${response.statusText}`);
    }

    const data = await response.json();
    const depositStatus = data.data?.status;

    // Map Rama Shop status to our status
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

    // Default to pending
    return { status: "pending", amount: data.data?.amount };
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

    const updatePayload: any = {
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
