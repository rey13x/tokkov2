import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/server/admin";
import { listOrdersWithItems } from "@/server/store-data";

type ExportRow = {
  No: number | string;
  Nama: string;
  Email: string;
  Produk: string;
  Qty: number | string;
  "Harga Satuan": number | string;
  Subtotal: number | string;
  Durasi: string;
  Tanggal: string;
  Status: string;
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
  let grandTotal = 0;

  data.forEach((order) => {
    const date = new Date(order.createdAt);
    const tanggal = date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    order.items.forEach((item: any) => {
      const subtotal = Number(item.unitPrice || 0) * Number(item.quantity || 0);
      grandTotal += subtotal;
      rows.push({
        No: counter,
        Nama: order.userName,
        Email: order.userEmail,
        Produk: item.productName,
        Qty: item.quantity,
        "Harga Satuan": item.unitPrice,
        Subtotal: subtotal,
        Durasi: item.productDuration || "-",
        Tanggal: tanggal,
        Status: order.status,
      });
      counter += 1;
    });
  });

  rows.push({
    No: "",
    Nama: "TOTAL",
    Email: "",
    Produk: `${rows.length} item`,
    Qty: rows.reduce((total, row) => total + (Number(row.Qty) || 0), 0),
    "Harga Satuan": "",
    Subtotal: grandTotal,
    Durasi: "",
    Tanggal: "",
    Status: "",
  });

  return rows;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();

    const orders = await listOrdersWithItems(1000);
    const rows = toExportRows(orders);

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 6 }, { wch: 24 }, { wch: 32 }, { wch: 30 }, { wch: 8 },
        { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
      ];
      worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
      worksheet["!autofilter"] = { ref: `A1:J${Math.max(1, rows.length - 1)}` };
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
      "No",
      "Nama",
      "Email",
      "Produk",
      "Qty",
      "Harga Satuan",
      "Subtotal",
      "Durasi",
      "Tanggal",
      "Status",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
    ];

    return new NextResponse(`\uFEFF${lines.join("\n")}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="orders-export.csv"',
      },
    });
  } catch (error) {
    console.error("GET /api/admin/orders/export failed:", error);
    return NextResponse.json(
      { message: "Gagal export data order." },
      { status: 500 },
    );
  }
}
