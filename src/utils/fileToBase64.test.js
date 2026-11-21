import { describe, expect, it } from 'vitest';
import fileToBase64 from './fileToBase64';

describe('fileToBase64', () => {
  it('should resolve the bare base64 of a blob without the data: prefix', async () => {
    const result = await fileToBase64(new Blob(['hello'], { type: 'text/plain' }));
    expect(result).toBe(btoa('hello'));
  });
});
