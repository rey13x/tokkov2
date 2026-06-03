import { NextResponse } from "next/server";
import { getMaintenanceSettings } from "@/server/store-data";

export async function GET() {
  try {
    const settings = await getMaintenanceSettings();
    return NextResponse.json(
      { settings },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/maintenance-settings failed:", error);
    return NextResponse.json(
      { message: "Gagal membaca status pemeliharaan." },
      { status: 500 },
    );
  }
}
