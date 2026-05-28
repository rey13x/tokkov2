"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import type { StoreTestimonial, StoreTestimonialComment } from "@/types/store";
import styles from "./TestimoniClient.module.css";

interface TestimoniClientProps {
  testimonials: StoreTestimonial[];
  activeRating: number | null;
}

export default function TestimoniClient({ testimonials, activeRating }: TestimoniClientProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Record<string, StoreTestimonialComment[]>>({});
  const [isLoadingComments, setIsLoadingComments] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, { id: string; name: string } | null>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return testimonials.filter((testimonial) => activeRating === null || testimonial.rating === activeRating);
  }, [testimonials, activeRating]);

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
              <p className={styles.linkedProductsLabel}>Produk Terkait:</p>
              {testimonial.linkedProducts.map((product) => (
                <div key={product.productId} className={styles.linkedProductItem}>
                  {product.productName}
                </div>
              ))}
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
                        />
                      ) : (
                        <div className={styles.commentAvatarPlaceholder} />
                      )}
                      <div className={styles.commentUserInfo}>
                        <div className={styles.commentNameWithVerified}>
                          <span className={comment.userName === "Tokko Marketplace" ? styles.tokkoMarketplaceName : styles.commentName}>
                            {comment.userName}
                          </span>
                          {comment.verified && (
                            <span className={styles.verifiedBadge} title="Terverifikasi">
                              ✓
                            </span>
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

                    <p className={styles.commentText}>{comment.text}</p>

                    {session?.user && (
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
                        Reply
                      </button>
                    )}
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
                    placeholder="Tulis komentar..."
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
