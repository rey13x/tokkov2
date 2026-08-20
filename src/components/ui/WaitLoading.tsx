"use client";

import styles from "./WaitLoading.module.css";

type WaitLoadingProps = {
  centered?: boolean;
  viewport?: boolean;
  text?: string;
};

export default function WaitLoading({
  centered = false,
  viewport = false,
  text = "Pastikan Internet kamu Stabil...",
}: WaitLoadingProps) {
  const className = viewport ? styles.viewport : centered ? styles.centered : undefined;

  return (
    <div className={className}>
      <div className={styles.pill} role="status" aria-live="polite" aria-label={text}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  );
}

