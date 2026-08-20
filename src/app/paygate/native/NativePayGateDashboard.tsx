"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiCreditCard, FiKey, FiPackage, FiPlus, FiRefreshCw, FiShoppingBag } from "react-icons/fi";
import styles from "./page.module.css";

type Store = {
  slug: string;
  name: string;
  description: string;
  website: string;
  bannerUrl: string;
  logoUrl: string;
  theme: string;
  isActive: boolean;
  qrisName: string;
  staticQris: string;
  packageIds: string[];
  minAmount: number;
  maxAmount: number;
  allowCustomAmount: boolean;
  presetAmounts: number[];
  telegramChatId: string;
  webhookUrl: string;
  webhookSecret: string;
};

type Product = { id: string; name: string; description: string; price: number; imageUrl: string; isActive: boolean };
type ApiKey = { id: string; key?: string; maskedKey: string; requestCount: number; lastUsed: number | null };
type Transaction = { id: string; amount: number; totalAmount: number; status: string; createdAt: number; paidAt: number | null };

const demoQris = "00020101021126570011ID.DANA.WWW011893600915380287361302098028736130303UMI51440014ID.CO.QRIS.WWW0215ID10243638392580303UMI5204481453033605802ID5911Tamaga Cell6011Kab. Bekasi61051742363043A75";
const themes = ["light", "dark", "neobrutalism", "mint", "midnight", "matrix"];

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function NativePayGateDashboard() {
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [productDraft, setProductDraft] = useState({ name: "", description: "", price: 10000, imageUrl: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const publicUrl = useMemo(() => (store ? `${window.location.origin}/${store.slug}` : ""), [store]);
  const paidTotal = transactions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.totalAmount, 0);

  async function load() {
    setLoading(true);
    const [storeRes, productRes, keyRes, trxRes] = await Promise.all([
      fetch("/api/paygate/native/store", { cache: "no-store" }),
      fetch("/api/paygate/native/products", { cache: "no-store" }),
      fetch("/api/paygate/native/api-keys", { cache: "no-store" }),
      fetch("/api/paygate/native/transactions?limit=30", { cache: "no-store" }),
    ]);
    const [storeJson, productJson, keyJson, trxJson] = await Promise.all([
      storeRes.json(),
      productRes.json(),
      keyRes.json(),
      trxRes.json(),
    ]);
    setStore(storeJson.store);
    setProducts(productJson.products || []);
    setApiKeys(keyJson.apiKeys || []);
    setTransactions(trxJson.transactions || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveStore(event: FormEvent) {
    event.preventDefault();
    if (!store) return;
    setError("");
    setNotice("");
    const response = await fetch("/api/paygate/native/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...store,
        packageIds: store.packageIds.join(","),
        presetAmounts: store.presetAmounts.join(","),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setError(result.error || "Gagal menyimpan toko.");
      return;
    }
    setStore(result.store);
    setNotice("Konfigurasi PayGate tersimpan.");
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/paygate/native/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productDraft),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setError(result.error || "Produk gagal disimpan.");
      return;
    }
    setProductDraft({ name: "", description: "", price: 10000, imageUrl: "" });
    setNotice("Produk ditambahkan.");
    await load();
  }

  async function createApiKey() {
    const response = await fetch("/api/paygate/native/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const result = await response.json();
    if (result.apiKey?.key) {
      await navigator.clipboard.writeText(result.apiKey.key);
      setNotice("API key baru dibuat dan sudah disalin. Simpan sekarang karena hanya tampil sekali.");
    }
    await load();
  }

  if (loading || !store) return <main className={styles.page}><p className={styles.notice}>Memuat PayGate...</p></main>;

  return (
    <main className={styles.page}>
      <aside className={styles.sidebar}>
        <strong>PG</strong>
        <a href="#store"><FiShoppingBag /></a>
        <a href="#qris"><FiCreditCard /></a>
        <a href="#products"><FiPackage /></a>
        <a href="#api"><FiKey /></a>
      </aside>

      <section className={styles.hero}>
        <div>
          <p>PayGate Native</p>
          <h1>{store.name || "Toko PayGate"}</h1>
          <span>{publicUrl}</span>
        </div>
        <div className={styles.heroStats}>
          <strong>{formatRupiah(paidTotal)}</strong>
          <span>Duit masuk tercatat</span>
        </div>
      </section>

      {notice ? <p className={styles.notice}><FiCheckCircle /> {notice}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <form id="store" className={styles.grid} onSubmit={saveStore}>
        <section className={styles.panel}>
          <h2>Identitas Toko</h2>
          <label>Slug URL<input value={store.slug} onChange={(e) => setStore({ ...store, slug: e.target.value })} /></label>
          <label>Nama Toko<input value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} /></label>
          <label>Deskripsi<textarea value={store.description} onChange={(e) => setStore({ ...store, description: e.target.value })} /></label>
          <label>Website<input value={store.website} onChange={(e) => setStore({ ...store, website: e.target.value })} /></label>
          <label>Banner URL<input value={store.bannerUrl} onChange={(e) => setStore({ ...store, bannerUrl: e.target.value })} /></label>
          <label>Logo URL<input value={store.logoUrl} onChange={(e) => setStore({ ...store, logoUrl: e.target.value })} /></label>
        </section>

        <section className={styles.panel} id="qris">
          <h2>Pengaturan Pembayaran</h2>
          <label>QRIS Statis<textarea value={store.staticQris} placeholder={demoQris} onChange={(e) => setStore({ ...store, staticQris: e.target.value })} /></label>
          <label>Package IDs<input value={store.packageIds.join(", ")} onChange={(e) => setStore({ ...store, packageIds: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
          <label>Nominal Preset<input value={store.presetAmounts.join(", ")} onChange={(e) => setStore({ ...store, presetAmounts: e.target.value.split(",").map(Number).filter(Boolean) })} /></label>
          <div className={styles.twoCols}>
            <label>Min Nominal<input type="number" value={store.minAmount} onChange={(e) => setStore({ ...store, minAmount: Number(e.target.value) })} /></label>
            <label>Max Nominal<input type="number" value={store.maxAmount} onChange={(e) => setStore({ ...store, maxAmount: Number(e.target.value) })} /></label>
          </div>
          <label>Telegram Chat ID<input value={store.telegramChatId} onChange={(e) => setStore({ ...store, telegramChatId: e.target.value })} /></label>
          <label>Merchant Webhook URL<input value={store.webhookUrl} onChange={(e) => setStore({ ...store, webhookUrl: e.target.value })} /></label>
          <label>Merchant Webhook Secret<input value={store.webhookSecret} onChange={(e) => setStore({ ...store, webhookSecret: e.target.value })} /></label>
        </section>

        <section className={styles.panel}>
          <h2>Tema Halaman</h2>
          <div className={styles.themeGrid}>
            {themes.map((theme) => (
              <button key={theme} type="button" className={store.theme === theme ? styles.themeActive : ""} onClick={() => setStore({ ...store, theme })}>{theme}</button>
            ))}
          </div>
          <label className={styles.switch}><input type="checkbox" checked={store.isActive} onChange={(e) => setStore({ ...store, isActive: e.target.checked })} /> Halaman aktif</label>
          <button className={styles.primary} type="submit">Simpan Perubahan</button>
          <a className={styles.secondary} href={`/${store.slug}`} target="_blank">Lihat Toko</a>
        </section>
      </form>

      <section id="products" className={styles.panel}>
        <h2>Produk</h2>
        <form className={styles.productForm} onSubmit={saveProduct}>
          <input placeholder="Nama produk" value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} />
          <input type="number" placeholder="Harga" value={productDraft.price} onChange={(e) => setProductDraft({ ...productDraft, price: Number(e.target.value) })} />
          <input placeholder="Image URL" value={productDraft.imageUrl} onChange={(e) => setProductDraft({ ...productDraft, imageUrl: e.target.value })} />
          <button type="submit"><FiPlus /> Tambah</button>
        </form>
        <div className={styles.productList}>
          {products.map((product) => <article key={product.id}><strong>{product.name}</strong><span>{formatRupiah(product.price)}</span></article>)}
        </div>
      </section>

      <section id="api" className={styles.panel}>
        <h2>API Keys</h2>
        <button className={styles.primary} type="button" onClick={createApiKey}><FiKey /> Buat API Key</button>
        {apiKeys.map((key) => <p key={key.id} className={styles.keyRow}>{key.maskedKey} <small>{key.requestCount} request</small></p>)}
      </section>

      <section className={styles.panel}>
        <h2>Transaksi</h2>
        <button className={styles.secondary} type="button" onClick={load}><FiRefreshCw /> Refresh</button>
        {transactions.map((trx) => (
          <article key={trx.id} className={styles.transaction}>
            <span>{trx.id}</span>
            <strong>{formatRupiah(trx.totalAmount)}</strong>
            <em>{trx.status}</em>
          </article>
        ))}
      </section>
    </main>
  );
}
