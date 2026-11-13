import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downsizeImage, MAX_BYTES, MAX_SIDE } from './imageDownsize';

/** A fake canvas whose encoded size is whatever `sizeFor(quality, width)` says. */
function stubCanvas(sizeFor) {
  const canvases = [];
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag !== 'canvas') return realCreate(tag);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }),
      toBlob: (callback, type, quality) =>
        callback(new Blob([new Uint8Array(sizeFor(quality, canvas.width))], { type })),
    };
    canvases.push(canvas);
    return canvas;
  });
  return canvases;
}

const file = (name = 'photo.png', type = 'image/png') => new File(['x'], name, { type });

describe('downsizeImage', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4000, height: 2000, close: vi.fn() }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should scale the longest side to 1568 px and re-encode as JPEG', async () => {
    const canvases = stubCanvas(() => 1000);

    const result = await downsizeImage(file());

    expect(MAX_SIDE).toBe(1568);
    expect([result.width, result.height]).toEqual([1568, 784]);
    expect([canvases[0].width, canvases[0].height]).toEqual([1568, 784]);
    expect(result.blob.type).toBe('image/jpeg');
    expect(result.name).toBe('photo.jpg');
  });

  it('should not enlarge an image that is already small', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600 }));
    stubCanvas(() => 1000);

    const result = await downsizeImage(file());

    expect([result.width, result.height]).toEqual([800, 600]);
  });

  it('should step the quality down from 0.85 until the file is at most 700 KB', async () => {
    const qualities = [];
    stubCanvas((quality) => {
      qualities.push(quality);
      return quality > 0.7 ? MAX_BYTES + 1000 : MAX_BYTES - 1000;
    });

    const result = await downsizeImage(file());

    expect(qualities).toEqual([0.85, 0.75, 0.65]);
    expect(result.blob.size).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('should shrink the picture itself when even the lowest quality is too big', async () => {
    const canvases = stubCanvas((quality, width) => (width > 1000 ? MAX_BYTES * 2 : 1000));

    const result = await downsizeImage(file());

    expect(canvases.length).toBeGreaterThan(1);
    expect(result.width).toBeLessThanOrEqual(1000);
    expect(result.blob.size).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('should give up with a clear message when nothing gets small enough', async () => {
    stubCanvas(() => MAX_BYTES * 10);

    await expect(downsizeImage(file('huge.png'))).rejects.toThrow('huge.png is too large to attach.');
  });

  it('should explain a file that cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad')));

    await expect(downsizeImage(file('broken.png'))).rejects.toThrow('broken.png could not be read as an image.');
  });
});
