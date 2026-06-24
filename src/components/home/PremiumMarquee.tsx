"use client";

import React, { ReactNode, useEffect, useRef, useState, useCallback, useMemo } from "react";
import styles from "./PremiumMarquee.module.css";

interface PremiumMarqueeProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  speed?: number; // pixels per second (target: logo 20px/s, testimonial 12px/s)
  gap?: number; // gap between items in pixels
  className?: string;
  itemClassName?: string;
  pauseOnHover?: boolean;
  pauseOnTouch?: boolean;
}

export default function PremiumMarquee<T extends { id: string }>({
  items,
  renderItem,
  speed = 20,
  gap = 16,
  className,
  itemClassName,
  pauseOnHover = true,
  pauseOnTouch = true,
}: PremiumMarqueeProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(Date.now());
  const positionRef = useRef<number>(0);
  const contentWidthRef = useRef<number>(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isAnimating, setIsAnimating] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate items for seamless loop (need at least 3x repetition)
  const duplicatedItems = useMemo(() => {
    if (items.length === 0) return [];

    // Calculate how many times we need to repeat items
    const repetitions = Math.max(3, Math.ceil(150 / Math.max(1, items.length)));

    const duplicated: Array<T & { _key: string }> = [];
    for (let rep = 0; rep < repetitions; rep++) {
      items.forEach((item, idx) => {
        duplicated.push({
          ...item,
          _key: `${item.id}-${rep}-${idx}`,
        });
      });
    }
    return duplicated;
  }, [items]);

  // Animate marquee using requestAnimationFrame
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const animate = () => {
      if (isPaused || !isAnimating) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = Date.now();
      const deltaTime = (now - lastTimeRef.current) / 1000; // Convert to seconds
      lastTimeRef.current = now;

      // Calculate pixel movement: speed (px/s) * deltaTime (s)
      const movement = speed * deltaTime;
      positionRef.current -= movement;

      // Get content width (width of one set of original items)
      if (contentWidthRef.current === 0) {
        const firstItem = track.children[0] as HTMLElement;
        if (firstItem && items.length > 0) {
          const itemWidth = firstItem.offsetWidth;
          contentWidthRef.current = items.length * itemWidth + items.length * gap;
        }
      }

      // Seamless looping: when we've scrolled one full set, reset position
      if (contentWidthRef.current > 0) {
        if (positionRef.current <= -contentWidthRef.current) {
          positionRef.current = 0;
        }
      }

      // Apply transform for smooth GPU-accelerated animation
      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPaused, isAnimating, speed, items.length, gap]);

  // Handle hover pause
  useEffect(() => {
    if (!pauseOnHover) return;

    const container = containerRef.current;
    if (!container) return;

    const onMouseEnter = () => {
      setIsPaused(true);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
    };

    const onMouseLeave = () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      // Resume after 1.5 seconds
      pauseTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
        lastTimeRef.current = Date.now(); // Reset time to avoid jump
        pauseTimeoutRef.current = null;
      }, 1500);
    };

    container.addEventListener("mouseenter", onMouseEnter, { capture: false });
    container.addEventListener("mouseleave", onMouseLeave, { capture: false });

    return () => {
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mouseleave", onMouseLeave);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [pauseOnHover]);

  // Handle touch pause
  useEffect(() => {
    if (!pauseOnTouch || !containerRef.current) return;

    const onTouchStart = () => {
      setIsPaused(true);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };

    const onTouchEnd = () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      // Resume after 1.5 seconds
      pauseTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
        lastTimeRef.current = Date.now(); // Reset time to avoid jump
      }, 1500);
    };

    const container = containerRef.current;
    container.addEventListener("touchstart", onTouchStart);
    container.addEventListener("touchend", onTouchEnd);

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [pauseOnTouch]);

  // Handle manual drag
  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    let isMouseDown = false;
    let dragStartX = 0;
    let dragStartPosition = 0;
    let lastDragX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      dragStartX = e.clientX;
      dragStartPosition = positionRef.current;
      lastDragX = e.clientX;
      setIsPaused(true);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      
      const deltaX = e.clientX - dragStartX;
      positionRef.current = dragStartPosition + deltaX;
      
      // Apply transform
      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      lastTimeRef.current = Date.now();
    };

    const onMouseUp = () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      lastTimeRef.current = Date.now();
      
      // Resume animation after 800ms
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      pauseTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
      }, 800);
    };

    let isTouchDown = false;
    let touchStartX = 0;
    let touchStartPosition = 0;

    const onTouchStart = (e: TouchEvent) => {
      isTouchDown = true;
      touchStartX = e.touches[0].clientX;
      touchStartPosition = positionRef.current;
      setIsPaused(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchDown) return;
      
      const deltaX = e.touches[0].clientX - touchStartX;
      positionRef.current = touchStartPosition + deltaX;
      
      // Apply transform
      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      lastTimeRef.current = Date.now();
    };

    const onTouchEnd = () => {
      if (!isTouchDown) return;
      isTouchDown = false;
      lastTimeRef.current = Date.now();
      
      // Resume animation after 800ms
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
      pauseTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
      }, 800);
    };

    container.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.marqueeContainer} ${className || ""}`}
      style={{
        "--marquee-gap": `${gap}px`,
      } as React.CSSProperties}
    >
      <div className={styles.marqueeViewport}>
        <div ref={trackRef} className={styles.marqueeTrack} style={{ gap }}>
          {duplicatedItems.map((item) => (
            <div
              key={item._key}
              className={`${styles.marqueeSlide} ${itemClassName || ""}`}
            >
              {renderItem(item as T, 0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
