"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiArrowLeft } from "react-icons/fi";
import { AiOutlineLike, AiFillLike } from "react-icons/ai";
import { FaRegComment } from "react-icons/fa";
import { MdOutlineShare } from "react-icons/md";
import { BsLeaf } from "react-icons/bs";
import { MdFlagCircle } from "react-icons/md";
import MaintenanceModal from "@/components/maintenance/MaintenanceModal";
import type { BookStory } from "@/types/store";
import StorySubmissionModal from "./StorySubmissionModal";
import styles from "./BookSpiritClient.module.css";

export default function BookSpiritClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const [stories, setStories] = useState<BookStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [loadingActions, setLoadingActions] = useState<Record<string, string>>({}); // "like" | "comment_send" | ""
  const [reportModal, setReportModal] = useState<{ storyId: string; storyTitle: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

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

  const handleTellStory = () => {
    if (!session?.user?.email) {
      router.push("/auth");
    } else {
      setShowModal(true);
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

  const handleAddComment = async (storyId: string) => {
    const text = commentText[storyId]?.trim();
    if (!text) return;

    setLoadingActions(prev => ({ ...prev, [storyId]: "comment_send" }));
    try {
      const response = await fetch(`/api/book-stories/${storyId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const data = (await response.json()) as { story: BookStory };
        setStories(stories.map(s => s.id === storyId ? data.story : s));
        setCommentText(prev => ({ ...prev, [storyId]: "" }));
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setLoadingActions(prev => ({ ...prev, [storyId]: "" }));
    }
  };

  const handleShare = async (story: BookStory) => {
    try {
      const storyUrl = "https://tokkov2.vercel.app/book-spirit";
      const shareText = `"${story.story.slice(0, 100)}..." - ${story.userName}\n\nAyo lihat cerita lain dan ceritakan diri kamu yang menarik di Book Spirit, dapetin app premium gratis!\n\n${storyUrl}`;
      
      if (navigator.share) {
        await navigator.share({
          title: "Book Spirit",
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

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingContainer}>
          <p>Tunggu sebentar yaa..</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.back()}
          aria-label="Kembali"
        >
          <FiArrowLeft />
        </button>
        <h1>Book Spirit</h1>
        <div className={styles.headerPlaceholder} />
      </header>

      <section className={styles.storyList}>
        {stories.length === 0 ? (
          <div className={styles.emptyState}>
            <button
              type="button"
              className={styles.tellStoryButton}
              onClick={handleTellStory}
              style={{ marginTop: "24px" }}
            >
              Tell your Story!
            </button>
          </div>
        ) : (
          <>
            {stories.map((story) => (
              <article key={story.id} className={styles.storyItem} style={{ position: "relative", overflow: "visible" }}>
                {/* Decorative leaves */}
                <div style={{ position: "absolute", top: "-12px", left: "20px", color: "#007AFF", fontSize: "32px", opacity: 0.6 }}>
                  <BsLeaf style={{ transform: "rotate(-30deg)" }} />
                </div>
                <div style={{ position: "absolute", top: "20px", right: "-8px", color: "#007AFF", fontSize: "28px", opacity: 0.5 }}>
                  <BsLeaf style={{ transform: "rotate(60deg)" }} />
                </div>
                <div style={{ position: "absolute", bottom: "-12px", right: "30px", color: "#007AFF", fontSize: "30px", opacity: 0.6 }}>
                  <BsLeaf style={{ transform: "rotate(20deg)" }} />
                </div>
                <div style={{ position: "absolute", bottom: "40px", left: "-8px", color: "#007AFF", fontSize: "26px", opacity: 0.5 }}>
                  <BsLeaf style={{ transform: "rotate(-60deg)" }} />
                </div>

                <div className={styles.storyContent}>
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
                          border: "2px solid #007AFF",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: "#007AFF",
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
                      <h3 className={styles.storyAuthor}>{story.userName}</h3>
                      <p style={{ fontSize: "12px", color: "#999", margin: "0" }}>
                        {new Date(story.createdAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
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
                            borderRadius: "8px",
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
                  <p className={styles.storyBrand}>Book Spirit</p>

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
                        color: userHasLiked(story) ? "#007AFF" : "#999",
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
                        <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "8px" }}>
                          {story.comments.map((comment) => (
                            <div key={comment.id} style={{ marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #f0f0f0" }}>
                              <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 4px 0" }}>
                                {comment.userName}
                              </p>
                              <p style={{ fontSize: "13px", color: "#333", margin: "0" }}>
                                {comment.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {session?.user?.email && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <input
                            type="text"
                            placeholder="Tambah komentar..."
                            value={commentText[story.id] || ""}
                            onChange={(e) => setCommentText(prev => ({ ...prev, [story.id]: e.target.value }))}
                            onKeyPress={(e) => {
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
                          <button
                            type="button"
                            onClick={() => handleAddComment(story.id)}
                            disabled={loadingActions[story.id] === "comment_send"}
                            style={{
                              padding: "8px 12px",
                              background: "#007AFF",
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
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.tellStoryButton}
                  onClick={handleTellStory}
                >
                  Tell your Story!
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
      <MaintenanceModal />
    </main>
  );
}
