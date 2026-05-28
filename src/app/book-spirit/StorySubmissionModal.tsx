"use client";

import { useRef, useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { FiCamera } from "react-icons/fi";
import { MdStar } from "react-icons/md";
import styles from "./StorySubmissionModal.module.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
};

// Popular emojis for quick selection
const POPULAR_EMOJIS = ["😊", "❤️", "👍", "🎉", "✨", "💯", "😍", "🌟", "💪", "🔥", "😌", "🙌", "💕", "🎊", "👏"];

export default function StorySubmissionModal({ isOpen, onClose, onSubmitted }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [rating, setRating] = useState(0); // 0-5, 0 means disabled
  const [linkedProducts, setLinkedProducts] = useState<Array<{id: string; name: string}>>([]);
  const [availableProducts, setAvailableProducts] = useState<Array<{id: string; name: string}>>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [elements, setElements] = useState<Array<{emoji: string; opacity: number}>>([]);
  const [emojiInput, setEmojiInput] = useState<string>("");
  const [emojiOpacity, setEmojiOpacity] = useState(0.5);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Load available products
    const loadProducts = async () => {
      try {
        const response = await fetch("/api/me/products");
        if (response.ok) {
          const data = await response.json();
          setAvailableProducts(data.products || []);
        }
      } catch (error) {
        console.error("Failed to load products:", error);
      }
    };
    
    if (isOpen) {
      loadProducts();
    }
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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        setMessage("Hanya file gambar yang diperbolehkan");
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setPhotos((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditorFocus = () => {
    updateActiveFormats();
  };

  const addProduct = (product: {id: string; name: string}) => {
    if (!linkedProducts.find(p => p.id === product.id)) {
      setLinkedProducts([...linkedProducts, product]);
    }
    setShowProductPicker(false);
  };

  const removeProduct = (productId: string) => {
    setLinkedProducts(linkedProducts.filter(p => p.id !== productId));
  };

  const addEmoji = (emoji: string) => {
    const newElements = [...elements, { emoji, opacity: emojiOpacity }];
    setElements(newElements);
    setShowEmojiPicker(false);
  };

  const removeElement = (index: number) => {
    setElements(elements.filter((_, i) => i !== index));
  };

  const handleAddCustomEmoji = () => {
    if (emojiInput.trim()) {
      addEmoji(emojiInput);
      setEmojiInput("");
    }
  };

  const cleanupHTML = (html: string): string => {
    // Create a temporary div to parse HTML
    const temp = document.createElement("div");
    temp.innerHTML = html;
    
    // Remove unnecessary divs and clean up formatting
    const walk = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      
      const el = node as Element;
      
      // Remove empty divs
      if (el.tagName === "DIV" && !el.textContent?.trim()) {
        el.remove();
        return;
      }
      
      // Convert divs to paragraphs for better structure
      if (el.tagName === "DIV" && el.textContent?.trim()) {
        const p = document.createElement("p");
        while (el.firstChild) {
          p.appendChild(el.firstChild);
        }
        el.replaceWith(p);
        return;
      }
      
      // Walk through children
      Array.from(node.childNodes).forEach(walk);
    };
    
    Array.from(temp.childNodes).forEach(walk);
    return temp.innerHTML;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const rawHTML = editorRef.current?.innerHTML?.trim() || "";
    const cleanHTML = cleanupHTML(rawHTML);
    const plainText = editorRef.current?.innerText?.trim() || "";
    
    if (!plainText || plainText.length < 10) {
      setMessage("Cerita minimal 10 karakter");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/book-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story: cleanHTML,
          photos,
          rating: rating > 0 ? rating : undefined,
          linkedProducts: linkedProducts.length > 0 ? linkedProducts : undefined,
          elements: elements.length > 0 ? elements : undefined,
        }),
      });

      const data = (await response.json()) as { message: string };

      if (response.ok) {
        setSuccess(true);
        setMessage(data.message);
        if (editorRef.current) editorRef.current.innerHTML = "";
        setPhotos([]);
        setRating(0);
        setLinkedProducts([]);
        setElements([]);
        setEmojiInput("");
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
          <h1>Ceritakan Kepuasanmu</h1>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Tutup"
          >
            <IoClose />
          </button>
        </div>

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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={styles.toolbarBtn}
          >
            <FiCamera aria-hidden="true" style={{ marginRight: "6px", verticalAlign: "middle" }} /> Tambah Foto
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handlePhotoSelect}
          style={{ display: "none" }}
        />

        {photos.length > 0 && (
          <div style={{ padding: "12px", borderTop: "1px solid #eee", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {photos.map((photo, index) => (
              <div
                key={index}
                style={{
                  position: "relative",
                  width: "80px",
                  height: "80px",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: "rgba(0,0,0,0.6)",
                    border: "none",
                    color: "white",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                    fontSize: "16px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IoClose aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formSectionsGrid}>
            {/* Star Rating Section */}
            <div className={styles.formSection}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <label style={{ fontSize: "14px", fontWeight: 600 }}>Rating:</label>
                <button
                  type="button"
                  onClick={() => setRating(rating > 0 ? 0 : 1)}
                  style={{
                    padding: "6px 12px",
                    border: `2px solid ${rating > 0 ? "#007AFF" : "#e0e0e0"}`,
                    borderRadius: "6px",
                    background: rating > 0 ? "#f0f7ff" : "transparent",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: rating > 0 ? "#007AFF" : "#666",
                    transition: "all 0.2s ease",
                  }}
                >
                  {rating > 0 ? "✓ Rating Aktif" : "Aktifkan Rating"}
                </button>
              </div>
              {rating > 0 && (
                <div style={{ display: "flex", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "28px",
                        padding: 0,
                        opacity: star <= rating ? 1 : 0.3,
                        transition: "opacity 0.2s ease",
                      }}
                    >
                      <MdStar style={{ color: "#FFB800" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Picker Section */}
            <div className={styles.formSection}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <label style={{ fontSize: "14px", fontWeight: 600 }}>Produk:</label>
                <button
                  type="button"
                  onClick={() => setShowProductPicker(!showProductPicker)}
                  style={{
                    padding: "6px 12px",
                    border: "2px solid #007AFF",
                    borderRadius: "6px",
                    background: "#f0f7ff",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#007AFF",
                    transition: "all 0.2s ease",
                  }}
                >
                  {showProductPicker ? "- Tutup" : "+ Pilih Produk"}
                </button>
              </div>

              {showProductPicker && availableProducts.length > 0 && (
                <div style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "12px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  background: "#f9f9f9",
                }}>
                  {availableProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 12px",
                        textAlign: "left",
                        border: "1px solid #e0e0e0",
                        borderRadius: "6px",
                        marginBottom: "8px",
                        background: "#fff",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        fontSize: "13px",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "#f0f7ff";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#007AFF";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#e0e0e0";
                      }}
                    >
                      {product.name}
                    </button>
                  ))}
                </div>
              )}

              {linkedProducts.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {linkedProducts.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 10px",
                        background: "#f0f7ff",
                        border: "1px solid #007AFF",
                        borderRadius: "16px",
                        fontSize: "12px",
                      }}
                    >
                      <span>{product.name}</span>
                      <button
                        type="button"
                        onClick={() => removeProduct(product.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "16px",
                          color: "#007AFF",
                        }}
                      >
                        <IoClose />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Emoji Elements Section */}
            <div className={styles.formSection}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <label style={{ fontSize: "14px", fontWeight: 600 }}>Elemen:</label>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    padding: "6px 12px",
                    border: "2px solid #007AFF",
                    borderRadius: "6px",
                    background: "#f0f7ff",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#007AFF",
                    transition: "all 0.2s ease",
                  }}
                >
                  {showEmojiPicker ? "- Tutup" : "+ Pilih Emoji"}
                </button>
              </div>

              {showEmojiPicker && (
                <div style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "12px",
                  background: "#f9f9f9",
                }}>
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>Emoji Populer:</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {POPULAR_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => addEmoji(emoji)}
                          style={{
                            width: "32px",
                            height: "32px",
                            border: "1px solid #e0e0e0",
                            borderRadius: "6px",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: "18px",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#f0f7ff";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "#007AFF";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "#e0e0e0";
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "12px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>Custom Emoji:</div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="text"
                      value={emojiInput}
                      onChange={(e) => setEmojiInput(e.target.value)}
                      placeholder="Paste emoji atau teks"
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomEmoji();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomEmoji}
                      style={{
                        padding: "6px 12px",
                        background: "#007AFF",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      + Tambah
                    </button>
                  </div>

                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                    Opacity: {Math.round(emojiOpacity * 100)}%
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={emojiOpacity}
                    onChange={(e) => setEmojiOpacity(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      cursor: "pointer",
                    }}
                  />
                </div>
              </div>
            )}

            {elements.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {elements.map((element, index) => (
                  <div
                    key={index}
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      background: "#f0f7ff",
                      border: "1px solid #007AFF",
                      borderRadius: "16px",
                    }}
                  >
                    <span style={{ fontSize: "18px", opacity: element.opacity }}>
                      {element.emoji}
                    </span>
                    <span style={{ fontSize: "11px", color: "#666" }}>
                      {Math.round(element.opacity * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => removeElement(index)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "16px",
                        color: "#007AFF",
                      }}
                    >
                      <IoClose />
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          <div
            ref={editorRef}
            className={styles.richEditor}
            contentEditable
            suppressContentEditableWarning
            onMouseUp={handleEditorFocus}
            onKeyUp={handleEditorFocus}
            onFocus={handleEditorFocus}
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
