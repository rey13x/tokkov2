"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FiGlobe } from "react-icons/fi";
import styles from "./LanguageTools.module.css";

type LanguageCode = "id" | "en";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  toggleLanguage: () => void;
};

const STORAGE_KEY = "tokko_language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

const translations: Record<string, string> = {
  "Beranda": "Home",
  "Menu utama": "Main menu",
  "Menu produk": "Product menu",
  "Menu": "Menu",
  "Profil": "Profile",
  "Pilih foto Profil": "Choose Profile Photo",
  "Masuk ke halaman admin": "Open admin page",
  "Semua Layanan": "All Services",
  "Produk Baru": "New Products",
  "Informasi": "Information",
  "Informasi Media": "Media Information",
  "Bekerja sama dengan": "Working with",
  "Testimoni": "Testimonials",
  "Troli": "Cart",
  "Koleksi": "Collection",
  "Cari Layanan...": "Search services...",
  "Cari Testimoni...": "Search testimonials...",
  "Produk tidak ditemukan untuk filter ini.": "No products found for this filter.",
  "Semua Produk": "All Products",
  "Isi Testimoni": "Write Testimonial",
  "Tulis pesan kamu": "Write your message",
  "Tambah komentar...": "Add a comment...",
  "Tambah Foto": "Add Photo",
  "Produk:": "Product:",
  "+ Pilih Produk": "+ Choose Product",
  "- Tutup": "- Close",
  "Batal": "Cancel",
  "Hapus": "Delete",
  "Hapus...": "Deleting...",
  "Edit": "Edit",
  "Simpan": "Save",
  "Simpan...": "Saving...",
  "Simpan Perubahan": "Save Changes",
  "Batal Edit": "Cancel Edit",
  "Tambah": "Add",
  "Tambah Informasi": "Add Information",
  "Tambah Testimoni": "Add Testimonial",
  "Tambah Logo": "Add Logo",
  "Tambah media": "Add media",
  "+ Tambah Media": "+ Add Media",
  "+ Tambah Opsi": "+ Add Option",
  "Hapus Semua": "Delete All",
  "Pekerjaan": "Jobs",
  "Jual Beli": "Commerce",
  "Pelamar": "Applicants",
  "Penuh": "Full",
  "Posisi Penuh": "Position Full",
  "Posisi ini sudah penuh": "This position is full",
  "Memuat...": "Loading...",
  "Mengarahkan...": "Redirecting...",
  "Lamar": "i want",
  "Klik tombol Lamar untuk melamar pekerjaan ini.": "Click the i want button to apply for this job.",
  "Mohon tunggu hingga lamaran selesai diproses.": "Please wait until the application finishes processing.",
  "Mohon tunggu sebelum melamar lagi.": "Please wait before applying again.",
  "Anda tidak dapat melamar pekerjaan ini saat ini.": "You cannot apply for this job right now.",
  "Yakin ingin melamar pekerjaan ini?": "Are you sure you want to apply for this job?",
  "Setelah kamu lamar, kamu akan dicatat di sistem kami.": "After you apply, it will be recorded in our system.",
  "Gagal mencatat lamaran.": "Failed to save application.",
  "Gagal mencatat lamaran. Anda akan dialihkan ke link pendaftaran.": "Failed to save application. You will be redirected to the registration link.",
  "Gagal memuat lamaran": "Failed to load applications",
  "Gagal memuat riwayat lamaran": "Failed to load application history",
  "Yakin ingin membatalkan lamaran ini?": "Are you sure you want to cancel this application?",
  "Yakin ingin membatalkan lamaran pekerjaan ini?": "Are you sure you want to cancel this job application?",
  "Gagal membatalkan lamaran.": "Failed to cancel application.",
  "Gagal membatalkan lamaran. Coba lagi.": "Failed to cancel application. Try again.",
  "Lamaran berhasil dibatalkan.": "Application canceled successfully.",
  "Anda harus": "You must",
  "login terlebih dahulu": "log in first",
  "untuk melamar pekerjaan ini.": "to apply for this job.",
  "Lamaran berhasil dicatat!": "Application saved!",
  "Cek riwayat lamaran di": "Check application history on the",
  "halaman troli": "cart page",
  "Anda akan dialihkan ke halaman pendaftaran...": "You will be redirected to the registration page...",
  "Pekerjaan Dilamar": "Applied Jobs",
  "Lamaran Pekerjaan": "Job Applications",
  "ID Lamaran": "Application ID",
  "Dilamar pada": "Applied on",
  "Batalkan Lamaran": "Cancel Application",
  "Belum ada lamaran pekerjaan.": "No job applications yet.",
  "Login": "Log In",
  "Masuk": "Log In",
  "Daftar dan Masuk": "Register and Log In",
  "Memproses...": "Processing...",
  "Kembali ke Beranda": "Back to Home",
  "Kembali ke Login": "Back to Login",
  "Masukkan 6 digit kode": "Enter the 6-digit code",
  "Masukkan email kamu": "Enter your email",
  "Masukkan password baru": "Enter new password",
  "Profil berhasil diperbarui.": "Profile updated successfully.",
  "Login sebagai": "Logged in as",
  "Memuat foto profil...": "Loading profile photos...",
  "Belum ada foto profil yang tersedia": "No profile photos available yet",
  "Tidak ada foto profil tersedia": "No profile photos available",
  "Admin Panel": "Admin Panel",
  "Dashboard": "Dashboard",
  "Produk": "Products",
  "Produk Baru": "New Products",
  "CRUD Produk": "Product CRUD",
  "Edit Produk": "Edit Product",
  "Media Produk": "Product Media",
  "Nama Produk": "Product Name",
  "Harga Produk": "Product Price",
  "Deskripsi Produk": "Product Description",
  "Pesanan": "Orders",
  "Status Pesanan": "Order Status",
  "Status Pemesanan": "Order Status",
  "Pengaturan": "Settings",
  "Pengguna": "Users",
  "Pelanggan": "Customers",
  "Pembayaran": "Payment",
  "Metode Pembayaran": "Payment Method",
  "Bukti Pembayaran": "Payment Proof",
  "Belum ada data.": "No data yet.",
  "Belum ada produk.": "No products yet.",
  "Belum ada pesanan.": "No orders yet.",
  "Belum ada informasi.": "No information yet.",
  "Tidak ada data": "No data",
  "Tidak ditemukan": "Not found",
  "Kembali": "Back",
  "Lanjut": "Continue",
  "Konfirmasi": "Confirm",
  "Batalkan": "Cancel",
  "Aktif": "Active",
  "Nonaktif": "Inactive",
  "Tanggal": "Date",
  "Nama": "Name",
  "Email": "Email",
  "Password": "Password",
  "Username": "Username",
  "Role": "Role",
  "Status": "Status",
  "Aksi": "Actions",
  "Urutan": "Order",
  "Kategori": "Category",
  "Judul": "Title",
  "Deskripsi": "Description",
  "Pesan": "Message",
  "Link": "Link",
  "Gambar": "Image",
  "Foto": "Photo",
  "Video": "Video",
  "Suara": "Voice",
  "File": "File",
  "Upload": "Upload",
  "Uploading...": "Uploading...",
  "Pilih": "Choose",
  "Pilih foto profil": "Choose profile photo",
  "Pilih foto Profil": "Choose Profile Photo",
  "Pilih testimoni": "Choose testimonial",
  "Pilih Produk": "Choose Product",
  "Pilih Media": "Choose Media",
  "Kelola Komentar Testimoni": "Manage Testimonial Comments",
  "Komentar di Halaman Testimoni": "Comments on Testimonials Page",
  "Pilih Testimoni": "Choose Testimonial",
  "Pilih Testimoni untuk AI": "Choose Testimonial for AI",
  "Tambah Komentar": "Add Comment",
  "Tambah Komentar Langsung": "Add Comment Directly",
  "Menambah...": "Adding...",
  "Edit Komentar": "Edit Comment",
  "Salin Komentar Testimoni ke Cerita": "Copy Testimonial Comments to Story",
  "Simpan Pengaturan": "Save Settings",
  "Simpan Password Baru": "Save New Password",
  "Resetting...": "Resetting...",
  "Preview Beranda Tokko": "Preview Tokko Home",
  "CRUD Informasi": "Information CRUD",
  "Edit Informasi": "Edit Information",
  "CRUD Testimonial + Voice": "Testimonial + Voice CRUD",
  "Edit Testimonial": "Edit Testimonial",
  "CRUD Logo Marquee": "Logo Marquee CRUD",
  "Edit Logo Marquee": "Edit Logo Marquee",
  "Story Reels": "Story Reels",
  "Tambah Reel": "Add Reel",
  "Testimoni - Cerita Menunggu Persetujuan": "Testimonials - Stories Waiting for Approval",
  "Testimoni - Cerita yang Sudah Disetujui": "Testimonials - Approved Stories",
  "Testimoni - Kelola Cerita & Komentar": "Testimonials - Manage Stories & Comments",
  "Testimoni - Cerita Yang Di-Report": "Testimonials - Reported Stories",
  "Ubah Penulis": "Change Writer",
  "Atur Penonton": "Set Viewers",
  "Simpan Penulis": "Save Writer",
  "Hapus Cerita": "Delete Story",
  "Cerita": "Story",
  "Komentar": "Comments",
  "Penulis": "Writer",
  "Penonton": "Viewers",
  "Pembaca": "Readers",
  "Upload Media Produk (Foto/Video)": "Upload Product Media (Photo/Video)",
  "Upload Media Informasi (Foto/Video)": "Upload Information Media (Photo/Video)",
  "Upload Media Testimoni (Foto/Video)": "Upload Testimonial Media (Photo/Video)",
  "Upload Voice Testimoni": "Upload Testimonial Voice",
  "Pilih file media dari device": "Choose media file from device",
  "Pilih file suara (mp3/wav)": "Choose audio file (mp3/wav)",
  "Pilih logo dari device": "Choose logo from device",
  "Jumlah maksimal pelamar (kosongkan untuk unlimited)": "Maximum applicants (leave empty for unlimited)",
  "Media Tambahan (Opsional)": "Additional Media (Optional)",
  "Tambahkan foto atau video tambahan untuk galeri produk. Gunakan link (URL).": "Add extra photos or videos for the product gallery. Use links (URLs).",
  "Kebijakan Privasi": "Privacy Policy",
  "Simpan Kebijakan Privasi": "Save Privacy Policy",
};

