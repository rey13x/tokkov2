"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiCreditCard, FiGlobe, FiShoppingBag } from "react-icons/fi";
// @ts-expect-error - qrcode.react doesn't ship complete React 19 types in this project.
import QRCode from "qrcode.react";
import styles from "./page.module.css";

type Store = {
  slug: string;
  name: string;
  description: string;
  website: string;
  bannerUrl: string;
  logoUrl: string;
  theme: string;
  minAmount: number;
  maxAmount: number;
  allowCustomAmount: boolean;
  presetAmounts: number[];
};

type Product = { id: string; name: string; description: string; price: number; imageUrl: string };
type Transaction = { id: string; amount: number; totalAmount: number; status: string; qrString: string; expiredAt: number };

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function StorefrontClient({ store, products }: { store: Store; products: Product[] }) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [amount, setAmount] = useState(store.presetAmounts[0] || store.minAmount);
  const [customAmount, setCustomAmount] = useState(store.minAmount);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeAmount = selectedProductId ? products.find((item) => item.id === selectedProductId)?.price || amount : amount;

  useEffect(() => {
    if (!transaction || transaction.status !== "pending") return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/paygate/native/public/status?transactionId=${transaction.id}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (result.transaction?.status && result.transaction.status !== transaction.status) {
        setTransaction((current) => current ? { ...current, ...result.transaction } : current);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [transaction]);

  async function checkout() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/paygate/native/public/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: store.slug,
        productId: selectedProductId || null,
        amount: activeAmount,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || !result.ok) {
      setError(result.error || "Transaksi belum bisa dibuat.");
      return;
    }
    setTransaction(result.transaction);
  }

  return (
    <main className={`${styles.page} ${styles[`theme_${store.theme}`] || styles.theme_light}`}>
      <section className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.banner} style={store.bannerUrl ? { backgroundImage: `url(${store.bannerUrl})` } : undefined} />
          <div className={styles.identity}>
            <div className={styles.logo}>{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <FiShoppingBag />}</div>
            <h1>{store.name}</h1>
            <p>{store.description || "Pembayaran QRIS otomatis via PayGate"}</p>
            {store.website ? <a href={store.website} target="_blank" rel="noreferrer"><FiGlobe /> Website</a> : null}
          </div>
        </header>

        {transaction ? (
          <section className={styles.paymentBox}>
            {transaction.status === "paid" ? (
              <div className={styles.success}><FiCheckCircle /><h2>Transaksi sukses</h2><p>{formatRupiah(transaction.totalAmount)} sudah diterima.</p></div>
            ) : (
              <>
                <h2>Scan QRIS</h2>
                <QRCode value={transaction.qrString} size={260} includeMargin />
                <strong>{formatRupiah(transaction.totalAmount)}</strong>
                <span>ID: {transaction.id}</span>
                <button type="button" onClick={() => setTransaction(null)}>Buat transaksi lain</button>
              </>
            )}
          </section>
        ) : (
          <section className={styles.checkout}>
            {products.length ? (
              <>
                <h2>Pilih Produk</h2>
                <div className={styles.products}>
                  {products.map((product) => (
                    <button key={product.id} type="button" className={selectedProductId === product.id ? styles.selected : ""} onClick={() => setSelectedProductId(product.id)}>
                      {product.imageUrl ? <img src={product.imageUrl} alt="" /> : null}
                      <strong>{product.name}</strong>
                      <span>{formatRupiah(product.price)}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className={styles.textButton} onClick={() => setSelectedProductId("")}>Masukkan nominal lain</button>
              </>
            ) : null}

            {!selectedProductId ? (
              <>
                <h2>Pilih Nominal Pembayaran</h2>
                <div className={styles.presets}>
                  {store.presetAmounts.map((preset) => (
                    <button key={preset} type="button" className={amount === preset ? styles.selected : ""} onClick={() => setAmount(preset)}>
                      {formatRupiah(preset)}
                    </button>
                  ))}
                </div>
                {store.allowCustomAmount ? (
                  <label className={styles.customAmount}>
                    Rp
                    <input type="number" min={store.minAmount} max={store.maxAmount} value={customAmount} onChange={(e) => {
                      const next = Number(e.target.value);
                      setCustomAmount(next);
                      setAmount(next);
                    }} />
                  </label>
                ) : null}
              </>
            ) : null}

            {error ? <p className={styles.error}>{error}</p> : null}
            <button className={styles.payButton} type="button" onClick={checkout} disabled={loading || !activeAmount}>
              <FiCreditCard /> {loading ? "Membuat QRIS..." : "Bayar Sekarang"}
            </button>
            <small>Pembayaran aman via QRIS, dikonfirmasi otomatis oleh PayGate.</small>
          </section>
        )}
      </section>
    </main>
  );
}
