"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { formatRupiah } from "@/data/products";
import { getFirebaseClientAuth } from "@/lib/firebase-client";
import type { StoreInformation, StoreProduct } from "@/types/store";
import styles from "./page.module.css";

type StatsPoint = {
  bucket: string;
  totalOrders: number;
  totalAmount: number;
};

type OrderLite = {
  id: string;
  userName: string;
  userEmail: string;
  total: number;
  status: string;
  createdAt: string;
};

const defaultProductForm = {
  name: "",
  category: "",
  shortDescription: "",
  description: "",
  price: 0,
  imageUrl: "/assets/background.jpg",
};

const defaultInfoForm = {
  type: "update" as "message" | "poll" | "update",
  title: "",
  body: "",
  imageUrl: "/assets/background.jpg",
  pollOptions: "",
};

export default function AdminPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<"checking" | "allowed" | "blocked">("checking");
  const [adminEmail, setAdminEmail] = useState("");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [informations, setInformations] = useState<StoreInformation[]>([]);
  const [series, setSeries] = useState<StatsPoint[]>([]);
  const [latestOrders, setLatestOrders] = useState<OrderLite[]>([]);
  const [productForm, setProductForm] = useState(defaultProductForm);
  const [infoForm, setInfoForm] = useState(defaultInfoForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const maxOrderCount = useMemo(
    () => Math.max(1, ...series.map((item) => item.totalOrders)),
    [series],
  );

  const loadProducts = async () => {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil produk");
    }
    const result = (await response.json()) as { products: StoreProduct[] };
    setProducts(result.products);
  };

  const loadInformations = async () => {
    const response = await fetch("/api/admin/informations", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil informasi");
    }
    const result = (await response.json()) as { informations: StoreInformation[] };
    setInformations(result.informations);
  };

  const loadStats = async () => {
    const response = await fetch("/api/admin/stats", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil stats");
    }
    const result = (await response.json()) as {
      series: StatsPoint[];
      latestOrders: OrderLite[];
    };
    setSeries(result.series);
    setLatestOrders(result.latestOrders);
  };

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          setAuthState("blocked");
          router.replace("/admin/login");
          return;
        }

        const payload = (await response.json()) as {
          authenticated: boolean;
          user?: { email?: string };
        };

        if (!payload.authenticated) {
          setAuthState("blocked");
          router.replace("/admin/login");
          return;
        }

        setAdminEmail(payload.user?.email ?? "");
        setAuthState("allowed");
        await Promise.allSettled([loadProducts(), loadInformations(), loadStats()]);
      })
      .catch(() => {
        setAuthState("blocked");
        router.replace("/admin/login");
      });
  }, [router]);

  useEffect(() => {
    if (authState !== "allowed") {
      return;
    }

    const timer = window.setInterval(() => {
      loadStats().catch(() => {});
    }, 5000);

    return () => window.clearInterval(timer);
  }, [authState]);

  const onLogoutAdmin = async () => {
    const auth = getFirebaseClientAuth();
    if (auth) {
      await firebaseSignOut(auth).catch(() => {});
    }
    await nextAuthSignOut({ redirect: false }).catch(() => {});
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
    router.replace("/admin/login");
  };

  const onCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal tambah produk.");
        return;
      }

      setMessage("Produk baru berhasil ditambahkan.");
      setProductForm(defaultProductForm);
      await loadProducts();
    } catch {
      setError("Gagal tambah produk.");
    } finally {
      setIsLoading(false);
    }
  };

  const onCreateInformation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/informations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...infoForm,
          pollOptions: infoForm.pollOptions
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal tambah informasi.");
        return;
      }

      setMessage("Informasi berhasil ditambahkan.");
      setInfoForm(defaultInfoForm);
      await loadInformations();
    } catch {
      setError("Gagal tambah informasi.");
    } finally {
      setIsLoading(false);
    }
  };

  const onDeleteAllProducts = async () => {
    if (!window.confirm("Yakin hapus semua produk?")) {
      return;
    }
    await fetch("/api/admin/products", { method: "DELETE" });
    await loadProducts();
  };

  const onDeleteProduct = async (id: string) => {
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    await loadProducts();
  };

  const onDeleteInformation = async (id: string) => {
    await fetch(`/api/admin/informations/${id}`, { method: "DELETE" });
    await loadInformations();
  };

  const onQuickEditProduct = async (product: StoreProduct) => {
    const nextName = window.prompt("Nama produk", product.name);
    if (!nextName) {
      return;
    }
    const nextPriceRaw = window.prompt("Harga", String(product.price));
    if (!nextPriceRaw) {
      return;
    }
    const nextPrice = Number(nextPriceRaw);
    if (!Number.isFinite(nextPrice)) {
      return;
    }

    await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextName,
        price: nextPrice,
      }),
    });
    await loadProducts();
  };

  const onQuickEditInformation = async (information: StoreInformation) => {
    const nextTitle = window.prompt("Judul informasi", information.title);
    if (!nextTitle) {
      return;
    }
    const nextBody = window.prompt("Isi informasi", information.body);
    if (!nextBody) {
      return;
    }

    await fetch(`/api/admin/informations/${information.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: nextTitle,
        body: nextBody,
      }),
    });
    await loadInformations();
  };

  if (authState === "checking") {
    return (
      <main className={styles.page}>
        <p>Memuat admin panel...</p>
      </main>
    );
  }

  if (authState !== "allowed") {
    return null;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Admin Dashboard</h1>
          <p>
            Kelola produk, informasi, order, dan statistik realtime.
            {adminEmail ? ` (${adminEmail})` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <a href="/api/admin/orders/export" className={styles.actionLink}>
            Export CSV
          </a>
          <button type="button" onClick={onLogoutAdmin} className={styles.actionLink}>
            Logout Admin
          </button>
          <Link href="/" className={styles.actionLink}>
            Ke Beranda
          </Link>
        </div>
      </header>

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {message ? <p className={styles.successText}>{message}</p> : null}

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Grafik Order Realtime</h2>
          <div className={styles.chart}>
            {series.length === 0 ? <p>Belum ada data order.</p> : null}
            {series.map((point) => (
              <div key={point.bucket} className={styles.barWrap}>
                <div
                  className={styles.bar}
                  style={{
                    height: `${Math.max(10, (point.totalOrders / maxOrderCount) * 100)}%`,
                  }}
                />
                <span>{point.totalOrders}</span>
              </div>
            ))}
          </div>
          <div className={styles.chartLabels}>
            {series.map((point) => (
              <span key={`label-${point.bucket}`}>{point.bucket.slice(11)}</span>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <h2>Order Terbaru</h2>
          <div className={styles.list}>
            {latestOrders.map((order) => (
              <div key={order.id} className={styles.listItem}>
                <p>{order.userName}</p>
                <span>
                  {formatRupiah(order.total)} - {new Date(order.createdAt).toLocaleString("id-ID")}
                </span>
              </div>
            ))}
            {latestOrders.length === 0 ? <p>Belum ada order.</p> : null}
          </div>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h2>CRUD Produk</h2>
            <button type="button" className={styles.deleteAll} onClick={onDeleteAllProducts}>
              Hapus Semua
            </button>
          </div>

          <form className={styles.form} onSubmit={onCreateProduct}>
            <input
              value={productForm.name}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Nama produk"
              required
            />
            <input
              value={productForm.category}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, category: event.target.value }))
              }
              placeholder="Kategori"
              required
            />
            <input
              value={productForm.shortDescription}
              onChange={(event) =>
                setProductForm((current) => ({
                  ...current,
                  shortDescription: event.target.value,
                }))
              }
              placeholder="Deskripsi pendek"
              required
            />
            <textarea
              value={productForm.description}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Deskripsi lengkap"
              required
            />
            <input
              type="number"
              value={productForm.price}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, price: Number(event.target.value) }))
              }
              placeholder="Harga"
              min={0}
              required
            />
            <input
              value={productForm.imageUrl}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
              placeholder="URL gambar (contoh /assets/background.jpg)"
              required
            />
            <button type="submit" disabled={isLoading}>
              Tambah Produk
            </button>
          </form>

          <div className={styles.list}>
            {products.map((product) => (
              <div key={product.id} className={styles.listItem}>
                <p>
                  {product.name} - {formatRupiah(product.price)}
                </p>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => onQuickEditProduct(product)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onDeleteProduct(product.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.card}>
          <h2>CRUD Informasi</h2>
          <form className={styles.form} onSubmit={onCreateInformation}>
            <select
              value={infoForm.type}
              onChange={(event) =>
                setInfoForm((current) => ({
                  ...current,
                  type: event.target.value as "message" | "poll" | "update",
                }))
              }
            >
              <option value="update">Update</option>
              <option value="message">Message</option>
              <option value="poll">Polling</option>
            </select>
            <input
              value={infoForm.title}
              onChange={(event) =>
                setInfoForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Judul informasi"
              required
            />
            <textarea
              value={infoForm.body}
              onChange={(event) =>
                setInfoForm((current) => ({ ...current, body: event.target.value }))
              }
              placeholder="Isi informasi"
              required
            />
            <input
              value={infoForm.imageUrl}
              onChange={(event) =>
                setInfoForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
              placeholder="URL gambar"
            />
            <input
              value={infoForm.pollOptions}
              onChange={(event) =>
                setInfoForm((current) => ({ ...current, pollOptions: event.target.value }))
              }
              placeholder="Opsi polling pisahkan koma"
            />
            <button type="submit" disabled={isLoading}>
              Tambah Informasi
            </button>
          </form>

          <div className={styles.list}>
            {informations.map((information) => (
              <div key={information.id} className={styles.listItem}>
                <p>
                  [{information.type}] {information.title}
                </p>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => onQuickEditInformation(information)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onDeleteInformation(information.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
