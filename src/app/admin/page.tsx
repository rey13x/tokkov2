"use client";

import { type ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { formatRupiah } from "@/data/products";
import { getFirebaseClientAuth } from "@/lib/firebase-client";
import type { StoreInformation, StoreProduct, StoreTestimonial } from "@/types/store";
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

type AdminSection = "overview" | "products" | "informations" | "testimonials" | "preview";

const sidebarItems: Array<{ id: AdminSection; label: string; desc: string }> = [
  { id: "overview", label: "Ringkasan", desc: "Statistik & order" },
  { id: "products", label: "Produk", desc: "CRUD produk" },
  { id: "informations", label: "Informasi", desc: "CRUD informasi" },
  { id: "testimonials", label: "Testimonial", desc: "CRUD testimonial" },
  { id: "preview", label: "Preview", desc: "Lihat hasil realtime" },
];

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

const defaultTestimonialForm = {
  name: "",
  country: "Indonesia" as "Indonesia" | "Inggris" | "Filipina",
  message: "",
  rating: 5,
  audioUrl: "/assets/bagas.mp3",
};

function formatRupiahInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

function parseRupiahInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return Number(digits || 0);
}

export default function AdminPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<"checking" | "allowed" | "blocked">("checking");
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [adminEmail, setAdminEmail] = useState("");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [informations, setInformations] = useState<StoreInformation[]>([]);
  const [testimonials, setTestimonials] = useState<StoreTestimonial[]>([]);
  const [series, setSeries] = useState<StatsPoint[]>([]);
  const [latestOrders, setLatestOrders] = useState<OrderLite[]>([]);
  const [productForm, setProductForm] = useState(defaultProductForm);
  const [priceInput, setPriceInput] = useState("");
  const [productEditId, setProductEditId] = useState<string | null>(null);
  const [infoForm, setInfoForm] = useState(defaultInfoForm);
  const [infoEditId, setInfoEditId] = useState<string | null>(null);
  const [testimonialForm, setTestimonialForm] = useState(defaultTestimonialForm);
  const [testimonialEditId, setTestimonialEditId] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);
  const [isUploadingInfoImage, setIsUploadingInfoImage] = useState(false);
  const [isUploadingTestimonialAudio, setIsUploadingTestimonialAudio] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const maxOrderCount = useMemo(
    () => Math.max(1, ...series.map((item) => item.totalOrders)),
    [series],
  );
  const totalRevenue = useMemo(
    () => latestOrders.reduce((sum, order) => sum + order.total, 0),
    [latestOrders],
  );

  const bumpPreview = () => {
    setPreviewVersion((current) => current + 1);
  };

  const resetProductForm = () => {
    setProductEditId(null);
    setProductForm(defaultProductForm);
    setPriceInput("");
  };

  const resetInfoForm = () => {
    setInfoEditId(null);
    setInfoForm(defaultInfoForm);
  };

  const resetTestimonialForm = () => {
    setTestimonialEditId(null);
    setTestimonialForm(defaultTestimonialForm);
  };

  const uploadMedia = async (file: File, folder: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { message?: string; url?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.message ?? "Upload gambar gagal.");
    }

    return payload.url;
  };

  const onSelectProductImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingProductImage(true);
    try {
      const uploaded = await uploadMedia(file, "products");
      setProductForm((current) => ({
        ...current,
        imageUrl: uploaded,
      }));
      setMessage("Gambar produk berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload gambar gagal.");
    } finally {
      setIsUploadingProductImage(false);
      event.target.value = "";
    }
  };

  const onSelectInfoImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingInfoImage(true);
    try {
      const uploaded = await uploadMedia(file, "informations");
      setInfoForm((current) => ({
        ...current,
        imageUrl: uploaded,
      }));
      setMessage("Gambar informasi berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload gambar gagal.");
    } finally {
      setIsUploadingInfoImage(false);
      event.target.value = "";
    }
  };

  const onSelectTestimonialAudio = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingTestimonialAudio(true);
    try {
      const uploaded = await uploadMedia(file, "testimonials-audio");
      setTestimonialForm((current) => ({
        ...current,
        audioUrl: uploaded,
      }));
      setMessage("Voice testimonial berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload voice gagal.");
    } finally {
      setIsUploadingTestimonialAudio(false);
      event.target.value = "";
    }
  };

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

  const loadTestimonials = async () => {
    const response = await fetch("/api/admin/testimonials", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil testimonial");
    }
    const result = (await response.json()) as { testimonials: StoreTestimonial[] };
    setTestimonials(result.testimonials);
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
        await Promise.allSettled([
          loadProducts(),
          loadInformations(),
          loadTestimonials(),
          loadStats(),
        ]);
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

  const onSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    const payload = {
      ...productForm,
      price: Number(productForm.price),
    };

    try {
      const endpoint = productEditId ? `/api/admin/products/${productEditId}` : "/api/admin/products";
      const method = productEditId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal simpan produk.");
        return;
      }

      setMessage(productEditId ? "Produk berhasil diperbarui." : "Produk baru berhasil ditambahkan.");
      resetProductForm();
      await loadProducts();
      bumpPreview();
    } catch {
      setError("Gagal simpan produk.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveInformation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    const payload = {
      ...infoForm,
      pollOptions: infoForm.pollOptions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      const endpoint = infoEditId ? `/api/admin/informations/${infoEditId}` : "/api/admin/informations";
      const method = infoEditId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal simpan informasi.");
        return;
      }

      setMessage(infoEditId ? "Informasi berhasil diperbarui." : "Informasi berhasil ditambahkan.");
      resetInfoForm();
      await loadInformations();
      bumpPreview();
    } catch {
      setError("Gagal simpan informasi.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveTestimonial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const endpoint = testimonialEditId
        ? `/api/admin/testimonials/${testimonialEditId}`
        : "/api/admin/testimonials";
      const method = testimonialEditId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testimonialForm),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal simpan testimonial.");
        return;
      }

      setMessage(testimonialEditId ? "Testimonial berhasil diperbarui." : "Testimonial berhasil ditambahkan.");
      resetTestimonialForm();
      await loadTestimonials();
      bumpPreview();
    } catch {
      setError("Gagal simpan testimonial.");
    } finally {
      setIsLoading(false);
    }
  };

  const onDeleteAllProducts = async () => {
    if (!window.confirm("Yakin hapus semua produk?")) {
      return;
    }
    await fetch("/api/admin/products", { method: "DELETE" });
    resetProductForm();
    await loadProducts();
    bumpPreview();
  };

  const onDeleteProduct = async (id: string) => {
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (productEditId === id) {
      resetProductForm();
    }
    await loadProducts();
    bumpPreview();
  };

  const onDeleteInformation = async (id: string) => {
    await fetch(`/api/admin/informations/${id}`, { method: "DELETE" });
    if (infoEditId === id) {
      resetInfoForm();
    }
    await loadInformations();
    bumpPreview();
  };

  const onDeleteTestimonial = async (id: string) => {
    await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
    if (testimonialEditId === id) {
      resetTestimonialForm();
    }
    await loadTestimonials();
    bumpPreview();
  };

  const onEditProduct = (product: StoreProduct) => {
    setActiveSection("products");
    setProductEditId(product.id);
    setProductForm({
      name: product.name,
      category: product.category,
      shortDescription: product.shortDescription,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl,
    });
    setPriceInput(formatRupiahInput(String(product.price)));
  };

  const onEditInformation = (information: StoreInformation) => {
    setActiveSection("informations");
    setInfoEditId(information.id);
    setInfoForm({
      type: information.type,
      title: information.title,
      body: information.body,
      imageUrl: information.imageUrl,
      pollOptions: information.pollOptions.join(", "),
    });
  };

  const onEditTestimonial = (testimonial: StoreTestimonial) => {
    setActiveSection("testimonials");
    setTestimonialEditId(testimonial.id);
    setTestimonialForm({
      name: testimonial.name,
      country: (testimonial.country || "Indonesia") as "Indonesia" | "Inggris" | "Filipina",
      message: testimonial.message,
      rating: testimonial.rating,
      audioUrl: testimonial.audioUrl,
    });
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
            Kelola semua konten dengan panel rapi dan preview realtime.
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

      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <p className={styles.sidebarTitle}>Navigasi Admin</p>
            <nav className={styles.sidebarNav}>
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.sidebarButton} ${activeSection === item.id ? styles.sidebarButtonActive : ""}`}
                  onClick={() => setActiveSection(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <section className={styles.content}>
      {activeSection === "overview" ? (
      <section className={styles.sectionGrid}>
        <article className={styles.card}>
          <h2>Ringkasan Cepat</h2>
          <div className={styles.quickStats}>
            <div>
              <strong>{products.length}</strong>
              <span>Total Produk</span>
            </div>
            <div>
              <strong>{informations.length}</strong>
              <span>Informasi Aktif</span>
            </div>
            <div>
              <strong>{testimonials.length}</strong>
              <span>Testimonial</span>
            </div>
            <div>
              <strong>{latestOrders.length}</strong>
              <span>Order Terkini</span>
            </div>
            <div>
              <strong>{formatRupiah(totalRevenue)}</strong>
              <span>Omzet (terbaru)</span>
            </div>
          </div>
        </article>

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
      ) : null}

      {activeSection !== "overview" ? (
      <section className={styles.sectionGrid}>
        {activeSection === "products" ? (
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h2>{productEditId ? "Edit Produk" : "CRUD Produk"}</h2>
            <button type="button" className={styles.deleteAll} onClick={onDeleteAllProducts}>
              Hapus Semua
            </button>
          </div>

          <form className={styles.form} onSubmit={onSaveProduct}>
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
              type="text"
              value={priceInput}
              onChange={(event) => {
                const formatted = formatRupiahInput(event.target.value);
                setPriceInput(formatted);
                setProductForm((current) => ({
                  ...current,
                  price: parseRupiahInput(formatted),
                }));
              }}
              placeholder="Harga (Rp)"
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
            <label className={styles.fileField}>
              Upload Foto Produk
              <input type="file" accept="image/*" onChange={onSelectProductImage} />
              <small>{isUploadingProductImage ? "Uploading..." : "Pilih gambar dari device"}</small>
            </label>
            <div className={styles.previewCard}>
              <Image
                src={productForm.imageUrl || "/assets/background.jpg"}
                alt="Preview produk"
                width={72}
                height={72}
                className={styles.previewImage}
                unoptimized
              />
              <div>
                <p>{productForm.name || "Preview nama produk"}</p>
                <span>{formatRupiah(Number(productForm.price || 0))}</span>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" disabled={isLoading}>
                {productEditId ? "Simpan Perubahan" : "Tambah Produk"}
              </button>
              {productEditId ? (
                <button type="button" className={styles.secondaryButton} onClick={resetProductForm}>
                  Batal Edit
                </button>
              ) : null}
            </div>
          </form>

          <div className={styles.list}>
            {products.map((product) => (
              <div key={product.id} className={styles.listItem}>
                <div className={styles.listPreview}>
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={56}
                    height={56}
                    className={styles.listThumb}
                    unoptimized
                  />
                  <div>
                    <p>
                      {product.name} - {formatRupiah(product.price)}
                    </p>
                    <span>{product.category}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => onEditProduct(product)}>
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
        ) : null}

        {activeSection === "informations" ? (
        <article className={styles.card}>
          <h2>{infoEditId ? "Edit Informasi" : "CRUD Informasi"}</h2>
          <form className={styles.form} onSubmit={onSaveInformation}>
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
            <label className={styles.fileField}>
              Upload Foto Informasi
              <input type="file" accept="image/*" onChange={onSelectInfoImage} />
              <small>{isUploadingInfoImage ? "Uploading..." : "Pilih gambar dari device"}</small>
            </label>
            <input
              value={infoForm.pollOptions}
              onChange={(event) =>
                setInfoForm((current) => ({ ...current, pollOptions: event.target.value }))
              }
              placeholder="Opsi polling pisahkan koma"
            />
            <div className={styles.previewCard}>
              <Image
                src={infoForm.imageUrl || "/assets/background.jpg"}
                alt="Preview informasi"
                width={72}
                height={72}
                className={styles.previewImage}
                unoptimized
              />
              <div>
                <p>{infoForm.title || "Preview judul informasi"}</p>
                <span>{infoForm.type.toUpperCase()}</span>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" disabled={isLoading}>
                {infoEditId ? "Simpan Perubahan" : "Tambah Informasi"}
              </button>
              {infoEditId ? (
                <button type="button" className={styles.secondaryButton} onClick={resetInfoForm}>
                  Batal Edit
                </button>
              ) : null}
            </div>
          </form>

          <div className={styles.list}>
            {informations.map((information) => (
              <div key={information.id} className={styles.listItem}>
                <div className={styles.listPreview}>
                  <Image
                    src={information.imageUrl || "/assets/background.jpg"}
                    alt={information.title}
                    width={56}
                    height={56}
                    className={styles.listThumb}
                    unoptimized
                  />
                  <div>
                    <p>
                      [{information.type}] {information.title}
                    </p>
                    <span>{new Date(information.createdAt).toLocaleDateString("id-ID")}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => onEditInformation(information)}>
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
        ) : null}

        {activeSection === "testimonials" ? (
        <article className={styles.card}>
          <h2>{testimonialEditId ? "Edit Testimonial" : "CRUD Testimonial + Voice"}</h2>
          <form className={styles.form} onSubmit={onSaveTestimonial}>
            <input
              value={testimonialForm.name}
              onChange={(event) =>
                setTestimonialForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Nama pemberi testimoni"
              required
            />
            <textarea
              value={testimonialForm.message}
              onChange={(event) =>
                setTestimonialForm((current) => ({ ...current, message: event.target.value }))
              }
              placeholder="Isi testimoni"
              required
            />
            <select
              value={testimonialForm.country}
              onChange={(event) =>
                setTestimonialForm((current) => ({
                  ...current,
                  country: event.target.value as "Indonesia" | "Inggris" | "Filipina",
                }))
              }
            >
              <option value="Indonesia">Indonesia</option>
              <option value="Inggris">Inggris</option>
              <option value="Filipina">Filipina</option>
            </select>
            <select
              value={testimonialForm.rating}
              onChange={(event) =>
                setTestimonialForm((current) => ({
                  ...current,
                  rating: Number(event.target.value),
                }))
              }
            >
              <option value={5}>Bintang 5</option>
              <option value={4}>Bintang 4</option>
              <option value={3}>Bintang 3</option>
              <option value={2}>Bintang 2</option>
              <option value={1}>Bintang 1</option>
            </select>
            <input
              value={testimonialForm.audioUrl}
              onChange={(event) =>
                setTestimonialForm((current) => ({
                  ...current,
                  audioUrl: event.target.value,
                }))
              }
              placeholder="URL voice"
              required
            />
            <label className={styles.fileField}>
              Upload Voice Testimoni
              <input type="file" accept="audio/*" onChange={onSelectTestimonialAudio} />
              <small>
                {isUploadingTestimonialAudio ? "Uploading..." : "Pilih file suara (mp3/wav)"}
              </small>
            </label>
            <audio controls src={testimonialForm.audioUrl} className={styles.audioPreview} />
            <div className={styles.formActions}>
              <button type="submit" disabled={isLoading}>
                {testimonialEditId ? "Simpan Perubahan" : "Tambah Testimoni"}
              </button>
              {testimonialEditId ? (
                <button type="button" className={styles.secondaryButton} onClick={resetTestimonialForm}>
                  Batal Edit
                </button>
              ) : null}
            </div>
          </form>

          <div className={styles.list}>
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className={styles.listItem}>
                <div className={styles.listPreview}>
                  <div>
                    <p>
                      {"\u2605".repeat(Math.max(1, Math.min(5, testimonial.rating)))} {testimonial.name}
                    </p>
                    <span>{testimonial.country}</span>
                    <span>{testimonial.message}</span>
                    <audio controls src={testimonial.audioUrl} className={styles.audioPreview} />
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => onEditTestimonial(testimonial)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onDeleteTestimonial(testimonial.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
        ) : null}

        {activeSection === "preview" ? (
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Preview Realtime</h2>
            <div className={styles.rowActions}>
              <button type="button" onClick={bumpPreview}>
                Refresh Preview
              </button>
              <a href="/" target="_blank" rel="noreferrer" className={styles.inlineLink}>
                Buka Tab Baru
              </a>
            </div>
          </div>
          <p className={styles.previewHint}>
            Setiap create/update/delete akan otomatis refresh preview ini.
          </p>
          <div className={styles.previewViewport}>
            <iframe
              key={previewVersion}
              src={`/?adminPreview=${previewVersion}`}
              title="Preview Beranda Tokko"
              className={styles.previewFrame}
            />
          </div>
        </article>
        ) : null}
      </section>
      ) : null}
      </section>
      </div>
    </main>
  );
}
