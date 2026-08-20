"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import WaitLoading from "@/components/ui/WaitLoading";
import {
  FiArrowDownLeft,
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiClipboard,
  FiCopy,
  FiCreditCard,
  FiEye,
  FiEyeOff,
  FiKey,
  FiLogOut,
  FiHome,
  FiMenu,
  FiRefreshCw,
  FiShoppingCart,
  FiUser,
  FiX,
} from "react-icons/fi";
// @ts-expect-error - qrcode.react doesn't ship complete React 19 types in this project.
import QRCode from "qrcode.react";
import styles from "./PayGatePanel.module.css";

type PayGateAccount = {
  id: string;
  userId: string;
  username: string;
  email: string;
  createdAt?: number;
  updatedAt?: number;
};

type PayGateApiKey = {
  id: string;
  key?: string;
  maskedKey: string;
  requestCount: number;
  lastUsed: number | null;
};

type PayGateTransaction = {
  id: string;
  type: string;
  amount: number;
  status: string;
  depositId?: string | null;
  createdAt: number;
  updatedAt?: number | null;
  raw?: Record<string, unknown> | null;
};

type DepositQr = {
  depositId: string;
  qrString: string;
  amount: number;
  totalAmount: number;
  uniqueCode: number;
  expiredAt?: string;
  message?: string;
  expiresAt?: number;
};

type ModalView = "menu" | "deposit" | "topup" | "apiKey" | "qris" | "logout" | null;
type PayGateAuthMode = "register" | "login";
type TransactionFilter = "all" | "deposit" | "withdrawal";
type PayGateRouteMode = "entry" | PayGateAuthMode | "dashboard";

const depositPresets = [10000, 25000, 50000, 100000];
const topupServices = [
  { id: "pulsa", label: "Pulsa", desc: "Semua operator", icon: "phone" },
  { id: "data", label: "Paket Data", desc: "Internet murah", icon: "signal" },
  { id: "wallet", label: "E-Wallet", desc: "DANA, GoPay, OVO", icon: "wallet" },
];
const walletOptions = ["Astrapay", "DANA", "GoPay", "OVO", "ShopeePay"];

function formatRupiah(value: number | null | undefined) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;
}
function formatDate(value: number | string | null | undefined) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "paid" || normalized === "already") return "Berhasil";
  if (normalized === "failed" || normalized === "expired") return "Gagal";
  return "Pending";
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/playwright|browsers\.json|external module|cannot find module|require stack|browserType\.launch|executable doesn'?t exist/i.test(message)) {
    return "Ups, PayGate sedang mengalami gangguan server. Coba lagi sebentar atau konfirmasi ke admin.";
  }
  if (/network|fetch failed|failed to fetch|timeout|timed out|503|500/i.test(message)) {
    return "Ups, PayGate sedang mengalami gangguan server. Coba lagi sebentar.";
  }
  return message || "Ups, terjadi gangguan. Coba lagi sebentar.";
}

function getPayGateLoginError(error: unknown) {
  const message = getErrorMessage(error);
  if (/invalid|incorrect|wrong|salah|tidak ditemukan|not found|unauthor/i.test(message)) {
    return "Belum bisa masuk. Coba cek lagi email dan password kamu, atau pastikan akun PayGate-nya sudah terdaftar.";
  }
  return "Belum bisa masuk. Coba lagi sebentar atau konfirmasi ke admin PayGate.";
}

function ButtonLoading() {
  return <span className={styles.buttonSpinner} aria-label="Loading" role="status" />;
}

