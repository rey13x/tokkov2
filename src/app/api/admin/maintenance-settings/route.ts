import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";
import { getMaintenanceSettings, upsertMaintenanceSettings } from "@/server/store-data";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const settings = await getMaintenanceSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET /api/admin/maintenance-settings failed:", error);
    return NextResponse.json(
      { message: "Gagal membaca pengaturan pemeliharaan." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const settings = await upsertMaintenanceSettings({
      isEnabled: Boolean(body.isEnabled),
      message: String(body.message || ""),
      accessKey: String(body.accessKey || ""),
      openTime: String(body.openTime || ""),
      closeTime: String(body.closeTime || ""),
      maintenanceTitle: String(body.maintenanceTitle || "Website sedang dalam Pemeliharaan"),
      maintenanceSubtitle: String(body.maintenanceSubtitle || "Hi! Tokkers Website sedang dalam Pemeliharaan. Tenang.. kamu tetap bisa melihat tampilan website kami"),
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("PUT /api/admin/maintenance-settings failed:", error);
    return NextResponse.json(
      { message: "Gagal menyimpan pengaturan pemeliharaan." },
      { status: 500 },
    );
  }
}
