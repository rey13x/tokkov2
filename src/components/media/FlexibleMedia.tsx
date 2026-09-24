"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DEFAULT_MEDIA_IMAGE, getOptimizedImageSrc, isVideoMediaUrl, resolveMediaUrl } from "@/lib/media";

type FlexibleMediaProps = {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
  unoptimized?: boolean;
  fallbackSrc?: string;
  controls?: boolean;
};

export default function FlexibleMedia({
  src,
  alt,
  className,
  sizes,
  fill = false,
  width = 72,
  height = 72,
  priority = false,
  unoptimized = true,
  fallbackSrc = DEFAULT_MEDIA_IMAGE,
  controls = false,
}: FlexibleMediaProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const normalizedSrc = src?.trim() ?? "";
  const resolvedSrc = normalizedSrc || (fallbackSrc?.trim() ? fallbackSrc : "");
  const isVideo = isVideoMediaUrl(resolvedSrc);
  const imageSrc = resolvedSrc ? getOptimizedImageSrc(resolvedSrc) : "";

  useEffect(() => {
    setHasImageError(false);
    setIsLoading(true);
  }, [resolvedSrc]);

  if (!resolvedSrc) {
    return null;
  }

  if (isVideo) {
    const style = fill
      ? { width: "100%", height: "100%", objectFit: "cover" as const }
      : undefined;

    return (
      <video
        src={resolvedSrc}
        className={className}
        style={style}
        muted={!controls}
        loop={!controls}
        playsInline
        autoPlay={!controls}
        controls={controls}
      />
    );
  }

  const safeSrc = hasImageError ? (fallbackSrc?.trim() || "") : (imageSrc || fallbackSrc || "");

  if (!safeSrc) {
    return null;
  }

  const imageProps = {
    src: safeSrc,
    alt,
    className,
    sizes,
    priority,
    unoptimized,
    onError: () => {
      setHasImageError(true);
      setIsLoading(false);
    },
    onLoad: () => setIsLoading(false),
    style: {
      opacity: isLoading ? 0.6 : 1,
      transition: "opacity 180ms ease",
    } as const,
  };

  if (fill) {
    return <Image {...imageProps} fill />;
  }

  return <Image {...imageProps} width={width} height={height} />;
}
