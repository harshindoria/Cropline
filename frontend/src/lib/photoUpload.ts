// Checks crop photos before upload. The limits match backend/src/config/multer.ts.

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Longest side, in pixels, of a photo shrunk to fit the size limit.
const MAX_DIMENSION = 2560;
const JPEG_QUALITY = 0.85;

const toJpeg = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));

// Redraws a photo smaller as a JPEG. Returns null if the browser cannot decode it.
const shrinkPhoto = async (file: File): Promise<File | null> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await toJpeg(canvas);
  if (!blob) return null;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
};

export type PreparedPhoto = { file: File } | { error: string };

// Returns a photo the backend will accept, shrinking it if it is over the size limit,
// or an error message to show the user.
export const preparePhoto = async (file: File): Promise<PreparedPhoto> => {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { error: `${file.name}: only JPEG, PNG and WebP photos are allowed.` };
  }
  if (file.size <= MAX_PHOTO_BYTES) return { file };

  const shrunk = await shrinkPhoto(file);
  if (!shrunk || shrunk.size > MAX_PHOTO_BYTES) {
    return { error: `${file.name}: photo is larger than 5 MB.` };
  }
  return { file: shrunk };
};
