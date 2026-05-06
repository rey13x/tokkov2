"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import type { PortfolioItem } from "@/types/store";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import styles from "./AdminPortfolioSection.module.css";

type Props = {
  isFileUploadEnabled: boolean;
  onUploadMedia: (file: File, folder: string) => Promise<string>;
};

const defaultPortfolioForm = {
  title: "",
  description: "",
  imageUrl: "/assets/logo.png",
  category: "Portfolio",
  link: "",
  sortOrder: 0,
  isActive: true,
};

export function AdminPortfolioSection({ isFileUploadEnabled, onUploadMedia }: Props) {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioForm, setPortfolioForm] = useState(defaultPortfolioForm);
  const [portfolioEditId, setPortfolioEditId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPortfolioImage, setIsUploadingPortfolioImage] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load portfolio data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch("/api/admin/portfolio");
        const data = await response.json();
        setPortfolioItems(data.portfolioItems || []);
      } catch (err) {
        console.error("Failed to load portfolio data:", err);
      }
    };

    loadData();
  }, []);

  const onSelectPortfolioImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setMessage("");
    setIsUploadingPortfolioImage(true);
    try {
      const uploaded = await onUploadMedia(file, "portfolio");
      setPortfolioForm((current) => ({
        ...current,
        imageUrl: uploaded,
      }));
      setMessage("Media portfolio berhasil diupload.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload media gagal.");
    } finally {
      setIsUploadingPortfolioImage(false);
      event.target.value = "";
    }
  };

  const onSavePortfolioItem = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const url = portfolioEditId
        ? `/api/admin/portfolio/${portfolioEditId}`
        : "/api/admin/portfolio";
      const method = portfolioEditId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "portfolio-item",
          ...portfolioForm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Gagal menyimpan portfolio item.");
        return;
      }

      setMessage(
        portfolioEditId
          ? "Portfolio item berhasil diperbarui."
          : "Portfolio item berhasil ditambahkan.",
      );

      // Reload portfolio items
      const listResponse = await fetch("/api/admin/portfolio");
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setPortfolioItems(listData.portfolioItems || []);
      }

      setPortfolioForm(defaultPortfolioForm);
      setPortfolioEditId(null);
    } catch (err) {
      setError("Terjadi kesalahan. Coba lagi.");
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const onEditPortfolioItem = (item: PortfolioItem) => {
    setPortfolioForm({
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      category: item.category,
      link: item.link || "",
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    setPortfolioEditId(item.id);
  };

  const onDeletePortfolioItem = async (id: string) => {
    if (!confirm("Yakin mau hapus portfolio item ini?")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/portfolio/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Gagal menghapus portfolio item.");
        return;
      }

      setMessage("Portfolio item berhasil dihapus.");

      // Reload portfolio items
      const listResponse = await fetch("/api/admin/portfolio");
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setPortfolioItems(listData.portfolioItems || []);
      }
    } catch (err) {
      setError("Terjadi kesalahan. Coba lagi.");
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className={styles.container}>
      {/* Portfolio Items Section */}
      <article className={styles.card}>
        <div className={styles.cardHead}>
          <h2>{portfolioEditId ? "Edit Portfolio Item" : "CRUD Portfolio Items"}</h2>
        </div>

        <form className={styles.form} onSubmit={onSavePortfolioItem}>
          <input
            type="text"
            value={portfolioForm.title}
            onChange={(event) =>
              setPortfolioForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="Judul portfolio"
            required
          />
          <textarea
            value={portfolioForm.description}
            onChange={(event) =>
              setPortfolioForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Deskripsi portfolio"
            rows={3}
            required
          />
          <input
            type="text"
            value={portfolioForm.category}
            onChange={(event) =>
              setPortfolioForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            placeholder="Kategori"
            required
          />
          <input
            type="url"
            value={portfolioForm.link}
            onChange={(event) =>
              setPortfolioForm((current) => ({
                ...current,
                link: event.target.value,
              }))
            }
            placeholder="Link ke project (opsional)"
          />
          <input
            type="number"
            min={0}
            value={portfolioForm.sortOrder}
            onChange={(event) =>
              setPortfolioForm((current) => ({
                ...current,
                sortOrder: Number(event.target.value || 0),
              }))
            }
            placeholder="Urutan tampil"
          />
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={portfolioForm.isActive}
              onChange={(event) =>
                setPortfolioForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            Aktifkan Portfolio Item
          </label>
          <input value={portfolioForm.imageUrl} readOnly placeholder="URL gambar portfolio otomatis" />
          {isFileUploadEnabled ? (
            <label className={styles.fileField}>
              Upload Gambar Portfolio
              <input
                type="file"
                accept="image/*"
                onChange={onSelectPortfolioImage}
              />
              <small>
                {isUploadingPortfolioImage ? "Uploading..." : "Pilih gambar dari device"}
              </small>
            </label>
          ) : null}

          <div className={styles.previewCard}>
            <FlexibleMedia
              src={portfolioForm.imageUrl}
              alt="Preview portfolio"
              width={120}
              height={120}
              className={styles.previewImage}
              unoptimized
            />
            <div>
              <p>{portfolioForm.title || "Preview title"}</p>
              <span>{portfolioForm.category || "Preview category"}</span>
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={isLoading}>
              {portfolioEditId ? "Simpan Perubahan" : "Tambah Portfolio"}
            </button>
            {portfolioEditId ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setPortfolioForm(defaultPortfolioForm);
                  setPortfolioEditId(null);
                }}
              >
                Batal Edit
              </button>
            ) : null}
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}
        </form>

        <div className={styles.list}>
          {portfolioItems.map((item) => (
            <div key={item.id} className={styles.listItem}>
              <div className={styles.listPreview}>
                <FlexibleMedia
                  src={item.imageUrl}
                  alt={item.title}
                  width={80}
                  height={80}
                  className={styles.listThumb}
                  unoptimized
                />
                <div>
                  <p>{item.title}</p>
                  <span>{item.category}</span>
                  <span>Urutan: {item.sortOrder}</span>
                  <span className={item.isActive ? styles.statusActive : styles.statusInactive}>
                    {item.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  onClick={() => onEditPortfolioItem(item)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePortfolioItem(item.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {portfolioItems.length === 0 ? (
            <p>Belum ada portfolio item.</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
