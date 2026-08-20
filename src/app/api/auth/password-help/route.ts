import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { sendTelegramAuthNotification } from "@/server/notifications";

export async function POST() {
  const session = await getServerAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  void sendTelegramAuthNotification({
    event: "password_reset_request",
    name: session.user.username || session.user.name || "User",
    email: session.user.email,
    phone: session.user.phone,
  });

  return NextResponse.json({ message: "Admin sudah diberi tahu." });
}
