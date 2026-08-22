"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { DonationActivity, DonationActivityType, StoreProduct } from "@/types/store";
import styles from "./page.module.css";

const labels: Record<DonationActivityType, string> = { income: "Pemasukan", expense: "Pengeluaran", refund: "Pengembalian" };
const todayInput = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function AdminDonationActivitiesSection() {
  const [activities, setActivities] = useState<DonationActivity[]>([]);
  const [donationProducts, setDonationProducts] = useState<StoreProduct[]>([]);
  const [donationProductId, setDonationProductId] = useState("");
  const [type, setType] = useState<DonationActivityType>("income");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayInput);
  const [useToday, setUseToday] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [actorName, setActorName] = useState("Tokko Marketplace");
  const [actorPhone, setActorPhone] = useState("085121579597");
  const [filter, setFilter] = useState<"all" | DonationActivityType>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const formatAmount = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits ? `Rp ${Number(digits).toLocaleString("id-ID")}` : "";
  };

  const loadActivities = async () => {
    const response = await fetch("/api/admin/donation-activities", { cache: "no-store" });
    if (response.ok) setActivities(((await response.json()) as { activities: DonationActivity[] }).activities);
  };

  useEffect(() => {
    void loadActivities();
    fetch("/api/admin/products", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { products?: StoreProduct[] } | null) => {
        const products = (data?.products ?? []).filter((product) => product.productType === "donation");
        setDonationProducts(products);
        setDonationProductId((current) => current || products[0]?.id || "");
      })
      .catch(() => {});
    fetch("/api/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((profile: { phone?: string; username?: string } | null) => {
        if (profile?.phone?.trim()) setActorPhone(profile.phone.trim());
        if (profile?.username?.trim()) setActorName("Tokko Marketplace");
      })
      .catch(() => {});
  }, []);

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "donation-activities");
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const result = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !result.url) throw new Error(result.message || "Upload foto gagal.");
      setImageUrl(result.url);
      setMessage("Foto berhasil diupload dan siap dikirim.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload foto gagal.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/donation-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          amount: Number(amount.replace(/\D/g, "")),
          note,
          imageUrl,
          occurredAt: new Date(useToday ? todayInput() : occurredAt).toISOString(),
          actorName,
          actorPhone,
          donationProductId,
        }),
      });
      const result = (await response.json()) as { message?: string; telegramSent?: boolean; telegramError?: string };
      if (!response.ok) throw new Error(result.message || "Gagal mengirim aktivitas.");
      setAmount("");
      setNote("");
      setImageUrl("");
      setMessage(result.telegramSent ? "Aktivitas tersimpan dan berhasil dikirim ke Telegram." : `Aktivitas tersimpan, tetapi Telegram gagal: ${result.telegramError || "periksa konfigurasi bot/channel."}`);
      await loadActivities();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal mengirim aktivitas.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <article className={styles.card}>
      <h2>Aktivitas Donasi</h2>
      <p>Pantau pemasukan, pengeluaran, dan pengembalian donasi.</p>
      <form className={styles.form} onSubmit={submit}>
        <select value={type} onChange={(event) => setType(event.target.value as DonationActivityType)}>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
          <option value="refund">Pengembalian</option>
        </select>
        <select value={donationProductId} onChange={(event) => setDonationProductId(event.target.value)} required>
          <option value="">Pilih card donasi</option>
          {donationProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · Saldo Rp {Number(product.donationTotal ?? 0).toLocaleString("id-ID")}
            </option>
          ))}
        </select>
        <input value={amount} onChange={(event) => setAmount(formatAmount(event.target.value))} inputMode="numeric" placeholder="Rp 0" required />
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan aktivitas" required />
        <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} type="url" placeholder="URL foto lampiran (opsional)" />
        <label className={styles.fileField}>Foto lampiran (opsional)<input type="file" accept="image/*" onChange={uploadImage} /><small>{isUploading ? "Uploading..." : imageUrl ? "Foto siap dikirim" : "Pilih foto dari device"}</small></label>
        <label><input type="checkbox" checked={useToday} onChange={(event) => setUseToday(event.target.checked)} /> Hari ini dan waktu sekarang</label>
        {!useToday ? <input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /> : null}
        <button type="submit" disabled={isSending || isUploading}>{isSending ? "Mengirim..." : "Kirim"}</button>
        {message ? <p>{message}</p> : null}
        {error ? <p>{error}</p> : null}
      </form>
      <div className={styles.formActions}>
        {(["all", "income", "expense", "refund"] as const).map((value) => (
          <button key={value} type="button" className={filter === value ? styles.primaryButton : styles.secondaryButton} onClick={() => setFilter(value)}>
            {value === "all" ? "Semua" : labels[value]}
          </button>
        ))}
      </div>
      <div className={styles.list}>
        {activities.filter((activity) => filter === "all" || activity.type === filter).map((activity) => <div className={styles.listItem} key={activity.id}><strong>{labels[activity.type]} · Rp {activity.amount.toLocaleString("id-ID")}</strong><span>{donationProducts.find((product) => product.id === activity.donationProductId)?.name ?? "Card donasi lama"}</span><span>{activity.note}</span><button type="button" className={styles.secondaryButton} onClick={async () => { if (!window.confirm("Hapus aktivitas dan pesan Telegram ini?")) return; const response = await fetch(`/api/admin/donation-activities?id=${encodeURIComponent(activity.id)}`, { method: "DELETE" }); if (response.ok) { setActivities((current) => current.filter((item) => item.id !== activity.id)); await loadActivities(); } else { setError("Aktivitas gagal dihapus."); } }}>Hapus</button></div>)}
      </div>
    </article>
  );
}
