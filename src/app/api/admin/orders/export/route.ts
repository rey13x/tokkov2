import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/server/admin";
import { listOrdersWithItems } from "@/server/store-data";

type ExportRow = {
  nomor: number;
  nama: string;
  gmail: string;
  produk: string;
  dibeli_berapa: number;
  durasi_produk: string;
  tanggal: string;
  bulan: string;
  tahun: string;
};

function escapeCsv(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toExportRows(data: Awaited<ReturnType<typeof listOrdersWithItems>>) {
  const rows: ExportRow[] = [];
  let counter = 1;

  data.forEach((order) => {
    const date = new Date(order.createdAt);
    const tanggal = String(date.getDate()).padStart(2, "0");
    const bulan = String(date.getMonth() + 1).padStart(2, "0");
    const tahun = String(date.getFullYear());

    order.items.forEach((item) => {
      rows.push({
        nomor: counter,
        nama: order.userName,
        gmail: order.userEmail,
        produk: item.productName,
        dibeli_berapa: item.quantity,
        durasi_produk: item.productDuration || "",
        tanggal,
        bulan,
        tahun,
      });
      counter += 1;
    });
  });

  return rows;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "csv").toLowerCase();

  const orders = await listOrdersWithItems(1000);
  const rows = toExportRows(orders);

  if (format === "xlsx") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "orders");
    const file = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(file, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="orders-export.xlsx"',
      },
    });
  }

  const headers: Array<keyof ExportRow> = [
    "nomor",
    "nama",
    "gmail",
    "produk",
    "dibeli_berapa",
    "durasi_produk",
    "tanggal",
    "bulan",
    "tahun",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
  ];

  return new NextResponse(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders-export.csv"',
    },
  });
}
