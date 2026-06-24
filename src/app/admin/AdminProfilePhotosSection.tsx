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
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setError(err instanceof Error ? err.message : "Failed to fetch photos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
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

      if (!response.ok) throw new Error("Failed to add photo");

      const data = await response.json();
      setPhotos([...photos, data.photo]);
      setNewPhotoUrl("");
      setMessage("Foto profil berhasil ditambahkan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add photo");
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

      if (!response.ok) throw new Error("Failed to delete photo");

      setPhotos(photos.filter((p) => p.id !== id));
      setMessage("Foto profil berhasil dihapus");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo");
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

      <form onSubmit={handleAddPhoto} className={styles.form}>
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
