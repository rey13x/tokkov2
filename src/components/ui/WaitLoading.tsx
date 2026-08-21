"use client";

import styles from "./WaitLoading.module.css";

type WaitLoadingProps = {
  centered?: boolean;
  viewport?: boolean;
  text?: string | undefined;
};

const DEFAULT_LOADING_TEXT = "Lagi ngambil data, Pastiin internet kamu ada...";

export default function WaitLoading({
  centered = false,
  viewport = false,
  text,
}: WaitLoadingProps) {
  const className = viewport ? styles.viewport : centered ? styles.centered : undefined;

  const displayText = text ?? DEFAULT_LOADING_TEXT;

  return (
    <div className={className}>
      <div className={styles.pill} role="status" aria-live="polite" aria-label={displayText}>
        <span className={styles.spinner} aria-hidden="true" />
        {displayText ? <span>{displayText}</span> : null}
      </div>
    </div>
  );
}

