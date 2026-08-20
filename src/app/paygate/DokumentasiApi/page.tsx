import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import ApiCodeBlock from "./ApiCodeBlock";
import styles from "./page.module.css";

const baseUrl = "https://domain-kamu.com/api/payments";

export default async function PayGateApiDocumentationPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/auth?redirect=/paygate/DokumentasiApi");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <a className={styles.backLink} href="/paygate/dashboard">&larr; Kembali ke Dashboard</a>
            <p className={styles.eyebrow}>PAYGATE API</p>
            <h1>Dokumentasi API</h1>
            <p className={styles.lead}>
              Buat transaksi QRIS, pantau status pembayaran, dan hubungkan detector pembayaran ke PayGate kamu.
            </p>
          </div>
          <div className={styles.heroBadge}>v1 &middot; REST API</div>
        </header>

        <section className={styles.introGrid}>
          <article><strong>Integrasi cepat</strong><span>Endpoint sederhana untuk implementasi langsung.</span></article>
          <article><strong>Aman</strong><span>Gunakan API key di setiap permintaan.</span></article>
            <article><strong>Webhook</strong><span>Detector mengirim pembayaran berhasil secara aman.</span></article>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>01 &middot; Mulai</p>
          <h2>Konfigurasi server</h2>
          <p>PayGate internal menggunakan QRIS statis dan webhook bertanda tangan. Semua secret hanya boleh berada di server.</p>
          <ApiCodeBlock code={`PAYGATE_STATIC_QRIS=isi_string_qris_merchant
PAYGATE_WEBHOOK_SECRET=secret_panjang_acak`} language="Environment" />
          <ol className={styles.steps}>
            <li>Masukkan QRIS merchant ke environment production.</li>
            <li>Buat secret acak panjang untuk webhook.</li>
            <li>Gunakan secret yang sama hanya pada server detector.</li>
          </ol>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>02 &middot; Alur transaksi</p>
          <h2>PayGate QRIS internal</h2>
          <p>Checkout membuat order dan transaction ID lokal, menampilkan QRIS merchant, lalu menunggu event dari detector pembayaran.</p>
          <ApiCodeBlock code={`POST /api/payments/create-qr
POST /api/payments/verify
POST /api/payments/webhook/paygate`} language="Routes" />
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>03 &middot; Kode Penggunaan</p>
          <h2>Webhook pembayaran internal</h2>
          <p>
            QRIS statis ditampilkan ke pembeli. Service detector kamu mengirim event ketika mutasi pembayaran terdeteksi.
            Server memeriksa signature, mencocokkan nominal, mengubah order menjadi sukses, lalu mengirim Telegram.
          </p>
          <ApiCodeBlock code={`POST ${baseUrl}/webhook/paygate
Header: X-PayGate-Signature: HMAC_SHA256(raw_body, PAYGATE_WEBHOOK_SECRET)
Content-Type: application/json`} language="Webhook" />
          <ApiCodeBlock code={`{
  "transactionId": "PG-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "amount": 25000,
  "status": "paid",
  "paidAt": "2026-08-20T12:30:00.000Z"
}`} language="JSON payload" />
          <ApiCodeBlock code={`import crypto from "node:crypto";

const payload = {
  transactionId: "PG-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  amount: 25000,
  status: "paid",
  paidAt: new Date().toISOString()
};
const rawBody = JSON.stringify(payload);
const signature = crypto
  .createHmac("sha256", process.env.PAYGATE_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

await fetch("https://domain-kamu.com/api/payments/webhook/paygate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-PayGate-Signature": signature
  },
  body: rawBody
});`} language="Node.js detector" />
          <ol className={styles.steps}>
            <li>Pasang `PAYGATE_STATIC_QRIS` di environment server.</li>
            <li>Pasang `PAYGATE_WEBHOOK_SECRET` yang sama di server dan detector.</li>
            <li>Ambil `transactionId` dari order yang sedang menunggu pembayaran.</li>
            <li>Kirim event `paid` hanya setelah pembayaran benar-benar terdeteksi.</li>
          </ol>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>04 &middot; Status</p>
          <h2>Kode HTTP</h2>
          <div className={styles.statusGrid}>
            <span><b>200</b><small>OK &middot; Berhasil</small></span>
            <span><b>400</b><small>Bad Request</small></span>
            <span><b>401</b><small>API key tidak valid</small></span>
            <span><b>404</b><small>Resource tidak ditemukan</small></span>
            <span><b>500</b><small>Gangguan server</small></span>
          </div>
        </section>

        <footer className={styles.footer}>Jangan pernah membagikan API key. Butuh bantuan? Konfirmasi ke admin PayGate.</footer>
      </div>
    </main>
  );
}
