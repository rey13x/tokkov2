"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/data/products";
import styles from "./DonationTotalTicker.module.css";

type DonationTotalTickerProps = {
  amount: number;
};

export default function DonationTotalTicker({ amount }: DonationTotalTickerProps) {
  const target = Math.max(0, Math.round(Number(amount) || 0));
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let delayId = 0;
    const duration = 2000;

    const startAnimation = () => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const easedProgress = 1 - (1 - progress) ** 3;
        setDisplayAmount(Math.round(target * easedProgress));
        if (progress < 1) {
          frameId = window.requestAnimationFrame(tick);
        }
      };

      setDisplayAmount(0);
      frameId = window.requestAnimationFrame(tick);
    };

    delayId = window.setTimeout(startAnimation, 500);
    return () => {
      window.clearTimeout(delayId);
      window.cancelAnimationFrame(frameId);
    };
  }, [target]);

  return (
    <span className={styles.ticker} aria-label={`Terkumpul ${formatRupiah(target)}`}>
      Terkumpul {formatRupiah(displayAmount)}
    </span>
  );
}
