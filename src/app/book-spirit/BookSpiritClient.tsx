"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AiOutlineLike, AiFillLike } from "react-icons/ai";
import { FaRegComment } from "react-icons/fa";
import { MdOutlineShare, MdPhotoCamera } from "react-icons/md";
import { MdFlagCircle } from "react-icons/md";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { BookStory } from "@/types/store";
import StorySubmissionModal from "./StorySubmissionModal";
import styles from "./BookSpiritClient.module.css";

export default function BookSpiritClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const stickyRef = useRef<HTMLElement | null>(null);
  const [stories, setStories] = useState<BookStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, { id: string; name: string } | null>>({});
  const [replyPhotos, setReplyPhotos] = useState<Record<string, string>>({});
  const [loadingActions, setLoadingActions] = useState<Record<string, string>>({}); // "like" | "comment_send" | ""
  const [reportModal, setReportModal] = useState<{ storyId: string; storyTitle: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [activeRating, setActiveRating] = useState<number | null>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [maintenanceGuideStep, setMaintenanceGuideStep] = useState<0 | 1 | 2>(0);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const loadStories = async () => {
      try {
        const response = await fetch("/api/book-stories/approved");
        if (response.ok) {
          const data = (await response.json()) as { stories: BookStory[] };
          setStories(data.stories);
        }
      } catch (error) {
        console.error("Failed to fetch stories:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("maintenanceGuide") === "1") {
      setMaintenanceGuideStep(1);
      window.setTimeout(() => {
        document.querySelector<HTMLElement>("[data-maintenance-guide='write-testimoni']")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setHasScrolled(scrollTop > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Extract unique products from all stories
  const allProducts = Array.from(
    stories.reduce((acc, story) => {
      if (story.linkedProducts) {
        story.linkedProducts.forEach(product => {
          acc.set(product.productId, product.productName);
        });
      }
      return acc;
    }, new Map<string, string>())
  ).map(([id, name]) => ({ id, name }));

  // Extract unique ratings
  const availableRatings = Array.from(new Set(stories.filter(s => s.rating).map(s => s.rating))).sort() as number[];

  // Filter stories based on active rating and product
  const filteredStories = stories.filter(story => {
    const matchesRating = activeRating === null || story.rating === activeRating;
    const matchesProduct = activeProductId === null || 
      (story.linkedProducts && story.linkedProducts.some(p => p.productId === activeProductId));
    return matchesRating && matchesProduct;
  });

  const handleTellStory = () => {
    if (!session?.user?.email) {
      router.push("/auth");
    } else {
      setShowModal(true);
      if (maintenanceGuideStep === 1) {
        setMaintenanceGuideStep(2);
      }
    }
  };

  const handleStorySubmitted = async () => {
    try {
      const response = await fetch("/api/book-stories/approved");
      if (response.ok) {
        const data = (await response.json()) as { stories: BookStory[] };
        setStories(data.stories);
      }
    } catch (error) {
      console.error("Failed to reload stories:", error);
    }
  };

  const handleLike = async (storyId: string) => {
    setLoadingActions(prev => ({ ...prev, [storyId]: "like" }));
    try {
      const response = await fetch(`/api/book-stories/${storyId}/likes`, {
        method: "POST",
      });
      if (response.ok) {
        const data = (await response.json()) as { story: BookStory };
        setStories(stories.map(s => s.id === storyId ? data.story : s));
      }
    } catch (error) {
      console.error("Failed to like story:", error);
    } finally {
      setLoadingActions(prev => ({ ...prev, [storyId]: "" }));
    }
  };

  const isVerifiedActor = (actor: { userEmail?: string; userName?: string; verified?: boolean }) => {
    return (
      Boolean(actor.verified) ||
      actor.userEmail?.toLowerCase() === "digitalawanku2@gmail.com" ||
      actor.userName === "Tokko Marketplace"
    );
  };

  const handleAddComment = async (storyId: string) => {
    const text = commentText[storyId]?.trim();
    if (!text) return;

    setLoadingActions(prev => ({ ...prev, [storyId]: "comment_send" }));
    try {
      const response = await fetch(`/api/book-stories/${storyId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          replyToId: replyTo[storyId]?.id,
          replyToName: replyTo[storyId]?.name,
          photoUrl: replyPhotos[storyId],
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { story: BookStory };
        setStories(stories.map(s => s.id === storyId ? data.story : s));
        setCommentText(prev => ({ ...prev, [storyId]: "" }));
        setReplyTo(prev => ({ ...prev, [storyId]: null }));
        setReplyPhotos(prev => ({ ...prev, [storyId]: "" }));
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setLoadingActions(prev => ({ ...prev, [storyId]: "" }));
    }
  };

  const handleReplyPhotoSelect = async (storyId: string, file: File | null) => {
    if (!file) {
      setReplyPhotos(prev => ({ ...prev, [storyId]: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setReplyPhotos(prev => ({ ...prev, [storyId]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteComment = async (storyId: string, commentId: string) => {
    if (!confirm("Yakin hapus komentar ini?")) {
      return;
    }

    setLoadingActions(prev => ({ ...prev, [commentId]: "comment_delete" }));
    try {
      const response = await fetch(`/api/book-stories/${storyId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });

      if (response.ok) {
        const data = (await response.json()) as { story: BookStory };
        setStories(stories.map(s => s.id === storyId ? data.story : s));
      } else {
        const data = (await response.json()) as { message?: string };
        alert(data.message || "Gagal hapus komentar");
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
      alert("Gagal hapus komentar");
    } finally {
      setLoadingActions(prev => ({ ...prev, [commentId]: "" }));
    }
  };

  const handleShare = async (story: BookStory) => {
    try {
      const storyUrl = "https://tokkov2.vercel.app/book-spirit";
      const shareText = `\"${story.story.slice(0, 100)}...\" - ${story.userName}\n\nAyo lihat cerita lain dan ceritakan kepuasanmu di Testimoni, dapetin app premium gratis!\n\n${storyUrl}`;
      
      if (navigator.share) {
        await navigator.share({
          title: "Testimoni",
          text: shareText,
          url: storyUrl,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareText);
        alert("Link bagikan disalin ke clipboard!");
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  const handleReportStory = async () => {
    if (!reportModal || !reportReason.trim()) {
      alert("Silakan isi alasan laporan");
      return;
    }

    setReportSubmitting(true);
    try {
      const response = await fetch(`/api/book-stories/${reportModal.storyId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason }),
      });

      const data = await response.json();
      if (response.ok) {
        alert("Laporan kamu sudah diterima. Terima kasih!");
        setReportModal(null);
        setReportReason("");
      } else {
        alert(data.message || "Gagal mengirim laporan");
      }
    } catch (error) {
      console.error("Failed to report story:", error);
      alert("Gagal mengirim laporan");
    } finally {
      setReportSubmitting(false);
    }
  };

  const toggleComments = (storyId: string) => {
    const newSet = new Set(expandedComments);
    if (newSet.has(storyId)) {
      newSet.delete(storyId);
    } else {
      newSet.add(storyId);
    }
    setExpandedComments(newSet);
  };

  const userHasLiked = (story: BookStory) => {
    return session?.user?.id ? story.likedBy.includes(session.user.id) : false;
  };

  const getRootComments = (story: BookStory) => {
    return story.comments.filter(
      (comment) => !comment.replyToId || !story.comments.some((item) => item.id === comment.replyToId),
    );
  };

  const getReplyComments = (story: BookStory, parentId: string) => {
    return story.comments.filter((comment) => comment.replyToId === parentId);
  };

  const renderStoryComment = (
    story: BookStory,
    comment: BookStory["comments"][number],
    isReply = false,
  ) => (
    <div
      key={comment.id}
      className={`${styles.commentItem} ${isReply ? styles.commentReply : ""}`}
    >
      <div className={styles.commentHeaderRow}>
        <p className={isVerifiedActor(comment) ? styles.commentAuthorVerified : styles.commentAuthor}>
          {comment.userName}
        </p>
        {isVerifiedActor(comment) ? (
          <span className={styles.commentBadgeWrap} title="Terverifikasi">
            <VerifiedBadge />
          </span>
        ) : null}
      </div>
      {comment.replyToName ? (
        <p className={styles.replyTarget}>Membalas @{comment.replyToName}</p>
      ) : null}
      {comment.photoUrl && (
        <img
          src={comment.photoUrl}
          alt="Comment photo"
          style={{
            maxWidth: "100%",
            maxHeight: "200px",
            borderRadius: "6px",
            marginBottom: "8px",
            objectFit: "cover",
          }}
        />
      )}
      <p className={styles.commentText}>{comment.text}</p>
      {session?.user ? (
        <div className={styles.commentActions}>
          <button
            type="button"
            onClick={() =>
              setReplyTo(prev => ({
                ...prev,
                [story.id]: { id: comment.id, name: comment.userName },
              }))
            }
          >
            Balas
          </button>
          {(session.user.role === "admin" || comment.userId === session.user.id) ? (
            <button
              type="button"
              onClick={() => handleDeleteComment(story.id, comment.id)}
              disabled={loadingActions[comment.id] === "comment_delete"}
            >
              {loadingActions[comment.id] === "comment_delete" ? "Hapus..." : "Hapus"}
            </button>
          ) : null}
        </div>
      ) : null}
      {!isReply && getReplyComments(story, comment.id).length > 0 ? (
        <div className={styles.replyList}>
          {getReplyComments(story, comment.id).map((reply) => renderStoryComment(story, reply, true))}
        </div>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingContainer}>
          <p style={{ textAlign: 'center' }}>Pastikan Internet kamu Stabil...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section 
        ref={stickyRef}
        className={`${styles.stickyTop} ${hasScrolled ? styles.stickyTopScrolled : ""}`}
      >
        <header className={styles.header}>
          <h1>Testimoni</h1>
          <button
            type="button"
            className={styles.backLink}
            onClick={() => router.back()}
          >
            Kembali
          </button>
        </header>

        <div className={styles.searchWrap}>
          <div className={styles.searchRow}>
            <input
              type="search"
              placeholder="Cari Testimoni..."
              style={{ cursor: "pointer" }}
            />
            {session?.user ? (
              <button
                type="button"
                onClick={() => router.push("/profil")}
                className={styles.gifBox}
                style={{ cursor: "pointer", border: "none", background: "none", padding: 0 }}
                title="Lihat profil"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={session.user.image || "/assets/logo.png"}
                  alt="Profil"
                  style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              </button>
            ) : (
              <div className={styles.gifBox} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif"
                  alt=""
                />
              </div>
            )}
          </div>
        </div>

        {/* Filter Section - Combined */}
        {stories.length > 0 && (
          <div className={styles.categoryRow}>
            {/* Rating Filters */}
            <button
              type="button"
              onClick={() => setActiveRating(null)}
              className={`${styles.categoryChip} ${activeRating === null ? styles.categoryChipActive : ""}`}
            >
              Semua
            </button>
            {availableRatings.map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => setActiveRating(rating)}
                className={`${styles.categoryChip} ${
                  activeRating === rating ? styles.categoryChipActive : ""
                }`}
              >
                {"\u2605".repeat(rating)}
              </button>
            ))}

            {/* Product Filters */}
            {allProducts.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveProductId(null)}
                  className={`${styles.categoryChip} ${activeProductId === null ? styles.categoryChipActive : ""}`}
                >
                  Semua Produk
                </button>
                {allProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setActiveProductId(product.id)}
                    className={`${styles.categoryChip} ${
                      activeProductId === product.id ? styles.categoryChipActive : ""
                    }`}
                  >
                    {product.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <section className={styles.content}>
        {filteredStories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#999" }}>
            <button
              type="button"
              className={styles.tellStoryButton}
              onClick={handleTellStory}
              data-maintenance-guide="write-testimoni"
              style={{ marginTop: "24px" }}
            >
              Isi Testimoni
            </button>
            <p style={{ marginTop: "16px", fontSize: "14px", color: "#666" }}>Bagikan pengalaman terbaik mu bersama kami</p>
          </div>
        ) : (
          <>
            {filteredStories.map((story) => (
              <article key={story.id} className={styles.storyItem}>
                <div className={styles.storyContent}>
                  {/* User Info Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    {story.userAvatarUrl ? (
                      <img
                        src={story.userAvatarUrl}
                        alt={story.userName}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #11151E",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: "#11151E",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: "18px",
                          fontWeight: "bold",
                        }}
                      >
                        {story.userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className={styles.authorNameRow}>
                        <h3 className={isVerifiedActor(story) ? styles.storyAuthorVerified : styles.storyAuthor}>
                          {story.userName}
                        </h3>
                        {isVerifiedActor(story) ? (
                          <span className={styles.verifiedBadgeWrap} title="Terverifikasi">
                            <VerifiedBadge />
                          </span>
                        ) : null}
                      </div>
                      <p style={{ fontSize: "12px", color: "#999", margin: "0" }}>
                        {new Date(story.createdAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                  </div>
                  
                  {/* Rating and Products - New Position */}
                  <div className={styles.ratingAndProductsContainer}>
                    {/* Rating Display */}
                    {story.rating && story.rating > 0 && (
                      <div className={styles.ratingBadge}>
                        <span className={styles.ratingStars}>
                          {"★".repeat(story.rating)}{"☆".repeat(5 - story.rating)}
                        </span>
                      </div>
                    )}
                    
                    {/* Linked Products Display */}
                    {story.linkedProducts && story.linkedProducts.length > 0 && (
                      <div className={styles.productsScrollContainer}>
                        {story.linkedProducts.map((prod) => (
                          <span key={prod.productId} className={styles.productBadge}>
                            {prod.productName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {story.photos && story.photos.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                      {story.photos.map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`Story photo ${idx + 1}`}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "300px",
                            borderRadius: "12px",
                            objectFit: "cover",
                          }}
                        />
                      ))}
                    </div>
                  )}
                  
                  <div
                    className={styles.storyText}
                    dangerouslySetInnerHTML={{ __html: story.story }}
                  />
                  
                  <p className={styles.storyBrand}>Testimoni</p>

                  <div style={{ display: "flex", gap: "16px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee", alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleLike(story.id)}
                      disabled={loadingActions[story.id] === "like"}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: loadingActions[story.id] === "like" ? "wait" : "pointer",
                        fontSize: "18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: userHasLiked(story) ? "#11151E" : "#999",
                        opacity: loadingActions[story.id] === "like" ? 0.6 : 1,
                      }}
                    >
                      {loadingActions[story.id] === "like" ? (
                        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                      ) : userHasLiked(story) ? (
                        <AiFillLike />
                      ) : (
                        <AiOutlineLike />
                      )}
                      <span style={{ fontSize: "14px" }}>{story.likedBy.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleComments(story.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#999",
                      }}
                    >
                      <FaRegComment />
                      <span style={{ fontSize: "14px" }}>{story.comments.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShare(story)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#999",
                      }}
                    >
                      <MdOutlineShare />
                      <span style={{ fontSize: "14px" }}>Bagikan</span>
                    </button>

                    {session?.user?.email && (
                      <button
                        type="button"
                        onClick={() => setReportModal({ storyId: story.id, storyTitle: story.story.slice(0, 50) })}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "18px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#999",
                          marginLeft: "auto",
                        }}
                        title="Laporkan cerita"
                      >
                        <MdFlagCircle />
                        <span style={{ fontSize: "14px" }}>Lapor</span>
                      </button>
                    )}
                  </div>

                  {expandedComments.has(story.id) && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #eee" }}>
                      {story.comments.length === 0 ? (
                        <p style={{ fontSize: "14px", color: "#999" }}>Belum ada komentar</p>
                      ) : (
                        <div className={styles.commentsList}>
                          {getRootComments(story).map((comment) => renderStoryComment(story, comment))}
                        </div>
                      )}

                      {session?.user?.email && (
                        <div className={styles.commentComposer}>
                          {replyTo[story.id] ? (
                            <div className={styles.replyingTo}>
                              Membalas @{replyTo[story.id]?.name}
                              <button
                                type="button"
                                onClick={() => setReplyTo(prev => ({ ...prev, [story.id]: null }))}
                              >
                                ×
                              </button>
                            </div>
                          ) : null}
                          {replyPhotos[story.id] && (
                            <div style={{ marginBottom: "8px", position: "relative" }}>
                              <img
                                src={replyPhotos[story.id]}
                                alt="Preview"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "150px",
                                  borderRadius: "6px",
                                  objectFit: "cover",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setReplyPhotos(prev => ({ ...prev, [story.id]: "" }))}
                                style={{
                                  position: "absolute",
                                  top: "4px",
                                  right: "4px",
                                  background: "rgba(0,0,0,0.7)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "50%",
                                  width: "24px",
                                  height: "24px",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  fontWeight: "bold",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          )}
                          <div style={{ display: "flex", gap: "4px" }}>
                            <input
                              type="text"
                              placeholder={replyTo[story.id] ? `Balas @${replyTo[story.id]?.name}...` : "Tambah komentar..."}
                              value={commentText[story.id] || ""}
                              onChange={(e) => setCommentText(prev => ({ ...prev, [story.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && loadingActions[story.id] !== "comment_send") {
                                  handleAddComment(story.id);
                                }
                              }}
                              disabled={loadingActions[story.id] === "comment_send"}
                              style={{
                                flex: 1,
                                padding: "8px",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                fontSize: "13px",
                                opacity: loadingActions[story.id] === "comment_send" ? 0.6 : 1,
                              }}
                            />
                            <label style={{
                              padding: "8px 12px",
                              background: "#f0f0f0",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "18px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}>
                              <MdPhotoCamera />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleReplyPhotoSelect(story.id, e.target.files?.[0] || null)}
                                style={{ display: "none" }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleAddComment(story.id)}
                              disabled={loadingActions[story.id] === "comment_send"}
                              style={{
                                padding: "8px 12px",
                                background: "#11151E",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loadingActions[story.id] === "comment_send" ? "wait" : "pointer",
                                fontSize: "13px",
                                opacity: loadingActions[story.id] === "comment_send" ? 0.6 : 1,
                              }}
                            >
                              {loadingActions[story.id] === "comment_send" ? "Mengirim..." : "Kirim"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.tellStoryButton}
                  onClick={handleTellStory}
                  data-maintenance-guide="write-testimoni"
                >
                  Isi Testimoni
                </button>
              </article>
            ))}
          </>
        )}
      </section>

      {/* Report Modal */}
      {reportModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px",
        }}>
          <div style={{
            background: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "bold" }}>
              Laporkan Cerita
            </h2>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
              Silakan jelaskan alasan Anda melaporkan cerita ini. Laporan Anda akan ditinjau oleh tim admin.
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Tuliskan alasan laporan (minimal 5 karakter)..."
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setReportModal(null);
                  setReportReason("");
                }}
                disabled={reportSubmitting}
                style={{
                  padding: "10px 16px",
                  background: "#f0f0f0",
                  color: "#333",
                  border: "none",
                  borderRadius: "6px",
                  cursor: reportSubmitting ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReportStory}
                disabled={reportSubmitting || reportReason.trim().length < 5}
                style={{
                  padding: "10px 16px",
                  background: reportReason.trim().length < 5 ? "#ccc" : "#FF3B30",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: reportSubmitting || reportReason.trim().length < 5 ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                {reportSubmitting ? "Mengirim..." : "Laporkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <StorySubmissionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmitted={handleStorySubmitted}
      />
      {maintenanceGuideStep > 0 ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 900,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: maintenanceGuideStep === 1 ? "50%" : "50%",
              bottom: maintenanceGuideStep === 1 ? "110px" : "28px",
              transform: "translateX(-50%)",
              width: "min(360px, calc(100vw - 32px))",
              background: "rgba(10, 13, 20, 0.94)",
              color: "white",
              borderRadius: "18px",
              padding: "16px 18px",
              boxShadow: "0 18px 44px rgba(0,0,0,0.32)",
              animation: "maintenanceGuideFloat 1.25s ease-in-out infinite",
              pointerEvents: "auto",
            }}
          >
            <strong style={{ display: "block", fontSize: "15px", marginBottom: "6px" }}>
              {maintenanceGuideStep === 1 ? "Klik Isi Testimoni" : "Tulis pesan kamu"}
            </strong>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.45 }}>
              {maintenanceGuideStep === 1
                ? "Tekan tombol Isi Testimoni untuk mulai mengobrol dengan kami."
                : "Ketik: berikan penilaian terakhir kamu atau mengobrol dengan kami."}
            </p>
            <button
              type="button"
              onClick={() => {
                if (maintenanceGuideStep === 1) {
                  handleTellStory();
                  return;
                }
                setMaintenanceGuideStep(0);
              }}
              style={{
                marginTop: "12px",
                border: 0,
                borderRadius: "999px",
                background: "#ffffff",
                color: "#11151e",
                padding: "8px 14px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {maintenanceGuideStep === 1 ? "Buka" : "Selesai"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