const phraseTranslations = Object.entries(translations).sort((a, b) => b[0].length - a[0].length);
const textOriginals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();

function preserveOuterWhitespace(original: string, translated: string) {
  const start = original.match(/^\s*/)?.[0] ?? "";
  const end = original.match(/\s*$/)?.[0] ?? "";
  return `${start}${translated}${end}`;
}

function translateValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;

  const exact = translations[trimmed];
  if (exact) return preserveOuterWhitespace(value, exact);

  let next = value;
  for (const [source, target] of phraseTranslations) {
    next = next.split(source).join(target);
  }
  return next;
}

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest("[data-no-translate], script, style, code, pre, textarea, input, select"));
}

function translateTextNode(node: Text, language: LanguageCode) {
  if (shouldSkipNode(node)) return;

  const stored = textOriginals.get(node);
  const current = node.nodeValue ?? "";
  const translatedStored = stored ? translateValue(stored) : "";
  const source = stored && (current === translatedStored || current === stored) ? stored : current;

  textOriginals.set(node, source);
  const next = language === "en" ? translateValue(source) : source;
  if (current !== next) {
    node.nodeValue = next;
  }
}

function translateAttributes(element: Element, language: LanguageCode) {
  if (element.closest("[data-no-translate], script, style, code, pre")) return;

  const attrs = ["placeholder", "title", "aria-label", "alt"];
  let originals = attrOriginals.get(element);
  if (!originals) {
    originals = new Map<string, string>();
    attrOriginals.set(element, originals);
  }

  for (const attr of attrs) {
    const current = element.getAttribute(attr);
    if (!current) continue;

    const stored = originals.get(attr);
    const translatedStored = stored ? translateValue(stored) : "";
    const source = stored && (current === stored || current === translatedStored) ? stored : current;
    originals.set(attr, source);

    const next = language === "en" ? translateValue(source) : source;
    if (current !== next) {
      element.setAttribute(attr, next);
    }
  }
}

