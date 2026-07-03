import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { listUsersWithPushSubscription } from "@/server/db";
import { sendFirebaseWebPushMessage } from "@/server/notifications";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const subscribers = await listUsersWithPushSubscription();
    return NextResponse.json({
      subscribers: subscribers.map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
      })),
    });
  } catch (error) {
    console.error("GET /api/admin/notifications failed:", error);
    return NextResponse.json({ message: "Gagal memuat langganan notifikasi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const message = String(body.body || "").trim();
    const url = String(body.url || "/").trim();

    if (!title || !message) {
      return NextResponse.json({ message: "Judul dan isi notifikasi harus diisi." }, { status: 400 });
    }

    const subscribers = await listUsersWithPushSubscription();
    if (subscribers.length === 0) {
      return NextResponse.json({ message: "Tidak ada pengguna yang berlangganan notifikasi." });
    }

    const sendResults = await Promise.all(
      subscribers.map(async (subscriber) => {
        return sendFirebaseWebPushMessage({
          token: subscriber.pushSubscription,
          title,
          body: message,
          url,
        });
      }),
    );

    const sentCount = sendResults.filter(Boolean).length;
    return NextResponse.json({
      message: `Notifikasi dikirim ke ${sentCount} dari ${subscribers.length} pengguna berlangganan.`,
    });
  } catch (error) {
    console.error("POST /api/admin/notifications failed:", error);
    return NextResponse.json({ message: "Gagal mengirim notifikasi." }, { status: 500 });
  }
}
