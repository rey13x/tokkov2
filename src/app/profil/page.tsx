"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import WaitLoading from "@/components/ui/WaitLoading";
import styles from "./page.module.css";

const PROFILE_AVATAR_STORAGE_KEY = "tokko_profile_avatar";

interface ProfilePhoto {
  id: string;
  url: string;
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const canUseEmailOtp = process.env.NEXT_PUBLIC_EMAIL_OTP_ENABLED === "true";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState("");
  const [profilePhotos, setProfilePhotos] = useState<ProfilePhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [photosError, setPhotosError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth?redirect=/profil");
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const load = async () => {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const result = (await response.json()) as {
        username: string;
        email: string;
        phone: string;
        avatarUrl?: string;
      };

      setName(result.username);
      setEmail(result.email);
      setPhone(result.phone);
      setAvatarUrl(result.avatarUrl ?? "");

      try {
        if (result.avatarUrl) {
          window.localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, result.avatarUrl);
        } else {
          window.localStorage.removeItem(PROFILE_AVATAR_STORAGE_KEY);
        }
      } catch {}
    };

    load()
      .catch(() => {})
      .finally(() => setIsProfileLoading(false));
  }, [status]);

  useEffect(() => {
    // Ensure avatarUrl is in sync with session
    if (session?.user?.image && (!avatarUrl || avatarUrl.length < session.user.image.length)) {
      setAvatarUrl(session.user.image);
      try {
        window.localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, session.user.image);
      } catch {}
    }
  }, [session?.user?.image, avatarUrl]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Load profile photos when modal opens
  useEffect(() => {
    if (!showProfileModal) {
      return;
    }

    const loadPhotos = async () => {
      try {
        setIsLoadingPhotos(true);
        setPhotosError("");
        const response = await fetch("/api/admin/profile-photos", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Gagal mengambil foto profil");
        }

        const data = (await response.json()) as { photos?: ProfilePhoto[] };
        setProfilePhotos(data.photos || []);

        if (!data.photos || data.photos.length === 0) {
          setPhotosError("Belum ada foto profil yang tersedia");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Gagal mengambil foto profil";
        setPhotosError(errorMsg);
        setProfilePhotos([]);
      } finally {
        setIsLoadingPhotos(false);
      }
    };

    loadPhotos();
  }, [showProfileModal]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,
          email,
          phone,
          oldPassword: canUseEmailOtp ? oldPassword : "",
          newPassword: canUseEmailOtp ? newPassword : "",
          otpCode: canUseEmailOtp ? otpCode : "",
        }),
      });

      const result = (await response.json()) as {
        message?: string;
        user?: {
          username: string;
          email: string;
          phone: string;
          avatarUrl?: string;
        };
      };
      if (!response.ok) {
        setError(result.message ?? "Gagal update profil.");
        return;
      }

      setMessage(result.message ?? "Profil berhasil diperbarui.");
      setOldPassword("");
      setNewPassword("");
      setOtpCode("");
      if (result.user) {
        setName(result.user.username);
        setEmail(result.user.email);
        setPhone(result.user.phone);
        setAvatarUrl(result.user.avatarUrl ?? "");
      }
      
      // Update session with new profile data (wait for it to complete)
      try {
        const updateResult = await update({
          username: result.user?.username ?? name,
          email: result.user?.email ?? email,
          phone: result.user?.phone ?? phone,
          avatarUrl: result.user?.avatarUrl ?? avatarUrl,
          image: result.user?.avatarUrl ?? avatarUrl,
        });
        if (updateResult) {
          console.log("Session updated with new profile:", updateResult);
        }
      } catch (updateError) {
        console.error("Failed to update session:", updateError);
      }
      
      // Fetch fresh user data to ensure username sync is complete
      try {
        const freshResponse = await fetch("/api/me", { 
          cache: "no-store",
          headers: { "pragma": "no-cache", "cache-control": "no-cache" }
        });
        if (freshResponse.ok) {
          const freshData = (await freshResponse.json()) as { 
            username?: string; 
            email?: string; 
            phone?: string;
            avatarUrl?: string;
          };
          if (freshData.username) {
            setName(freshData.username);
          }
          if (freshData.email) {
            setEmail(freshData.email);
          }
          if (freshData.phone) {
            setPhone(freshData.phone);
          }
          if (freshData.avatarUrl) {
            setAvatarUrl(freshData.avatarUrl);
          }
        }
      } catch (freshError) {
        console.error("Failed to fetch fresh user data:", freshError);
      }
    } catch {
      setError("Gagal update profil.");
    } finally {
      setIsSaving(false);
    }
  };

  const onRequestOtp = async () => {
    setError("");
    setMessage("");
    setIsRequestingOtp(true);
    try {
      const response = await fetch("/api/me/password-otp/request", {
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Gagal kirim OTP.");
        return;
      }
      setMessage(result.message ?? "OTP sudah dikirim.");
    } catch {
      setError("Gagal kirim OTP.");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const onLogout = async () => {
    try {
      window.localStorage.removeItem(PROFILE_AVATAR_STORAGE_KEY);
    } catch {}
    await signOut({ callbackUrl: "/" });
  };

  const onSelectProfileImage = (imageUrl: string) => {
    setSelectedProfileImage(imageUrl);
  };

  const onConfirmProfileImage = async (imageUrl?: string) => {
    const urlToSave = imageUrl || selectedProfileImage;
    
    if (!urlToSave) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingAvatar(true);

    try {
      // Call API to update avatar with selected profile photo
      const response = await fetch("/api/me/select-profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: urlToSave }),
      });

      const result = (await response.json()) as { message?: string; avatarUrl?: string };
      
      if (!response.ok || !result.avatarUrl) {
        setError(result.message ?? "Gagal memperbarui foto profil.");
        setIsUploadingAvatar(false);
        return;
      }

      // Update avatar locally
      setAvatarUrl(result.avatarUrl);

      // Store in localStorage
      try {
        window.localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, result.avatarUrl);
      } catch {}

      // Update session
      try {
        await update({ avatarUrl: result.avatarUrl, image: result.avatarUrl });
      } catch (updateErr) {
        console.error("Session update failed:", updateErr);
      }

      // Fetch fresh user data
      try {
        const freshResponse = await fetch("/api/me", {
          cache: "no-store",
          headers: { "pragma": "no-cache", "cache-control": "no-cache" }
        });
        if (freshResponse.ok) {
          const freshData = (await freshResponse.json()) as { avatarUrl?: string };
          if (freshData.avatarUrl) {
            setAvatarUrl(freshData.avatarUrl);
          }
        }
      } catch (fetchErr) {
        console.error("Failed to fetch fresh avatar data:", fetchErr);
      }

      setMessage("Foto profil berhasil diperbarui.");
      setShowProfileModal(false);
      setSelectedProfileImage("");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Gagal memperbarui foto profil.";
      setError(errorMsg);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Profil</h1>
        <Link href="/" className={styles.backLink}>
          Kembali
        </Link>
      </header>

      {status === "loading" || isProfileLoading ? <WaitLoading centered /> : null}

      {status === "authenticated" && !isProfileLoading ? (
        <section className={styles.card}>
          <aside className={styles.avatarPanel}>
            <div className={styles.avatarWrap}>
              {avatarUrl || session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl || session?.user?.image || ""} alt="Foto profil" className={styles.avatarImage} />
              ) : (
                <span className={styles.avatarFallback}>
                  {(name || session?.user?.username || session?.user?.email || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </div>
            <button
              type="button"
              className={styles.choosePhotoButton}
              onClick={() => setShowProfileModal(true)}
              disabled={isUploadingAvatar}
            >
              Pilih foto Profil
            </button>

            {session?.user?.role === "admin" ? (
              <Link
                href="/admin"
                className={styles.adminButton}
                title="Masuk ke halaman admin"
              >
                <FiArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </aside>

          <form className={styles.form} onSubmit={onSubmit}>
            <label className={styles.field}>
              Username
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                type="text"
                required
              />
            </label>

            <label className={styles.field}>
              Gmail
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>

            <label className={styles.field}>
              No Telepon
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                placeholder="08xxxxxxxxxx"
              />
            </label>

            {canUseEmailOtp ? (
              <>
                <label className={styles.field}>
                  Password Lama
                  <input
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    type="password"
                    placeholder="Isi jika ingin ganti password"
                  />
                </label>

                <label className={styles.field}>
                  Ubah Password Baru
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                    placeholder="Minimal 6 karakter"
                  />
                </label>

                {newPassword.trim().length > 0 ? (
                  <div className={styles.otpCard}>
                    <button
                      type="button"
                      className={styles.otpButton}
                      onClick={onRequestOtp}
                      disabled={isRequestingOtp}
                    >
                      {isRequestingOtp ? "Mengirim OTP..." : "Kirim OTP Verifikasi"}
                    </button>
                    <label className={styles.field}>
                      Kode OTP
                      <input
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value)}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Masukkan 6 digit OTP"
                      />
                    </label>
                  </div>
                ) : null}
              </>
            ) : (
              <p className={styles.disabledInfo}>Fitur ganti password via email OTP dimatikan.</p>
            )}

            {error ? (
              <div
                className={styles.error}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: "20px",
                    padding: "0",
                    lineHeight: "1",
                  }}
                  title="Tutup notif"
                >
                  ✕
                </button>
              </div>
            ) : null}
            {message ? (
              <div
                className={styles.success}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span>{message}</span>
                <button
                  type="button"
                  onClick={() => setMessage("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: "20px",
                    padding: "0",
                    lineHeight: "1",
                  }}
                  title="Tutup notif"
                >
                  ✕
                </button>
              </div>
            ) : null}

            <button type="submit" className={styles.submitButton} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Perbarui"}
            </button>
            <div className={styles.accountMeta}>
              <p>Login sebagai: {session?.user?.email ?? "-"}</p>
            </div>
          </form>
        </section>
      ) : null}

      {status === "authenticated" ? (
        <button type="button" className={styles.logoutButton} onClick={onLogout}>
          Logout
        </button>
      ) : null}

      {/* Profile Image Selection Modal */}
      {showProfileModal && (
        <div className={styles.modalOverlay} onClick={() => setShowProfileModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Pilih Foto Profil</h2>
            
            {isLoadingPhotos ? (
              <div className={styles.loadingText}>Memuat foto profil...</div>
            ) : photosError ? (
              <div className={styles.emptyText}>{photosError}</div>
            ) : profilePhotos.length === 0 ? (
              <div className={styles.emptyText}>Tidak ada foto profil tersedia</div>
            ) : (
              <div className={styles.profileImageGrid}>
                {profilePhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className={`${styles.profileImageOption} ${
                      selectedProfileImage === photo.url ? styles.profileImageSelected : ""
                    }`}
                    onClick={async () => {
                      setSelectedProfileImage(photo.url);
                      // Auto-save immediately when user clicks a photo
                      await onConfirmProfileImage(photo.url);
                    }}
                    disabled={isUploadingAvatar}
                    title="Pilih foto profil"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="Profile" />
                  </button>
                ))}
              </div>
            )}
            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => {
                  setShowProfileModal(false);
                  setSelectedProfileImage("");
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
