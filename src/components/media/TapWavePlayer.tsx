"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import styles from "./TapWavePlayer.module.css";

type TapWavePlayerProps = {
  srcCandidates: string[];
};

const BAR_PATTERN = [10, 14, 18, 24, 20, 28, 34, 26, 22, 16, 20, 30, 38, 32, 24, 18, 14];

export default function TapWavePlayer({ srcCandidates }: TapWavePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [boostIndex, setBoostIndex] = useState(-1);

  const src = useMemo(
    () => srcCandidates[candidateIndex] ?? srcCandidates[srcCandidates.length - 1] ?? "",
    [candidateIndex, srcCandidates],
  );

  const stopBoost = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const animateBoost = () => {
    const audio = audioRef.current;
    if (!audio?.duration || Number.isNaN(audio.duration)) {
      rafRef.current = window.requestAnimationFrame(animateBoost);
      return;
    }
    const idx = Math.floor((audio.currentTime / audio.duration) * BAR_PATTERN.length);
    setBoostIndex(Math.max(0, Math.min(BAR_PATTERN.length - 1, idx)));
    rafRef.current = window.requestAnimationFrame(animateBoost);
  };

  const seekAndPlay = async (index: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.duration && !Number.isNaN(audio.duration)) {
      audio.currentTime = (index / BAR_PATTERN.length) * audio.duration;
    }

    await audio.play().catch(() => {});
    setIsPlaying(true);
    stopBoost();
    animateBoost();
  };

  useEffect(() => {
    return () => stopBoost();
  }, []);

  return (
    <div className={styles.player}>
      <div className={styles.bars} role="button" tabIndex={0} aria-label="Play voice Bagas">
        {BAR_PATTERN.map((height, index) => {
          const threshold = (index + 1) / BAR_PATTERN.length;
          const active = progress >= threshold;
          const boosted = isPlaying && boostIndex === index;
          return (
            <button
              type="button"
              key={`bar-${index}`}
              className={`${styles.barButton} ${active ? styles.barActive : ""} ${
                boosted ? styles.barBoost : ""
              }`}
              style={{ "--h": `${height}px` } as CSSProperties}
              onClick={() => seekAndPlay(index)}
              aria-label={`Play from section ${index + 1}`}
            />
          );
        })}
      </div>
      <audio
        ref={audioRef}
        src={src}
        onError={() => {
          if (candidateIndex < srcCandidates.length - 1) {
            setCandidateIndex((prev) => prev + 1);
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          stopBoost();
        }}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setBoostIndex(-1);
          stopBoost();
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (!audio.duration || Number.isNaN(audio.duration)) {
            return;
          }
          setProgress(audio.currentTime / audio.duration);
        }}
      />
    </div>
  );
}
