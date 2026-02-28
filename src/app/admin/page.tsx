"use client";

import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { signOut as nextAuthSignOut } from "next-auth/react";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { formatRupiah } from "@/data/products";
import { getFirebaseClientAuth } from "@/lib/firebase-client";
import type {
  OrderSummary,
  StoreInformation,
  StoreMarqueeItem,
  StorePaymentSettings,
  StorePrivacyPolicyPage,
  StoreProduct,
  StoreTestimonial,
} from "@/types/store";
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

type AdminSection =
  | "overview"
  | "orders"
  | "products"
  | "informations"
  | "testimonials"
  | "marquees"
  | "paymentSettings"
  | "privacyPolicy"
  | "preview";

const sidebarItems: Array<{ id: AdminSection; label: string; desc: string }> = [
  { id: "overview", label: "Ringkasan", desc: "Statistik & order" },
  { id: "orders", label: "Order", desc: "Status pesanan user" },
  { id: "products", label: "Produk", desc: "CRUD produk" },
  { id: "informations", label: "Informasi", desc: "CRUD informasi" },
  { id: "testimonials", label: "Testimonial", desc: "CRUD testimonial" },
  { id: "marquees", label: "Marquee", desc: "CRUD logo marquee" },
  { id: "paymentSettings", label: "Pembayaran", desc: "Atur QRIS" },
  {
    id: "privacyPolicy",
    label: "Kebijakan Privasi",
    desc: "Atur konten halaman privasi",
  },
  { id: "preview", label: "Preview", desc: "Lihat hasil realtime" },
];

const defaultProductForm = {
  name: "",
  category: "",
  shortDescription: "",
  description: "",
  duration: "",
  price: 0,
  imageUrl: "/assets/logo.png",
};

const defaultInfoForm = {
  type: "update" as "message" | "poll" | "update",
  title: "",
  body: "",
  imageUrl: "/assets/logo.png",
  pollOptions: ["", ""],
};

const defaultTestimonialForm = {
  name: "",
  country: "Indonesia",
  roleLabel: "Founder Tokko",
  message: "",
  rating: 5,
  mediaUrl: "/assets/logo.png",
  audioUrl: "/assets/notif.mp3",
};

const defaultMarqueeForm = {
  label: "",
  imageUrl: "/assets/logo.png",
  isActive: true,
  sortOrder: 1,
};

const defaultPrivacyPolicyForm = {
  title: "Kebijakan Privasi & Sertifikasi Layanan",
  updatedLabel: "Terakhir diperbarui: 28 Februari 2026",
  bannerImageUrl: "/assets/background.jpg",
  contentHtml: "<p>Tulis isi kebijakan privasi di sini.</p>",
};

