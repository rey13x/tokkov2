"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./VoiceWavePlayer.module.css";

type VoiceWavePlayerProps = {
  srcCandidates: string[];
  title?: string;
};

const baseWavePattern = [
  0.34, 0.46, 0.38, 0.58, 0.44, 0.68, 0.5, 0.74, 0.56, 0.82, 0.42, 0.65, 0.34, 0.72, 0.54, 0.88,
  0.62, 0.76, 0.48, 0.94, 0.58, 0.8, 0.46, 0.7, 0.4, 0.6, 0.52, 0.64, 0.44, 0.56,
];

const barCount = baseWavePattern.length;

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampLevel(value: number) {
  return Math.min(0.98, Math.max(0.18, value));
}

export default function VoiceWavePlayer({ srcCandidates, title }: VoiceWavePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [levels, setLevels] = useState(baseWavePattern);

  const src = useMemo(
    () => srcCandidates[candidateIndex] ?? srcCandidates[srcCandidates.length - 1] ?? "",
    [candidateIndex, srcCandidates],
  );

  const stopMeter = (reset = false) => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (reset) {
      setLevels(baseWavePattern);
    }
  };

  const ensureAudioGraph = () => {
    const audio = audioRef.current;
    if (!audio || typeof window === "undefined") {
      return null;
    }

    if (!contextRef.current) {
      contextRef.current = new window.AudioContext();
    }

    if (!analyserRef.current) {
      analyserRef.current = contextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.84;
    }

    if (!sourceRef.current) {
      sourceRef.current = contextRef.current.createMediaElementSource(audio);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(contextRef.current.destination);
    }

    return { context: contextRef.current, analyser: analyserRef.current };
  };

  const startMeter = () => {
    const analyser = analyserRef.current;
    if (!analyser) {
      return;
    }

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const binsPerBar = Math.max(1, Math.floor(buffer.length / barCount));

    const paint = () => {
      analyser.getByteFrequencyData(buffer);

      setLevels((previous) =>
        baseWavePattern.map((base, index) => {
          const start = index * binsPerBar;
          let sum = 0;
          for (let step = 0; step < binsPerBar; step += 1) {
            sum += buffer[start + step] ?? 0;
          }
          const energy = sum / (binsPerBar * 255);
          const target = clampLevel(base * 0.48 + energy * 0.95);
          const smooth = previous[index] * 0.58 + target * 0.42;
          return clampLevel(smooth);
        }),
      );

      rafRef.current = window.requestAnimationFrame(paint);
    };

    stopMeter();
    rafRef.current = window.requestAnimationFrame(paint);
  };

  const seekAndPlay = async (ratio: number) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextRatio = clampRatio(ratio);
    if (audio.duration && !Number.isNaN(audio.duration)) {
      audio.currentTime = nextRatio * audio.duration;
      setProgress(nextRatio);
    }

    const graph = ensureAudioGraph();
    if (graph?.context.state === "suspended") {
      await graph.context.resume();
    }

    if (audio.paused) {
      await audio.play().catch(() => {});
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      const graph = ensureAudioGraph();
      if (graph?.context.state === "suspended") {
        await graph.context.resume();
      }
      await audio.play().catch(() => {});
      return;
    }

    audio.pause();
  };

  const handleTrackClick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const ratio = (event.clientX - rect.left) / rect.width;
    void seekAndPlay(ratio);
  };

  const handleTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      void togglePlay();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      void seekAndPlay(progress - 0.05);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      void seekAndPlay(progress + 0.05);
    }
  };

  useEffect(() => {
    return () => {
      stopMeter();
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      contextRef.current?.close().catch(() => {});
    };
  }, []);

  const activeBars = Math.round(progress * barCount);

  return (
    <div className={styles.player}>
      {title ? <p className={styles.title}>{title}</p> : null}
      <div
        className={`${styles.waveTrack} ${isPlaying ? styles.waveTrackPlaying : ""}`}
        role="slider"
        tabIndex={0}
        aria-label="Voice waveform"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onPointerDown={handleTrackClick}
        onKeyDown={handleTrackKeyDown}
      >
        {levels.map((height, index) => (
          <span
            key={`wave-bar-${index}`}
            className={`${styles.waveBar} ${index < activeBars ? styles.waveBarActive : ""}`}
            style={{ "--bar-height": `${Math.round(height * 100)}%` } as CSSProperties}
          />
        ))}
      </div>
      <audio
        ref={audioRef}
        src={src}
        onError={() => {
          stopMeter(true);
          if (candidateIndex < srcCandidates.length - 1) {
            setCandidateIndex((prev) => prev + 1);
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          startMeter();
        }}
        onPause={() => {
          setIsPlaying(false);
          stopMeter(true);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          stopMeter(true);
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
