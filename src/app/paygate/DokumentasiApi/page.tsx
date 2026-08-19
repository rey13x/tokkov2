import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";
import ApiCodeBlock from "./ApiCodeBlock";
import styles from "./page.module.css";

const baseUrl = "https://ramashop.my.id/api/public";

export default async function PayGateApiDocumentationPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/paygate/login");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <a className={styles.backLink} href="/paygate/dashboard">&larr; Kembali ke Dashboard</a>
            <p className={styles.eyebrow}>PAYGATE API</p>
            <h1>Dokumentasi API</h1>
            <p className={styles.lead}>
              Integrasikan deposit QRIS, saldo, dan riwayat transaksi ke aplikasi kamu dengan API PayGate.
            </p>
          </div>
          <div className={styles.heroBadge}>v1 &middot; REST API</div>
        </header>

        <section className={styles.introGrid}>
          <article><strong>Integrasi cepat</strong><span>Endpoint sederhana untuk implementasi langsung.</span></article>
          <article><strong>Aman</strong><span>Gunakan API key di setiap permintaan.</span></article>
          <article><strong>Real-time</strong><span>Cek status deposit QRIS kapan saja.</span></article>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>01 &middot; Mulai</p>
          <h2>Autentikasi</h2>
          <p>Semua permintaan API memerlukan API key dari dashboard PayGate. Jangan bagikan key atau menyimpannya di repository publik.</p>
          <ApiCodeBlock code={`X-API-Key: your_api_key_here`} language="Header" />
          <ol className={styles.steps}>
            <li>Login ke dashboard PayGate.</li>
            <li>Buka menu <strong>API Key</strong>.</li>
            <li>Generate dan simpan API key dengan aman.</li>
          </ol>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>02 &middot; Endpoint</p>
          <h2>Base URL</h2>
          <ApiCodeBlock code={baseUrl} language="URL" />

          <div className={styles.endpoint}>
            <div className={styles.endpointTitle}><span className={styles.method}>GET</span><h3> Cek saldo</h3></div>
            <p>Mengambil saldo akun saat ini.</p>
            <ApiCodeBlock code={`curl -H "X-API-Key: your_api_key_here" \\\n  ${baseUrl}/balance`} language="cURL" />
            <ApiCodeBlock code={`{
  "success": true,
  "data": {
    "balance": 50000,
    "username": "john_doe",
    "email": "john@example.com"
  }
}`} language="JSON response" />
          </div>

          <div className={styles.endpoint}>
            <div className={styles.endpointTitle}><span className={styles.methodPost}>POST</span><h3> Buat deposit QRIS</h3></div>
            <p>Buat deposit baru. Nominal minimal adalah Rp 100 dan sistem dapat menambahkan kode unik.</p>
            <ApiCodeBlock code={`fetch("${baseUrl}/deposit/create", {
  method: "POST",
  headers: {
    "X-API-Key": "YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ amount: 10000, method: "qris" })
})
  .then((response) => response.json())
  .then(console.log);`} language="JavaScript" />
            <ApiCodeBlock code={`{
  "success": true,
  "data": {
    "depositId": "DEP1234567890",
    "amount": 10000,
    "uniqueCode": 73,
    "totalAmount": 10073,
    "qrString": "00020101021126670016...",
    "status": "pending",
    "expiredAt": "2026-01-01T13:00:00.000Z"
  }
}`} language="JSON response" />
          </div>

          <div className={styles.endpoint}>
            <div className={styles.endpointTitle}><span className={styles.method}>GET</span><h3> Cek status deposit</h3></div>
            <p>Status dapat berupa <strong>pending</strong>, <strong>success</strong>, atau <strong>already</strong>.</p>
            <ApiCodeBlock code={`fetch("${baseUrl}/deposit/status/DEP1234567890", {
  headers: { "X-API-Key": "YOUR_API_KEY" }
})
  .then((response) => response.json())
  .then(console.log);`} language="JavaScript" />
          </div>

          <div className={styles.endpoint}>
            <div className={styles.endpointTitle}><span className={styles.method}>GET</span><h3> Riwayat transaksi</h3></div>
            <p>Mengambil riwayat deposit dan transaksi akun.</p>
            <ApiCodeBlock code={`curl -H "X-API-Key: your_api_key_here" \\\n  ${baseUrl}/history`} language="cURL" />
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.kicker}>03 &middot; Status</p>
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
