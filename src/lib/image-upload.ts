export const MAX_IMAGE_SOURCE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_STORED_IMAGE_SIZE_BYTES = 450 * 1024;
const DIRECT_UPLOAD_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_DIRECT_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;

export async function prepareImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  if (file.size <= MAX_STORED_IMAGE_SIZE_BYTES && DIRECT_UPLOAD_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size <= MAX_DIRECT_UPLOAD_SIZE_BYTES && DIRECT_UPLOAD_IMAGE_TYPES.has(file.type)) {
      return file;
    }
    throw new Error("Foto ini tidak dapat diproses. Coba gunakan JPG, PNG, atau WEBP.");
  }

  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    let currentScale = scale;
    let quality = 0.82;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Browser tidak dapat memproses foto ini.");
    }

    for (let attempt = 0; attempt < 24; attempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * currentScale));
      canvas.height = Math.max(1, Math.round(bitmap.height * currentScale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error("Foto gagal dikompres.")),
          "image/webp",
          quality,
        );
      });

      if (blob.size <= MAX_STORED_IMAGE_SIZE_BYTES) {
        const fileName = `${file.name.replace(/\.[^.]+$/, "") || "foto"}.webp`;
        return new File([blob], fileName, { type: "image/webp", lastModified: file.lastModified });
      }

      if (quality > 0.32) {
        quality = Math.max(0.32, quality - 0.1);
      } else if (Math.max(canvas.width, canvas.height) > 320) {
        currentScale *= 0.8;
        quality = 0.78;
      } else {
        quality = Math.max(0.18, quality - 0.05);
      }
    }

    throw new Error("Foto belum bisa dikompres ke ukuran penyimpanan. Coba foto lain.");
  } finally {
    bitmap.close();
  }
}