"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LiquidGlassCursor.module.css";

interface MousePos {
  x: number;
  y: number;
}

export default function LiquidGlassCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePos = useRef<MousePos>({ x: 0, y: 0 });
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  const isOverButton = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };
    updateCanvasSize();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Track mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    // Detect hover over buttons and interactive elements
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.classList.contains("interactive") ||
        target.closest("button") ||
        target.closest("a");
      isOverButton.current = !!isInteractive;
      targetScale.current = isOverButton.current ? 2 : 1;
    };

    const handleMouseOut = () => {
      targetScale.current = 1;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);

    // Animation loop
    const animate = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      // Smooth scale transition
      currentScale.current +=
        (targetScale.current - currentScale.current) * 0.15;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      const x = mousePos.current.x;
      const y = mousePos.current.y;
      const baseRadius = 15;
      const radius = baseRadius * currentScale.current;

      // Draw liquid glass cursor
      // Outer ring with glow
      ctx.fillStyle = "rgba(100, 150, 255, 0.1)";
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
      ctx.fill();

      // Middle ring
      ctx.fillStyle = "rgba(100, 150, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.fill();

      // Core with gradient
      const gradient = ctx.createRadialGradient(
        x - 3,
        y - 3,
        0,
        x,
        y,
        radius
      );
      gradient.addColorStop(0, "rgba(150, 180, 255, 0.8)");
      gradient.addColorStop(0.5, "rgba(100, 150, 255, 0.4)");
      gradient.addColorStop(1, "rgba(80, 130, 255, 0.1)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Highlight on top
      ctx.fillStyle = "rgba(200, 220, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(x - radius / 3, y - radius / 3, radius / 4, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = "rgba(120, 170, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => updateCanvasSize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.cursor} />;
}
