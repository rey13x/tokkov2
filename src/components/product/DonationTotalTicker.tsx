"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { formatRupiah } from "@/data/products";
import NumberTicker from "@/components/ui/number-ticker";
import styles from "./DonationTotalTicker.module.css";

type DonationTotalTickerProps = {
  amount: number;
  slow?: boolean;
  showCelebration?: boolean;
};

export default function DonationTotalTicker({ amount, slow = false, showCelebration = false }: DonationTotalTickerProps) {
  const target = Math.max(0, Math.round(Number(amount) || 0));
  const [completedTarget, setCompletedTarget] = useState<number | null>(null);
  const [shimmerTarget, setShimmerTarget] = useState<number | null>(null);
  const [logoExiting, setLogoExiting] = useState(false);
  const [tickerKey, setTickerKey] = useState(0);
  const shimmerTimerRef = useRef<number | null>(null);
  const logoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shimmerTimerRef.current !== null) {
        window.clearTimeout(shimmerTimerRef.current);
      }
      if (logoTimerRef.current !== null) {
        window.clearTimeout(logoTimerRef.current);
      }
    };
  }, [target]);

  const handleTickerComplete = () => {
    setCompletedTarget(target);
    if (shimmerTimerRef.current !== null) {
      window.clearTimeout(shimmerTimerRef.current);
    }
    shimmerTimerRef.current = window.setTimeout(() => setShimmerTarget(target), 650);
  };

  const restartTicker = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setLogoExiting(true);
    if (shimmerTimerRef.current !== null) {
      window.clearTimeout(shimmerTimerRef.current);
    }
    logoTimerRef.current = window.setTimeout(() => {
      setCompletedTarget(null);
      setShimmerTarget(null);
      setLogoExiting(false);
      setTickerKey((current) => current + 1);
    }, 460);
  };
  const shimmerClass = styles.tickerShimmer;

  const className = [
    styles.ticker,
    completedTarget === target ? styles.tickerBounce : "",
    shimmerTarget === target ? `${shimmerClass}${slow ? ` ${styles.tickerShimmerSlow}` : ""}` : "",
  ].filter(Boolean).join(" ");
  const numberClassName = [
    shimmerTarget === target ? `${shimmerClass}${slow ? ` ${styles.tickerShimmerSlow}` : ""}` : "",
  ].filter(Boolean).join(" ");
  const particles = [
    { left: "54%", top: "-105%", delay: "0ms", duration: "520ms", rotate: "-18deg" },
    { left: "78%", top: "-72%", delay: "90ms", duration: "610ms", rotate: "16deg" },
    { left: "101%", top: "-22%", delay: "170ms", duration: "470ms", rotate: "-12deg" },
    { left: "108%", top: "34%", delay: "250ms", duration: "570ms", rotate: "22deg" },
    { left: "91%", top: "78%", delay: "330ms", duration: "640ms", rotate: "-20deg" },
    { left: "66%", top: "99%", delay: "410ms", duration: "500ms", rotate: "12deg" },
  ];

  return (
    <span className={className} aria-label={`Terkumpul ${formatRupiah(target)}`}>
      Terkumpul Rp <NumberTicker key={tickerKey} value={target} reverse className={numberClassName} onComplete={handleTickerComplete} />
      {showCelebration && (completedTarget === target || logoExiting) ? (
        <button
          type="button"
          className={`${styles.brandMark} ${logoExiting ? styles.brandMarkExiting : styles.brandMarkEntering}`}
          onClick={restartTicker}
          aria-label="Ulangi animasi donasi"
          title="Ulangi animasi"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/maintenancelogo.jpg" alt="" />
        </button>
      ) : null}
      {showCelebration ? (
        <span className={`${styles.particleField}${completedTarget === target ? ` ${styles.particleFieldDone}` : ""}`} aria-hidden="true">
          {particles.map((particle, index) => (
            <i
              key={index}
              className={styles.particle}
              style={{
                left: particle.left,
                top: particle.top,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
                ["--particle-rotate" as string]: particle.rotate,
              } as CSSProperties}
            >
              +
            </i>
          ))}
        </span>
      ) : null}
    </span>
  );
}
