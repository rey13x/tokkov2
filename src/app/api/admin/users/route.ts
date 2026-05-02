import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import {
  listAllUsers,
  getUserPurchases,
  getUserJobApplications,
  deleteUser,
} from "@/server/db";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const users = await listAllUsers();
    const usersWithActivity = await Promise.all(
      users.map(async (user) => {
        const purchases = await getUserPurchases(user.id);
        const jobApplications = await getUserJobApplications(user.id);

        return {
          ...user,
          purchaseCount: purchases.length ?? 0,
          jobApplicationCount: jobApplications.length ?? 0,
          lastActiveAt: user.last_active_at ? new Date(user.last_active_at).toISOString() : null,
          createdAt: new Date(user.created_at).toISOString(),
        };
      }),
    );

    return NextResponse.json({ users: usersWithActivity });
  } catch (error) {
    console.error("GET /api/admin/users failed:", error);
    const detail =
      error instanceof Error && error.message.trim() ? ` (${error.message.trim()})` : "";

    return NextResponse.json(
      { message: `Gagal mengambil data user.${detail}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { userId } = await request.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { message: "User ID harus disediakan." },
        { status: 400 },
      );
    }

    await deleteUser(userId);
    return NextResponse.json({ message: "User berhasil dihapus." });
  } catch (error) {
    console.error("DELETE /api/admin/users failed:", error);
    const detail =
      error instanceof Error && error.message.trim() ? ` (${error.message.trim()})` : "";

    return NextResponse.json(
      { message: `Gagal menghapus user.${detail}` },
      { status: 500 },
    );
  }
}