export default function PayGatePanel({ routeMode = "entry" }: { routeMode?: PayGateRouteMode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? "";
  const loadSeqRef = useRef(0);
  const [account, setAccount] = useState<PayGateAccount | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [apiKeys, setApiKeys] = useState<PayGateApiKey[]>([]);
  const [transactions, setTransactions] = useState<PayGateTransaction[]>([]);
  const [loading, setLoading] = useState(routeMode !== "entry");
  const [syncing, setSyncing] = useState(false);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [checkingDeposit, setCheckingDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(10000);
  const [depositQr, setDepositQr] = useState<DepositQr | null>(null);
  const [qrTimeLeft, setQrTimeLeft] = useState(0);
  const [modal, setModal] = useState<ModalView>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPaygatePassword, setShowPaygatePassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [topupAmount, setTopupAmount] = useState(10000);
  const [paygateAuthMode, setPaygateAuthMode] = useState<PayGateAuthMode>(
    routeMode === "register" ? "register" : "login",
  );
  const [paygateUsername, setPaygateUsername] = useState("");
  const [paygateEmail, setPaygateEmail] = useState("");
  const [paygatePassword, setPaygatePassword] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");

  const primaryApiKey = apiKeys[0] ?? null;
  const visibleApiKey = showApiKey ? primaryApiKey?.key || primaryApiKey?.maskedKey : primaryApiKey?.maskedKey;
  const recentDepositsTotal = useMemo(
    () =>
      transactions
        .filter((item) => item.type.toLowerCase().includes("deposit") && ["success", "paid", "already"].includes(item.status.toLowerCase()))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [transactions],
  );
  const recentWithdrawalsTotal = useMemo(
    () =>
      transactions
        .filter((item) => item.type.toLowerCase().includes("withdraw"))
        .reduce((total, item) => total + Number(item.amount || 0), 0),
    [transactions],
  );
  const filteredTransactions = useMemo(() => {
    if (transactionFilter === "all") return transactions;
    return transactions.filter((item) => item.type.toLowerCase().includes(transactionFilter));
  }, [transactionFilter, transactions]);

  function getTransactionQr(transaction: PayGateTransaction): DepositQr | null {
    const data = transaction.raw?.data && typeof transaction.raw.data === "object"
      ? transaction.raw.data as Record<string, unknown>
      : transaction.raw;
    const qrString = data?.qrString || data?.qr_string;
    if (!transaction.depositId || typeof qrString !== "string" || !qrString) return null;
    const expiresAtValue = data?.expiredAt || data?.expired_at;
    const expiresAt = expiresAtValue
      ? new Date(String(expiresAtValue)).getTime()
      : transaction.createdAt + 5 * 60 * 1000;
    if (!Number.isFinite(expiresAt)) return null;
    return {
      depositId: transaction.depositId,
      qrString,
      amount: Number(data?.amount ?? transaction.amount),
      totalAmount: Number(data?.totalAmount ?? data?.total_amount ?? transaction.amount),
      uniqueCode: Number(data?.uniqueCode ?? data?.unique_code ?? 0),
      expiredAt: new Date(expiresAt).toISOString(),
      expiresAt,
    };
  }

  const payGateSessionKey = sessionUserId ? `tokko_paygate_session:${sessionUserId}` : "";

  const loadPayGate = useCallback(async () => {
    const loadSeq = ++loadSeqRef.current;
    setError("");
    if (!sessionUserId) {
      router.replace("/auth?redirect=/paygate");
      return;
    }
    try {
      const [accountResponse, keyResponse, transactionResponse] = await Promise.all([
        fetch("/api/paygate/account?balance=1", { cache: "no-store" }),
        fetch("/api/paygate/api-keys", { cache: "no-store" }),
        fetch("/api/paygate/transactions?limit=30", { cache: "no-store" }),
      ]);

      if (accountResponse.status === 401) {
        window.location.href = "/auth?redirect=/paygate";
        return;
      }

      const accountJson = await accountResponse.json();
      const keyJson = await keyResponse.json().catch(() => ({ apiKeys: [] }));
      const transactionJson = await transactionResponse.json().catch(() => ({ transactions: [] }));

      if (!accountResponse.ok || !accountJson.ok) {
        throw new Error(accountJson.reason || accountJson.error || "Data PayGate belum bisa dimuat. Coba refresh lagi ya.");
      }

      if (loadSeq !== loadSeqRef.current) return;
      setAccount(accountJson.account ?? {
        id: sessionUserId,
        userId: sessionUserId,
        username: session?.user?.name || session?.user?.email || "Akun Tokko",
        email: session?.user?.email || "",
      });
      setBalance(typeof accountJson.balance === "number" ? accountJson.balance : null);
      setApiKeys(keyJson.ok ? keyJson.apiKeys ?? [] : []);
      setTransactions(transactionJson.ok ? transactionJson.transactions?.items ?? transactionJson.transactions ?? [] : []);
    } catch (loadError) {
      if (loadSeq !== loadSeqRef.current) return;
      setError(getErrorMessage(loadError));
    } finally {
      if (loadSeq !== loadSeqRef.current) return;
      setLoading(false);
    }
  }, [router, session, sessionUserId]);

  useEffect(() => {
    if (routeMode === "entry") {
      return;
    }

    loadSeqRef.current += 1;
    queueMicrotask(() => {
      setAccount(null);
      setBalance(null);
      setApiKeys([]);
      setTransactions([]);
      setDepositQr(null);
      setModal(null);
      setShowApiKey(false);
      setShowPaygatePassword(false);
      setCopied(false);
      setNotice("");
      setError("");
      setPaygatePassword("");
      setTransactionFilter("all");
      setLoading(true);
      void loadPayGate();
    });
  }, [loadPayGate, routeMode, sessionUserId]);

  useEffect(() => {
    if (!depositQr?.expiresAt) return;
    const update = () => setQrTimeLeft(Math.max(0, depositQr.expiresAt! - Date.now()));
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [depositQr]);

  async function handleSetupPayGate() {
    if (paygateAuthMode === "register" && !paygateUsername.trim()) {
      setError("Username PayGate-nya diisi dulu ya.");
      return;
    }
    if (!paygateEmail.trim()) {
      setError("Email PayGate-nya diisi dulu ya.");
      return;
    }
    if (!paygatePassword) {
      setError("Password PayGate-nya diisi dulu ya.");
      return;
    }

    setSyncing(true);
    setError("");
    setNotice(paygateAuthMode === "register" ? "Sebentar ya, lagi bikin akun PayGate kamu..." : "Sebentar ya, lagi masuk ke PayGate...");

    try {
      const response = await fetch("/api/integrations/ramashop/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: paygateAuthMode,
          username: paygateUsername,
          email: paygateEmail,
          password: paygatePassword,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        if (
          paygateAuthMode === "register" &&
          response.status === 429
        ) {
          setPaygateAuthMode("login");
          router.replace("/paygate/login");
          setError("");
          setNotice("Registrasinya sedang dibatasi. Kita pindah ke Login dulu ya, coba pakai email dan password yang sama.");
          return;
        }
        throw new Error(
          result.error ||
            (paygateAuthMode === "login"
              ? "Belum bisa masuk. Coba cek lagi email dan password kamu, ya."
              : "Akun PayGate belum berhasil dibuat. Coba lagi ya."),
        );
      }

      setNotice("Berhasil masuk! Tunggu sebentar ya, lagi nyiapin PayGate kamu...");
      window.localStorage.setItem(payGateSessionKey, "active");
      setPaygatePassword("");
      router.replace("/paygate/dashboard");
    } catch (setupError) {
      setNotice("");
      setError(paygateAuthMode === "login" ? getPayGateLoginError(setupError) : getErrorMessage(setupError));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingDeposit(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/integrations/ramashop/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: depositAmount }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Depositnya belum berhasil dibuat. Coba lagi ya.");
      }

      const data = result.data ?? result.result?.data?.data ?? result.result?.data ?? {};
      const qrString = data.qrString || data.qr_string;
      const depositId = data.depositId;

      if (!depositId || !qrString) {
        throw new Error("QRIS-nya belum siap. Coba buat deposit lagi ya.");
      }

      setDepositQr({
        depositId,
        qrString,
        amount: Number(data.amount ?? depositAmount),
        totalAmount: Number(data.totalAmount ?? data.amount ?? depositAmount),
        uniqueCode: Number(data.uniqueCode ?? 0),
        expiredAt: data.expiredAt,
        message: result.message ?? result.result?.data?.message,
        expiresAt: data.expiredAt ? new Date(data.expiredAt).getTime() : Date.now() + 5 * 60 * 1000,
      });
      setQrTimeLeft(data.expiredAt ? Math.max(0, new Date(data.expiredAt).getTime() - Date.now()) : 5 * 60 * 1000);
      setModal("qris");
      await loadPayGate();
    } catch (depositError) {
      setError(getErrorMessage(depositError));
    } finally {
      setSubmittingDeposit(false);
    }
  }

  async function handleCheckDeposit() {
    if (!depositQr) return;
    setCheckingDeposit(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/integrations/ramashop/deposit/status/${depositQr.depositId}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Status depositnya belum bisa dicek. Coba lagi ya.");
      }

      const status = result.data?.status ?? result.result?.data?.data?.status ?? result.result?.data?.status;
      if (status === "success" || status === "already") {
        setNotice("Depositnya sudah masuk! Saldo kamu ikut diperbarui ya.");
        setModal(null);
        await loadPayGate();
      } else {
        setNotice("Pembayarannya belum masuk. Tunggu sebentar, lalu cek lagi ya.");
      }
    } catch (checkError) {
      setError(getErrorMessage(checkError));
    } finally {
      setCheckingDeposit(false);
    }
  }

  async function copyApiKey() {
    if (!primaryApiKey?.key) return;
    await navigator.clipboard.writeText(primaryApiKey.key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function openModal(nextModal: ModalView) {
    setError("");
    setNotice("");
    setModal(nextModal);
  }

  function formatQrTime(value: number) {
    const totalSeconds = Math.ceil(value / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }

  function switchAuthMode(nextMode: PayGateAuthMode) {
    setPaygateAuthMode(nextMode);
    setError("");
    setNotice("");
    router.replace(`/paygate/${nextMode}`);
  }

  async function handleLogout() {
    loadSeqRef.current += 1;
    setAccount(null);
    setBalance(null);
    setApiKeys([]);
    setTransactions([]);
    setDepositQr(null);
    setModal(null);
    setShowApiKey(false);
    setShowPaygatePassword(false);
    setPaygatePassword("");
    setPaygateAuthMode("login");
    if (payGateSessionKey) window.localStorage.removeItem(payGateSessionKey);
    await signOut({ callbackUrl: "/auth" });
    setError("");
  }

  function goHome() {
    router.push("/");
  }

  if (routeMode === "entry") {
    return (
      <main className={styles.entryPage} aria-labelledby="paygate-title">
        <section className={styles.entryContent}>
          <div className={styles.entryIcon} aria-hidden="true">
            <Image
              src="/assets/maintenancelogo.jpg"
              alt="Tokko"
              width={112}
              height={112}
              className={styles.entryLogo}
              priority
            />
          </div>
          <h1 id="paygate-title">PayGate</h1>
          <p>Hi Tokkers! Layanan PayGate ( Payment Gateaway ) segera hadir...</p>
          <button type="button" className={styles.entryButton} onClick={goHome}>
            <FiArrowLeft />
            Kembali
          </button>
        </section>
      </main>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <motion.main
      className={`${styles.page} ${routeMode === "login" || routeMode === "register" ? styles.authPage : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <aside className={styles.sidebar} aria-label="Navigasi PayGate">
        <div className={styles.brandMark}>P<span>G</span></div>
        <button type="button" className={styles.sidebarItemActive} aria-label="QRIS Saya" title="QRIS Saya"><FiCreditCard /></button>
        <button type="button" className={styles.sidebarItem} onClick={() => openModal("apiKey")} aria-label="API Keys" title="API Keys"><FiKey /></button>
        <button type="button" className={styles.sidebarItem} onClick={() => router.push("/paygate/DokumentasiApi")} aria-label="Dokumentasi API" title="Dokumentasi API"><FiBookOpen /></button>
        <button type="button" className={styles.sidebarItem} onClick={() => openModal("menu")} aria-label="Menu" title="Menu"><FiMenu /></button>
        <div className={styles.sidebarSpacer} />
        <button type="button" className={styles.sidebarItem} onClick={goHome} aria-label="Beranda" title="Beranda"><FiHome /></button>
        <button type="button" className={styles.sidebarItem} onClick={() => openModal("logout")} aria-label="Keluar" title="Keluar"><FiLogOut /></button>
      </aside>
      {routeMode !== "login" && routeMode !== "register" ? (
        <motion.header className={styles.topbar} initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className={styles.identity}>
            <div className={styles.avatar} aria-hidden="true">
              <FiUser />
            </div>
            <div>
              <span>{account ? "PayGate" : "Akun Tokko"}</span>
              <strong>{account?.username || "PayGate belum terhubung"}</strong>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <motion.button type="button" className={styles.actionButton} onClick={goHome} whileHover={hoverLift} whileTap={tapPress}>
              <FiHome /> <span>Home</span>
            </motion.button>
            <motion.button type="button" className={styles.actionButton} onClick={() => openModal("logout")} whileHover={hoverLift} whileTap={tapPress}>
              <FiLogOut /> <span>Logout</span>
            </motion.button>
            <motion.button type="button" className={styles.iconButton} onClick={() => openModal("menu")} aria-label="Buka menu" whileHover={hoverLift} whileTap={tapPress}>
              <FiMenu />
            </motion.button>
          </div>
        </motion.header>
      ) : null}

      <AnimatePresence>
        {error ? <motion.p key="paygate-error" className={styles.errorText} role="alert" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>{error}</motion.p> : null}
        {notice ? <motion.p key="paygate-notice" className={styles.noticeText} role="status" aria-live="polite" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>{notice}</motion.p> : null}
      </AnimatePresence>

      {false ? (
        <motion.section className={`${styles.setupPanel} ${styles.authPanel}`} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className={styles.authBanner} aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <span key={`paygate-logo-${index}`}><Image src="/assets/logo.png" alt="" width={22} height={22} /></span>
            ))}
          </div>
          <h1>{paygateAuthMode === "register" ? "Register PayGate" : "Login PayGate"}</h1>
          <p className={styles.authDescription}>{paygateAuthMode === "register" ? "Buat akun PayGate untuk mendapatkan API key." : "Masuk dengan akun PayGate kamu."}</p>
          <div className={styles.authTabs} role="tablist" aria-label="Mode akses PayGate">
            <button
              type="button"
              className={paygateAuthMode === "register" ? styles.authTabActive : ""}
              onClick={() => {
                switchAuthMode("register");
              }}
            >
              Register
            </button>
            <button
              type="button"
              className={paygateAuthMode === "login" ? styles.authTabActive : ""}
              onClick={() => {
                switchAuthMode("login");
              }}
            >
              Login
            </button>
          </div>
          <form
            className={styles.setupForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSetupPayGate();
            }}
          >
            {paygateAuthMode === "register" ? (
              <label>
                <span>Username PayGate</span>
                <input
                  id="paygate-username"
                  name="username"
                  type="text"
                  value={paygateUsername}
                  onChange={(event) => setPaygateUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="Username PayGate"
                  disabled={syncing}
                />
              </label>
            ) : null}
            <label>
              <span>Email PayGate</span>
              <input
                id="paygate-email"
                name="email"
                type="email"
                value={paygateEmail}
                onChange={(event) => setPaygateEmail(event.target.value)}
                autoComplete="email"
                placeholder="Email PayGate"
                disabled={syncing}
              />
            </label>
            <label>
              <span>Password PayGate</span>
              <div className={styles.passwordField}>
                <input
                  id="paygate-password"
                  name="password"
                  type={showPaygatePassword ? "text" : "password"}
                  value={paygatePassword}
                  onChange={(event) => setPaygatePassword(event.target.value)}
                  autoComplete={paygateAuthMode === "register" ? "new-password" : "current-password"}
                  placeholder="Password PayGate"
                  disabled={syncing}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPaygatePassword((current) => !current)}
                  aria-label={showPaygatePassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPaygatePassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </label>
            <p className={styles.authHelper}>
              PayGate bermasalah? Konfirmasi ke{" "}
              <a href="https://wa.me/6285121579597?text=Halo%20min%20PayGate%20kayaknya%20bermasalah.." target="_blank" rel="noreferrer">admin</a>
            </p>
            <button type="submit" className={styles.primaryButton} disabled={syncing}>
              {syncing ? (
                <>
                  <ButtonLoading />
                  <span>{paygateAuthMode === "register" ? "Lagi bikin akun..." : "Lagi masuk..."}</span>
                </>
              ) : (
                <>
                  <FiKey /> {paygateAuthMode === "register" ? "Register dan Generate API Key" : "Login dan Generate API Key"}
                </>
              )}
            </button>
          </form>
          <button type="button" className={styles.authBackButton} onClick={goHome}>Balik ke Beranda</button>
        </motion.section>
      ) : (
        <>
          <motion.section className={styles.statsGrid} initial="hidden" animate="show" variants={staggerVariants}>
            <motion.article className={styles.statCard} variants={rowVariants} whileHover={cardHover}>
              <span>
                <FiCreditCard /> Saldo
              </span>
              <strong>{balance === null ? "-" : formatRupiah(balance)}</strong>
            </motion.article>
            <motion.article className={styles.statCard} variants={rowVariants} whileHover={cardHover}>
              <span>
                <FiArrowDownLeft /> Total Deposit
              </span>
              <strong>{formatRupiah(recentDepositsTotal)}</strong>
            </motion.article>
            <motion.article className={styles.statCard} variants={rowVariants} whileHover={cardHover}>
              <span>
                <FiRefreshCw /> Total Tarik
              </span>
              <strong>{formatRupiah(recentWithdrawalsTotal)}</strong>
            </motion.article>
          </motion.section>

          <motion.section className={styles.actionGrid} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <motion.button type="button" className={styles.depositButton} onClick={() => openModal("deposit")} whileHover={cardHover} whileTap={tapPress}>
              <FiCreditCard />
              <span>Deposit</span>
            </motion.button>
            <motion.button type="button" className={styles.topupButton} onClick={() => openModal("topup")} whileHover={cardHover} whileTap={tapPress}>
              <FiShoppingCart />
              <span>TopUp / Tarik</span>
            </motion.button>
          </motion.section>

          <motion.section className={styles.historyPanel} initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}>
            <div className={styles.sectionHeader}>
              <h2>Riwayat Transaksi</h2>
              <div className={styles.historyTools}>
                <select value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value as TransactionFilter)} aria-label="Filter transaksi">
                  <option value="all">Semua</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Penarikan</option>
                </select>
                <motion.button type="button" className={styles.refreshButton} onClick={loadPayGate} aria-label="Refresh data" whileHover={{ rotate: 90, scale: 1.06 }} whileTap={tapPress}><FiRefreshCw /></motion.button>
              </div>
            </div>
            {filteredTransactions.length > 0 ? (
              <motion.div className={styles.transactionList} initial="hidden" animate="show" variants={staggerVariants}>
                {filteredTransactions.map((transaction) => (
                  <motion.article key={transaction.id} className={styles.transactionItem} variants={rowVariants}>
                    <div>
                      <strong>{transaction.type || "Transaksi"}</strong>
                      <span>{transaction.depositId || transaction.id}</span>
                    </div>
                    <div className={styles.transactionMeta}>
                      <strong>{formatRupiah(transaction.amount)}</strong>
                      <span className={styles[`status${statusLabel(transaction.status)}`]}>
                        {statusLabel(transaction.status)}
                      </span>
                      <small>{formatDate(transaction.createdAt)}</small>
                      {getTransactionQr(transaction) ? (
                        <button
                          type="button"
                          className={styles.qrHistoryButton}
                          onClick={() => {
                            const qr = getTransactionQr(transaction);
                            setDepositQr(qr);
                            setQrTimeLeft(qr?.expiresAt ? Math.max(0, qr.expiresAt - Date.now()) : 0);
                            setModal("qris");
                          }}
                        >
                          <FiCreditCard /> Lihat QRIS
                        </button>
                      ) : null}
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            ) : (
              <div className={styles.emptyState}>
                <FiClipboard />
                <span>Belum ada transaksi.</span>
              </div>
            )}
          </motion.section>
        </>
      )}

      {modal ? (
        <motion.div className={styles.overlay} onMouseDown={() => setModal(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section className={`${styles.modal} ${modal === "menu" ? styles.menuModal : ""}`} onMouseDown={(event) => event.stopPropagation()} initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }}>
            <motion.button type="button" className={styles.closeButton} onClick={() => setModal(null)} aria-label="Tutup" whileHover={hoverLift} whileTap={tapPress}>
              <FiX />
            </motion.button>

            {modal === "menu" ? (
              <>
                <header className={styles.modalHero}>
                  <h2>Menu</h2>
                </header>
                <div className={styles.menuGroup}>
                  <span>Transaksi</span>
                  <button type="button" className={styles.menuItem} onClick={() => openModal("deposit")}>
                    <FiCreditCard />
                    <span>
                      <strong>Deposit</strong>
                      <small>Isi saldo via QRIS</small>
                    </span>
                  </button>
                  <button type="button" className={styles.menuItem} onClick={() => openModal("topup")}>
                    <FiShoppingCart />
                    <span>
                      <strong>TopUp</strong>
                      <small>Pulsa, paket data, e-money</small>
                    </span>
                  </button>
                </div>
                <div className={styles.menuGroup}>
                  <span>Developer</span>
                  <button type="button" className={styles.menuItem} onClick={() => openModal("apiKey")}>
                    <FiKey />
                    <span>
                      <strong>API Key</strong>
                      <small>Manage your API key</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setModal(null);
                      router.push("/paygate/DokumentasiApi");
                    }}
                  >
                    <FiBookOpen />
                    <span>
                      <strong>API Documentation</strong>
                      <small>Integration guide</small>
                    </span>
                  </button>
                </div>
              </>
            ) : null}

            {modal === "logout" ? (
              <>
                <h2>Keluar dari akun?</h2>
                <p className={styles.logoutMessage}>
                  Kamu akan keluar dari PayGate dan akun Tokko sekaligus.
                </p>
                <div className={styles.logoutActions}>
                  <button type="button" className={styles.secondaryButton} onClick={goHome}>
                    Balik ke Beranda
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={() => void handleLogout()}>
                    Ya, keluar
                  </button>
                </div>
              </>
            ) : null}

            {modal === "deposit" ? (
              <>
                <h2>Deposit Saldo</h2>
                <form className={styles.form} onSubmit={handleDeposit}>
                  <label>
                    Nominal
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(Number(event.target.value))}
                    />
                  </label>
                  <div className={styles.presetGrid}>
                    {depositPresets.map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        className={depositAmount === preset ? styles.presetActive : ""}
                        onClick={() => setDepositAmount(preset)}
                      >
                        {formatRupiah(preset)}
                      </button>
                    ))}
                  </div>
                  <button type="submit" className={styles.primaryButton} disabled={submittingDeposit}>
                    {submittingDeposit ? (
                      <ButtonLoading />
                    ) : (
                      <>
                        <FiArrowRight /> Lanjutkan
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : null}

            {modal === "qris" && depositQr ? (
              <>
                <h2>QRIS Deposit</h2>
                <div className={styles.qrBox}>
                  <QRCode value={depositQr.qrString} size={240} level="H" includeMargin />
                </div>
                <div className={styles.qrMeta}>
                  <span>Total Bayar</span>
                  <strong>{formatRupiah(depositQr.totalAmount)}</strong>
                  <small>{depositQr.message || `Deposit ID ${depositQr.depositId}`}</small>
                  <small className={qrTimeLeft > 0 ? styles.qrTimer : styles.qrExpired}>
                    {qrTimeLeft > 0 ? `Berlaku ${formatQrTime(qrTimeLeft)}` : "QRIS sudah kedaluwarsa"}
                  </small>
                </div>
                <motion.button type="button" className={styles.primaryButton} onClick={handleCheckDeposit} disabled={checkingDeposit || qrTimeLeft === 0} whileHover={hoverLift} whileTap={tapPress}>
                  {checkingDeposit ? (
                    <ButtonLoading />
                  ) : (
                    <>
                      <FiCheckCircle /> Cek Transaksi
                    </>
                  )}
                </motion.button>
              </>
            ) : null}

            {modal === "apiKey" ? (
              <>
                <h2>API Key</h2>
                <div className={styles.apiKeyBox}>
                  <label>Gateway Key:</label>
                  <div className={styles.apiValue}>
                    <code>{visibleApiKey || "Belum ada API key"}</code>
                    <button type="button" onClick={() => setShowApiKey((value) => !value)} aria-label="Toggle API key">
                      {showApiKey ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  <div className={styles.apiStats}>
                    <span>
                      <small>Request Count</small>
                      <strong>{primaryApiKey?.requestCount ?? 0}</strong>
                    </span>
                    <span>
                      <small>Last Used</small>
                      <strong>{formatDate(primaryApiKey?.lastUsed)}</strong>
                    </span>
                  </div>
                </div>
                <button type="button" className={styles.copyButton} onClick={copyApiKey} disabled={!primaryApiKey?.key}>
                  <FiCopy /> {copied ? "Tersalin" : "API Key Server-side"}
                </button>
              </>
            ) : null}

            {modal === "topup" ? (
              <>
                <h2>Pilih Layanan TopUp</h2>
                <div className={styles.serviceGrid}>
                  {topupServices.map((service) => (
                    <button type="button" key={service.id}>
                      <span>{service.icon === "wallet" ? "Rp" : service.icon === "signal" ? "4G" : "HP"}</span>
                      <strong>{service.label}</strong>
                      <small>{service.desc}</small>
                    </button>
                  ))}
                </div>
                <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
                  <label>
                    Nomor HP
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Contoh: 081234567890"
                    />
                  </label>
                  <label>
                    Nominal
                    <input
                      type="number"
                      min={10000}
                      step={1000}
                      value={topupAmount}
                      onChange={(event) => setTopupAmount(Number(event.target.value))}
                    />
                  </label>
                </form>
                <div className={styles.walletList}>
                  {walletOptions.map((wallet) => (
                    <button type="button" key={wallet}>
                      <span>{wallet}</span>
                      <FiArrowRight />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </motion.section>
        </motion.div>
      ) : null}
    </motion.main>
  );
}

const rowVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const staggerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const hoverLift = { y: -3, scale: 1.015, transition: { duration: 0.2, ease: "easeOut" } } as const;
const cardHover = { y: -5, transition: { duration: 0.24, ease: "easeOut" } } as const;
const tapPress = { scale: 0.97, transition: { duration: 0.12 } } as const;

function LoadingScreen() {
  return (
    <main className={styles.loadingPage}>
      <WaitLoading centered text="Pastikan Internet kamu Stabil..." />
    </main>
  );
}

export {};
