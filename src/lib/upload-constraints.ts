export const DEFAULT_IMAGE_MAX_SIZE_BYTES = 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getImageUploadError(
  file: Pick<File, "type" | "size">,
  maxSizeBytes = DEFAULT_IMAGE_MAX_SIZE_BYTES,
) {
  if (!file.type || !file.type.startsWith("image/")) {
    return "Tipe file tidak valid. Pilih gambar JPG, PNG, WEBP, atau GIF.";
  }

  if (file.size <= 0) {
    return "File kosong. Pilih gambar lain.";
  }

  if (file.size > maxSizeBytes) {
    return `Ukuran file terlalu besar. Maksimal ${formatFileSize(maxSizeBytes)}.`;
  }

  return "";
}
