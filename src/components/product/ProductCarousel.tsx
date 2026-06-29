"use client";

import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { isVideoMediaUrl } from "@/lib/media";
import type { ProductMediaItem } from "@/types/store";
import styles from "./ProductCarousel.module.css";

type ProductCarouselProps = {
  primaryImage: string;
  mediaGallery?: ProductMediaItem[];
  productName: string;
};

export default function ProductCarousel({
  primaryImage,
  mediaGallery,
  productName,
}: ProductCarouselProps) {
  // Combine primary image with gallery
  const allMedia: ProductMediaItem[] = [
    { url: primaryImage, type: "image" },
    ...(mediaGallery || []),
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const dragStartX = useRef<number>(0);
  const dragStartTime = useRef<number>(0);
  const progressInterval = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideStartTime = useRef<number>(Date.now());
  const videoDuration = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentMedia = allMedia[currentIndex];
  const isVideo = currentMedia && isVideoMediaUrl(currentMedia.url);
  const totalSlides = allMedia.length;

  const hideControlsLater = () => {
    if (controlHideTimeout.current) {
      clearTimeout(controlHideTimeout.current);
    }
    controlHideTimeout.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
  };

  const showControls = () => {
    setControlsVisible(true);
    hideControlsLater();
  };

  // Progress bar animation for photos only. Videos rely on native time events.
  useEffect(() => {
    if (isDragging || !isPlaying || isVideo) {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      return;
    }

    const slideDurationMs = 5000;
    slideStartTime.current = Date.now();
    setProgress(0);

    const interval = setInterval(() => {
      const elapsed = Date.now() - slideStartTime.current;
      const nextProgress = Math.min(100, (elapsed / slideDurationMs) * 100);
      setProgress(nextProgress);

      if (elapsed >= slideDurationMs) {
        setCurrentIndex((idx) => (idx + 1) % totalSlides);
      }
    }, 50);

    progressInterval.current = interval;
    return () => clearInterval(interval);
  }, [currentIndex, isDragging, isPlaying, isVideo, totalSlides]);

  const handlePrevious = () => {
    setCurrentIndex((idx) => (idx - 1 + totalSlides) % totalSlides);
    setProgress(0);
  };

  const handleNext = () => {
    setCurrentIndex((idx) => (idx + 1) % totalSlides);
    setProgress(0);
  };

  const handleDragStart = (e: MouseEvent | TouchEvent) => {
    setIsDragging(true);
    dragStartX.current = "touches" in e ? e.touches[0].clientX : e.clientX;
    dragStartTime.current = Date.now();
    showControls();
  };

  const handleDragEnd = (e: MouseEvent | TouchEvent) => {
    const dragEndX = "changedTouches" in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
    const dragDelta = dragStartX.current - dragEndX;
    const dragDuration = Date.now() - dragStartTime.current;

    setIsDragging(false);
    showControls();

    // Check if it's a significant drag (> 50px or < 300ms quick swipe)
    if (Math.abs(dragDelta) > 50 || (Math.abs(dragDelta) > 30 && dragDuration < 300)) {
      if (dragDelta > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }
  };

  const togglePlayPause = () => {
    if (isVideo && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      showControls();
    }
  };

  const handleMediaClick = () => {
    showControls();
  };

  const onVideoLoadedMetadata = () => {
    if (!videoRef.current) {
      return;
    }
    const duration = videoRef.current.duration;
    if (Number.isFinite(duration) && duration > 0) {
      videoDuration.current = duration;
    }
  };

  const onVideoTimeUpdate = () => {
    if (!videoRef.current || !Number.isFinite(videoRef.current.duration)) {
      return;
    }
    const duration = videoRef.current.duration;
    const currentTime = videoRef.current.currentTime;
    setProgress((currentTime / duration) * 100);
  };

  const onVideoEnded = () => {
    showControls();
    const timer = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
    if (controlHideTimeout.current) {
      clearTimeout(controlHideTimeout.current);
    }
    controlHideTimeout.current = timer;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div className={styles.carousel}>
      {/* Progress bars */}
      {totalSlides > 1 && (
        <div className={styles.progressBars}>
          {allMedia.map((_, idx) => (
            <div
              key={idx}
              className={styles.progressBar}
              style={{
                flex: 1,
                height: "2px",
                background: "#e0e0e0",
                margin: "0 2px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "#ffffff",
                  width: `${idx === currentIndex ? progress : idx < currentIndex ? 100 : 0}%`,
                  transition:
                    idx === currentIndex
                      ? "width 50ms linear"
                      : "width 300ms ease",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Media container */}
      <div
        className={styles.mediaContainer}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={currentMedia.url}
            controls={false}
            autoPlay={isPlaying}
            muted
            playsInline
            className={styles.media}
            onClick={handleMediaClick}
            onLoadedMetadata={onVideoLoadedMetadata}
            onTimeUpdate={onVideoTimeUpdate}
            onEnded={onVideoEnded}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentMedia.url}
            alt={`${productName} - ${currentIndex + 1}`}
            className={styles.media}
            onClick={handleMediaClick}
          />
        )}

        {/* Video play/pause button */}
        {isVideo && controlsVisible && (
          <button
            className={styles.playButton}
            onClick={togglePlayPause}
            title={isPlaying ? "Pause" : "Play"}
            type="button"
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
                <rect x="6" y="5" width="4" height="14" rx="1.2" />
                <rect x="14" y="5" width="4" height="14" rx="1.2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
                <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
              </svg>
            )}
          </button>
        )}

        {/* Navigation arrows (only show if more than 1 slide) */}
        {totalSlides > 1 && controlsVisible && (
          <>
            <button
              className={`${styles.navButton} ${styles.navPrev}`}
              onClick={handlePrevious}
              title="Previous"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
                <path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className={`${styles.navButton} ${styles.navNext}`}
              onClick={handleNext}
              title="Next"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
                <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {/* Slide counter */}
        {totalSlides > 1 && (
          <div className={styles.counter}>
            {currentIndex + 1} / {totalSlides}
          </div>
        )}
      </div>
    </div>
  );
}
