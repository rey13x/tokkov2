"use client";

import Image from "next/image";
import { DEFAULT_MEDIA_IMAGE, isVideoMediaUrl, resolveMediaUrl } from "@/lib/media";

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
  const resolvedSrc = resolveMediaUrl(src) || fallbackSrc;
  const isVideo = isVideoMediaUrl(resolvedSrc);

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

  if (fill) {
    return (
      <Image
        src={resolvedSrc || fallbackSrc}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    <Image
      src={resolvedSrc || fallbackSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
    />
  );
}
