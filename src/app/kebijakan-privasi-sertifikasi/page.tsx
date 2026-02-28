import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Kebijakan Privasi & Sertifikasi Layanan | Tokko",
  description:
    "Informasi kebijakan privasi, keamanan data, serta sertifikasi dan standar layanan Tokko.",
};

export default function PrivacyCertificationPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Kebijakan Privasi & Sertifikasi Layanan</h1>
        <p className={styles.meta}>Terakhir diperbarui: 28 Februari 2026</p>

        <h2>Kebijakan Privasi</h2>
        <p>
          Tokko berkomitmen menjaga keamanan dan kerahasiaan data pelanggan. Data
          yang kami proses meliputi nama, email, nomor telepon, riwayat pesanan,
          serta data teknis yang diperlukan untuk operasional layanan.
        </p>
        <ul>
          <li>Data hanya digunakan untuk proses transaksi, dukungan, dan evaluasi layanan.</li>
          <li>Data tidak diperjualbelikan kepada pihak ketiga tanpa persetujuan pelanggan.</li>
          <li>Akses data dibatasi hanya untuk personel yang memiliki kewenangan.</li>
          <li>Retensi data mengikuti kebutuhan operasional dan kewajiban hukum yang berlaku.</li>
        </ul>

        <h2>Sertifikasi & Standar Layanan</h2>
        <p>
          Untuk menjaga kualitas, Tokko menerapkan standar operasional dan kontrol
          kualitas internal secara berkala pada setiap layanan.
        </p>
        <ul>
          <li>Kepatuhan kebijakan perlindungan data pribadi berbasis regulasi Indonesia (UU PDP).</li>
          <li>Proses verifikasi transaksi berlapis untuk meminimalkan penyalahgunaan akun.</li>
          <li>Audit kualitas layanan rutin pada performa pengiriman dan tingkat keberhasilan.</li>
          <li>Seleksi mitra panel layanan berdasarkan stabilitas sistem dan rekam jejak kualitas.</li>
        </ul>

        <h2>Hak Pelanggan</h2>
        <ul>
          <li>Meminta klarifikasi penggunaan data pribadi untuk transaksi tertentu.</li>
          <li>Meminta pembaruan data akun bila terdapat ketidaksesuaian informasi.</li>
          <li>Mengajukan pertanyaan terkait keamanan akun dan kebijakan layanan.</li>
        </ul>

        <h2>Kontak</h2>
        <p>
          Jika membutuhkan dokumen kebijakan yang lebih rinci, silakan hubungi tim
          kami melalui kanal resmi yang tersedia pada halaman utama.
        </p>
      </section>
    </main>
  );
}
