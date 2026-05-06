"use client";

import { useRef, useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { IoClose } from "react-icons/io5";
import { FiEdit3 } from "react-icons/fi";
import styles from "./StorySubmissionModal.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

export default function StorySubmissionModal({ isOpen, onClose, onSubmitted }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<Array<{ type: "image" | "video"; src: string }>>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Novel");
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(true);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEditorOpen(false);
      setMessage("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }

    document.body.style.overflow = "";
    return undefined;
  }, [isOpen]);

  const applyEditorCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    updateActiveFormats();
  };

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState("bold")) formats.add("bold");
    if (document.queryCommandState("italic")) formats.add("italic");
    if (document.queryCommandState("underline")) formats.add("underline");
    setActiveFormats(formats);
  };

  const canUndo = () => {
    return document.queryCommandEnabled("undo");
  };

  const canRedo = () => {
    return document.queryCommandEnabled("redo");
  };

  const handleUndo = () => {
    applyEditorCommand("undo");
  };

  const handleRedo = () => {
    applyEditorCommand("redo");
  };

  const handleThumbnailSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Thumbnail harus berupa gambar");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setThumbnail(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleMediaSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setMessage("Hanya foto atau video yang diperbolehkan");
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setMediaItems((prev) => [
          ...prev,
          {
            type: file.type.startsWith("video/") ? "video" : "image",
            src: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMediaItem = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const removeThumbnail = () => {
    setThumbnail(null);
  };

  const handleEditorFocus = () => {
    updateActiveFormats();
  };

  const categoryOptions = [
    "Novel",
    "Cerpen",
    "Puisi",
    "Horor",
    "Romance",
    "Komedi",
    "Action",
    "Petualangan",
    "Fantasi",
    "Fiksi Ilmiah",
    "Misteri",
    "Thriller",
    "Drama",
    "Slice of Life",
    "Motivasi",
    "Inspirasi Hidup",
    "Psikologi",
    "Filosofi",
    "Self Improvement",
    "Biografi",
    "Autobiografi",
    "Sejarah",
    "Religi",
    "Spiritual",
    "Teen Fiction",
    "Young Adult",
    "New Adult",
    "Adult",
    "Distopia",
    "Kriminal",
    "Detektif",
    "Survival",
    "Tragedi",
    "Supernatural",
    "Paranormal",
    "Zombie",
    "Apocalypse",
    "Coming of Age",
    "Romcom",
    "Sastra",
    "Dongeng",
    "Mitologi",
    "Kehidupan Sekolah",
    "Persahabatan",
    "Keluarga",
    "Politik",
    "Bisnis",
    "Teknologi",
    "Pendidikan",
    "Cerita Perang",
    "Time Travel",
    "Dark Fantasy",
    "Historical Fiction",
    "Antologi",
    "Kumpulan Cerita Pendek",
    "Monolog",
    "Fabel",
    "Satire",
  ];

  const cleanupHTML = (html: string): string => {
    const temp = document.createElement("div");
    temp.innerHTML = html;

    const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "UL", "OL", "LI", "A"]);
    const allowedAttributes = new Set(["href", "target", "rel"]);

    const walk = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as HTMLElement;

      if (el.tagName === "DIV" || el.tagName === "BLOCKQUOTE") {
        const p = document.createElement("p");
        while (el.firstChild) {
          p.appendChild(el.firstChild);
        }
        el.replaceWith(p);
        walk(p);
        return;
      }

      if (el.tagName === "SPAN") {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent?.insertBefore(el.firstChild, el);
        }
        parent?.removeChild(el);
        return;
      }

      if (!allowedTags.has(el.tagName)) {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent?.insertBefore(el.firstChild, el);
        }
        parent?.removeChild(el);
        return;
      }

      Array.from(el.attributes).forEach((attr) => {
        if (!allowedAttributes.has(attr.name)) {
          el.removeAttribute(attr.name);
          return;
        }
        if (attr.name === "href") {
          const value = attr.value.trim();
          if (!value.startsWith("http://") && !value.startsWith("https://") && !value.startsWith("mailto:")) {
            el.removeAttribute("href");
          }
        }
      });

      Array.from(node.childNodes).forEach(walk);
    };

    Array.from(temp.childNodes).forEach(walk);
    return temp.innerHTML.trim();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawHTML = editorRef.current?.innerHTML?.trim() || "";
    const cleanHTML = cleanupHTML(rawHTML);
    const plainText = editorRef.current?.innerText?.trim() || "";
    
    if (!title.trim() || title.trim().length < 3) {
      setMessage("Judul cerita wajib diisi minimal 3 karakter.");
      return;
    }

    if (!category.trim()) {
      setMessage("Kategori cerita wajib dipilih.");
      return;
    }

    if (!plainText || plainText.length < 10) {
      setMessage("Cerita minimal 10 karakter");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setSuccess(false);

    const photos = thumbnail ? [thumbnail, ...mediaItems.map((item) => item.src)] : mediaItems.map((item) => item.src);

    try {
      const response = await fetch("/api/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim(),
          story: cleanHTML,
          photos,
        }),
      });

      const data = (await response.json()) as { message: string };

      if (response.ok) {
        setSuccess(true);
        setMessage(data.message);
        setTitle("");
        setCategory("Novel");
        if (editorRef.current) editorRef.current.innerHTML = "";
        setThumbnail(null);
        setMediaItems([]);
        onSubmitted?.();
        setTimeout(onClose, 2000);
      } else {
        setMessage(data.message || "Gagal :( mungkin Maintenance");
      }
    } catch (error) {
      setMessage("Terjadi kesalahan. Coba lagi nanti.");
      console.error("Error submitting story:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.fullModal}>
        <div className={styles.header}>
          <h1>Tell your Story!</h1>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Tutup"
          >
            <IoClose />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="story-title" className={styles.inputLabel}>
              Judul Cerita
            </label>
            <input
              id="story-title"
              type="text"
              className={styles.textInput}
              placeholder="Masukkan judul cerita"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="story-category" className={styles.inputLabel}>
              Kategori Cerita
            </label>
            <select
              id="story-category"
              className={styles.selectInput}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.editorToggleWrap}>
            <button
              type="button"
              className={`${styles.editorToggleButton} ${editorOpen ? styles.editorToggleActive : ""}`}
              onClick={() => setEditorOpen((prev) => !prev)}
              aria-expanded={editorOpen}
            >
              <FiEdit3 aria-hidden="true" className={styles.editorToggleIcon} />
              <span>Tools</span>
            </button>
          </div>

          <div className={`${styles.editorReveal} ${editorOpen ? styles.open : ""}`}>
            <div className={styles.richToolbar}>
              <button
                type="button"
                onClick={handleUndo}
                className={styles.toolbarBtn}
                title="Undo"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={handleRedo}
                className={styles.toolbarBtn}
                title="Redo"
              >
                ↷
              </button>
              <div style={{ width: "1px", background: "#e0e0e0", margin: "0 4px" }} />
              <button 
                type="button" 
                onClick={() => applyEditorCommand("bold")}
                className={`${styles.toolbarBtn} ${activeFormats.has("bold") ? styles.active : ""}`}
              >
                Bold
              </button>
              <button 
                type="button" 
                onClick={() => applyEditorCommand("italic")}
                className={`${styles.toolbarBtn} ${activeFormats.has("italic") ? styles.active : ""}`}
              >
                Italic
              </button>
              <button 
                type="button" 
                onClick={() => applyEditorCommand("underline")}
                className={`${styles.toolbarBtn} ${activeFormats.has("underline") ? styles.active : ""}`}
              >
                Underline
              </button>
              <button type="button" onClick={() => applyEditorCommand("formatBlock", "<p>")} className={styles.toolbarBtn}>
                Paragraph
              </button>
              <button type="button" onClick={() => applyEditorCommand("formatBlock", "<h2>")} className={styles.toolbarBtn}>
                Heading
              </button>
              <button type="button" onClick={() => applyEditorCommand("formatBlock", "<h3>")} className={styles.toolbarBtn}>
                Subheading
              </button>
              <button type="button" onClick={() => applyEditorCommand("formatBlock", "<blockquote>")} className={styles.toolbarBtn}>
                Kutip
              </button>
              <button type="button" onClick={() => applyEditorCommand("fontSize", "2")} className={styles.toolbarBtn}>
                Kecil
              </button>
              <button type="button" onClick={() => applyEditorCommand("fontSize", "3")} className={styles.toolbarBtn}>
                Normal
              </button>
              <button type="button" onClick={() => applyEditorCommand("fontSize", "5")} className={styles.toolbarBtn}>
                Besar
              </button>
              <button type="button" onClick={() => applyEditorCommand("insertUnorderedList")} className={styles.toolbarBtn}>
                Bullet List
              </button>
              <button type="button" onClick={() => applyEditorCommand("insertOrderedList")} className={styles.toolbarBtn}>
                Number List
              </button>
              <button
                type="button"
                onClick={() => {
                  const linkUrl = window.prompt("Masukkan URL link");
                  if (!linkUrl) return;
                  applyEditorCommand("createLink", linkUrl);
                }}
                className={styles.toolbarBtn}
              >
                Link
              </button>
              <button type="button" onClick={() => applyEditorCommand("unlink")} className={styles.toolbarBtn}>
                Unlink
              </button>
              <button type="button" onClick={() => thumbnailInputRef.current?.click()} className={styles.toolbarBtn}>
                {thumbnail ? "Ganti Thumbnail" : "Pilih Thumbnail"}
              </button>
              <button type="button" onClick={() => mediaInputRef.current?.click()} className={styles.toolbarBtn}>
                Tambah Media
              </button>
            </div>

            <div className={styles.richEditorWrapper}>
              <div
                ref={editorRef}
                className={styles.richEditor}
                contentEditable
                suppressContentEditableWarning
                onMouseUp={handleEditorFocus}
                onKeyUp={handleEditorFocus}
                onFocus={handleEditorFocus}
              />
            </div>

            <div className={styles.mediaPreviewPanel}>
              {thumbnail && (
                <div className={styles.thumbnailPreview}>
                  <img src={thumbnail} alt="Thumbnail preview" />
                  <button type="button" className={styles.removeMediaButton} onClick={removeThumbnail}>✕</button>
                </div>
              )}
              {mediaItems.length > 0 && (
                <div className={styles.mediaPreviewGrid}>
                  {mediaItems.map((item, index) => (
                    <div key={index} className={styles.mediaPreviewItem}>
                      {item.type === "image" ? (
                        <img src={item.src} alt={`Preview ${index + 1}`} className={styles.mediaPreviewImage} />
                      ) : (
                        <video className={styles.mediaPreviewVideo} controls>
                          <source src={item.src} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      )}
                      <button type="button" className={styles.removeMediaButton} onClick={() => removeMediaItem(index)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            onChange={handleThumbnailSelect}
            style={{ display: "none" }}
          />
          <input
            ref={mediaInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleMediaSelect}
            style={{ display: "none" }}
          />

          <div className={styles.footer}>
            {message && (
              <p className={`${styles.message} ${success ? styles.success : styles.error}`}>
                {message}
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Mengirim..." : "Add Story"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