const defaultPaymentSettingsForm: Omit<StorePaymentSettings, "id" | "updatedAt"> = {
  title: "Qriss",
  qrisImageUrl: "/assets/logo.png",
  instructionText:
    "Scan Qriss diatas ini untuk proses produk kamu. Pastikan benar-benar sudah membayar",
  expiryMinutes: 30,
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
  const isFileUploadEnabled = true;

  const [authState, setAuthState] = useState<"checking" | "allowed" | "blocked">("checking");
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [informations, setInformations] = useState<StoreInformation[]>([]);
  const [testimonials, setTestimonials] = useState<StoreTestimonial[]>([]);
  const [marquees, setMarquees] = useState<StoreMarqueeItem[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [orderStatusDrafts, setOrderStatusDrafts] = useState<Record<string, "process" | "done" | "error">>({});
  const [series, setSeries] = useState<StatsPoint[]>([]);
  const [latestOrders, setLatestOrders] = useState<OrderLite[]>([]);
  const [productForm, setProductForm] = useState(defaultProductForm);
  const [priceInput, setPriceInput] = useState("");
  const [productEditId, setProductEditId] = useState<string | null>(null);
  const [infoForm, setInfoForm] = useState(defaultInfoForm);
  const [infoEditId, setInfoEditId] = useState<string | null>(null);
  const [testimonialForm, setTestimonialForm] = useState(defaultTestimonialForm);
  const [testimonialEditId, setTestimonialEditId] = useState<string | null>(null);
  const [marqueeForm, setMarqueeForm] = useState(defaultMarqueeForm);
  const [marqueeEditId, setMarqueeEditId] = useState<string | null>(null);
  const [privacyPolicyForm, setPrivacyPolicyForm] = useState(defaultPrivacyPolicyForm);
  const [paymentSettingsForm, setPaymentSettingsForm] = useState(defaultPaymentSettingsForm);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);
  const [isUploadingInfoImage, setIsUploadingInfoImage] = useState(false);
  const [isUploadingTestimonialMedia, setIsUploadingTestimonialMedia] = useState(false);
  const [isUploadingTestimonialAudio, setIsUploadingTestimonialAudio] = useState(false);
  const [isUploadingMarqueeImage, setIsUploadingMarqueeImage] = useState(false);
  const [isUploadingPrivacyBanner, setIsUploadingPrivacyBanner] = useState(false);
  const [isUploadingPaymentQris, setIsUploadingPaymentQris] = useState(false);
  const [activePollVoteId, setActivePollVoteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const privacyEditorRef = useRef<HTMLDivElement | null>(null);

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

  const resetMarqueeForm = () => {
    setMarqueeEditId(null);
    setMarqueeForm(defaultMarqueeForm);
  };

  useEffect(() => {
    if (!privacyEditorRef.current) {
      return;
    }
    if (privacyEditorRef.current.innerHTML === privacyPolicyForm.contentHtml) {
      return;
    }
    privacyEditorRef.current.innerHTML = privacyPolicyForm.contentHtml;
  }, [privacyPolicyForm.contentHtml]);

  const applyPrivacyEditorCommand = (command: string, value?: string) => {
    if (!privacyEditorRef.current) {
      return;
    }
    privacyEditorRef.current.focus();
    document.execCommand(command, false, value);
    setPrivacyPolicyForm((current) => ({
      ...current,
      contentHtml: privacyEditorRef.current?.innerHTML || current.contentHtml,
    }));
  };

  const onPrivacyEditorInput = () => {
    if (!privacyEditorRef.current) {
      return;
    }
    const nextHtml = privacyEditorRef.current.innerHTML;
    setPrivacyPolicyForm((current) => ({
      ...current,
      contentHtml: nextHtml,
    }));
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
      throw new Error(payload.message ?? "Upload media gagal.");
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
      setMessage("Media produk berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload media gagal.");
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
      setMessage("Media informasi berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload media gagal.");
    } finally {
      setIsUploadingInfoImage(false);
      event.target.value = "";
    }
  };

  const onSelectTestimonialMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingTestimonialMedia(true);
    try {
      const uploaded = await uploadMedia(file, "testimonials-media");
      setTestimonialForm((current) => ({
        ...current,
        mediaUrl: uploaded,
      }));
      setMessage("Media testimonial berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload media gagal.");
    } finally {
      setIsUploadingTestimonialMedia(false);
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

  const onSelectMarqueeImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingMarqueeImage(true);
    try {
      const uploaded = await uploadMedia(file, "marquees");
      setMarqueeForm((current) => ({
        ...current,
        imageUrl: uploaded,
      }));
      setMessage("Logo marquee berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload logo marquee gagal.");
    } finally {
      setIsUploadingMarqueeImage(false);
      event.target.value = "";
    }
  };

  const onSelectPrivacyBanner = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingPrivacyBanner(true);
    try {
      const uploaded = await uploadMedia(file, "privacy-policy");
      setPrivacyPolicyForm((current) => ({
        ...current,
        bannerImageUrl: uploaded,
      }));
      setMessage("Banner kebijakan privasi berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload banner gagal.");
    } finally {
      setIsUploadingPrivacyBanner(false);
      event.target.value = "";
    }
  };

  const onSelectPaymentQris = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingPaymentQris(true);
    try {
      const uploaded = await uploadMedia(file, "payment-settings");
      setPaymentSettingsForm((current) => ({
        ...current,
        qrisImageUrl: uploaded,
      }));
      setMessage("Gambar QRIS berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload QRIS gagal.");
    } finally {
      setIsUploadingPaymentQris(false);
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

  const loadMarquees = async () => {
    const response = await fetch("/api/admin/marquees", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil marquee");
    }
    const result = (await response.json()) as { marquees: StoreMarqueeItem[] };
    setMarquees(result.marquees);
  };

  const loadPrivacyPolicy = async () => {
    const response = await fetch("/api/admin/privacy-policy", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil kebijakan privasi");
    }
    const result = (await response.json()) as { privacyPolicy: StorePrivacyPolicyPage };
    setPrivacyPolicyForm({
      title: result.privacyPolicy.title,
      updatedLabel: result.privacyPolicy.updatedLabel,
      bannerImageUrl: result.privacyPolicy.bannerImageUrl,
      contentHtml: result.privacyPolicy.contentHtml,
    });
  };

  const loadPaymentSettings = async () => {
    const response = await fetch("/api/admin/payment-settings", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil pengaturan pembayaran");
    }
    const result = (await response.json()) as { paymentSettings: StorePaymentSettings };
    setPaymentSettingsForm({
      title: result.paymentSettings.title,
      qrisImageUrl: result.paymentSettings.qrisImageUrl,
      instructionText: result.paymentSettings.instructionText,
      expiryMinutes: result.paymentSettings.expiryMinutes,
    });
  };

  const loadOrders = async () => {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil order");
    }
    const result = (await response.json()) as { orders: OrderSummary[] };
    setOrders(result.orders);
    setOrderStatusDrafts((current) => {
      const next = { ...current };
      for (const order of result.orders) {
        if (!next[order.id]) {
          const normalized =
            order.status === "done" || order.status === "error" ? order.status : "process";
          next[order.id] = normalized;
        }
      }
      return next;
    });
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

        setAuthState("allowed");
        await Promise.allSettled([
          loadProducts(),
          loadInformations(),
          loadTestimonials(),
          loadMarquees(),
          loadPrivacyPolicy(),
          loadPaymentSettings(),
          loadOrders(),
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
      pollOptions:
        infoForm.type === "poll"
          ? infoForm.pollOptions.map((item) => item.trim()).filter(Boolean)
          : [],
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

  const onSaveMarquee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const endpoint = marqueeEditId ? `/api/admin/marquees/${marqueeEditId}` : "/api/admin/marquees";
      const method = marqueeEditId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marqueeForm),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal simpan logo marquee.");
        return;
      }

      setMessage(marqueeEditId ? "Logo marquee berhasil diperbarui." : "Logo marquee berhasil ditambahkan.");
      resetMarqueeForm();
      await loadMarquees();
      bumpPreview();
    } catch {
      setError("Gagal simpan logo marquee.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSavePrivacyPolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/privacy-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(privacyPolicyForm),
      });
      const result = (await response.json()) as {
        message?: string;
        privacyPolicy?: StorePrivacyPolicyPage;
      };
      if (!response.ok) {
        setError(result.message ?? "Gagal simpan kebijakan privasi.");
        return;
      }

      if (result.privacyPolicy) {
        setPrivacyPolicyForm({
          title: result.privacyPolicy.title,
          updatedLabel: result.privacyPolicy.updatedLabel,
          bannerImageUrl: result.privacyPolicy.bannerImageUrl,
          contentHtml: result.privacyPolicy.contentHtml,
        });
      }
      setMessage("Kebijakan privasi berhasil diperbarui.");
      bumpPreview();
    } catch {
      setError("Gagal simpan kebijakan privasi.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSavePaymentSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentSettingsForm),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal simpan pengaturan pembayaran.");
        return;
      }
      setMessage("Pengaturan pembayaran berhasil disimpan.");
      await loadPaymentSettings();
      bumpPreview();
    } catch {
      setError("Gagal simpan pengaturan pembayaran.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveOrderStatus = async (orderId: string) => {
    const statusDraft = orderStatusDrafts[orderId] ?? "process";
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusDraft }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal update status order.");
        return;
      }

      setMessage("Status order berhasil diperbarui.");
      await loadOrders();
      await loadStats();
    } catch {
      setError("Gagal update status order.");
    }
  };

  const onDeleteOrder = async (orderId: string) => {
    if (!window.confirm("Yakin hapus order ini?")) {
      return;
    }
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal menghapus order.");
        return;
      }

      setOrderStatusDrafts((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setMessage("Order berhasil dihapus.");
      await loadOrders();
      await loadStats();
    } catch {
      setError("Gagal menghapus order.");
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

  const onDeleteMarquee = async (id: string) => {
    await fetch(`/api/admin/marquees/${id}`, { method: "DELETE" });
    if (marqueeEditId === id) {
      resetMarqueeForm();
    }
    await loadMarquees();
    bumpPreview();
  };

  const onVoteInformation = async (informationId: string, option: string) => {
    setActivePollVoteId(informationId);
    try {
      const response = await fetch(`/api/informations/${informationId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ option }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Gagal vote polling.");
        return;
      }

      await loadInformations();
      bumpPreview();
    } catch {
      setError("Gagal vote polling.");
    } finally {
      setActivePollVoteId(null);
    }
  };

  const updateInfoPollOption = (index: number, value: string) => {
    setInfoForm((current) => {
      const next = [...current.pollOptions];
      next[index] = value;
      return {
        ...current,
        pollOptions: next,
      };
    });
  };

  const addInfoPollOption = () => {
    setInfoForm((current) => ({
      ...current,
      pollOptions: [...current.pollOptions, ""],
    }));
  };

  const removeInfoPollOption = (index: number) => {
    setInfoForm((current) => {
      const next = current.pollOptions.filter((_, optionIndex) => optionIndex !== index);
      return {
        ...current,
        pollOptions: next.length > 0 ? next : [""],
      };
    });
  };

  const onEditProduct = (product: StoreProduct) => {
    setActiveSection("products");
    setProductEditId(product.id);
    setProductForm({
      name: product.name,
      category: product.category,
      shortDescription: product.shortDescription,
      description: product.description,
      duration: product.duration ?? "",
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
      pollOptions: information.pollOptions.length > 0 ? information.pollOptions : ["", ""],
    });
  };

  const onEditTestimonial = (testimonial: StoreTestimonial) => {
    setActiveSection("testimonials");
    setTestimonialEditId(testimonial.id);
    setTestimonialForm({
      name: testimonial.name,
      country: testimonial.country || "Indonesia",
      roleLabel: testimonial.roleLabel || "Founder Tokko",
      message: testimonial.message,
      rating: testimonial.rating,
      mediaUrl: testimonial.mediaUrl || "/assets/logo.png",
      audioUrl: testimonial.audioUrl,
    });
  };

  const onEditMarquee = (marquee: StoreMarqueeItem) => {
    setActiveSection("marquees");
    setMarqueeEditId(marquee.id);
    setMarqueeForm({
      label: marquee.label,
      imageUrl: marquee.imageUrl || "/assets/logo.png",
      isActive: marquee.isActive,
      sortOrder: marquee.sortOrder,
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
          <p>Halo Admin, konsisten untuk produknya yaa. Hubungi melalui Whatsapp jika ada trouble</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/api/admin/orders/export?format=csv" className={styles.actionLink}>
            Export CSV
          </Link>
          <Link href="/api/admin/orders/export?format=xlsx" className={styles.actionLink}>
            Export XLSX
          </Link>
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
      {!isFileUploadEnabled ? (
        <p className={styles.warnText}>
          Upload file dimatikan. Isi media menggunakan URL manual.
        </p>
      ) : null}

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
              <strong>{marquees.length}</strong>
              <span>Logo Marquee</span>
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
        {activeSection === "orders" ? (
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h2>Kelola Status Pesanan</h2>
            <button type="button" className={styles.secondaryButton} onClick={() => loadOrders()}>
              Refresh
            </button>
          </div>
          <div className={styles.list}>
            {orders.map((order) => (
              <div key={order.id} className={styles.listItem}>
                <div className={styles.listPreview}>
                  <div>
                    <p>{order.userName} - {order.id.slice(0, 8).toUpperCase()}</p>
                    <span>
                      {formatRupiah(order.total)} - {new Date(order.createdAt).toLocaleString("id-ID")}
                    </span>
                    <span>Status: {order.status}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <select
                    value={orderStatusDrafts[order.id] ?? "process"}
                    onChange={(event) =>
                      setOrderStatusDrafts((current) => ({
                        ...current,
                        [order.id]: event.target.value as "process" | "done" | "error",
                      }))
                    }
                  >
                    <option value="process">Proses</option>
                    <option value="done">Habis</option>
                    <option value="error">Error</option>
                  </select>
                  <button type="button" onClick={() => onSaveOrderStatus(order.id)}>
                    Simpan
                  </button>
                  <a
                    href={`/api/orders/${order.id}/receipt`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.inlineLink}
                  >
                    Struk
                  </a>
                  <button type="button" onClick={() => onDeleteOrder(order.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
            {orders.length === 0 ? <p>Belum ada order.</p> : null}
          </div>
        </article>
        ) : null}

        {activeSection === "paymentSettings" ? (
        <article className={styles.card}>
          <h2>Pengaturan Pembayaran QRIS</h2>
          <form className={styles.form} onSubmit={onSavePaymentSettings}>
            <input
              value={paymentSettingsForm.title}
              onChange={(event) =>
                setPaymentSettingsForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Judul pembayaran"
              required
            />
            <input
              value={paymentSettingsForm.qrisImageUrl}
              readOnly
              placeholder="URL gambar QRIS otomatis"
              required
            />
            <label className={styles.fileField}>
              Upload Gambar QRIS
              <input type="file" accept="image/*" onChange={onSelectPaymentQris} />
              <small>{isUploadingPaymentQris ? "Uploading..." : "Pilih gambar QRIS dari device"}</small>
            </label>
            <textarea
              value={paymentSettingsForm.instructionText}
              onChange={(event) =>
                setPaymentSettingsForm((current) => ({
                  ...current,
                  instructionText: event.target.value,
                }))
              }
              placeholder="Teks instruksi pembayaran"
              required
            />
            <input
              type="number"
              min={5}
              max={180}
              value={paymentSettingsForm.expiryMinutes}
              onChange={(event) =>
                setPaymentSettingsForm((current) => ({
                  ...current,
                  expiryMinutes: Number(event.target.value || 30),
                }))
              }
              placeholder="Durasi batas pembayaran (menit)"
              required
            />
            <div className={styles.previewCard}>
              <FlexibleMedia
                src={paymentSettingsForm.qrisImageUrl}
                alt={paymentSettingsForm.title}
                width={72}
                height={72}
                className={styles.previewImage}
                unoptimized
              />
              <div>
                <p>{paymentSettingsForm.title}</p>
                <span>{paymentSettingsForm.expiryMinutes} menit</span>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" disabled={isLoading}>
                Simpan Pengaturan Pembayaran
              </button>
            </div>
          </form>
        </article>
        ) : null}

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
              value={productForm.duration}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, duration: event.target.value }))
              }
              placeholder="Durasi (contoh: 1 Bulan / 30 Hari / Lifetime)"
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
            <input value={productForm.imageUrl} readOnly placeholder="URL media produk otomatis" />
            {isFileUploadEnabled ? (
              <label className={styles.fileField}>
                Upload Media Produk (Foto/Video)
                <input type="file" accept="image/*,video/*" onChange={onSelectProductImage} />
                <small>{isUploadingProductImage ? "Uploading..." : "Pilih file media dari device"}</small>
              </label>
            ) : null}
            <div className={styles.previewCard}>
              <FlexibleMedia
                src={productForm.imageUrl}
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
                  <FlexibleMedia
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
                    <span>
                      {product.category}
                      {product.duration ? ` - ${product.duration}` : ""}
                    </span>
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
              onChange={(event) => {
                const nextType = event.target.value as "message" | "poll" | "update";
                setInfoForm((current) => ({
                  ...current,
                  type: nextType,
                  pollOptions:
                    nextType === "poll"
                      ? current.pollOptions.length > 0
                        ? current.pollOptions
                        : ["", ""]
                      : current.pollOptions,
                }));
              }}
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
            <input value={infoForm.imageUrl} readOnly placeholder="URL media informasi otomatis" />
            {isFileUploadEnabled ? (
              <label className={styles.fileField}>
                Upload Media Informasi (Foto/Video)
                <input type="file" accept="image/*,video/*" onChange={onSelectInfoImage} />
                <small>{isUploadingInfoImage ? "Uploading..." : "Pilih file media dari device"}</small>
              </label>
            ) : null}
            {infoForm.type === "poll" ? (
              <div className={styles.pollBuilder}>
                <p>Opsi Polling</p>
                {infoForm.pollOptions.map((option, index) => (
                  <div key={`poll-option-${index}`} className={styles.pollBuilderRow}>
                    <input
                      value={option}
                      onChange={(event) => updateInfoPollOption(index, event.target.value)}
                      placeholder={`Isi opsi ${index + 1}`}
                    />
                    <button
                      type="button"
                      className={styles.pollBuilderRemove}
                      onClick={() => removeInfoPollOption(index)}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                <div className={styles.pollBuilderActions}>
                  <button
                    type="button"
                    className={styles.pollBuilderAdd}
                    onClick={addInfoPollOption}
                  >
                    + Tambah Opsi
                  </button>
                </div>
                <select className={styles.pollBuilderPreview} disabled>
                  <option>Pilih opsi polling</option>
                  {infoForm.pollOptions
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item, index) => (
                      <option key={`preview-${index}-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
            <div className={styles.previewCard}>
              <FlexibleMedia
                src={infoForm.imageUrl}
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
                  <FlexibleMedia
                    src={information.imageUrl}
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
                    {information.type === "poll" && information.pollOptions.length > 0 ? (
                      <div className={styles.pollSummary}>
                        <strong>
                          Total:{" "}
                          {information.pollOptions.reduce(
                            (sum, option) => sum + (information.pollVotes[option] ?? 0),
                            0,
                          )}{" "}
                          suara
                        </strong>
                        <div className={styles.pollSummaryButtons}>
                          {information.pollOptions.map((option) => (
                            <button
                              key={`${information.id}-${option}-vote`}
                              type="button"
                              onClick={() => onVoteInformation(information.id, option)}
                              disabled={activePollVoteId === information.id}
                            >
                              Vote {option}
                            </button>
                          ))}
                        </div>
                        {information.pollOptions.map((option) => (
                          <span key={`${information.id}-${option}`}>
                            {option}: {information.pollVotes[option] ?? 0}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
            <input
              value={testimonialForm.country}
              onChange={(event) =>
                setTestimonialForm((current) => ({
                  ...current,
                  country: event.target.value,
                }))
              }
              placeholder="Country (bebas isi)"
              required
            />
            <input
              value={testimonialForm.roleLabel}
              onChange={(event) =>
                setTestimonialForm((current) => ({
                  ...current,
                  roleLabel: event.target.value,
                }))
              }
              placeholder="Label gelembung (contoh: Founder Tokko)"
            />
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
            <input value={testimonialForm.mediaUrl} readOnly placeholder="URL media testimoni otomatis" />
            {isFileUploadEnabled ? (
              <label className={styles.fileField}>
                Upload Media Testimoni (Foto/Video)
                <input type="file" accept="image/*,video/*" onChange={onSelectTestimonialMedia} />
                <small>
                  {isUploadingTestimonialMedia ? "Uploading..." : "Pilih file media dari device"}
                </small>
              </label>
            ) : null}
            <div className={styles.previewCard}>
              <FlexibleMedia
                src={testimonialForm.mediaUrl}
                alt={testimonialForm.name || "Preview testimonial"}
                width={72}
                height={72}
                className={styles.previewImage}
                unoptimized
              />
              <div>
                <p>{testimonialForm.name || "Preview nama testimonial"}</p>
                <span>{testimonialForm.roleLabel || testimonialForm.country}</span>
              </div>
            </div>
            <input value={testimonialForm.audioUrl} readOnly placeholder="URL voice otomatis" />
            {isFileUploadEnabled ? (
              <label className={styles.fileField}>
                Upload Voice Testimoni
                <input type="file" accept="audio/*" onChange={onSelectTestimonialAudio} />
                <small>
                  {isUploadingTestimonialAudio ? "Uploading..." : "Pilih file suara (mp3/wav)"}
                </small>
              </label>
            ) : null}
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
                    <span>{testimonial.roleLabel || "-"}</span>
                    <span>{testimonial.message}</span>
                    <FlexibleMedia
                      src={testimonial.mediaUrl}
                      alt={testimonial.name}
                      width={56}
                      height={56}
                      className={styles.listThumb}
                      unoptimized
                    />
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

        {activeSection === "marquees" ? (
        <article className={styles.card}>
          <h2>{marqueeEditId ? "Edit Logo Marquee" : "CRUD Logo Marquee"}</h2>
          <form className={styles.form} onSubmit={onSaveMarquee}>
            <input
              value={marqueeForm.label}
              onChange={(event) =>
                setMarqueeForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="Label logo"
              required
            />
            <input
              type="number"
              min={0}
              value={marqueeForm.sortOrder}
              onChange={(event) =>
                setMarqueeForm((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value || 0),
                }))
              }
              placeholder="Urutan tampil"
            />
            <input value={marqueeForm.imageUrl} readOnly placeholder="URL logo marquee otomatis" />
            {isFileUploadEnabled ? (
              <label className={styles.fileField}>
                Upload Logo Marquee
                <input type="file" accept="image/*,video/*" onChange={onSelectMarqueeImage} />
                <small>
                  {isUploadingMarqueeImage ? "Uploading..." : "Pilih logo dari device"}
                </small>
              </label>
            ) : null}
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={marqueeForm.isActive}
                onChange={(event) =>
                  setMarqueeForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              Aktif ditampilkan di beranda
            </label>
            <div className={styles.previewCard}>
              <FlexibleMedia
                src={marqueeForm.imageUrl}
                alt={marqueeForm.label || "Preview logo marquee"}
                width={72}
                height={72}
                className={styles.previewImage}
                unoptimized
              />
              <div>
                <p>{marqueeForm.label || "Preview label marquee"}</p>
                <span>Urutan: {marqueeForm.sortOrder}</span>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" disabled={isLoading}>
                {marqueeEditId ? "Simpan Perubahan" : "Tambah Logo"}
              </button>
              {marqueeEditId ? (
                <button type="button" className={styles.secondaryButton} onClick={resetMarqueeForm}>
                  Batal Edit
                </button>
              ) : null}
            </div>
          </form>

          <div className={styles.list}>
            {marquees.map((marquee) => (
              <div key={marquee.id} className={styles.listItem}>
                <div className={styles.listPreview}>
                  <FlexibleMedia
                    src={marquee.imageUrl}
                    alt={marquee.label}
                    width={56}
                    height={56}
                    className={styles.listThumb}
                    unoptimized
                  />
                  <div>
                    <p>{marquee.label}</p>
                    <span>Urutan: {marquee.sortOrder}</span>
                    <span>{marquee.isActive ? "Aktif" : "Nonaktif"}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => onEditMarquee(marquee)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onDeleteMarquee(marquee.id)}>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
            {marquees.length === 0 ? <p>Belum ada logo marquee.</p> : null}
          </div>
        </article>
        ) : null}

        {activeSection === "privacyPolicy" ? (
        <article className={styles.card}>
          <h2>Pengaturan Kebijakan Privasi</h2>
          <form className={styles.form} onSubmit={onSavePrivacyPolicy}>
            <input
              value={privacyPolicyForm.title}
              onChange={(event) =>
                setPrivacyPolicyForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Judul halaman"
              required
            />
            <input
              value={privacyPolicyForm.updatedLabel}
              onChange={(event) =>
                setPrivacyPolicyForm((current) => ({
                  ...current,
                  updatedLabel: event.target.value,
                }))
              }
              placeholder="Label tanggal update"
              required
            />
            <input value={privacyPolicyForm.bannerImageUrl} readOnly placeholder="URL banner otomatis" required />
            {isFileUploadEnabled ? (
              <label className={styles.fileField}>
                Upload Banner Kebijakan Privasi
                <input type="file" accept="image/*" onChange={onSelectPrivacyBanner} />
                <small>
                  {isUploadingPrivacyBanner ? "Uploading..." : "Pilih file banner dari device"}
                </small>
              </label>
            ) : null}

            <div className={styles.richToolbar}>
              <button type="button" onClick={() => applyPrivacyEditorCommand("bold")}>
                Bold
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("italic")}>
                Italic
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("underline")}>
                Underline
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("formatBlock", "<p>")}>
                Paragraf
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("formatBlock", "<h2>")}>
                Heading
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("formatBlock", "<h3>")}>
                Subheading
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("fontSize", "2")}>
                Kecil
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("fontSize", "3")}>
                Normal
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("fontSize", "5")}>
                Besar
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("insertUnorderedList")}>
                Bullet List
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("insertOrderedList")}>
                Number List
              </button>
              <button
                type="button"
                onClick={() => {
                  const linkUrl = window.prompt("Masukkan URL link");
                  if (!linkUrl) {
                    return;
                  }
                  applyPrivacyEditorCommand("createLink", linkUrl);
                }}
              >
                Link
              </button>
              <button type="button" onClick={() => applyPrivacyEditorCommand("unlink")}>
                Unlink
              </button>
            </div>

            <div
              ref={privacyEditorRef}
              className={styles.richEditor}
              contentEditable
              suppressContentEditableWarning
              onInput={onPrivacyEditorInput}
            />

            <div className={styles.policyPreviewCard}>
              <p className={styles.previewDateText}>{privacyPolicyForm.updatedLabel}</p>
              <FlexibleMedia
                src={privacyPolicyForm.bannerImageUrl}
                alt="Preview banner kebijakan privasi"
                width={320}
                height={46}
                className={styles.policyBannerImage}
                unoptimized
              />
            </div>

            <div
              className={styles.policyHtmlPreview}
              dangerouslySetInnerHTML={{ __html: privacyPolicyForm.contentHtml }}
            />

            <div className={styles.formActions}>
              <button type="submit" disabled={isLoading}>
                Simpan Kebijakan Privasi
              </button>
            </div>
          </form>
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
