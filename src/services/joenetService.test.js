import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import {
  JOENET_APPS,
  formatBytes,
  formatDate,
  isoDay,
  normalizeConsolePath,
  toRecords,
  verifyKey,
} from './joenetService';

describe('joenetService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should verify a key with GET system/status using the trimmed key', async () => {
    api.joenetRequest.mockResolvedValue({ success: true, status: 200, data: {} });

    await verifyKey('radarr', '  abc  ', 'jwt');

    expect(api.joenetRequest).toHaveBeenCalledWith('radarr', 'system/status', 'jwt', 'abc');
  });

  it('should unwrap paged records and plain arrays', () => {
    expect(toRecords({ records: [1, 2] })).toEqual([1, 2]);
    expect(toRecords([3])).toEqual([3]);
    expect(toRecords(null)).toEqual([]);
  });

  it('should make console paths relative to /api/v3', () => {
    expect(normalizeConsolePath(' /api/v3/movie/1 ')).toBe('movie/1');
    expect(normalizeConsolePath('/system/status')).toBe('system/status');
  });

  it('should format sizes and dates', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('not a date')).toBe('-');
    expect(isoDay(new Date('2026-10-22T12:00:00Z'))).toBe('2026-10-22');
  });

  it('should target movies for Radarr and series for Sonarr', () => {
    expect(JOENET_APPS.radarr.itemPath).toBe('movie');
    expect(JOENET_APPS.sonarr.itemPath).toBe('series');
    expect(JOENET_APPS.radarr.addPayload({ title: 'A' }, { qualityProfileId: 1, rootFolderPath: '/m' })).toMatchObject({
      title: 'A',
      qualityProfileId: 1,
      rootFolderPath: '/m',
      monitored: true,
    });
  });
});
