"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { StoreTestimonial, StoreTestimonialComment, CommentReactionSummary, StoreProduct } from "@/types/store";
import styles from "./TestimoniClient.module.css";

interface TestimoniClientProps {
  testimonials: StoreTestimonial[];
  activeRating: number | null;
}

const COMMON_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

export default function TestimoniClient({ testimonials, activeRating }: TestimoniClientProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Record<string, StoreTestimonialComment[]>>({});
  const [reactions, setReactions] = useState<Record<string, CommentReactionSummary[]>>({});
  const [isLoadingComments, setIsLoadingComments] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, { id: string; name: string } | null>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [isDeletingComment, setIsDeletingComment] = useState<Record<string, boolean>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");
  const [isEditingComment, setIsEditingComment] = useState<Record<string, boolean>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<Record<string, boolean>>({});
  const [isLoadingReactions, setIsLoadingReactions] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<StoreProduct[]>([]);

  const filtered = useMemo(() => {
    return testimonials.filter((testimonial) => activeRating === null || testimonial.rating === activeRating);
  }, [testimonials, activeRating]);

  const loadReactions = useCallback(
    async (commentId: string) => {
      if (reactions[commentId]) return;

      setIsLoadingReactions((prev) => ({ ...prev, [commentId]: true }));
      try {
        const testimonialId = filtered[0]?.id; // This is a workaround; ideally pass testimonialId
        const res = await fetch(`/api/testimonials/${testimonialId}/comments/${commentId}/reactions`);
        const data = (await res.json()) as { reactions: CommentReactionSummary[] };
        setReactions((prev) => ({ ...prev, [commentId]: data.reactions }));
      } catch (error) {
        console.error("Failed to load reactions:", error);
      } finally {
        setIsLoadingReactions((prev) => ({ ...prev, [commentId]: false }));
      }
    },
    [reactions, filtered],
  );

  const addReaction = useCallback(
    async (testimonialId: string, commentId: string, emoji: string) => {
      if (!session?.user) return;

      try {
        const res = await fetch(
          `/api/testimonials/${testimonialId}/comments/${commentId}/reactions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji }),
          },
        );

        const data = (await res.json()) as { reactions: CommentReactionSummary[] };
        if (res.ok) {
          setReactions((prev) => ({ ...prev, [commentId]: data.reactions }));
          setShowReactionPicker((prev) => ({ ...prev, [commentId]: false }));
        }
      } catch (error) {
        console.error("Failed to add reaction:", error);
      }
    },
    [session],
  );

  const removeReaction = useCallback(
    async (testimonialId: string, commentId: string, emoji: string) => {
      if (!session?.user) return;

      try {
        const res = await fetch(
          `/api/testimonials/${testimonialId}/comments/${commentId}/reactions`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji }),
          },
        );

        const data = (await res.json()) as { reactions: CommentReactionSummary[] };
        if (res.ok) {
          setReactions((prev) => ({ ...prev, [commentId]: data.reactions }));
        }
      } catch (error) {
        console.error("Failed to remove reaction:", error);
      }
    },
    [session],
  );

  const editComment = useCallback(
    async (testimonialId: string, commentId: string, newText: string) => {
      if (!session?.user || !newText.trim()) return;

      setIsEditingComment((prev) => ({ ...prev, [commentId]: true }));
      try {
        const res = await fetch(`/api/testimonials/${testimonialId}/comments`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId, text: newText }),
        });

        const data = (await res.json()) as { comment: StoreTestimonialComment };
        if (res.ok) {
          setComments((prev) => ({
            ...prev,
            [testimonialId]: (prev[testimonialId] || []).map((c) =>
              c.id === commentId ? data.comment : c,
            ),
          }));
          setEditingCommentId(null);
          setEditingCommentText("");
        } else {
          const error = (await res.json()) as { message?: string };
          alert(error.message || "Gagal edit komentar");
        }
      } catch (error) {
        console.error("Failed to edit comment:", error);
        alert("Gagal edit komentar");
      } finally {
        setIsEditingComment((prev) => ({ ...prev, [commentId]: false }));
      }
    },
    [session],
  );

  useEffect(() => {
    // Fetch products to get images
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/store");
        const data = (await res.json()) as { products: StoreProduct[] };
        setProducts(data.products);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      }
    };
    fetchProducts();
  }, []);

  const loadComments = useCallback(
    async (testimonialId: string) => {
      if (comments[testimonialId]) return;

      setIsLoadingComments((prev) => ({ ...prev, [testimonialId]: true }));
      try {
        const res = await fetch(`/api/testimonials/${testimonialId}/comments`);
        const data = (await res.json()) as { comments: StoreTestimonialComment[] };
        setComments((prev) => ({ ...prev, [testimonialId]: data.comments }));
      } catch (error) {
        console.error("Failed to load comments:", error);
      } finally {
        setIsLoadingComments((prev) => ({ ...prev, [testimonialId]: false }));
      }
    },
    [comments],
  );

  const submitComment = useCallback(
    async (testimonialId: string) => {
      const text = commentText[testimonialId]?.trim();
      if (!text || !session?.user) return;

      setIsSubmitting((prev) => ({ ...prev, [testimonialId]: true }));
      try {
        const res = await fetch(`/api/testimonials/${testimonialId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            replyToId: replyTo[testimonialId]?.id,
            replyToName: replyTo[testimonialId]?.name,
          }),
        });

        const data = (await res.json()) as { comment: StoreTestimonialComment };
        if (res.ok) {
          setComments((prev) => ({
            ...prev,
            [testimonialId]: [...(prev[testimonialId] || []), data.comment],
          }));
          setCommentText((prev) => ({ ...prev, [testimonialId]: "" }));
          setReplyTo((prev) => ({ ...prev, [testimonialId]: null }));
        }
      } catch (error) {
        console.error("Failed to submit comment:", error);
      } finally {
        setIsSubmitting((prev) => ({ ...prev, [testimonialId]: false }));
      }
    },
    [commentText, replyTo, session],
  );

  const deleteComment = useCallback(
    async (testimonialId: string, commentId: string) => {
      if (!session?.user) return;
      if (!confirm("Yakin hapus komentar ini?")) return;

      setIsDeletingComment((prev) => ({ ...prev, [commentId]: true }));
      try {
        const res = await fetch(`/api/testimonials/${testimonialId}/comments`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId }),
        });

        if (res.ok) {
          setComments((prev) => ({
            ...prev,
            [testimonialId]: (prev[testimonialId] || []).filter((c) => c.id !== commentId),
          }));
        } else {
          const error = (await res.json()) as { message?: string };
          alert(error.message || "Gagal hapus komentar");
        }
      } catch (error) {
        console.error("Failed to delete comment:", error);
        alert("Gagal hapus komentar");
      } finally {
        setIsDeletingComment((prev) => ({ ...prev, [commentId]: false }));
      }
    },
    [session],
  );

  const toggleComments = (testimonialId: string) => {
    if (comments[testimonialId]) {
      setComments((prev) => {
        const newComments = { ...prev };
        delete newComments[testimonialId];
        return newComments;
      });
    } else {
      loadComments(testimonialId);
    }
  };

  return (
    <div className={styles.grid}>
      {filtered.map((testimonial) => (
        <div key={testimonial.id} className={styles.card}>
          <div className={styles.rating}>
            {testimonial.rating > 0 ? "⭐".repeat(testimonial.rating) : "No Rating"}
          </div>

          <div className={styles.cardHeader}>
            {testimonial.mediaUrl ? (
              <FlexibleMedia
                src={testimonial.mediaUrl}
                alt={testimonial.name}
                className={styles.avatar}
                unoptimized
              />
            ) : (
              <div className={styles.avatarPlaceholder} />
            )}
            <div className={styles.nameSection}>
              <div className={styles.nameWithVerified}>
                <h3 className={styles.name}>{testimonial.name}</h3>
                {testimonial.verified && (
                  <span className={styles.verifiedBadge} title="Terverifikasi">
                    ✓
                  </span>
                )}
              </div>
              <p className={styles.role}>{testimonial.roleLabel}</p>
            </div>
          </div>

          <p className={styles.message}>{testimonial.message}</p>

          {testimonial.userAvatarUrl && (
            <img src={testimonial.userAvatarUrl} alt="User avatar" className={styles.userAvatar} />
          )}

          {testimonial.linkedProducts && testimonial.linkedProducts.length > 0 && (
            <div className={styles.linkedProducts}>
              <p className={styles.linkedProductsLabel}>Produk Terkait</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {testimonial.linkedProducts.map((product) => {
                  const productData = products.find(p => p.id === product.productId);
                  return (
                    <Link
                      key={product.productId}
                      href={`/produk/${product.productId}`}
                      className={styles.linkedProductItem}
                      title={product.productName}
                    >
                      {productData?.imageUrl && (
                        <img
                          src={productData.imageUrl}
                          alt={product.productName}
                          className={styles.linkedProductThumbnail}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <span className={styles.linkedProductName}>{product.productName}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {testimonial.audioUrl && (
            <audio controls className={styles.audio}>
              <source src={testimonial.audioUrl} type="audio/mpeg" />
              Audio testimonial tidak dapat diputar.
            </audio>
          )}

          {/* Comments Section */}
          <button
            type="button"
            onClick={() => toggleComments(testimonial.id)}
            className={styles.commentsToggle}
          >
            💬 Komentar ({comments[testimonial.id]?.length ?? 0})
          </button>

          {comments[testimonial.id] && (
            <div className={styles.commentsSection}>
              {isLoadingComments[testimonial.id] && <p>Loading komentar...</p>}

              {/* Comments List */}
              <div className={styles.commentsList}>
                {comments[testimonial.id]?.map((comment) => (
                  <div key={comment.id} className={styles.comment}>
                    <div className={styles.commentHeader}>
                      {comment.userAvatarUrl ? (
                        <img
                          src={comment.userAvatarUrl}
                          alt={comment.userName}
                          className={styles.commentAvatar}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = "https://via.placeholder.com/32?text=" + encodeURIComponent(comment.userName.charAt(0));
                          }}
                        />
                      ) : (
                        <div className={styles.commentAvatarPlaceholder} />
                      )}
                      <div className={styles.commentUserInfo}>
                        <div className={styles.commentNameWithVerified}>
                          <span className={
                            comment.userName === "Tokko Marketplace" ? styles.adminCommentName :
                            comment.userId === session?.user?.id ? styles.ownCommentName :
                            comment.verified ? styles.verifiedCommentName : styles.commentName
                          }>
                            {comment.userName === "Tokko Marketplace" ? "Bold" : comment.userName}
                          </span>
                          {(comment.verified || comment.userName === "Tokko Marketplace") && (
                            <div className={styles.verifiedBadgeInline}>
                              <VerifiedBadge />
                            </div>
                          )}
                        </div>
                        <span className={styles.commentDate}>
                          {new Date(comment.createdAt).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                    </div>

                    {comment.replyToName && (
                      <p className={styles.replyTo}>@{comment.replyToName}</p>
                    )}

                    {editingCommentId === comment.id ? (
                      <div className={styles.editCommentForm}>
                        <textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          maxLength={500}
                          className={styles.textInput}
                        />
                        <div className={styles.editCommentActions}>
                          <button
                            type="button"
                            onClick={() =>
                              editComment(testimonial.id, comment.id, editingCommentText)
                            }
                            disabled={isEditingComment[comment.id] || !editingCommentText.trim()}
                            className={styles.submitButton}
                          >
                            {isEditingComment[comment.id] ? "Menyimpan..." : "Simpan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentText("");
                            }}
                            className={styles.cancelButton}
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.commentText}>{comment.text}</p>
                    )}

                    <div className={styles.commentReactions}>
                      {reactions[comment.id] && reactions[comment.id].length > 0 && (
                        <div className={styles.reactionsDisplay}>
                          {reactions[comment.id].map((reaction) => (
                            <button
                              key={reaction.emoji}
                              type="button"
                              onClick={() => {
                                if (reaction.userReacted) {
                                  removeReaction(testimonial.id, comment.id, reaction.emoji);
                                } else {
                                  addReaction(testimonial.id, comment.id, reaction.emoji);
                                }
                              }}
                              className={`${styles.reactionBadge} ${
                                reaction.userReacted ? styles.reactionActive : ""
                              }`}
                              title={`Kamu ${reaction.userReacted ? "sudah" : "belum"} memberi reaksi`}
                            >
                              {reaction.emoji} {reaction.count > 1 && <span>{reaction.count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={styles.commentActions}>
                      {session?.user && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (!reactions[comment.id]) {
                                loadReactions(comment.id);
                              }
                              setShowReactionPicker((prev) => ({
                                ...prev,
                                [comment.id]: !prev[comment.id],
                              }));
                            }}
                            className={styles.reactionButton}
                            title="Tambah reaksi"
                          >
                            😊
                          </button>
                          {showReactionPicker[comment.id] && (
                            <div className={styles.reactionPicker}>
                              {COMMON_REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() =>
                                    addReaction(testimonial.id, comment.id, emoji)
                                  }
                                  className={styles.reactionOption}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setReplyTo((prev) => ({
                                ...prev,
                                [testimonial.id]: { id: comment.id, name: comment.userName },
                              }))
                            }
                            className={styles.replyButton}
                          >
                            Balas
                          </button>
                        </>
                      )}
                      {session?.user &&
                        (session.user.role === "admin" ||
                          comment.userId === session.user.id) && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.text);
                              }}
                              disabled={editingCommentId !== null}
                              className={styles.editButton}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                deleteComment(testimonial.id, comment.id)
                              }
                              disabled={isDeletingComment[comment.id]}
                              className={styles.deleteButton}
                            >
                              {isDeletingComment[comment.id]
                                ? "Hapus..."
                                : "Hapus"}
                            </button>
                          </>
                        )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              {session?.user && (
                <div className={styles.commentInput}>
                  {replyTo[testimonial.id] && (
                    <div className={styles.replyingTo}>
                      Membalas @{replyTo[testimonial.id]?.name}
                      <button
                        type="button"
                        onClick={() => setReplyTo((prev) => ({ ...prev, [testimonial.id]: null }))}
                        className={styles.cancelReply}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <textarea
                    value={commentText[testimonial.id] ?? ""}
                    onChange={(e) =>
                      setCommentText((prev) => ({
                        ...prev,
                        [testimonial.id]: e.target.value,
                      }))
                    }
                    placeholder={replyTo[testimonial.id] ? `Balas @${replyTo[testimonial.id]?.name}...` : "Tulis komentar..."}
                    maxLength={500}
                    className={styles.textInput}
                  />
                  <button
                    type="button"
                    onClick={() => submitComment(testimonial.id)}
                    disabled={
                      isSubmitting[testimonial.id] || !commentText[testimonial.id]?.trim()
                    }
                    className={styles.submitButton}
                  >
                    {isSubmitting[testimonial.id] ? "Mengirim..." : "Kirim"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
