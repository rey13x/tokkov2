import sharp from "sharp";

const MAX_IMAGE_SIZE_BYTES = 450 * 1024;

export async function compressImageToWebp(buffer: Buffer): Promise<Buffer | null> {
  let width = 1800;
  let quality = 78;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const compressed = await sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    if (compressed.length <= MAX_IMAGE_SIZE_BYTES) {
      return compressed;
    }

    if (quality > 28) {
      quality = Math.max(28, quality - 10);
    } else if (width > 320) {
      width = Math.max(320, Math.floor(width * 0.75));
      quality = 72;
    } else if (quality > 18) {
      quality = Math.max(18, quality - 5);
    } else {
      break;
    }
  }

  return null;
}