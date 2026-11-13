/**
 * Shrinks an image before upload (docs/ai-chat-contract.md section 10): longest side at most
 * 1568 px, re-encoded as JPEG, stepping the quality down from 0.85 until it is at most 700 KB so
 * the request also passes proxies with a 1 MB body limit. Transparent areas are flattened onto
 * white (JPEG has no alpha). Resolves `{ blob, name, width, height }`.
 */
export const MAX_SIDE = 1568;
export const MAX_BYTES = 700 * 1024;
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];
const MAX_SHRINK_ROUNDS = 5;

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('unreadable'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const encode = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function downsizeImage(file, { maxSide = MAX_SIDE, maxBytes = MAX_BYTES } = {}) {
  let image;
  try {
    image = await loadImage(file);
  } catch {
    throw new Error(`${file.name || 'That file'} could not be read as an image.`);
  }

  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  let scale = Math.min(1, maxSide / Math.max(width, height));

  try {
    for (let round = 0; round < MAX_SHRINK_ROUNDS; round += 1) {
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, w, h);
      context.drawImage(image, 0, 0, w, h);

      for (const quality of QUALITIES) {
        const blob = await encode(canvas, quality);
        if (!blob) throw new Error('The image could not be re-encoded.');
        if (blob.size <= maxBytes) {
          const base = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
          return { blob, name: `${base}.jpg`, width: w, height: h };
        }
      }
      // Even the lowest quality is too big: shrink the picture itself and try again.
      scale *= 0.8;
    }
  } finally {
    image.close?.();
  }
  throw new Error(`${file.name || 'That image'} is too large to attach.`);
}
