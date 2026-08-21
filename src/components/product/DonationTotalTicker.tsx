"use client";

import { formatRupiah } from "@/data/products";
import styles from "./DonationTotalTicker.module.css";

type DonationTotalTickerProps = {
  amount: number;
};

export default function DonationTotalTicker({ amount }: DonationTotalTickerProps) {
  const target = Math.max(0, Math.round(Number(amount) || 0));

  return (
    <span className={styles.ticker} aria-label={`Terkumpul ${formatRupiah(target)}`}>
      Terkumpul {formatRupiah(target)}
    </span>
  );
}
