
"use client";

import React, { useState, useEffect, useRef, useMemo, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiThumbsUp, FiMessageCircle } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import VerifiedBadge from "@/components/VerifiedBadge";
import { formatRupiah } from "@/data/products";
import styles from "./page.module.css";
import { StoreProduct, StoreInformation, StoreTestimonial, StoreTestimonialComment, StoreMarqueeItem, StorePrivacyPolicyPage, StorePaymentSettings, BookStory, OrderSummary } from "@/types/store";

// ...existing code...
export default AdminManagementSection;

type AdminSection =
  | "overview"
  | "orders"
  | "products"
  | "informations"
  | "testimonials"
  | "testimonialComments"
  | "marquees"
  | "bookStories"
  | "paymentSettings"
  | "privacyPolicy"
  | "maintenanceSettings"
  | "admins"
  | "users"
  | "preview";

const sidebarItems: Array<{ id: AdminSection; label: string; desc: string }> = [
  { id: "overview", label: "Ringkasan", desc: "Statistik & order" },
  { id: "orders", label: "Order", desc: "Status pesanan user" },
  { id: "products", label: "Produk", desc: "CRUD produk" },
  { id: "informations", label: "Informasi", desc: "CRUD informasi" },
  { id: "testimonials", label: "Testimonial", desc: "CRUD testimonial" },
  { id: "testimonialComments", label: "Komentar Testimoni", desc: "Hapus komentar" },
  { id: "marquees", label: "Marquee", desc: "CRUD logo marquee" },
  { id: "bookStories", label: "Testimoni", desc: "Setujui cerita user" },
  { id: "paymentSettings", label: "Pembayaran", desc: "Atur QRIS" },
  {
    id: "privacyPolicy",
    label: "Kebijakan Privasi",
    desc: "Atur konten halaman privasi",
  },
  { id: "maintenanceSettings", label: "Pemeliharaan", desc: "Buka/tutup website" },
  { id: "admins", label: "Admin", desc: "Kelola admin" },
  { id: "users", label: "User", desc: "Lihat data user & aktivitas" },
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
  productType: "jual_beli" as "jual_beli" | "pekerjaan",
  jobApplicationLink: "",
  buyNowLink: "",
  maxApplicants: 0,
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
  linkedProducts: [] as Array<{ productId: string; productName: string }>,
  likeCount: 0,
  commentCount: 0,
};

const defaultMarqueeForm = {
  label: "",
  imageUrl: "/assets/logo.png",
  sortOrder: 0,
};

const defaultPrivacyPolicyForm = {
  title: "Kebijakan Privasi & Sertifikasi Layanan",
  updatedLabel: "Terakhir diperbarui: 28 Februari 2026",
  bannerImageUrl: "/assets/background.jpg",
  contentHtml: "<p>Tulis isi kebijakan privasi di sini.</p>",
};

const defaultPaymentSettingsForm: Omit<StorePaymentSettings, "id" | "updatedAt"> = {
  title: "Qriss",
  qrisImageUrl: "/assets/qriss.jpg",
  instructionText:
    "Scan Qriss diatas ini untuk proses produk kamu. Pastikan benar-benar sudah membayar",
  expiryMinutes: 30,
};
const MAX_QRIS_INLINE_LENGTH = 620_000;

