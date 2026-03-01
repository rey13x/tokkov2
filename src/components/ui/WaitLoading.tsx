"use client";

import styles from "./WaitLoading.module.css";

type WaitLoadingProps = {
  centered?: boolean;
  text?: string;
};

export default function WaitLoading({
  centered = false,
  text = "Tunggu sebentar yaa..",
}: WaitLoadingProps) {
  return (
    <div className={centered ? styles.centered : undefined}>
      <div className={styles.pill} role="status" aria-live="polite" aria-label={text}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>{text}</span>
      </div>
    </div>
  );
}

