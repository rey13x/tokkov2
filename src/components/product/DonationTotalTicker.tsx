"use client";

import { formatRupiah } from "@/data/products";
import styles from "./DonationTotalTicker.module.css";

type DonationTotalTickerProps = {
  amount: number;
  slow?: boolean;
};

export default function DonationTotalTicker({ amount, slow = false }: DonationTotalTickerProps) {
  const target = Math.max(0, Math.round(Number(amount) || 0));

  return (
    <span className={`${styles.ticker}${slow ? ` ${styles.tickerSlow}` : ""}`} aria-label={`Terkumpul ${formatRupiah(target)}`}>
      Terkumpul {formatRupiah(target)}
    </span>
  );
}