const defaultMaintenanceSettingsForm = {
  isEnabled: false,
  message: "Website sedang dalam pemeliharaan. Mohon coba lagi nanti.",
  accessKey: "",
  openDate: "",
  openTime: "",
  closeDate: "",
  closeTime: "",
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

function statusOrderLabel(status: string) {
  if (status === "done") {
    return "Habis";
  }
  if (status === "error") {
    return "Dikirim";
  }
  return "Proses";
}

function cancelRequestStatusLabel(status: string | undefined) {
  if (status === "confirmed") {
    return "Disetujui";
  }
  if (status === "requested") {
    return "Menunggu Konfirmasi";
  }
  return "Tidak ada";
}

function AdminManagementSection() {
      const [productForm, setProductForm] = useState<typeof defaultProductForm>(defaultProductForm);
    // Main admin dashboard state
    const [authState, setAuthState] = useState<"checking" | "allowed" | "blocked">("checking");
    const [activeSection, setActiveSection] = useState<AdminSection>("overview");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [informations, setInformations] = useState<StoreInformation[]>([]);
    const [testimonials, setTestimonials] = useState<StoreTestimonial[]>([]);
    const [testimonialComments, setTestimonialComments] = useState<Record<string, StoreTestimonialComment[]>>({});
    const [loadedTestimonialIds, setLoadedTestimonialIds] = useState<Set<string>>(new Set());
    const [isDeletingComment, setIsDeletingComment] = useState<Record<string, boolean>>({});
    const [isGeneratingAIComments, setIsGeneratingAIComments] = useState<Record<string, boolean>>({});
    const [isGeneratingAIReplies, setIsGeneratingAIReplies] = useState<Record<string, boolean>>({});
    const [aiCommentCount, setAiCommentCount] = useState<Record<string, number>>({});
    const [aiReplyCount, setAiReplyCount] = useState<Record<string, number>>({});
    const [marquees, setMarquees] = useState<StoreMarqueeItem[]>([]);
    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [orderStatusDrafts, setOrderStatusDrafts] = useState<Record<string, string>>({});
    const [series, setSeries] = useState<Array<{ bucket: string; totalOrders: number }>>([]);
    const [latestOrders, setLatestOrders] = useState<Array<{ id: string; userName: string; total: number; createdAt: string }>>([]);
    const [users, setUsers] = useState<any[]>([]); // Replace any with user type if available
    const [session, setSession] = useState<any>(null); // Replace any with session type if available
    const [productEditId, setProductEditId] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState<string>("");
  const [adminEmails, setAdminEmails] = useState<Array<{ id: string; email: string; createdAt: number }>>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [infoForm, setInfoForm] = useState(defaultInfoForm);
  const [infoEditId, setInfoEditId] = useState<string | null>(null);
  const [testimonialForm, setTestimonialForm] = useState(defaultTestimonialForm);
  const [testimonialEditId, setTestimonialEditId] = useState<string | null>(null);
  const [marqueeForm, setMarqueeForm] = useState(defaultMarqueeForm);
  const [marqueeEditId, setMarqueeEditId] = useState<string | null>(null);
  const [privacyPolicyForm, setPrivacyPolicyForm] = useState(defaultPrivacyPolicyForm);
  const [paymentSettingsForm, setPaymentSettingsForm] = useState(defaultPaymentSettingsForm);
  const [maintenanceSettingsForm, setMaintenanceSettingsForm] = useState(defaultMaintenanceSettingsForm);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);
  const [isUploadingInfoImage, setIsUploadingInfoImage] = useState(false);
  const [isUploadingTestimonialMedia, setIsUploadingTestimonialMedia] = useState(false);
  const [isUploadingTestimonialAudio, setIsUploadingTestimonialAudio] = useState(false);
  const [isUploadingMarqueeImage, setIsUploadingMarqueeImage] = useState(false);
  const [isUploadingPrivacyBanner, setIsUploadingPrivacyBanner] = useState(false);
  const [isUploadingPaymentQris, setIsUploadingPaymentQris] = useState(false);
  const [activePollVoteId, setActivePollVoteId] = useState<string | null>(null);
  const [bookStories, setBookStories] = useState<BookStory[]>([]);
  const [approvedBookStories, setApprovedBookStories] = useState<BookStory[]>([]);
  const [storyReports, setStoryReports] = useState<Array<{ id: string; storyId: string; userId: string; reason: string; createdAt: string; story?: BookStory }>>([]);
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [storyLikesForm, setStoryLikesForm] = useState<Record<string, number>>({});
  const [storyCommentsForm, setStoryCommentsForm] = useState<Record<string, Array<{ userName: string; text: string }>>>({});
  const [editingWriterId, setEditingWriterId] = useState<string | null>(null);
  const [editingViewersId, setEditingViewersId] = useState<string | null>(null);
  const [writerForm, setWriterForm] = useState<{ userId: string; userName: string; userEmail: string; userAvatarUrl: string }>({
    userId: "",
    userName: "",
    userEmail: "",
    userAvatarUrl: "",
  });
  const [viewersForm, setViewersForm] = useState<{ isPrivate: boolean; restrictedViewerIds: string[] }>({
    isPrivate: false,
    restrictedViewerIds: [],
  });
  const [storyCommentSectionLoadTime, setStoryCommentSectionLoadTime] = useState<number>(0);
  const privacyEditorRef = useRef<HTMLDivElement | null>(null);
  const maxOrderCount = useMemo(
    () => Math.max(1, ...series.map((item) => item.totalOrders)),
    [series],
  );
  const totalRevenue = useMemo(
    () => latestOrders.reduce((sum, order) => sum + order.total, 0),
    [latestOrders],
  );

  // Router
  const router = useRouter();

  // Dummy for file upload toggle (should be set from env/config)
  const isFileUploadEnabled = true;

  // Dummy bumpPreview (should be replaced with actual logic if needed)
  function bumpPreview() {
    setPreviewVersion((v) => v + 1);
  }

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        const response = await fetch("/api/admin/emails");
        if (!response.ok) {
          throw new Error("Gagal load admin");
        }
        const data = await response.json();
        setAdminEmails(data.adminEmails || []);
      } catch (err) {
        console.error("Error loading admin emails:", err);
      }
    };

    loadAdmins();
  }, []);

  const handleAddAdmin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!newAdminEmail.trim()) {
      setError("Email tidak boleh kosong.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Gagal menambahkan admin.");
        return;
      }

      setMessage(data.message || "Admin berhasil ditambahkan.");
      setNewAdminEmail("");

      // Reload admin list
      const listResponse = await fetch("/api/admin/emails");
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setAdminEmails(listData.adminEmails || []);
      }
    } catch (err) {
      setError("Terjadi kesalahan. Coba lagi.");
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Yakin mau hapus ${email} dari daftar admin?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/emails?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Gagal menghapus admin.");
        return;
      }

      setMessage(data.message || "Admin berhasil dihapus.");

      // Reload admin list
      const listResponse = await fetch("/api/admin/emails");
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setAdminEmails(listData.adminEmails || []);
      }
    } catch (err) {
      setError("Terjadi kesalahan. Coba lagi.");
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
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

  const loadBookStories = async () => {
    const response = await fetch("/api/admin/book-stories", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil cerita yang menunggu persetujuan");
    }
    const result = (await response.json()) as { stories: BookStory[] };
    setBookStories(result.stories);
  };

  const loadApprovedBookStories = async () => {
    const response = await fetch("/api/admin/book-stories?status=approved", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil cerita yang sudah disetujui");
    }
    const result = (await response.json()) as { stories: BookStory[] };
    setApprovedBookStories(result.stories);
  };

  const loadStoryReports = async () => {
    const response = await fetch("/api/admin/book-stories?type=reports", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil laporan cerita");
    }
    const result = (await response.json()) as { reports: Array<{ id: string; storyId: string; userId: string; reason: string; createdAt: string; story?: BookStory }> };
    setStoryReports(result.reports);
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

  const loadMaintenanceSettings = async () => {
    const response = await fetch("/api/admin/maintenance-settings", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil pengaturan pemeliharaan");
    }
    const result = (await response.json()) as { settings: any };
    setMaintenanceSettingsForm({
      isEnabled: result.settings.isEnabled || false,
      message: result.settings.message || "",
      accessKey: result.settings.accessKey || "",
      openDate: result.settings.openDate || "",
      openTime: result.settings.openTime || "",
      closeDate: result.settings.closeDate || "",
      closeTime: result.settings.closeTime || "",
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
      series: Array<{ bucket: string; totalOrders: number }>;
      latestOrders: Array<{ id: string; userName: string; total: number; createdAt: string }>;
    };
    setSeries(result.series);
    setLatestOrders(result.latestOrders);
  };

  const loadTestimonialComments = async () => {
    const response = await fetch("/api/admin/testimonial-comments", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil komentar testimoni");
    }
    const result = (await response.json()) as { comments: StoreTestimonialComment[] };
    // Group comments by testimonial ID
    const grouped: Record<string, StoreTestimonialComment[]> = {};
    for (const comment of result.comments) {
      if (!grouped[comment.testimonialId]) {
        grouped[comment.testimonialId] = [];
      }
      grouped[comment.testimonialId].push(comment);
    }
    setTestimonialComments(grouped);
  };

  const onDeleteTestimonialComment = async (commentId: string, testimonialId: string) => {
    if (!window.confirm("Yakin hapus komentar ini?")) {
      return;
    }

    setIsDeletingComment((prev) => ({ ...prev, [commentId]: true }));
    try {
      const response = await fetch("/api/admin/testimonial-comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setError(data.message || "Gagal hapus komentar");
        return;
      }

      // Remove comment from state
      setTestimonialComments((prev) => ({
        ...prev,
        [testimonialId]: (prev[testimonialId] || []).filter((c) => c.id !== commentId),
      }));

      setMessage("Komentar berhasil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hapus komentar");
    } finally {
      setIsDeletingComment((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const loadUsers = async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Gagal ambil data user");
    }
    const result = (await response.json()) as { users: typeof users };
    setUsers(result.users);
  };

  const onDeleteUser = async (userId: string) => {
    if (!window.confirm("Yakin ingin menghapus user ini? Data user akan terhapus selamanya.")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("Gagal menghapus user");
      }

      setMessage("User berhasil dihapus.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus user");
    } finally {
      setIsLoading(false);
    }
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
          user?: { email?: string; uid?: string };
        };

        if (!payload.authenticated) {
          setAuthState("blocked");
          router.replace("/admin/login");
          return;
        }

        // Set session
        setSession(payload);

        setAuthState("allowed");
        await Promise.allSettled([
          loadProducts(),
          loadInformations(),
          loadTestimonials(),
          loadTestimonialComments(),
          loadMarquees(),
          loadBookStories(),
          loadApprovedBookStories(),
          loadStoryReports(),
          loadPrivacyPolicy(),
          loadPaymentSettings(),
          loadMaintenanceSettings(),
          loadOrders(),
          loadStats(),
          loadUsers(),
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

  // Track when testimonialComments section is loaded to hide badges for newly added comments
  useEffect(() => {
    if (activeSection === "testimonialComments") {
      setStoryCommentSectionLoadTime(Date.now());
      // Load actual testimonial comments
      loadTestimonialComments().catch((err) => {
        console.error("Failed to load testimonial comments:", err);
        setError("Gagal memuat komentar testimoni");
      });
    }
  }, [activeSection]);

  const onLogoutAdmin = async () => {
    // If using next-auth, replace with signOut from 'next-auth/react' if needed
    // await signOut({ redirect: false }).catch(() => {});
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => {});
    router.replace("/admin/login");
  };

  const onSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    // Clean up fields based on product type
    let payload = {
      ...productForm,
      price: Number(productForm.price),
    };

    // For Jual Beli, remove job-related fields
    if (productForm.productType === "jual_beli") {
      payload = {
        ...payload,
        jobApplicationLink: "",
        maxApplicants: 0,
      };
    }
    // For Pekerjaan, remove buyNowLink and job-related fields
    if (productForm.productType === "pekerjaan") {
      payload = {
        ...payload,
        buyNowLink: "",
        maxApplicants: typeof payload.maxApplicants === "string" ? 
          parseInt(payload.maxApplicants, 10) : 
          (payload.maxApplicants || 0),
      };
    }

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

    if (
      paymentSettingsForm.qrisImageUrl.startsWith("data:") &&
      paymentSettingsForm.qrisImageUrl.length > MAX_QRIS_INLINE_LENGTH
    ) {
      setError(
        "Gambar QRIS terlalu besar untuk mode inline. Upload file <= 450KB atau aktifkan bucket upload.",
      );
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentSettingsForm),
      });
      const result = (await response
        .json()
        .catch(() => ({}))) as {
        message?: string;
        paymentSettings?: StorePaymentSettings;
      };
      if (!response.ok) {
        if (response.status === 401) {
          setError("Sesi admin berakhir. Login ulang dulu.");
          return;
        }
        setError(result.message ?? "Gagal simpan pengaturan pembayaran.");
        return;
      }
      if (result.paymentSettings) {
        setPaymentSettingsForm({
          title: result.paymentSettings.title,
          qrisImageUrl: result.paymentSettings.qrisImageUrl,
          instructionText: result.paymentSettings.instructionText,
          expiryMinutes: result.paymentSettings.expiryMinutes,
        });
      }
      setMessage("Pengaturan pembayaran berhasil disimpan.");
      await loadPaymentSettings().catch(() => {});
      bumpPreview();
    } catch {
      setError("Gagal simpan pengaturan pembayaran.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveMaintenanceSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/maintenance-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maintenanceSettingsForm),
      });
      const result = (await response.json()) as { message?: string; settings?: any };
      if (!response.ok) {
        setError(result.message ?? "Gagal simpan pengaturan pemeliharaan.");
        return;
      }
      setMessage("Pengaturan pemeliharaan berhasil disimpan.");
      await loadMaintenanceSettings().catch(() => {});
      bumpPreview();
    } catch {
      setError("Gagal simpan pengaturan pemeliharaan.");
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

  const onConfirmCancelOrder = async (orderId: string) => {
    if (!window.confirm("Konfirmasi pembatalan order ini?")) {
      return;
    }
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/cancel-request`, {
        method: "PATCH",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal konfirmasi pembatalan order.");
        return;
      }
      setMessage("Pembatalan order berhasil dikonfirmasi.");
      await loadOrders();
      await loadStats();
    } catch {
      setError("Gagal konfirmasi pembatalan order.");
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

  const onGenerateAIComments = async (testimonialId: string, count: number = 3) => {
    setIsGeneratingAIComments((prev) => ({ ...prev, [testimonialId]: true }));
    try {
      const response = await fetch(`/api/testimonials/${testimonialId}/ai-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, tone: "positive" }),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        throw new Error(data.message || "Gagal membuat komentar AI");
      }

      setMessage(`${data.generatedCount} komentar AI berhasil dibuat!`);
      await loadTestimonials();
      bumpPreview();
    } catch (error) {
      console.error("Error generating AI comments:", error);
      setError(error instanceof Error ? error.message : "Gagal membuat komentar AI");
    } finally {
      setIsGeneratingAIComments((prev) => ({ ...prev, [testimonialId]: false }));
    }
  };

  const onGenerateAIReplies = async (testimonialId: string, commentId: string, count: number = 1) => {
    const key = `${testimonialId}-${commentId}`;
    setIsGeneratingAIReplies((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await fetch(`/api/testimonials/${testimonialId}/ai-replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, count }),
      });

      const data = (await response.json()) as any;
      if (!response.ok) {
        throw new Error(data.message || "Gagal membuat balasan AI");
      }

      setMessage(`${data.generatedCount} balasan AI berhasil dibuat!`);
      // Reload comments for this testimonial
      setLoadedTestimonialIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(testimonialId);
        return newSet;
      });
    } catch (error) {
      console.error("Error generating AI replies:", error);
      setError(error instanceof Error ? error.message : "Gagal membuat balasan AI");
    } finally {
      setIsGeneratingAIReplies((prev) => ({ ...prev, [key]: false }));
    }
  };

  const onDeleteMarquee = async (id: string) => {
    await fetch(`/api/admin/marquees/${id}`, { method: "DELETE" });
    if (marqueeEditId === id) {
      resetMarqueeForm();
    }
    await loadMarquees();
    bumpPreview();
  };

  const onApproveBookStory = async (storyId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, action: "approve" }),
      });
      if (!response.ok) {
        throw new Error("Gagal setujui cerita");
      }
      setMessage("Cerita disetujui!");
      await loadBookStories();
      await loadApprovedBookStories();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal setujui cerita");
    } finally {
      setIsLoading(false);
    }
  };

  const onRejectBookStory = async (storyId: string) => {
    if (!window.confirm("Yakin tolak cerita ini?")) {
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, action: "reject" }),
      });
      if (!response.ok) {
        throw new Error("Gagal tolak cerita");
      }
      setMessage("Cerita ditolak!");
      await loadBookStories();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal tolak cerita");
    } finally {
      setIsLoading(false);
    }
  };

  const onDeleteBookStory = async (storyId: string) => {
    if (!window.confirm("Yakin hapus cerita ini?")) {
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, action: "delete" }),
      });
      if (!response.ok) {
        throw new Error("Gagal hapus cerita");
      }
      setMessage("Cerita dihapus!");
      await loadBookStories();
      await loadApprovedBookStories();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal hapus cerita");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStoryLikes = async (storyId: string, likes: number) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, action: "update-likes", likes }),
      });
      if (!response.ok) {
        throw new Error("Gagal update likes");
      }
      setMessage("Like berhasil diupdate!");
      await loadApprovedBookStories();
      setExpandedStoryId(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal update likes");
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomComments = async (storyId: string, comments: Array<{ userName: string; text: string }>) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, action: "add-comments", comments }),
      });
      if (!response.ok) {
        throw new Error("Gagal tambah komentar");
      }
      setMessage("Komentar berhasil ditambahkan!");
      await loadApprovedBookStories();
      setStoryCommentsForm(prev => ({ ...prev, [storyId]: [] }));
      setExpandedStoryId(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal tambah komentar");
    } finally {
      setIsLoading(false);
    }
  };

  const onDeleteBookStoryComment = async (storyId: string, commentId: string) => {
    if (!window.confirm("Yakin hapus komentar ini?")) {
      return;
    }

    try {
      setIsDeletingComment((prev) => ({ ...prev, [commentId]: true }));
      const response = await fetch("/api/admin/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, commentId, action: "delete-comment" }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || "Gagal hapus komentar");
      }

      setMessage("Komentar berhasil dihapus.");
      await loadApprovedBookStories();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal hapus komentar");
    } finally {
      setIsDeletingComment((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const resolveStoryReport = async (reportId: string, deleteStory: boolean) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action: "resolve-report", deleteReportedStory: deleteStory }),
      });
      if (!response.ok) {
        throw new Error("Gagal selesaikan laporan");
      }
      setMessage(deleteStory ? "Cerita dihapus dan laporan diselesaikan!" : "Laporan diselesaikan!");
      await loadStoryReports();
      if (deleteStory) {
        await loadApprovedBookStories();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal selesaikan laporan");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStoryWriter = async (storyId: string) => {
    if (!writerForm.userId.trim() || !writerForm.userName.trim() || !writerForm.userEmail.trim()) {
      setError("Semua field harus diisi");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/book-stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-writer",
          storyId,
          newUserId: writerForm.userId,
          newUserName: writerForm.userName,
          newUserEmail: writerForm.userEmail,
          newUserAvatarUrl: writerForm.userAvatarUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Gagal ubah penulis");
      }

      setMessage("Penulis cerita berhasil diubah!");
      setEditingWriterId(null);
      setWriterForm({ userId: "", userName: "", userEmail: "", userAvatarUrl: "" });
      await loadApprovedBookStories();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal ubah penulis");
    } finally {
      setIsLoading(false);
    }
  };

  const updateStoryViewers = async (storyId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/book-stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-viewers",
          storyId,
          isPrivate: viewersForm.isPrivate,
          restrictedViewerIds: viewersForm.restrictedViewerIds,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Gagal atur penonton");
      }

      setMessage("Pengaturan penonton cerita berhasil diubah!");
      setEditingViewersId(null);
      setViewersForm({ isPrivate: false, restrictedViewerIds: [] });
      await loadApprovedBookStories();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal atur penonton");
    } finally {
      setIsLoading(false);
    }
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
      productType: product.productType || "jual_beli",
      jobApplicationLink: product.jobApplicationLink || "",
      buyNowLink: product.buyNowLink || "",
      maxApplicants: product.maxApplicants ?? 0,
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
      linkedProducts: testimonial.linkedProducts || [],
      likeCount: testimonial.likeCount ?? 0,
      commentCount: testimonial.commentCount ?? 0,
    });
  };

  const onEditMarquee = (marquee: StoreMarqueeItem) => {
    setActiveSection("marquees");
    setMarqueeEditId(marquee.id);
    setMarqueeForm({
      label: marquee.label,
      imageUrl: marquee.imageUrl || "/assets/logo.png",
      sortOrder: (typeof marquee.sortOrder === "number" ? marquee.sortOrder : 0),
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
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? "✕" : "≡"}
        </button>
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
        <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ""}`}>
          <button
            type="button"
            className={styles.sidebarCloseButton}
            onClick={() => setIsSidebarOpen(false)}
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            ✕
          </button>
          <div className={styles.sidebarCard}>
            <p className={styles.sidebarTitle}>Navigasi Admin</p>
            <nav className={styles.sidebarNav}>
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.sidebarButton} ${activeSection === item.id ? styles.sidebarButtonActive : ""}`}
                  onClick={() => {
                    setActiveSection(item.id);
                    setIsSidebarOpen(false);
                  }}
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
                    <span>Status: {statusOrderLabel(order.status)}</span>
                    <span>Request Batal: {cancelRequestStatusLabel(order.cancelRequestStatus)}</span>
                    {order.cancelRequestReason ? (
                      <span>Alasan: {order.cancelRequestReason}</span>
                    ) : null}
                    {order.cancelRequestedAt ? (
                      <span>
                        Waktu Request: {new Date(order.cancelRequestedAt).toLocaleString("id-ID")}
                      </span>
                    ) : null}
                    {order.cancelConfirmedAt ? (
                      <span>
                        Waktu Konfirmasi: {new Date(order.cancelConfirmedAt).toLocaleString("id-ID")}
                      </span>
                    ) : null}
                    {order.items && order.items.length > 0 ? (
                      <span>
                        Produk:{" "}
                        {order.items
                          .map((item) => {
                            // Try to display productId and quantity (StoreOrderItem)
                            return `${item.productId} x${(item as any).quantity ?? "?"}`;
                          })
                          .join(", ")}
                      </span>
                    ) : null}
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
                    <option value="error">Dikirim</option>
                  </select>
                  <button type="button" onClick={() => onSaveOrderStatus(order.id)}>
                    Simpan
                  </button>
                  {order.cancelRequestStatus === "requested" ? (
                    <button type="button" onClick={() => onConfirmCancelOrder(order.id)}>
                      Konfirmasi Batal
                    </button>
                  ) : null}
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
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setPaymentSettingsForm((current) => ({
                  ...current,
                  qrisImageUrl: "/assets/qriss.jpg",
                }))
              }
            >
              Pakai QRIS dari Asset (`/assets/qriss.jpg`)
            </button>
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
                  expiryMinutes: Math.max(5, Math.min(180, Number(event.target.value || 30))),
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

        {activeSection === "maintenanceSettings" ? (
        <article className={styles.card}>
          <h2>Pengaturan Pemeliharaan Website</h2>
          <form className={styles.form} onSubmit={onSaveMaintenanceSettings}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={maintenanceSettingsForm.isEnabled}
                onChange={(event) =>
                  setMaintenanceSettingsForm((current) => ({
                    ...current,
                    isEnabled: event.target.checked,
                  }))
                }
              />
              <span>Aktifkan Mode Pemeliharaan (Website Tertutup)</span>
            </label>
            <textarea
              value={maintenanceSettingsForm.message}
              onChange={(event) =>
                setMaintenanceSettingsForm((current) => ({
                  ...current,
                  message: event.target.value,
                }))
              }
              placeholder="Pesan pemeliharaan yang akan ditampilkan ke user"
              required
            />
            <input
              type="text"
              value={maintenanceSettingsForm.accessKey}
              onChange={(event) =>
                setMaintenanceSettingsForm((current) => ({
                  ...current,
                  accessKey: event.target.value,
                }))
              }
              placeholder="Kunci akses (kosongkan jika tidak dibutuhkan)"
            />
            <small style={{ color: "#666", marginTop: "-4px" }}>
              Jika diisi, user perlu memasukkan kunci ini untuk mengakses website saat mode pemeliharaan aktif
            </small>
            
            <div style={{ marginTop: "16px", borderTop: "1px solid #e0e0e0", paddingTop: "16px" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "12px", fontWeight: 600 }}>⏰ Jadwal Pemeliharaan (Opsional)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "4px", fontWeight: 500 }}>
                    Tanggal Ditutup
                  </label>
                  <input
                    type="date"
                    value={maintenanceSettingsForm.closeDate}
                    onChange={(event) =>
                      setMaintenanceSettingsForm((current) => ({
                        ...current,
                        closeDate: event.target.value,
                      }))
                    }
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "4px", fontWeight: 500 }}>
                    Jam Ditutup
                  </label>
                  <input
                    type="time"
                    value={maintenanceSettingsForm.closeTime}
                    onChange={(event) =>
                      setMaintenanceSettingsForm((current) => ({
                        ...current,
                        closeTime: event.target.value,
                      }))
                    }
                    placeholder="HH:MM"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "4px", fontWeight: 500 }}>
                    Tanggal Dibuka
                  </label>
                  <input
                    type="date"
                    value={maintenanceSettingsForm.openDate}
                    onChange={(event) =>
                      setMaintenanceSettingsForm((current) => ({
                        ...current,
                        openDate: event.target.value,
                      }))
                    }
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "4px", fontWeight: 500 }}>
                    Jam Dibuka
                  </label>
                  <input
                    type="time"
                    value={maintenanceSettingsForm.openTime}
                    onChange={(event) =>
                      setMaintenanceSettingsForm((current) => ({
                        ...current,
                        openTime: event.target.value,
                      }))
                    }
                    placeholder="HH:MM"
                  />
                </div>
              </div>
              <small style={{ color: "#999", display: "block", marginTop: "8px" }}>
                Atur tanggal & jam kapan website akan ditutup dan dibuka. Website akan otomatis tertutup saat jam tercapai.
              </small>
            </div>

            {error ? <p className={styles.errorText}>{error}</p> : null}
            {message ? <p className={styles.successText}>{message}</p> : null}
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
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
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label>
                <input
                  type="radio"
                  name="productType"
                  value="jual_beli"
                  checked={productForm.productType === "jual_beli"}
                  onChange={() =>
                    setProductForm((current) => ({
                      ...current,
                      productType: "jual_beli",
                      jobApplicationLink: "",
                      maxApplicants: 0,
                    }))
                  }
                />
                Jual Beli
              </label>
              <label>
                <input
                  type="radio"
                  name="productType"
                  value="pekerjaan"
                  checked={productForm.productType === "pekerjaan"}
                  onChange={() =>
                    setProductForm((current) => ({
                      ...current,
                      productType: "pekerjaan",
                    }))
                  }
                />
                Pekerjaan
              </label>
            </div>
            {productForm.productType === "pekerjaan" ? (
              <input
                type="url"
                value={productForm.jobApplicationLink}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    jobApplicationLink: event.target.value,
                  }))
                }
                placeholder="Link pendaftaran/aplikasi pekerjaan"
                required
              />
            ) : null}
            {productForm.productType === "jual_beli" ? (
              <input
                type="url"
                value={productForm.buyNowLink}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    buyNowLink: event.target.value,
                  }))
                }
                placeholder="Link untuk button Beli Sekarang (opsional)"
              />
            ) : null}
            {productForm.productType === "pekerjaan" ? (
              <input
                type="number"
                min={0}
                value={productForm.maxApplicants || ""}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    maxApplicants: event.target.value
                      ? Math.max(0, Number(event.target.value))
                      : 0,
                  }))
                }
                placeholder="Jumlah maksimal pelamar (kosongkan untuk unlimited)"
              />
            ) : null}
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
                    {product.productType === "pekerjaan" ? (
                      <span style={{ color: "#666", fontSize: "0.85rem" }}>
                        Pelamar: {product.applicantCount || 0} / {product.maxApplicants ? product.maxApplicants : "∞"}
                      </span>
                    ) : null}
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
            <input
              type="number"
              min={0}
              value={testimonialForm.likeCount ?? 0}
              onChange={(event) =>
                setTestimonialForm((current) => ({
                  ...current,
                  likeCount: Number(event.target.value || 0),
                }))
              }
              placeholder="Jumlah like"
            />
            <input
              type="number"
              min={0}
              value={testimonialForm.commentCount ?? 0}
              onChange={(event) =>
                setTestimonialForm((current) => ({
                  ...current,
                  commentCount: Number(event.target.value || 0),
                }))
              }
              placeholder="Jumlah komentar"
            />
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
                    {testimonial.likeCount ? <span>👍 {testimonial.likeCount}</span> : null}
                    {testimonial.commentCount ? <span>💬 {testimonial.commentCount}</span> : null}
                    {testimonial.linkedProducts && testimonial.linkedProducts.length > 0 ? (
                      <span>📦 {testimonial.linkedProducts.length} produk</span>
                    ) : null}
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
                  <button
                    type="button"
                    onClick={() => {
                      const count = aiCommentCount[testimonial.id] || 3;
                      onGenerateAIComments(testimonial.id, count);
                    }}
                    disabled={isGeneratingAIComments[testimonial.id]}
                    style={{
                      background: "#04B851",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      padding: "6px 12px",
                      cursor: isGeneratingAIComments[testimonial.id] ? "not-allowed" : "pointer",
                      opacity: isGeneratingAIComments[testimonial.id] ? 0.6 : 1,
                    }}
                  >
                    {isGeneratingAIComments[testimonial.id] ? "Membuat..." : "🤖 AI Komentar"}
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={aiCommentCount[testimonial.id] || 3}
                    onChange={(e) =>
                      setAiCommentCount((prev) => ({
                        ...prev,
                        [testimonial.id]: Math.max(1, Math.min(20, parseInt(e.target.value) || 3)),
                      }))
                    }
                    style={{
                      width: "50px",
                      padding: "6px",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                    }}
                    title="Jumlah komentar AI untuk dibuat"
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
        ) : null}

        {activeSection === "testimonialComments" ? (
        <article className={styles.card}>
          <h2>Kelola Komentar Testimoni</h2>
          
          {/* Actual Testimonial Comments */}
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", marginTop: "24px" }}>Komentar di Halaman Testimoni</h3>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "16px" }}>
              {Object.values(testimonialComments).reduce((sum, comments) => sum + comments.length, 0)} komentar total
            </p>
            
            <div className={styles.list}>
              {Object.entries(testimonialComments).map(([testimonialId, comments]) => (
                <div key={testimonialId} style={{ marginBottom: "24px", borderBottom: "1px solid #e0e0e0", paddingBottom: "16px" }}>
                  {comments.length > 0 && (
                    <>
                      <div style={{ marginBottom: "12px", padding: "8px", background: "#f0f0f0", borderRadius: "4px", borderLeft: "3px solid #04B851" }}>
                        <p style={{ margin: "0 0 4px", fontWeight: "600", fontSize: "0.95rem" }}>
                          Testimoni ID: {testimonialId} - {comments.length} komentar
                        </p>
                      </div>

                      {comments.map((comment) => (
                        <div key={comment.id} style={{ marginBottom: "12px", padding: "10px", background: "#f9f9f9", borderRadius: "6px", border: "1px solid #e0e0e0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                            <span style={{
                              fontWeight: comment.verified ? 800 : 600,
                              color: "#333",
                              fontSize: "0.95rem",
                            }}>
                              {comment.userName}
                            </span>
                            {comment.verified && (
                              <div style={{ display: "inline-flex", alignItems: "center", width: "22px", height: "22px", overflow: "hidden" }}>
                                <VerifiedBadge />
                              </div>
                            )}
                            {comment.rating && comment.rating > 0 && (
                              <span style={{ fontSize: "0.85rem", color: "#666" }}>
                                {"⭐".repeat(comment.rating)}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "#999", display: "block", marginTop: "2px" }}>
                            {new Date(comment.createdAt).toLocaleString("id-ID")}
                          </span>

                          {comment.replyToName && (
                            <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "#11151E", fontWeight: "500" }}>
                              @{comment.replyToName}
                            </p>
                          )}

                          <p style={{ margin: "6px 0", fontSize: "0.9rem", color: "#444", wordBreak: "break-word" }}>
                            {comment.text}
                          </p>

                          <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => onDeleteTestimonialComment(comment.id, testimonialId)}
                              disabled={isDeletingComment[comment.id]}
                              style={{
                                background: "#f44336",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                padding: "6px 12px",
                                fontSize: "0.85rem",
                                cursor: isDeletingComment[comment.id] ? "not-allowed" : "pointer",
                                opacity: isDeletingComment[comment.id] ? 0.6 : 1,
                              }}
                            >
                              {isDeletingComment[comment.id] ? "Hapus..." : "Hapus"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const count = aiReplyCount[`${testimonialId}-${comment.id}`] || 1;
                                onGenerateAIReplies(testimonialId, comment.id, count);
                              }}
                              disabled={isGeneratingAIReplies[`${testimonialId}-${comment.id}`]}
                              style={{
                                background: "#04B851",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                padding: "6px 12px",
                                fontSize: "0.85rem",
                                cursor: isGeneratingAIReplies[`${testimonialId}-${comment.id}`] ? "not-allowed" : "pointer",
                                opacity: isGeneratingAIReplies[`${testimonialId}-${comment.id}`] ? 0.6 : 1,
                              }}
                            >
                              {isGeneratingAIReplies[`${testimonialId}-${comment.id}`] ? "Balas..." : "🤖 AI Balas"}
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={aiReplyCount[`${testimonialId}-${comment.id}`] || 1}
                              onChange={(e) =>
                                setAiReplyCount((prev) => ({
                                  ...prev,
                                  [`${testimonialId}-${comment.id}`]: Math.max(1, Math.min(5, parseInt(e.target.value) || 1)),
                                }))
                              }
                              style={{
                                width: "40px",
                                padding: "6px",
                                borderRadius: "4px",
                                border: "1px solid #ddd",
                                fontSize: "0.85rem",
                              }}
                              title="Jumlah balasan AI"
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}

              {Object.values(testimonialComments).reduce((sum, comments) => sum + comments.length, 0) === 0 ? (
                <p style={{ color: "#999", textAlign: "center", padding: "24px" }}>Belum ada komentar di halaman testimoni.</p>
              ) : null}
            </div>
          </div>

          {/* Book Story Comments */}
          <div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", marginTop: "24px" }}>Komentar Cerita (Book Stories)</h3>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "16px" }}>
              {approvedBookStories.reduce((sum, story) => sum + story.comments.length, 0)} komentar total dari halaman testimoni (cerita).
            </p>

            <div className={styles.list}>
              {approvedBookStories.map((story) =>
                story.comments.length > 0 ? (
                  <div key={story.id} style={{ marginBottom: "16px", borderBottom: "1px solid #e0e0e0", paddingBottom: "16px" }}>
                    <div style={{ marginBottom: "12px", padding: "8px", background: "#f0f0f0", borderRadius: "4px", borderLeft: "3px solid #11151E" }}>
                      <p style={{ margin: "0 0 4px", fontWeight: "600", fontSize: "0.95rem" }}>
                        {story.userName} - {story.comments.length} komentar
                      </p>
                      <span style={{ fontSize: "0.85rem", color: "#666" }}>
                        {story.userEmail} • {new Date(story.createdAt).toLocaleString("id-ID")}
                      </span>
                    </div>

                    {story.comments.map((comment) => (
                      <div key={comment.id} style={{ marginBottom: "12px", padding: "10px", background: "#f9f9f9", borderRadius: "6px", border: "1px solid #e0e0e0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                          <span style={{
                            fontWeight: comment.verified || comment.userName === "Tokko Marketplace" ? 800 : 600,
                            color: "#333",
                            fontSize: "0.95rem",
                          }}>
                            {comment.userName}
                          </span>
                          {(comment.verified || comment.userName === "Tokko Marketplace") && 
                           new Date(comment.createdAt).getTime() < storyCommentSectionLoadTime && (
                            <div style={{ display: "inline-flex", alignItems: "center", width: "22px", height: "22px", overflow: "hidden" }}>
                              <VerifiedBadge />
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#999", display: "block", marginTop: "2px" }}>
                          {new Date(comment.createdAt).toLocaleString("id-ID")}
                        </span>

                        {comment.replyToName && (
                          <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "#11151E", fontWeight: "500" }}>
                            @{comment.replyToName}
                          </p>
                        )}

                        <p style={{ margin: "6px 0", fontSize: "0.9rem", color: "#444", wordBreak: "break-word" }}>
                          {comment.text}
                        </p>

                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <button
                            type="button"
                            onClick={() => onDeleteBookStoryComment(story.id, comment.id)}
                            disabled={isDeletingComment[comment.id]}
                            style={{
                              background: "#f44336",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              padding: "6px 12px",
                              fontSize: "0.85rem",
                              cursor: isDeletingComment[comment.id] ? "not-allowed" : "pointer",
                              opacity: isDeletingComment[comment.id] ? 0.6 : 1,
                            }}
                          >
                            {isDeletingComment[comment.id] ? "Hapus..." : "Hapus"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null
              )}

              {approvedBookStories.reduce((sum, story) => sum + story.comments.length, 0) === 0 ? (
                <p style={{ color: "#999", textAlign: "center", padding: "24px" }}>Belum ada komentar cerita.</p>
              ) : null}
            </div>
          </div>

          {error ? <p className={styles.errorText}>{error}</p> : null}
          {message ? <p className={styles.successText}>{message}</p> : null}
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
            {/*
            <label className={styles.checkField}>
              <input
                type="checkbox"
              />
              Aktif ditampilkan di beranda
            </label>
            */}
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
                {/* Urutan marquee tidak tersedia */}
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
                    {/* Urutan dan status marquee tidak tersedia */}
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

        {activeSection === "bookStories" ? (
        <article className={styles.card}>
          <h2>Testimoni - Cerita Menunggu Persetujuan</h2>
          <div className={styles.list}>
            {bookStories.length === 0 ? (
              <p>Belum ada cerita yang menunggu persetujuan.</p>
            ) : (
              bookStories.map((story) => (
                <div key={story.id} className={styles.listItem}>
                  <div className={styles.listPreview}>
                    <div>
                      <p><strong>{story.userName}</strong></p>
                      <span>{story.userEmail}</span>
                      <span>{new Date(story.createdAt).toLocaleString("id-ID")}</span>
                      <p style={{ marginTop: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {story.story}
                      </p>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      onClick={() => onApproveBookStory(story.id)}
                      disabled={isLoading}
                      style={{ background: "#4CAF50", color: "white" }}
                    >
                      Setujui
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectBookStory(story.id)}
                      disabled={isLoading}
                      style={{ background: "#FF9800", color: "white" }}
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBookStory(story.id)}
                      disabled={isLoading}
                      style={{ background: "#f44336", color: "white" }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
        ) : null}

        {activeSection === "bookStories" ? (
        <article className={styles.card} style={{ marginTop: "24px" }}>
          <h2>Testimoni - Cerita yang Sudah Disetujui</h2>
          <div className={styles.list}>
            {approvedBookStories.length === 0 ? (
              <p>Belum ada cerita yang disetujui.</p>
            ) : (
              approvedBookStories.map((story) => (
                <div key={story.id} className={styles.listItem}>
                  <div className={styles.listPreview}>
                    <div>
                      <p><strong>{story.userName}</strong></p>
                      <span>{story.userEmail}</span>
                      <span>{new Date(story.createdAt).toLocaleString("id-ID")}</span>
                      {story.photos && story.photos.length > 0 && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                          {story.photos.slice(0, 3).map((photo, idx) => (
                            <img
                              key={idx}
                              src={photo}
                              alt={`Story photo ${idx + 1}`}
                              style={{
                                width: "60px",
                                height: "60px",
                                borderRadius: "4px",
                                objectFit: "cover",
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <p style={{ marginTop: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {story.story}
                      </p>
                      <p style={{ marginTop: "8px", fontSize: "12px", color: "#666", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FiThumbsUp aria-hidden="true" /> {story.likedBy.length}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FiMessageCircle aria-hidden="true" /> {story.comments.length}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      onClick={() => onDeleteBookStory(story.id)}
                      disabled={isLoading}
                      style={{ background: "#f44336", color: "white" }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
        ) : null}

        {activeSection === "bookStories" ? (
        <article className={styles.card} style={{ marginTop: "24px" }}>
          <h2>Testimoni - Kelola Cerita & Komentar</h2>
          <div className={styles.list}>
            {approvedBookStories.length === 0 ? (
              <p>Belum ada cerita yang disetujui.</p>
            ) : (
              approvedBookStories.map((story) => (
                <div key={story.id} className={styles.listItem}>
                  <div className={styles.listPreview}>
                    <div style={{ width: "100%" }}>
                      <p><strong>{story.userName}</strong></p>
                      <span>{story.userEmail}</span>
                      <span>{new Date(story.createdAt).toLocaleString("id-ID")}</span>
                      <p style={{ marginTop: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {story.story}
                      </p>
                      <p style={{ marginTop: "8px", fontSize: "12px", color: "#666", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FiThumbsUp aria-hidden="true" /> {story.likedBy.length}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FiMessageCircle aria-hidden="true" /> {story.comments.length}
                        </span>
                      </p>

                      {expandedStoryId === story.id && (
                        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #eee" }}>
                          <div>
                            <label style={{ display: "block", marginBottom: "8px" }}>
                              <strong>Atur Jumlah Like:</strong>
                              <input
                                type="number"
                                min="0"
                                value={storyLikesForm[story.id] ?? story.likedBy.length}
                                onChange={(e) =>
                                  setStoryLikesForm(prev => ({ ...prev, [story.id]: parseInt(e.target.value) || 0 }))
                                }
                                style={{ marginLeft: "8px", width: "80px", padding: "4px" }}
                              />
                              <button
                                type="button"
                                onClick={() => updateStoryLikes(story.id, storyLikesForm[story.id] ?? story.likedBy.length)}
                                disabled={isLoading}
                                style={{ marginLeft: "8px", padding: "4px 12px", background: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                              >
                                Update
                              </button>
                            </label>
                          </div>

                          <div style={{ marginTop: "16px" }}>
                            <strong>Komentar Saat Ini:</strong>
                            {story.comments.length === 0 ? (
                              <p style={{ marginTop: "8px", color: "#666", fontSize: "0.9rem" }}>Belum ada komentar.</p>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                                {story.comments.map((comment) => (
                                  <div key={comment.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", padding: "8px", background: "#f5f5f5", borderRadius: "4px" }}>
                                    <div style={{ minWidth: 0 }}>
                                      <p style={{ margin: 0, fontWeight: 700 }}>{comment.userName}</p>
                                      {comment.replyToName ? (
                                        <p style={{ margin: "2px 0 0", color: "#11151E", fontSize: "0.85rem" }}>@{comment.replyToName}</p>
                                      ) : null}
                                      <p style={{ margin: "4px 0 0", wordBreak: "break-word" }}>{comment.text}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteBookStoryComment(story.id, comment.id)}
                                      disabled={isDeletingComment[comment.id]}
                                      style={{ padding: "4px 8px", background: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: isDeletingComment[comment.id] ? "not-allowed" : "pointer", fontSize: "12px", flexShrink: 0 }}
                                    >
                                      {isDeletingComment[comment.id] ? "Hapus..." : "Hapus"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div style={{ marginTop: "16px" }}>
                            <strong>Tambah Komentar Custom:</strong>
                            {(storyCommentsForm[story.id] || []).map((comment, idx) => (
                              <div key={idx} style={{ marginTop: "8px", padding: "8px", background: "#f5f5f5", borderRadius: "4px" }}>
                                <input
                                  type="text"
                                  placeholder="Nama user"
                                  value={comment.userName}
                                  onChange={(e) => {
                                    const newComments = [...(storyCommentsForm[story.id] || [])];
                                    newComments[idx].userName = e.target.value;
                                    setStoryCommentsForm(prev => ({ ...prev, [story.id]: newComments }));
                                  }}
                                  style={{ width: "100%", padding: "4px", marginBottom: "4px", boxSizing: "border-box" }}
                                />
                                <textarea
                                  placeholder="Isi komentar"
                                  value={comment.text}
                                  onChange={(e) => {
                                    const newComments = [...(storyCommentsForm[story.id] || [])];
                                    newComments[idx].text = e.target.value;
                                    setStoryCommentsForm(prev => ({ ...prev, [story.id]: newComments }));
                                  }}
                                  style={{ width: "100%", padding: "4px", minHeight: "60px", boxSizing: "border-box" }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newComments = (storyCommentsForm[story.id] || []).filter((_, i) => i !== idx);
                                    setStoryCommentsForm(prev => ({ ...prev, [story.id]: newComments }));
                                  }}
                                  style={{ marginTop: "4px", padding: "4px 8px", background: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}
                                >
                                  Hapus
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const newComments = [...(storyCommentsForm[story.id] || []), { userName: "", text: "" }];
                                setStoryCommentsForm(prev => ({ ...prev, [story.id]: newComments }));
                              }}
                              style={{ marginTop: "8px", padding: "6px 12px", background: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                            >
                              + Tambah Komentar
                            </button>
                            {(storyCommentsForm[story.id] || []).length > 0 && (
                              <button
                                type="button"
                                onClick={() => addCustomComments(story.id, storyCommentsForm[story.id] || [])}
                                disabled={isLoading}
                                style={{ marginLeft: "8px", padding: "6px 12px", background: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                              >
                                Kirim Komentar
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      onClick={() => setExpandedStoryId(expandedStoryId === story.id ? null : story.id)}
                      style={{ background: "#FF9800", color: "white" }}
                    >
                      {expandedStoryId === story.id ? "Tutup" : "Kelola"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWriterId(editingWriterId === story.id ? null : story.id);
                        setWriterForm({
                          userId: story.userId,
                          userName: story.userName,
                          userEmail: story.userEmail,
                          userAvatarUrl: story.userAvatarUrl || "",
                        });
                      }}
                      style={{ background: "#9C27B0", color: "white" }}
                    >
                      {editingWriterId === story.id ? "Batal" : "Ubah Penulis"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingViewersId(editingViewersId === story.id ? null : story.id);
                        setViewersForm({
                          isPrivate: story.isPrivate ?? false,
                          restrictedViewerIds: story.restrictedViewers || [],
                        });
                      }}
                      style={{ background: "#00BCD4", color: "white" }}
                    >
                      {editingViewersId === story.id ? "Batal" : "Atur Penonton"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBookStory(story.id)}
                      disabled={isLoading}
                      style={{ background: "#f44336", color: "white" }}
                    >
                      Hapus
                    </button>
                  </div>
                  
                  {editingWriterId === story.id && (
                    <div style={{ marginTop: "12px", padding: "12px", background: "#f9f9f9", borderRadius: "4px" }}>
                      <h4>Ubah Penulis Cerita</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input
                          type="text"
                          placeholder="User ID"
                          value={writerForm.userId}
                          onChange={(e) => setWriterForm(prev => ({ ...prev, userId: e.target.value }))}
                          style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                        />
                        <input
                          type="text"
                          placeholder="Nama Penulis"
                          value={writerForm.userName}
                          onChange={(e) => setWriterForm(prev => ({ ...prev, userName: e.target.value }))}
                          style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                        />
                        <input
                          type="email"
                          placeholder="Email Penulis"
                          value={writerForm.userEmail}
                          onChange={(e) => setWriterForm(prev => ({ ...prev, userEmail: e.target.value }))}
                          style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                        />
                        <input
                          type="text"
                          placeholder="Avatar URL (opsional)"
                          value={writerForm.userAvatarUrl}
                          onChange={(e) => setWriterForm(prev => ({ ...prev, userAvatarUrl: e.target.value }))}
                          style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => updateStoryWriter(story.id)}
                            disabled={isLoading}
                            style={{ flex: 1, padding: "8px", background: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Simpan Penulis
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWriterId(null)}
                            style={{ flex: 1, padding: "8px", background: "#ccc", border: "none", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {editingViewersId === story.id && (
                    <div style={{ marginTop: "12px", padding: "12px", background: "#f9f9f9", borderRadius: "4px" }}>
                      <h4>Atur Penonton Cerita</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={viewersForm.isPrivate}
                            onChange={(e) => setViewersForm(prev => ({ ...prev, isPrivate: e.target.checked }))}
                          />
                          <span>Cerita Private (Pembaca Terbatas)</span>
                        </label>
                        
                        {viewersForm.isPrivate && (
                          <div>
                            <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                              Masukkan User ID yang dipisahkan dengan koma untuk pembaca yang diizinkan:
                            </p>
                            <textarea
                              placeholder="user_id_1, user_id_2, user_id_3"
                              value={viewersForm.restrictedViewerIds.join(", ")}
                              onChange={(e) => {
                                const ids = e.target.value
                                  .split(",")
                                  .map(id => id.trim())
                                  .filter(id => id.length > 0);
                                setViewersForm(prev => ({ ...prev, restrictedViewerIds: ids }));
                              }}
                              style={{ width: "100%", padding: "8px", border: "1px solid #ddd", borderRadius: "4px", minHeight: "80px", fontFamily: "monospace" }}
                            />
                            <p style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                              Total pembaca yang diizinkan: {viewersForm.restrictedViewerIds.length}
                            </p>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => updateStoryViewers(story.id)}
                            disabled={isLoading}
                            style={{ flex: 1, padding: "8px", background: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Simpan Pengaturan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingViewersId(null)}
                            style={{ flex: 1, padding: "8px", background: "#ccc", border: "none", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </article>
        ) : null}

        {activeSection === "bookStories" ? (
        <article className={styles.card} style={{ marginTop: "24px" }}>
          <h2>Testimoni - Cerita Yang Di-Report</h2>
          <div className={styles.list}>
            {storyReports.length === 0 ? (
              <p>Belum ada laporan cerita.</p>
            ) : (
              storyReports.map((report) => (
                <div key={report.id} className={styles.listItem}>
                  <div className={styles.listPreview}>
                    <div style={{ width: "100%" }}>
                      <p><strong>Laporan dari: {report.userId}</strong></p>
                      <span>Alasan: {report.reason}</span>
                      <span>{new Date(report.createdAt).toLocaleString("id-ID")}</span>
                      
                      {report.story && (
                        <>
                          <p style={{ marginTop: "12px", fontWeight: "bold" }}>Cerita yang di-report:</p>
                          <p><strong>{report.story.userName}</strong></p>
                          <span>{report.story.userEmail}</span>
                          <p style={{ marginTop: "8px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "14px" }}>
                            {report.story.story}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Hapus cerita ini dan selesaikan laporan?")) {
                          resolveStoryReport(report.id, true);
                        }
                      }}
                      disabled={isLoading}
                      style={{ background: "#f44336", color: "white" }}
                    >
                      Hapus Cerita
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveStoryReport(report.id, false)}
                      disabled={isLoading}
                      style={{ background: "#FF9800", color: "white" }}
                    >
                      Selesaikan
                    </button>
                  </div>
                </div>
              ))
            )}
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
              <div
                className={styles.policyHtmlPreview}
                dangerouslySetInnerHTML={{ __html: privacyPolicyForm.contentHtml }}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.success}>{message}</p>}
            <div className={styles.formActions}>
              <button type="submit" disabled={isLoading}>
                Simpan Kebijakan Privasi
              </button>
            </div>
          </form>
        </article>
        ) : null}

        {activeSection === "admins" && session?.user?.email?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() ? (
          <AdminManagementSection />
        ) : null}

        {activeSection === "users" ? (
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Manajemen User</h2>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => loadUsers()}
                disabled={isLoading}
              >
                Refresh
              </button>
            </div>

            <div className={styles.list}>
              {users.length === 0 ? (
                <p style={{ padding: "16px", textAlign: "center", color: "#999" }}>
                  Belum ada user yang mendaftar.
                </p>
              ) : (
                <table className={styles.table} style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ddd" }}>
                      <th style={{ padding: "8px", textAlign: "left" }}>Username</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Email</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Beli</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Lamar</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Last Active</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>Join</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px" }}>{user.username}</td>
                        <td style={{ padding: "8px", fontSize: "12px" }}>{user.email}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              background: user.purchaseCount > 0 ? "#4CAF50" : "#f0f0f0",
                              color: user.purchaseCount > 0 ? "white" : "black",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            {user.purchaseCount}
                          </span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-block",
                              background: user.jobApplicationCount > 0 ? "#2196F3" : "#f0f0f0",
                              color: user.jobApplicationCount > 0 ? "white" : "black",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            {user.jobApplicationCount}
                          </span>
                        </td>
                        <td style={{ padding: "8px", fontSize: "12px" }}>
                          {user.lastActiveAt
                            ? new Date(user.lastActiveAt).toLocaleDateString("id-ID", {
                                month: "short",
                                day: "numeric",
                              })
                            : "-"}
                        </td>
                        <td style={{ padding: "8px", fontSize: "12px" }}>
                          {new Date(user.createdAt).toLocaleDateString("id-ID", {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })}
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => onDeleteUser(user.id)}
                            disabled={isLoading}
                            style={{ fontSize: "12px", padding: "4px 8px" }}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
