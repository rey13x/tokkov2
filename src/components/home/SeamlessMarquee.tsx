"use client";

import { ReactNode, useMemo } from "react";
import styles from "./SeamlessMarquee.module.css";

interface SeamlessMarqueeProps<T> {
  items: T[];
  renderItem: (item: T, index: number, duplicate: number) => ReactNode;
  speed?: number; // pixels per second (default: 30)
  gap?: number; // gap between items in pixels
  className?: string;
  itemClassName?: string;
  animationDuration?: number; // in seconds (calculated from speed if not provided)
  autoplay?: boolean; // enable/disable animation (default: true)
}

export default function SeamlessMarquee<T extends { id: string }>({
  items,
  renderItem,
  speed = 30,
  gap = 0,
  className,
  itemClassName,
  animationDuration,
  autoplay = true,
}: SeamlessMarqueeProps<T>) {
  // Duplicate items to create seamless loop (minimum 3x for smooth transition)
  const duplicatedItems = useMemo(() => {
    if (items.length === 0) return [];
    // Repeat at least 3 times to ensure smooth looping
    const repetitions = Math.max(3, Math.ceil(100 / Math.max(1, items.length)));
    return Array.from({ length: repetitions }, (_, dupIndex) =>
      items.map((item, itemIndex) => ({
        ...item,
        _duplicateIndex: dupIndex,
        _itemIndex: itemIndex,
        _uniqueKey: `${item.id}-${dupIndex}-${itemIndex}`,
      }))
    ).flat();
  }, [items]);

  // Calculate animation duration based on speed or use provided value
  const duration = useMemo(() => {
    if (animationDuration) return animationDuration;
    
    // Calculate total width of one set of items
    const itemCount = items.length;
    const estimatedItemWidth = 80; // rough estimate
    const totalWidth = itemCount * (estimatedItemWidth + gap) + gap;
    
    // Duration = totalWidth / speed
    return Math.max(10, totalWidth / Math.max(1, speed));
  }, [items.length, gap, speed, animationDuration]);

  if (items.length === 0) {
    return null;
  }

  // CSS variable for animation duration
  const animationStyle = {
    "--marquee-duration": `${duration}s`,
    "--marquee-play-state": autoplay ? "running" : "paused",
  } as React.CSSProperties;

  return (
    <div
      className={`${styles.marqueeContainer} ${className || ""}`}
      style={animationStyle}
    >
      <div className={styles.marqueeTrack}>
        {duplicatedItems.map((item) => (
          <div key={item._uniqueKey} className={`${styles.marqueeItem} ${itemClassName || ""}`}>
            {renderItem(item as T, item._itemIndex, item._duplicateIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}
