"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiArrowLeft, FiX } from "react-icons/fi";
import { AiOutlineLike, AiFillLike, AiOutlineEye, AiOutlineSave, AiOutlineHistory } from "react-icons/ai";
import { MdOutlineShare, MdFlagCircle, MdOutlineBookmark, MdBookmark } from "react-icons/md";
import MaintenanceModal from "@/components/maintenance/MaintenanceModal";
import type { BookStory } from "@/types/store";
import StorySubmissionModal from "./StorySubmissionModal";
import styles from "./BookSpiritClient.module.css";

export default function BookSpiritClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const [stories, setStories] = useState<BookStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [activeTopCategory, setActiveTopCategory] = useState<"all" | "saved" | "recent">("all");

  const categories = [
    "Semua",
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

  const [showModal, setShowModal] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [loadingActions, setLoadingActions] = useState<Record<string, string>>({}); // "like" | "comment_send" | ""
  const [reportModal, setReportModal] = useState<{ storyId: string; storyTitle: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [selectedStory, setSelectedStory] = useState<BookStory | null>(null);
  const [readMode, setReadMode] = useState<"light" | "dark">("light");
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<0 | 0.5 | 1>(0);
  const [readStories, setReadStories] = useState<string[]>([]);

  const filteredSourceStories = useMemo(() => {
    if (activeTopCategory === "saved") {
      if (!session?.user?.id) return [];
      return stories.filter((story) => story.savedBy?.includes(session.user.id));
    }

    if (activeTopCategory === "recent") {
      return stories.filter((story) => readStories.includes(story.id));
    }

    return stories;
  }, [stories, activeTopCategory, readStories, session?.user?.id]);

  const availableCategories = useMemo(() => {
    const presentCategories = new Set(filteredSourceStories.map((story) => story.category));
    return categories.filter((category) => category !== "Semua" && presentCategories.has(category));
  }, [filteredSourceStories, categories]);

  const filteredStories = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return filteredSourceStories.filter((story) => {
      const matchesCategory = activeCategory === "Semua" || story.category === activeCategory;
      const text = `${story.title} ${story.story} ${story.category}`.toLowerCase();
      const matchesSearch = !normalizedQuery || text.includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [filteredSourceStories, searchQuery, activeCategory]);
  const [animatingLikes, setAnimatingLikes] = useState<Set<string>>(new Set());
  const detailRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // Helper function to strip HTML tags and get plain text
  const stripHtmlTags = (html: string): string => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 140): string => {
    const plain = stripHtmlTags(text);
    return plain.length > maxLength ? `${plain.slice(0, maxLength)}...` : plain;
  };

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
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("bookspirit_read_stories");
    if (stored) {
      try {
        setReadStories(JSON.parse(stored));
      } catch {
        setReadStories([]);
      }
    }
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
    // Trigger animation
    setAnimatingLikes(prev => new Set(prev).add(storyId));
    setTimeout(() => {
      setAnimatingLikes(prev => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });
    }, 400);
    
    try {
      const response = await fetch(`/api/book-stories/${storyId}/likes`, {
        method: "POST",
      });
      if (response.ok) {
        const data = (await response.json()) as { story: BookStory };
        setStories(stories.map(s => s.id === storyId ? data.story : s));
        if (selectedStory?.id === storyId) {
          setSelectedStory(data.story);
        }
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
        if (selectedStory?.id === storyId) {
          setSelectedStory(data.story);
        }
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
      const plainStory = stripHtmlTags(story.story).replace(/\s+/g, " ").trim();
      const snippet = plainStory.length > 120 ? `${plainStory.slice(0, 120).trim()}...` : plainStory;
      const shareText = `${snippet}\n\nBaca cerita menarik ini dengan lengkap di\n\n${storyUrl}`;
      
      if (navigator.share) {
        await navigator.share({
          title: story.title,
          text: shareText,
          url: storyUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("Link bagikan disalin ke clipboard!");
      }

      const response = await fetch(`/api/book-stories/${story.id}/share`, {
        method: "POST",
      });

      if (response.ok) {
        const data = (await response.json()) as { story: BookStory };
        setStories(stories.map((s) => (s.id === story.id ? data.story : s)));
        if (selectedStory?.id === story.id) {
          setSelectedStory(data.story);
        }
      }
    } catch (error) {
      console.error("Failed to share:", error);
    }
  };

  const saveReadStory = (storyId: string) => {
    if (typeof window === "undefined") return;
    setReadStories((current) => {
      const next = [storyId, ...current.filter((id) => id !== storyId)].slice(0, 6);
      window.localStorage.setItem("bookspirit_read_stories", JSON.stringify(next));
      return next;
    });
  };

  const toggleBookmark = async (storyId: string) => {
    if (!session?.user?.id) {
      router.push("/auth");
      return;
    }

    setLoadingActions((prev) => ({ ...prev, [storyId]: "save" }));
    try {
      const response = await fetch(`/api/book-stories/${storyId}/save`, {
        method: "POST",
      });
      if (response.ok) {
        const data = (await response.json()) as { story: BookStory };
        setStories(stories.map((s) => (s.id === storyId ? data.story : s)));
        if (selectedStory?.id === storyId) {
          setSelectedStory(data.story);
        }
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
    } finally {
      setLoadingActions((prev) => ({ ...prev, [storyId]: "" }));
    }
  };

  const isBookmarked = (storyId: string) => {
    if (!session?.user?.id) return false;
    const story = selectedStory?.id === storyId ? selectedStory : stories.find(s => s.id === storyId);
    return story?.savedBy?.includes(session.user.id) ?? false;
  };

  const removeFromRecent = (storyId: string) => {
    if (typeof window === "undefined") return;
    setReadStories((current) => {
      const next = current.filter((id) => id !== storyId);
      window.localStorage.setItem("bookspirit_read_stories", JSON.stringify(next));
      return next;
    });
  };

  const removeFromBookmark = (storyId: string) => {
    toggleBookmark(storyId);
  };

  const openStory = async (story: BookStory) => {
    setSelectedStory(story);
    setReadMode("light");
    setAutoScrollSpeed(0);
    saveReadStory(story.id);
    
    if (session?.user?.id) {
      try {
        const response = await fetch(`/api/book-stories/${story.id}/views`, {
          method: "POST",
        });
        if (response.ok) {
          const data = (await response.json()) as { story: BookStory };
          setStories(stories.map((s) => (s.id === story.id ? data.story : s)));
          setSelectedStory(data.story);
        }
      } catch (error) {
        console.error("Failed to track story view:", error);
      }
    }
  };

  const closeStory = () => {
    setSelectedStory(null);
    setAutoScrollSpeed(0);
  };

  useEffect(() => {
    if (scrollIntervalRef.current) {
      window.clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    if (selectedStory && autoScrollSpeed > 0 && detailRef.current) {
      scrollIntervalRef.current = window.setInterval(() => {
        const current = detailRef.current;
        if (!current) return;

        current.scrollBy({ top: autoScrollSpeed * 12, left: 0, behavior: "smooth" });

        if (current.scrollTop + current.clientHeight >= current.scrollHeight - 2) {
          window.clearInterval(scrollIntervalRef.current!);
          scrollIntervalRef.current = null;
        }
      }, 120);
    }

    return () => {
      if (scrollIntervalRef.current) {
        window.clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [selectedStory, autoScrollSpeed]);

  const getExcerpt = (text: string) => {
    return truncateText(text, 140);
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

  if (selectedStory) {
    return (
      <main className={`${styles.page} ${readMode === "dark" ? styles.readModeDark : styles.readModeLight}`}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={closeStory}
            aria-label="Kembali ke daftar cerita"
          >
            <FiArrowLeft />
          </button>
          <div>
            <h1>{selectedStory.title}</h1>
            <p className={styles.selectedStoryCategory}>{selectedStory.category}</p>
          </div>
          <div className={styles.headerPlaceholder} />
        </header>

        <section className={styles.detailHeader}>
          {selectedStory.photos && selectedStory.photos.length > 0 && (
            <div className={styles.detailImageWrap}>
              <img src={selectedStory.photos[0]} alt={selectedStory.userName} className={styles.detailImage} />
            </div>
          )}
          <div className={styles.detailMeta}>
            <p className={styles.storyAuthor}>Penulis : {selectedStory.userName}</p>
            <p className={styles.storyDate}>{new Date(selectedStory.createdAt).toLocaleDateString("id-ID")}</p>
            <p className={styles.storyExcerpt}>{getExcerpt(selectedStory.story)}</p>
          </div>
        </section>

        <section className={styles.detailActions}>
          <div className={styles.storyStats}>
            <button
              type="button"
              onClick={() => handleLike(selectedStory.id)}
              disabled={loadingActions[selectedStory.id] === "like" || !session?.user?.id}
              className={`${styles.iconButton} ${animatingLikes.has(selectedStory.id) ? styles.likeAnimating : ""}`}
              aria-label="Like cerita"
            >
              {userHasLiked(selectedStory) ? <AiFillLike /> : <AiOutlineLike />}
              <span>{selectedStory.likedBy.length}</span>
            </button>
            <div className={styles.iconButton} title="Dilihat" style={{ pointerEvents: "none", cursor: "default" }}>
              <AiOutlineEye />
              <span>{selectedStory.views || selectedStory.viewedBy?.length || 0}</span>
            </div>
            <button
              type="button"
              onClick={() => handleShare(selectedStory)}
              className={styles.iconButton}
              aria-label="Bagikan cerita"
            >
              <MdOutlineShare />
              <span>{selectedStory.shareCount || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => toggleBookmark(selectedStory.id)}
              disabled={loadingActions[selectedStory.id] === "save" || !session?.user?.id}
              className={`${styles.iconButton} ${isBookmarked(selectedStory.id) ? styles.activeBookmarkButton : ""}`}
              aria-label={isBookmarked(selectedStory.id) ? "Batal simpan cerita" : "Simpan cerita"}
            >
              {isBookmarked(selectedStory.id) ? <MdBookmark /> : <MdOutlineBookmark />}
              <span>{selectedStory.savedBy?.length || 0}</span>
            </button>
          </div>
        </section>

        <section className={styles.readControls}>
          <div>
            <button type="button" className={readMode === "light" ? styles.activeModeButton : styles.modeButton} onClick={() => setReadMode("light")}>Mode Terang</button>
            <button type="button" className={readMode === "dark" ? styles.activeModeButton : styles.modeButton} onClick={() => setReadMode("dark")}>Mode Gelap</button>
          </div>
          <div>
            <button type="button" className={autoScrollSpeed === 0 ? styles.activeSpeedButton : styles.speedButton} onClick={() => setAutoScrollSpeed(0)}>Stop</button>
            <button type="button" className={autoScrollSpeed === 0.5 ? styles.activeSpeedButton : styles.speedButton} onClick={() => setAutoScrollSpeed(0.5)}>0.5x</button>
            <button type="button" className={autoScrollSpeed === 1 ? styles.activeSpeedButton : styles.speedButton} onClick={() => setAutoScrollSpeed(1)}>1x</button>
          </div>
        </section>

        <section className={styles.detailStory} ref={detailRef}>
          <div className={styles.storyText}>{stripHtmlTags(selectedStory.story)}</div>
        </section>

        <section className={styles.commentSection}>
          <h2 className={styles.commentHeader}>Komentar</h2>
          {selectedStory.comments.length === 0 ? (
            <p className={styles.commentEmpty}>Belum ada komentar</p>
          ) : (
            <div className={styles.commentList}>
              {selectedStory.comments.map((comment) => (
                <div key={comment.id} className={styles.commentItem}>
                  <p className={styles.commentAuthor}>{comment.userName}</p>
                  <p className={styles.commentText}>{comment.text}</p>
                </div>
              ))}
            </div>
          )}
          {session?.user?.email && (
            <div className={styles.commentForm}>
              <input
                type="text"
                placeholder="Tambah komentar..."
                value={commentText[selectedStory.id] || ""}
                onChange={(e) => setCommentText(prev => ({ ...prev, [selectedStory.id]: e.target.value }))}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && loadingActions[selectedStory.id] !== "comment_send") {
                    handleAddComment(selectedStory.id);
                  }
                }}
                disabled={loadingActions[selectedStory.id] === "comment_send"}
              />
              <button
                type="button"
                onClick={() => handleAddComment(selectedStory.id)}
                disabled={loadingActions[selectedStory.id] === "comment_send"}
              >
                {loadingActions[selectedStory.id] === "comment_send" ? "Mengirim..." : "Kirim"}
              </button>
            </div>
          )}
        </section>

        {readStories.length > 0 && (
          <section className={styles.continueSection}>
            <button type="button" className={`${styles.tellStorySectionButton} ${styles.tellStoryButton}`} onClick={handleTellStory}>
              Tell your Story!
            </button>
            <div className={styles.continueList}>
              {readStories.filter((id) => id !== selectedStory.id).map((storyId) => {
                const story = stories.find((item) => item.id === storyId);
                return story ? (
                  <button key={story.id} type="button" className={styles.continueItem} onClick={() => openStory(story)}>
                    <span>{story.userName}</span>
                  </button>
                ) : null;
              })}
            </div>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.stickyTop}>
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
          <button
            type="button"
            className={styles.tellStoryHeaderButton}
            onClick={handleTellStory}
          >
            Tell your Story!
          </button>
        </header>

        <div className={styles.searchWrap}>
          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Cari cerita..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.searchHelperPlaceholder} />
          </div>
        </div>

        <div className={styles.topCategoryRow}>
          <button
            type="button"
            className={`${styles.topCategoryChip} ${activeTopCategory === "saved" ? styles.categoryChipActive : ""}`}
            onClick={() => {
              setActiveTopCategory("saved");
              setActiveCategory("Semua");
            }}
            aria-label="Cerita Disimpan"
          >
            <AiOutlineSave />
          </button>
          <button
            type="button"
            className={`${styles.topCategoryChip} ${activeTopCategory === "recent" ? styles.categoryChipActive : ""}`}
            onClick={() => {
              setActiveTopCategory("recent");
              setActiveCategory("Semua");
            }}
            aria-label="Cerita Baru Dibaca"
          >
            <AiOutlineHistory />
          </button>
          <button
            type="button"
            className={`${styles.topCategoryTextChip} ${activeTopCategory === "all" ? styles.categoryChipActive : ""}`}
            onClick={() => {
              setActiveTopCategory("all");
              setActiveCategory("Semua");
            }}
            aria-label="Semua cerita"
          >
            Semua
          </button>
        </div>

        {availableCategories.length > 1 && (
          <div className={styles.categoryRow}>
            {availableCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={`${styles.categoryChip} ${activeCategory === category ? styles.categoryChipActive : ""}`}
                onClick={() => {
                  setActiveTopCategory("all");
                  setActiveCategory(category);
                }}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </section>


      <section className={styles.storyList}>
        {filteredStories.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Tidak ada cerita sesuai pencarian atau kategori.</p>
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
            {filteredStories.map((story) => (
              <article key={story.id} className={styles.storyItem}>
                {story.photos && story.photos.length > 0 && (
                  <button type="button" className={styles.storyThumbnailButton} onClick={() => openStory(story)}>
                    <div className={styles.storyThumbnailFrame}>
                      <img src={story.photos[0]} alt={`Thumbnail cerita ${story.title}`} className={styles.storyThumbnail} />
                    </div>
                  </button>
                )}

                <div className={styles.storyHeaderInfo}>
                  <div>
                    <p className={styles.storyCategory}>{story.category}</p>
                    <h2 className={styles.storyTitle}>{story.title}</h2>
                  </div>
                </div>

                <p className={styles.storyExcerptText}>{getExcerpt(story.story)}</p>
                <div className={styles.storyCardFooter}>
                  <button type="button" className={styles.readMoreButton} onClick={() => openStory(story)}>
                    Baca Selengkapnya
                  </button>
                  <div className={styles.storyStats}>
                    <button
                      type="button"
                      onClick={() => handleLike(story.id)}
                      disabled={loadingActions[story.id] === "like" || !session?.user?.id}
                      className={`${styles.iconButton} ${animatingLikes.has(story.id) ? styles.likeAnimating : ""}`}
                      aria-label="Like cerita"
                    >
                      {userHasLiked(story) ? <AiFillLike /> : <AiOutlineLike />}
                      <span>{story.likedBy.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openStory(story)}
                      className={styles.iconButton}
                      aria-label="Jumlah dilihat"
                    >
                      <AiOutlineEye />
                      <span>{story.views || story.viewedBy?.length || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBookmark(story.id)}
                      disabled={loadingActions[story.id] === "save" || !session?.user?.id}
                      className={`${styles.iconButton} ${styles.bookmarkButton} ${isBookmarked(story.id) ? styles.activeBookmarkButton : ""}`}
                      aria-label={isBookmarked(story.id) ? "Batal simpan cerita" : "Simpan cerita"}
                    >
                      {isBookmarked(story.id) ? <MdBookmark /> : <MdOutlineBookmark />}
                      <span>{story.savedBy?.length || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(story)}
                      className={styles.iconButton}
                      aria-label="Bagikan cerita"
                    >
                      <MdOutlineShare />
                      <span>{story.shareCount || 0}</span>
                    </button>
                  </div>
                </div>
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
