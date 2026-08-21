import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import {
  generatePaymentNotes,
  getOrderById,
  isDonationOrder,
  updateOrderStatus,
} from "@/server/payment";
import {
  createProduct,
  getFirestoreOrNull,
  listOrdersWithItems,
  recordDonationTotals,
  updateOrderStatus as updateStoreOrderStatus,
} from "@/server/store-data";
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
  message?: {
    chat?: { id?: number | string };
    text?: string;
    caption?: string;
    message_id?: number;
    photo?: Array<{ file_id?: string; width?: number; height?: number }>;
    reply_to_message?: { message_id?: number };
  };
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
  return (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: { message_id?: number; file_path?: string };
  } | null;
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "numeric",
    hour12: false,
  }).format(new Date()));
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

const motivations = [
  "Pelan-pelan, yang penting terus bergerak.",
  "Satu order hari ini bisa membuka jalan untuk banyak order besok.",
  "Jualan yang konsisten selalu menemukan jalannya.",
  "Kerja baikmu sedang membangun kepercayaan.",
];

async function deleteTelegramMessage(chatId: string, messageId?: number) {
  if (!messageId) return;
  await telegramRequest("deleteMessage", { chat_id: chatId, message_id: messageId });
}

function getBotState(chatId: string) {
  return getFirestoreOrNull()?.collection("telegramBotState").doc(chatId);
}

async function sendTelegramMenu(chatId: string, replaceMessageId?: number) {
  const state = await getBotState(chatId);
  if (!replaceMessageId) {
    const old = await state?.get().catch(() => null);
    replaceMessageId = Number(old?.data()?.menuMessageId ?? 0) || undefined;
  }
  await deleteTelegramMessage(chatId, replaceMessageId);
  const adminUrl = `${process.env.NEXTAUTH_URL?.trim() || "https://tokkov2.vercel.app"}/admin`;
  const response = await telegramRequest("sendMessage", {
    chat_id: chatId,
    text: `${greeting()} 👋\n\n<i>${motivations[Math.floor(Math.random() * motivations.length)]}</i>\n\n📋 <b>MENU ADMIN TOKKO</b>\nPilih aksi:`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[
        { text: "📊 Ringkasan", url: `${adminUrl}?section=overview` },
        { text: "🛒 Order", url: `${adminUrl}?section=orders` },
      ], [
        { text: "📦 Produk", url: `${adminUrl}?section=products` },
        { text: "➕ Tambah Produk", callback_data: "product:start" },
      ], [
        { text: "💬 Testimoni", url: `${adminUrl}?section=testimonials` },
        { text: "📖 Book Story", url: `${adminUrl}?section=bookStories` },
      ], [
        { text: "💳 Pembayaran QRIS", url: `${adminUrl}?section=paymentSettings` },
        { text: "🛠️ Maintenance", url: `${adminUrl}?section=maintenanceSettings` },
      ], [
        { text: "📑 Rekap Pesanan", callback_data: "menu:recap" },
      ], [
        { text: "🔄 Refresh Menu", callback_data: "menu:refresh" },
      ]],
    },
  });
  if (response?.result?.message_id) {
    await state?.set({ menuMessageId: response.result.message_id, updatedAt: Date.now() }, { merge: true });
  }
}

