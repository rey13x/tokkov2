"use client";

import styles from "./rating-stars.module.css";

type RatingStarsProps = {
  rating: number;
  animated?: boolean;
};

export function RatingStars({ rating, animated = false }: RatingStarsProps) {
  const roundedRating = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`${styles.stars} ${animated ? styles.animated : ""}`} aria-label={`Rating ${rating} dari 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < roundedRating ? styles.starActive : styles.star}>★</span>
      ))}
    </span>
  );
}
