"use client";

import { useEffect, useState, type FormEvent } from "react";
import * as XLSX from "xlsx";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileSpreadsheet, FileText, Plus, RefreshCw, Save, Search, Trash2, Wallet } from "lucide-react";
import { formatRupiah } from "@/data/products";
import {
  buildFinanceOrderRows,
  calculateFinanceSummary,
  type FinanceAdjustment,
  type FinanceAdjustmentEffect,
  type FinanceAdjustmentDirection,
} from "@/lib/finance-report";
import type { StoreOrderDetail, StoreProduct } from "@/types/store";
import styles from "./AdminFinanceSection.module.css";

type FinanceData = {
  orders: StoreOrderDetail[];
  products: StoreProduct[];
  settings: { costByProductId: Record<string, number>; adjustments: FinanceAdjustment[] };
};

type OrderFinanceRow = ReturnType<typeof buildFinanceOrderRows>[number];

const todayDateInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const adjustmentEffects: Array<{ value: FinanceAdjustmentEffect; label: string; help: string }> = [
  { value: "revenue", label: "Pendapatan / omzet", help: "Mengubah penjualan, laba kotor, dan laba bersih." },
  { value: "hpp", label: "HPP / biaya produk", help: "Tambah menaikkan HPP; kurangi menurunkan HPP." },
  { value: "expense", label: "Biaya operasional", help: "Tambah menaikkan biaya; kurangi menurunkan biaya." },
  { value: "profit", label: "Laba bersih saja", help: "Tidak mengubah omzet, HPP, atau laba kotor." },
  { value: "cash", label: "Saldo kas saja", help: "Dicatat sebagai perubahan kas tanpa mengubah laba." },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function safeSpreadsheetText(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function paymentStatusLabel(status: string) {
  if (["paid", "done", "delivered", "sent", "cancelled"].includes(status.toLowerCase())) return "Terkonfirmasi";
  if (["error", "rejected", "declined", "failed"].includes(status.toLowerCase())) return "Gagal / batal";
  return "Menunggu";
}

function getDailySeries(rows: OrderFinanceRow[], adjustments: FinanceAdjustment[]) {
  const byDate = new Map<string, { date: string; revenue: number; hpp: number; expenses: number; directProfit: number }>();
  const getDay = (dateValue: string) => {
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  };
  const getBucket = (day: string) => {
    const bucket = byDate.get(day) ?? { date: day, revenue: 0, hpp: 0, expenses: 0, directProfit: 0 };
    byDate.set(day, bucket);
    return bucket;
  };

  for (const row of rows) {
    if (!row.paid) continue;
    const day = getDay(row.order.paidAt || row.order.createdAt);
    if (!day) continue;
    const bucket = getBucket(day);
    bucket.revenue += row.revenue;
    bucket.hpp += row.hpp;
  }

  for (const adjustment of adjustments) {
    const day = getDay(adjustment.date);
    if (!day) continue;
    const bucket = getBucket(day);
    const amount = adjustment.amount * (adjustment.direction === "subtract" ? -1 : 1);
    if (adjustment.affects === "revenue") bucket.revenue += amount;
    if (adjustment.affects === "hpp") bucket.hpp += amount;
    if (adjustment.affects === "expense") bucket.expenses += amount;
    if (adjustment.affects === "profit") bucket.directProfit += amount;
  }

  return [...byDate.values()]
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(-30)
    .map((day) => {
      const revenue = Math.max(0, day.revenue);
      const hpp = Math.max(0, day.hpp);
      const expenses = Math.max(0, day.expenses);
      const grossProfit = revenue - hpp;
      return { ...day, revenue, hpp, grossProfit, netProfit: grossProfit - expenses + day.directProfit };
    });
}

export function AdminFinanceSection() {
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [costDrafts, setCostDrafts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [adjustmentDate, setAdjustmentDate] = useState(todayDateInput);
  const [adjustmentDescription, setAdjustmentDescription] = useState("");
  const [adjustmentDirection, setAdjustmentDirection] = useState<FinanceAdjustmentDirection>("add");
  const [adjustmentEffect, setAdjustmentEffect] = useState<FinanceAdjustmentEffect>("revenue");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadFinance = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/finance", { cache: "no-store" });
      const data = await response.json() as FinanceData & { message?: string };
      if (!response.ok) throw new Error(data.message || "Gagal memuat laporan keuangan.");
      setFinance(data);
      setCostDrafts(data.settings.costByProductId ?? {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat laporan keuangan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadFinance());
  }, []);

  const orders = finance?.orders ?? [];
  const products = finance?.products ?? [];
  const adjustments = finance?.settings.adjustments ?? [];
  const costByProductId = finance?.settings.costByProductId ?? {};
  const rows = buildFinanceOrderRows(orders, products, costByProductId);
  const summary = calculateFinanceSummary(orders, costByProductId, adjustments);
  const dailySeries = getDailySeries(rows, adjustments);
  const selectedEffect = adjustmentEffects.find((effect) => effect.value === adjustmentEffect) ?? adjustmentEffects[0];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const order = row.order;
    const matchesSearch = !normalizedSearch || [
      order.id,
      order.userName,
      order.userEmail,
      order.userPhone,
      row.itemLabel,
    ].some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));
    const matchesStatus = statusFilter === "all" || (statusFilter === "paid" ? row.paid : !row.paid);
    return matchesSearch && matchesStatus;
  });

  const saveCosts = async () => {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/finance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costByProductId: costDrafts }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || "Gagal menyimpan HPP.");
      setMessage("HPP produk berhasil disimpan.");
      await loadFinance();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan HPP.");
    } finally {
      setIsSaving(false);
    }
  };

  const addAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(adjustmentAmount);
    if (!adjustmentDescription.trim() || !Number.isSafeInteger(amount) || amount <= 0) {
      setError("Isi keterangan dan nominal yang valid.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(`${adjustmentDate}T12:00:00`).toISOString(),
          description: adjustmentDescription.trim(),
          direction: adjustmentDirection,
          affects: adjustmentEffect,
          amount,
        }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || "Gagal menyimpan penyesuaian.");
      setAdjustmentDescription("");
      setAdjustmentAmount("");
      setMessage("Penyesuaian keuangan berhasil dicatat.");
      await loadFinance();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan penyesuaian.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAdjustment = async (id: string) => {
    if (!window.confirm("Hapus penyesuaian keuangan ini?")) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/finance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message || "Gagal menghapus penyesuaian.");
      setMessage("Penyesuaian berhasil dihapus.");
      await loadFinance();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus penyesuaian.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportRows = rows.map((row) => ({
    Tanggal: safeSpreadsheetText(formatDateTime(row.order.paidAt || row.order.createdAt)),
    "ID Order": safeSpreadsheetText(row.order.id),
    Nama: safeSpreadsheetText(row.order.userName),
    Email: safeSpreadsheetText(row.order.userEmail),
    Telepon: safeSpreadsheetText(row.order.userPhone),
    Status: safeSpreadsheetText(paymentStatusLabel(row.order.status)),
    Produk: safeSpreadsheetText(row.itemLabel),
    Voucher: safeSpreadsheetText(row.order.voucherCode ?? ""),
    "Nominal Order": row.orderAmount,
    "Penjualan Tercatat": row.revenue,
    HPP: row.hpp,
    "Laba Kotor": row.grossProfit,
  }));

  const downloadCsv = () => {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const content = `\uFEFF${XLSX.utils.sheet_to_csv(worksheet)}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "laporan-keuangan.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    const workbook = XLSX.utils.book_new();
    const overview = [
      { Metrik: "Order terkonfirmasi", Nilai: summary.paidOrderCount },
      { Metrik: "Penjualan", Nilai: summary.revenue },
      { Metrik: "HPP", Nilai: summary.hpp },
      { Metrik: "Laba kotor", Nilai: summary.grossProfit },
      { Metrik: "Biaya operasional", Nilai: summary.operatingExpenses },
      { Metrik: "Laba bersih", Nilai: summary.netProfit },
      { Metrik: "Penyesuaian saldo kas", Nilai: summary.cashAdjustments },
    ];
    const costs = products.map((product) => ({
      Produk: safeSpreadsheetText(product.name),
      Kategori: safeSpreadsheetText(product.category),
      "Harga Jual": product.price,
      HPP: costByProductId[product.id] ?? 0,
    }));
    const adjustmentRows = adjustments.map((adjustment) => ({
      Tanggal: safeSpreadsheetText(formatDateTime(adjustment.date)),
      Keterangan: safeSpreadsheetText(adjustment.description),
      Arah: adjustment.direction === "add" ? "Tambah" : "Kurangi",
      Dampak: adjustmentEffects.find((effect) => effect.value === adjustment.affects)?.label ?? adjustment.affects,
      Nominal: adjustment.amount,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overview), "Ringkasan");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), "Rincian Order");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(costs), "HPP Produk");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(adjustmentRows), "Penyesuaian");
    XLSX.writeFile(workbook, "laporan-keuangan.xlsx");
  };

  if (isLoading && !finance) {
    return <div className={styles.loading}>Memuat laporan keuangan...</div>;
  }

  return (
    <div className={styles.financePage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>LAPORAN ADMIN</p>
          <h1>Keuangan</h1>
          <p>Penjualan, HPP, laba, dan penyesuaian tercatat dalam satu laporan.</p>
        </div>
        <div className={`${styles.actions} ${styles.screenOnly}`}>
          <button type="button" onClick={() => void loadFinance()} disabled={isLoading}><RefreshCw size={16} /> Refresh</button>
          <button type="button" onClick={downloadCsv} disabled={!finance}><Download size={16} /> CSV</button>
          <button type="button" onClick={downloadExcel} disabled={!finance}><FileSpreadsheet size={16} /> Excel</button>
          <button type="button" onClick={() => window.print()} disabled={!finance}><FileText size={16} /> Simpan PDF</button>
        </div>
      </header>

      {error ? <p className={styles.errorNotice} role="alert">{error}</p> : null}
      {message ? <p className={styles.successNotice} role="status">{message}</p> : null}

      <section className={styles.statGrid} aria-label="Statistik keuangan">
        <article className={styles.stat}><span>Penjualan tercatat</span><strong>{formatRupiah(summary.revenue)}</strong><small>{summary.paidOrderCount.toLocaleString("id-ID")} order terkonfirmasi</small></article>
        <article className={styles.stat}><span>Total HPP</span><strong>{formatRupiah(summary.hpp)}</strong><small>Modal produk terjual</small></article>
        <article className={styles.stat}><span>Laba kotor</span><strong className={summary.grossProfit < 0 ? styles.negative : ""}>{formatRupiah(summary.grossProfit)}</strong><small>Penjualan dikurangi HPP</small></article>
        <article className={styles.stat}><span>Biaya operasional</span><strong>{formatRupiah(summary.operatingExpenses)}</strong><small>Setelah penyesuaian biaya</small></article>
        <article className={`${styles.stat} ${styles.netStat}`}><span>Laba bersih</span><strong className={summary.netProfit < 0 ? styles.negative : ""}>{formatRupiah(summary.netProfit)}</strong><small>Laba kotor dikurangi biaya</small></article>
        <article className={styles.stat}><span>Penyesuaian kas</span><strong>{formatRupiah(summary.cashAdjustments)}</strong><small>Tidak mengubah laba</small></article>
      </section>

      <section className={styles.chartPanel}>
        <div className={styles.panelHeading}>
          <div><h2>Grafik penjualan & laba</h2><p>Harian, dari maksimal 30 tanggal terbaru yang memiliki transaksi.</p></div>
          <Wallet aria-hidden="true" />
        </div>
        {dailySeries.length ? (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={dailySeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="financeRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#214ebd" stopOpacity={0.22} /><stop offset="100%" stopColor="#214ebd" stopOpacity={0.01} /></linearGradient>
                  <linearGradient id="financeProfitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b9b83" stopOpacity={0.18} /><stop offset="100%" stopColor="#3b9b83" stopOpacity={0.01} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e5eaf2" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`} />
                <YAxis tickLine={false} axisLine={false} width={78} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} />
                <Tooltip formatter={(value, name) => [formatRupiah(Number(value ?? 0)), name === "revenue" ? "Penjualan" : "Laba bersih"]} labelFormatter={(value) => formatDateTime(`${String(value)}T12:00:00`)} />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="#214ebd" strokeWidth={2.5} fill="url(#financeRevenueFill)" />
                <Area type="monotone" dataKey="netProfit" name="netProfit" stroke="#3b9b83" strokeWidth={2} fill="url(#financeProfitFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <p className={styles.emptyChart}>Belum ada order terkonfirmasi untuk digrafikkan.</p>}
        <div className={styles.chartLegend}><span><i className={styles.revenueKey} /> Penjualan</span><span><i className={styles.profitKey} /> Laba bersih</span></div>
      </section>

      <div className={styles.workGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>Kalkulator penyesuaian</h2><p>Pilih dampak agar HPP dan laba ikut berubah dengan benar.</p></div><Plus aria-hidden="true" /></div>
          <form className={`${styles.adjustmentForm} ${styles.screenOnly}`} onSubmit={addAdjustment}>
            <div className={styles.directionControl} role="group" aria-label="Arah penyesuaian">
              <button type="button" className={adjustmentDirection === "add" ? styles.directionActive : ""} onClick={() => setAdjustmentDirection("add")}>Tambah uang</button>
              <button type="button" className={adjustmentDirection === "subtract" ? styles.directionActive : ""} onClick={() => setAdjustmentDirection("subtract")}>Kurangi uang</button>
            </div>
            <label>Tanggal<input type="date" value={adjustmentDate} onChange={(event) => setAdjustmentDate(event.target.value)} required /></label>
            <label>Keterangan<input value={adjustmentDescription} onChange={(event) => setAdjustmentDescription(event.target.value)} maxLength={160} placeholder="Contoh: biaya iklan mingguan" required /></label>
            <label>Nominal (Rp)<input type="number" min={1} step={1} value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="0" required /></label>
            <label>Dampak perhitungan<select value={adjustmentEffect} onChange={(event) => setAdjustmentEffect(event.target.value as FinanceAdjustmentEffect)}>
              {adjustmentEffects.map((effect) => <option key={effect.value} value={effect.value}>{effect.label}</option>)}
            </select></label>
            <p className={styles.effectHelp}>{selectedEffect.help}</p>
            <button className={styles.primaryButton} type="submit" disabled={isSaving}><Plus size={16} /> Catat penyesuaian</button>
          </form>
          <div className={`${styles.adjustmentList} ${styles.screenOnly}`}>
            <h3>Penyesuaian terbaru</h3>
            {adjustments.slice(0, 6).map((adjustment) => (
              <div className={styles.adjustmentRow} key={adjustment.id}>
                <div><strong>{adjustment.description}</strong><span>{formatDateTime(adjustment.date)} · {adjustmentEffects.find((effect) => effect.value === adjustment.affects)?.label}</span></div>
                <strong className={adjustment.direction === "subtract" ? styles.negative : styles.positive}>{adjustment.direction === "subtract" ? "-" : "+"}{formatRupiah(adjustment.amount)}</strong>
                <button type="button" className={styles.iconButton} onClick={() => void deleteAdjustment(adjustment.id)} disabled={isSaving} aria-label={`Hapus penyesuaian ${adjustment.description}`}><Trash2 size={16} /></button>
              </div>
            ))}
            {!adjustments.length ? <p className={styles.emptyState}>Belum ada penyesuaian manual.</p> : null}
          </div>
          <div className={styles.printOnly}>
            <h3>Daftar penyesuaian</h3>
            <table className={styles.printTable}>
              <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Arah</th><th>Dampak</th><th>Nominal</th></tr></thead>
              <tbody>{adjustments.map((adjustment) => (
                <tr key={adjustment.id}>
                  <td>{formatDateTime(adjustment.date)}</td>
                  <td>{adjustment.description}</td>
                  <td>{adjustment.direction === "add" ? "Tambah" : "Kurangi"}</td>
                  <td>{adjustmentEffects.find((effect) => effect.value === adjustment.affects)?.label}</td>
                  <td>{formatRupiah(adjustment.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><h2>HPP per produk</h2><p>Modal per unit dikalikan jumlah unit pada order terkonfirmasi.</p></div></div>
          <div className={styles.costTableWrap}>
            <table className={styles.costTable}>
              <thead><tr><th>Produk</th><th>Harga jual</th><th>HPP / unit</th></tr></thead>
              <tbody>{products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong><small>{product.category}</small></td>
                  <td>{formatRupiah(product.price)}</td>
                  <td>
                    <input className={styles.costEditorInput} aria-label={`HPP ${product.name}`} type="number" min={0} step={1} value={costDrafts[product.id] ?? 0} onChange={(event) => setCostDrafts((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))} />
                    <span className={styles.printCost}>{formatRupiah(costByProductId[product.id] ?? 0)}</span>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className={`${styles.mobileCostList} ${styles.screenOnly}`}>
            {products.map((product) => <label key={product.id}><span><strong>{product.name}</strong><small>Jual {formatRupiah(product.price)}</small></span><input aria-label={`HPP ${product.name}`} type="number" min={0} step={1} value={costDrafts[product.id] ?? 0} onChange={(event) => setCostDrafts((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))} /></label>)}
          </div>
          <button type="button" className={`${styles.primaryButton} ${styles.screenOnly}`} onClick={() => void saveCosts()} disabled={isSaving}><Save size={16} /> Simpan HPP</button>
          {!products.length ? <p className={styles.emptyState}>Belum ada produk.</p> : null}
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.ordersHeader}>
          <div className={styles.panelHeading}><div><h2>Rincian transaksi</h2><p>Order terbaru, lengkap dengan pemesan, waktu, status, produk, HPP, dan laba.</p></div></div>
          <div className={`${styles.filters} ${styles.screenOnly}`}>
            <label className={styles.searchField}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, ID, produk..." /></label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter status order">
              <option value="all">Semua status</option><option value="paid">Terkonfirmasi</option><option value="unpaid">Belum terkonfirmasi</option>
            </select>
          </div>
        </div>
        <p className={styles.dataLimit}>Menampilkan hingga 1.000 order terbaru. Hanya status terkonfirmasi dihitung sebagai penjualan.</p>
        <div className={styles.orderTableWrap}>
          <table className={styles.orderTable}>
            <thead><tr><th>Tanggal & waktu</th><th>ID order</th><th>Pemesan</th><th>Produk</th><th>Status</th><th>Nominal order</th><th>Penjualan</th><th>HPP</th><th>Laba kotor</th></tr></thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.order.id}>
                  <td>{formatDateTime(row.order.paidAt || row.order.createdAt)}</td>
                  <td className={styles.orderId}>{row.order.id}</td>
                  <td><strong>{row.order.userName}</strong><small>{row.order.userEmail}</small><small>{row.order.userPhone || "-"}</small></td>
                  <td className={styles.productCell}>{row.itemLabel || "-"}</td>
                  <td><span className={`${styles.status} ${row.paid ? styles.statusPaid : styles.statusPending}`}>{paymentStatusLabel(row.order.status)}</span></td>
                  <td>{formatRupiah(row.orderAmount)}</td>
                  <td>{formatRupiah(row.revenue)}</td>
                  <td>{formatRupiah(row.hpp)}</td>
                  <td className={row.grossProfit < 0 ? styles.negative : ""}>{formatRupiah(row.grossProfit)}</td>
                </tr>
              ))}
              {!filteredRows.length ? <tr><td colSpan={9} className={styles.emptyTable}>{orders.length ? "Tidak ada transaksi yang cocok." : "Belum ada order."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <p className={styles.footnote}>HPP menggunakan modal produk yang disetel saat ini. Untuk order lama tanpa pencatatan HPP historis, laporan memakai nilai HPP saat ini.</p>
    </div>
  );
}