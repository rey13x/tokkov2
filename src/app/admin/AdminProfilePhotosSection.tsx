"use client";

import React, { useState, useEffect, useCallback } from "react";
import WaitLoading from "@/components/ui/WaitLoading";
import { withSobat } from "@/lib/user-message";
import { getImageUploadError, DEFAULT_IMAGE_MAX_SIZE_BYTES } from "@/lib/upload-constraints";
import { prepareImageForUpload } from "@/lib/image-upload";
import styles from "./AdminProfilePhotosSection.module.css";

interface ProfilePhoto {
  id: string;
  url: string;
  createdAt: string;
}

export function AdminProfilePhotosSection() {
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [message, setRawMessage] = useState("");
  const [error, setRawError] = useState("");
  const setMessage = (value: unknown) => setRawMessage(withSobat(value));
  const setError = (value: unknown) => setRawError(withSobat(value));
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchPhotos = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const response = await fetch("/api/admin/profile-photos");
      const data = await response.json().catch(() => null) as {
        photos?: ProfilePhoto[];
        message?: string;
      } | null;

      if (!response.ok) {
        const errorMessage = response.status === 401
          ? "Sesi admin telah berakhir. Silakan masuk kembali."
          : response.status === 403
            ? "Akun ini tidak memiliki izin untuk mengelola foto profil."
            : data?.message || "Gagal mengambil foto profil.";
        throw new Error(errorMessage);
      }

      setPhotos(data?.photos || []);
    } catch (err) {
      setError(err instanceof TypeError
        ? "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi."
        : err instanceof Error
          ? err.message
          : "Gagal mengambil foto profil.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch photos on mount
  useEffect(() => {
    void Promise.resolve().then(() => fetchPhotos(false));
  }, [fetchPhotos]);

  const handleAddPhotoByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPhotoUrl.trim()) {
      setError("URL foto tidak boleh kosong");
      return;
    }

    try {
      setIsAdding(true);
      const response = await fetch("/api/admin/profile-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newPhotoUrl.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Gagal menambahkan foto");
      }

      const data = await response.json();
      setPhotos([data.photo, ...photos]);
      setNewPhotoUrl("");
      setMessage("Foto profil berhasil ditambahkan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan foto");
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddPhotoByFile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError("Pilih file foto terlebih dahulu");
      return;
    }

    const validationError = getImageUploadError(selectedFile, DEFAULT_IMAGE_MAX_SIZE_BYTES);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    try {
      setIsAdding(true);
      const formData = new FormData();
      formData.append("file", await prepareImageForUpload(selectedFile));

      const response = await fetch("/api/admin/profile-photos", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Gagal upload foto");
      }

      const data = await response.json();
      setPhotos([data.photo, ...photos]);
      setSelectedFile(null);
      setMessage("Foto profil berhasil diupload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload foto");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (!confirm("Yakin hapus foto profil ini?")) return;

    try {
      setIsDeletingId(id);
      const response = await fetch("/api/admin/profile-photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Gagal menghapus foto");
      }

      setPhotos(photos.filter((p) => p.id !== id));
      setMessage("Foto profil berhasil dihapus");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus foto");
    } finally {
      setIsDeletingId(null);
    }
  };

  if (isLoading) {
    return <WaitLoading centered text="Tunggu ya Sobat, pastiin internet Sobat ada.." />;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Kelola Foto Profil</h2>

      {message && <div className={styles.success}>{message}</div>}
      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void fetchPhotos()}>
            Coba lagi
          </button>
        </div>
      )}

      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tab} ${uploadMode === "url" ? styles.tabActive : ""}`}
          onClick={() => setUploadMode("url")}
        >
          URL Foto
        </button>
        <button
          className={`${styles.tab} ${uploadMode === "file" ? styles.tabActive : ""}`}
          onClick={() => setUploadMode("file")}
        >
          Upload File
        </button>
      </div>

      {uploadMode === "url" ? (
        <form onSubmit={handleAddPhotoByUrl} className={styles.form}>
          <div className={styles.field}>
            <label>URL Foto Baru</label>
            <div className={styles.inputGroup}>
              <input
                type="url"
                placeholder="https://..."
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                required
                disabled={isAdding}
              />
              <button type="submit" disabled={isAdding}>
                {isAdding ? "Menambahkan..." : "Tambah Foto"}
              </button>
            </div>
            <small className={styles.hint}>
              Upload foto disini: <a href="https://catbox.moe/" target="_blank" rel="noreferrer">https://catbox.moe/</a> lalu Copy Link dan Paste kolom diatas
            </small>
          </div>
        </form>
      ) : (
        <form onSubmit={handleAddPhotoByFile} className={styles.form}>
          <div className={styles.field}>
            <label>Upload Foto</label>
            <div className={styles.fileInputWrapper}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={isAdding}
                className={styles.fileInput}
              />
              <span className={styles.fileInputLabel}>
                {selectedFile ? selectedFile.name : "Pilih file foto..."}
              </span>
            </div>
            <button type="submit" disabled={isAdding || !selectedFile} className={styles.uploadButton}>
              {isAdding ? "Mengupload..." : "Upload Foto"}
            </button>
            <small className={styles.hint}>
              Foto dikompres otomatis sebelum disimpan. Ukuran sumber maksimal 50MB.
            </small>
          </div>
        </form>
      )}

      <div className={styles.photosSection}>
        <h3>Foto Profil yang Tersedia ({photos.length})</h3>
        
        {photos.length === 0 ? (
          <p className={styles.empty}>Belum ada foto profil. Tambahkan foto baru di atas.</p>
        ) : (
          <div className={styles.photoGrid}>
            {photos.map((photo) => (
              <div key={photo.id} className={styles.photoCard}>
                <div className={styles.photoPreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Profile photo" />
                </div>
                <div className={styles.photoInfo}>
                  <small className={styles.url}>{photo.url}</small>
                  <small className={styles.date}>
                    {new Date(photo.createdAt).toLocaleDateString("id-ID")}
                  </small>
                </div>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => handleDeletePhoto(photo.id)}
                  disabled={isDeletingId === photo.id}
                >
                  {isDeletingId === photo.id ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminProfilePhotosSection;
