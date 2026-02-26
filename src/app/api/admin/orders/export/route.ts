import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin";

const csvPath = path.join(process.cwd(), "storage", "exports", "orders.csv");

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const file = await fs.readFile(csvPath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-export.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Belum ada file export order." },
      { status: 404 },
    );
  }
}

