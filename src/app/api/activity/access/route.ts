import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { sendTelegramActivityNotification } from "@/server/notifications";

const accessSchema = z.object({
  path: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = accessSchema.parse(body);

    await sendTelegramActivityNotification({
      event: "user_access",
      actorName: session.user.username || session.user.name || "User",
      actorEmail: session.user.email ?? "-",
      actorPhone: session.user.phone ?? "",
      description: `User mengakses halaman ${payload.path}.`,
      metadata: [`Path: ${payload.path}`],
    });

    return NextResponse.json({ message: "Aktivitas akses tercatat." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "Gagal mencatat aktivitas akses." }, { status: 500 });
  }
}

