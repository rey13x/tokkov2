export const DEFAULT_MEDIA_IMAGE = "/assets/logo.png";

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".ogv",
  ".ogg",
  ".avi",
  ".mkv",
];

function cleanMediaUrl(value: string) {
  return value.trim().toLowerCase().split("?")[0]?.split("#")[0] ?? "";
}

export function resolveMediaUrl(value?: string | null) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate || DEFAULT_MEDIA_IMAGE;
}

export function isVideoMediaUrl(value?: string | null) {
  const resolved = resolveMediaUrl(value);
  const normalized = cleanMediaUrl(resolved);

  if (normalized.startsWith("data:video/")) {
    return true;
  }

  return VIDEO_EXTENSIONS.some((ext) => normalized.endsWith(ext));
}