function parseProductCaption(caption: string) {
  const values = new Map<string, string>();
  for (const line of caption.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator > 0) values.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  const required = ["nama", "kategori", "harga", "deskripsi"];
  const missing = required.filter((key) => !values.get(key));
  if (missing.length) throw new Error(`Format salah. Field wajib: ${missing.join(", ")}.`);
  const price = Number(values.get("harga")?.replace(/[^0-9]/g, ""));
  if (!Number.isInteger(price) || price < 0) throw new Error("Format salah. Harga harus angka, contoh: Harga: 15000.");
  const productType = values.get("tipe") || "jual_beli";
  if (!["jual_beli", "pekerjaan", "donation"].includes(productType)) {
    throw new Error("Format salah. Tipe harus jual_beli, pekerjaan, atau donation.");
  }
  return {
    name: values.get("nama")!,
    category: values.get("kategori")!,
    shortDescription: values.get("ringkas") || values.get("deskripsi")!.slice(0, 140),
    description: values.get("deskripsi")!,
    duration: values.get("durasi") || "",
    price,
    productType: productType as "jual_beli" | "pekerjaan" | "donation",
    imageUrl: "",
    mediaGallery: [],
    jobApplicationLink: values.get("link") || "",
    maxApplicants: Number(values.get("pelamar") || 0),
    buyNowLink: values.get("buy now") || "",
  };
}

async function sendTelegramDocument(chatId: string, data: Uint8Array, filename: string, caption: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  form.append("document", new Blob([copy.buffer]), filename);
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form, cache: "no-store" });
}

