"use client";

import React, { useState, useEffect } from "react";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");

  // Fetch photos on mount
  useEffect(() => {
    fetchPhotos();
  }, []);

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

  const fetchPhotos = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/profile-photos");
      if (!response.ok) throw new Error("Failed to fetch photos");
      
      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil foto profil");
    } finally {
      setIsLoading(false);
    }
  };

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

    try {
      setIsAdding(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

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
    return <div className={styles.container}>Memuat foto profil...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Kelola Foto Profil</h2>

      {message && <div className={styles.success}>{message}</div>}
      {error && <div className={styles.error}>{error}</div>}

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
              Gunakan URL foto yang sudah di-upload atau link public
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
              Format: PNG, JPG, GIF, WEBP | Ukuran maksimal: 1MB
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
