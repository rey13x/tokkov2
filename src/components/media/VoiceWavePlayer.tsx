"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiPause, FiPlay } from "react-icons/fi";
import styles from "./VoiceWavePlayer.module.css";

type VoiceWavePlayerProps = {
  srcCandidates: string[];
  title?: string;
};

export default function VoiceWavePlayer({ srcCandidates, title }: VoiceWavePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const src = useMemo(
    () => srcCandidates[candidateIndex] ?? srcCandidates[srcCandidates.length - 1] ?? "",
    [candidateIndex, srcCandidates],
  );

  const drawWave = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);
    const bars = 42;
    const step = Math.max(1, Math.floor(bufferLength / bars));
    const gap = 4;
    const barWidth = Math.max(2, (width - gap * (bars - 1)) / bars);

    for (let i = 0; i < bars; i += 1) {
      const value = dataArray[i * step] ?? 0;
      const barHeight = Math.max(4, (value / 255) * (height - 2));
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = "#1f2657";
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    rafRef.current = window.requestAnimationFrame(drawWave);
  };

  const stopWave = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const ensureAudioGraph = () => {
    const audio = audioRef.current;
    if (!audio || typeof window === "undefined") {
      return;
    }

    if (!contextRef.current) {
      contextRef.current = new window.AudioContext();
    }

    if (!analyserRef.current) {
      analyserRef.current = contextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.82;
    }

    if (!sourceRef.current) {
      sourceRef.current = contextRef.current.createMediaElementSource(audio);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(contextRef.current.destination);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      ensureAudioGraph();
      if (contextRef.current?.state === "suspended") {
        await contextRef.current.resume();
      }
      await audio.play().catch(() => {});
      setIsPlaying(true);
      stopWave();
      drawWave();
    } else {
      audio.pause();
      setIsPlaying(false);
      stopWave();
    }
  };

  useEffect(() => {
    return () => {
      stopWave();
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      contextRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className={styles.player}>
      {title ? <p className={styles.title}>{title}</p> : null}
      <div className={styles.row}>
        <button type="button" onClick={togglePlay} className={styles.playButton} aria-label="Play voice">
          {isPlaying ? <FiPause /> : <FiPlay />}
        </button>
        <canvas ref={canvasRef} className={styles.wave} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={(event) => {
          const audio = audioRef.current;
          const next = Number(event.target.value);
          setProgress(next);
          if (audio?.duration) {
            audio.currentTime = (next / 100) * audio.duration;
          }
        }}
      />
      <audio
        ref={audioRef}
        src={src}
        onError={() => {
          if (candidateIndex < srcCandidates.length - 1) {
            setCandidateIndex((prev) => prev + 1);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          stopWave();
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (!audio.duration || Number.isNaN(audio.duration)) {
            return;
          }
          setProgress((audio.currentTime / audio.duration) * 100);
        }}
      />
    </div>
  );
}