async function buildOrderRecap() {
  const orders = await listOrdersWithItems(100);
  const rows = orders.map((order) => ({
    id: order.id,
    date: order.createdAt,
    name: order.userName,
    status: order.status,
    total: Number(order.totalAmount ?? order.total ?? 0),
    items: (order.items ?? []).map((item) => `${item.productName} x${item.quantity}`).join("; "),
  }));
  const header = ["Order ID", "Tanggal", "Nama", "Status", "Total", "Produk"];
  const csv = [header, ...rows.map((row) => [row.id, row.date, row.name, row.status, row.total, row.items])]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const doc = new PDFDocument({ size: "A4", margin: 32 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  doc.fontSize(16).font("Helvetica-Bold").text("REKAP PESANAN TOKKO", { align: "center" });
  doc.moveDown(0.5).fontSize(8).font("Helvetica");
  doc.text(`Dibuat: ${formatRecapDate(new Date())} | Total order: ${rows.length}`);
  doc.moveDown(0.5);
  rows.forEach((row, index) => {
    doc.font("Helvetica-Bold").text(`${index + 1}. ${row.id} | ${row.status} | Rp ${row.total.toLocaleString("id-ID")}`);
    doc.font("Helvetica").text(`${row.date} | ${row.name} | ${row.items || "-"}`).moveDown(0.25);
  });
  doc.end();
  const pdf = await new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  return { rows, csv: new TextEncoder().encode(csv), pdf: new Uint8Array(pdf) };
}

function formatRecapDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(date);
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

    if (command === "/tambahproduk" || command === "/addproduct") {
      await getBotState(chatId)?.set({ addProductPending: true, updatedAt: Date.now() }, { merge: true });
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "📦 <b>Tambah Produk</b>\n\nKirim <b>foto produk sebagai pesan berikutnya</b> dengan caption format:\n\n<code>Nama: Paket Premium\nKategori: Digital\nHarga: 15000\nDeskripsi: Deskripsi minimal 6 karakter\nRingkas: Kalimat singkat\nDurasi: 30 hari\nTipe: jual_beli</code>\n\nWajib: Nama, Kategori, Harga, Deskripsi. Maksimal foto 450KB.",
        parse_mode: "HTML",
      });
      return NextResponse.json({ ok: true, addProduct: true });
    }

    const state = await getBotState(chatId);
    const pending = await state?.get().catch(() => null);
    if (pending?.data()?.addProductPending) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: "Format salah. Kirim foto produk dengan caption sesuai format dari /tambahproduk.",
        parse_mode: "HTML",
      });
      return NextResponse.json({ ok: true, invalidProduct: true });
    }

    return NextResponse.json({ ok: true, ignored: true });
  }

  if (message?.photo?.length && message.caption) {
    const state = await getBotState(chatId);
    const pending = await state?.get().catch(() => null);
    if (!pending?.data()?.addProductPending) return NextResponse.json({ ok: true, ignored: true });
    try {
      const parsed = parseProductCaption(message.caption);
      const photo = message.photo[message.photo.length - 1];
      if (!photo.file_id) throw new Error("Foto tidak valid.");
      const fileInfo = await telegramRequest("getFile", { file_id: photo.file_id });
      const filePath = fileInfo?.result?.file_path;
      if (!filePath) throw new Error("Foto Telegram tidak dapat diambil.");
      const imageResponse = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`);
      const image = new Uint8Array(await imageResponse.arrayBuffer());
      if (image.byteLength > 450 * 1024) throw new Error("Foto terlalu besar. Maksimal 450KB.");
      const product = await createProduct({
        ...parsed,
        imageUrl: `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`,
      });
      if (!product) throw new Error("Produk gagal disimpan ke Firestore.");
      await state?.set({ addProductPending: false, updatedAt: Date.now() }, { merge: true });
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: `✅ <b>Produk berhasil ditambahkan</b>\n\nNama: ${parsed.name}\nHarga: Rp ${parsed.price.toLocaleString("id-ID")}\nID: <code>${product.id}</code>`,
        parse_mode: "HTML",
      });
    } catch (error) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: `❌ ${error instanceof Error ? error.message : "Format salah atau produk gagal disimpan."}`,
        parse_mode: "HTML",
      });
    }
    return NextResponse.json({ ok: true, productHandled: true });
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
    await sendTelegramMenu(chatId, callback.message.message_id);
    return NextResponse.json({ ok: true, menu: "refresh" });
  }

  if (callback.data === "product:start") {
    await getBotState(chatId)?.set({ addProductPending: true, updatedAt: Date.now() }, { merge: true });
    await telegramRequest("answerCallbackQuery", { callback_query_id: callback.id, text: "Kirim foto + caption produk." });
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "📦 <b>Tambah Produk</b>\n\nKirim foto produk dengan caption:\n\n<code>Nama: Paket Premium\nKategori: Digital\nHarga: 15000\nDeskripsi: Deskripsi minimal 6 karakter\nRingkas: Kalimat singkat\nDurasi: 30 hari\nTipe: jual_beli</code>\n\nWajib: Nama, Kategori, Harga, Deskripsi. Maksimal foto 450KB.",
      parse_mode: "HTML",
    });
    return NextResponse.json({ ok: true, productWizard: true });
  }

  if (callback.data === "menu:recap") {
    const recap = await buildOrderRecap();
    const summary = recap.rows.slice(0, 20).map((row, index) =>
      `${index + 1}. <code>${row.id.slice(0, 8)}</code> | ${row.status} | Rp ${row.total.toLocaleString("id-ID")} | ${row.name}`,
    ).join("\n");
    await telegramRequest("answerCallbackQuery", { callback_query_id: callback.id, text: "Rekap dibuat." });
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: `📑 <b>REKAP PESANAN</b>\nDibuat: ${formatRecapDate(new Date())}\nTotal: ${recap.rows.length}\n\n${summary || "Belum ada pesanan."}`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[
        { text: "📄 Kirim CSV", callback_data: "recap:csv" },
        { text: "📕 Kirim PDF", callback_data: "recap:pdf" },
      ], [{ text: "🔙 Menu", callback_data: "menu:refresh" }]] },
    });
    return NextResponse.json({ ok: true, recap: true });
  }

  if (callback.data === "recap:csv" || callback.data === "recap:pdf") {
    const recap = await buildOrderRecap();
    await telegramRequest("answerCallbackQuery", { callback_query_id: callback.id, text: "File sedang dikirim." });
    await sendTelegramDocument(chatId, callback.data === "recap:csv" ? recap.csv : recap.pdf,
      callback.data === "recap:csv" ? "rekap-pesanan.csv" : "rekap-pesanan.pdf",
      `📑 Rekap pesanan Tokko - ${formatRecapDate(new Date())}`);
    return NextResponse.json({ ok: true, recapFile: callback.data });
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