function translateTree(root: Node, language: LanguageCode) {
  if (typeof document === "undefined") return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return;

  const element = root as Element;
  if (element.closest?.("[data-no-translate]")) return;
  translateAttributes(element, language);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, language);
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      translateAttributes(current as Element, language);
    }
    current = walker.nextNode();
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    const restoreLanguage = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        setLanguageState(stored === "id" || stored === "en" ? stored : "en");
      } catch {
        setLanguageState("en");
      }
    }, 0);

    return () => window.clearTimeout(restoreLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {}

    translateTree(document.body, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTree(mutation.target, language);
        }
        if (mutation.type === "attributes") {
          translateTree(mutation.target, language);
        }
        mutation.addedNodes.forEach((node) => translateTree(node, language));
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });

    return () => observer.disconnect();
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      toggleLanguage: () => setLanguageState((current) => (current === "en" ? "id" : "en")),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

export function LanguageToggle({ floating = false }: { floating?: boolean }) {
  const { language, toggleLanguage } = useLanguage();
  const label = language === "en" ? "ENG" : "ID";

  return (
    <button
      type="button"
      className={`${styles.toggle} ${floating ? styles.floating : ""}`}
      onClick={toggleLanguage}
      aria-label="Change language"
      data-no-translate
    >
      <FiGlobe className={styles.toggleIcon} />
      <span>{label}</span>
    </button>
  );
}

export function FloatingLanguageToggle() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div data-no-translate>
      <LanguageToggle floating />
    </div>
  );
}
