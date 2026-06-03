"use client";

import { useEffect, useRef } from "react";
import styles from "./LiquidGlassBackground.module.css";

export default function LiquidGlassBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Optional: Add scroll effect or parallax
    const handleScroll = () => {
      if (!containerRef.current) return;
      // The background will stay fixed due to CSS background-attachment: fixed
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <div ref={containerRef} className={styles.liquidGlassBackground} />;
}
