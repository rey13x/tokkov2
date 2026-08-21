import { NextResponse } from "next/server";
import {
  generatePaymentNotes,
  getOrderById,
  isDonationOrder,
  updateOrderStatus,
} from "@/server/payment";
import { recordDonationTotals, updateOrderStatus as updateStoreOrderStatus } from "@/server/store-data";
import {
  sendTelegramPaymentSuccessNotification,
} from "@/server/notifications";

export const runtime = "nodejs";

type TelegramUpdate = {
  callback_query?: {
    id?: string;
    data?: string;
    message?: { chat?: { id?: number | string }; message_id?: number };
  };
  message?: { chat?: { id?: number | string }; text?: string };
};

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error(`Telegram ${method} failed:`, response.status);
  }
}

async function sendTelegramMenu(chatId: string) {
  const adminUrl = `${process.env.NEXTAUTH_URL?.trim() || "https://tokkov2.vercel.app"}/admin`;
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text: "📋 <b>MENU ADMIN TOKKO</b>\n\nPilih halaman yang mau dibuka:",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "📊 Ringkasan", url: `${adminUrl}?section=overview` },
        { text: "🛒 Order", url: `${adminUrl}?section=orders` },
      ], [
        { text: "📦 Produk", url: `${adminUrl}?section=products` },
        { text: "➕ Tambah Produk", url: `${adminUrl}?section=products&action=create` },
      ], [
        { text: "💬 Testimoni", url: `${adminUrl}?section=testimonials` },
        { text: "📖 Book Story", url: `${adminUrl}?section=bookStories` },
      ], [
        { text: "💳 Pembayaran QRIS", url: `${adminUrl}?section=paymentSettings` },
        { text: "🛠️ Maintenance", url: `${adminUrl}?section=maintenanceSettings` },
      ], [
        { text: "🔄 Refresh Menu", callback_data: "menu:refresh" },
      ]],
    },
  });
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token")?.trim();
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const configuredChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const update = (await request.json()) as TelegramUpdate;
  const callback = update.callback_query;
  const message = update.message;
  const incomingChatId = callback?.message?.chat?.id ?? message?.chat?.id;
  if (!incomingChatId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const chatId = String(incomingChatId);
  if (!configuredChatId || chatId !== configuredChatId) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (message?.text) {
    const command = message.text.trim();
    if (command === "/start" || command === "/menu") {
      await sendTelegramMenu(chatId);
      return NextResponse.json({ ok: true, menu: true });
    }

    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!callback?.data || !callback.message?.chat?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (callback.data === "menu:activity" || callback.data === "menu:payment") {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Notifikasi aktivitas dan order dikirim otomatis ke chat ini.",
    });
    return NextResponse.json({ ok: true, menu: callback.data });
  }

  if (callback.data === "menu:refresh") {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Menu diperbarui.",
    });
    await sendTelegramMenu(chatId);
    return NextResponse.json({ ok: true, menu: "refresh" });
  }

  if (!callback.data.startsWith("payment:")) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const [, action, orderId] = callback.data.split(":");
  if (!orderId || !["paid", "pending"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Callback tidak valid." }, { status: 400 });
  }

  if (action === "pending") {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Order tetap menunggu pembayaran.",
    });
    await telegramRequest("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: callback.message.message_id,
      reply_markup: { inline_keyboard: [] },
    });
    return NextResponse.json({ ok: true, status: "pending" });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Order tidak ditemukan.",
      show_alert: true,
    });
    return NextResponse.json({ ok: false, error: "Order tidak ditemukan." }, { status: 404 });
  }

  if (!['paid', 'sent'].includes(order.status)) {
    const amount = Number(order.totalAmount ?? order.total ?? 0);
    await updateOrderStatus(order.id, "paid", {
      depositId: order.depositId || order.id,
      paidAmount: amount,
      paymentNotes: generatePaymentNotes({
        depositId: order.depositId || order.id,
        amount,
        method: "konfirmasi Telegram admin",
        timestamp: new Date().toISOString(),
      }),
    });

    if (await isDonationOrder(order)) {
      await recordDonationTotals(order.id);
    }
  }

  if (order.status !== "sent") {
    await updateStoreOrderStatus(order.id, "sent");
  }

  await telegramRequest("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: callback.message.message_id,
    reply_markup: { inline_keyboard: [] },
  });

  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callback.id,
    text: "Pembayaran ditandai berhasil.",
  });
  await sendTelegramPaymentSuccessNotification({
    orderId: order.id,
    transactionId: order.depositId || order.id,
    amount: Number(order.totalAmount ?? order.total ?? 0),
    userName: order.userName,
    userEmail: order.userEmail,
  });

  return NextResponse.json({ ok: true, status: "sent", orderId: order.id });
}
