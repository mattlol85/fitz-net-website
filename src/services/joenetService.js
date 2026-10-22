/**
 * Shared Radarr/Sonarr definitions and helpers for the Joenet Admin Panel.
 * Both apps speak the same v3 API, so everything that differs between them
 * (endpoint names, command payloads, row shapes) lives in JOENET_APPS and the
 * section components stay generic.
 */
import { joenetRequest } from './api';

export const JOENET_APP_IDS = ['radarr', 'sonarr'];

const releaseDate = (movie) => movie.digitalRelease || movie.physicalRelease || movie.inCinemas;

const episodeLabel = (ep) =>
  `${ep.series?.title ?? 'Unknown series'} - S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')} ${ep.title ?? ''}`.trim();

export const JOENET_APPS = {
  radarr: {
    label: 'Radarr',
    noun: 'movie',
    itemPath: 'movie',
    // Commands that need no target, and commands that act on one library item.
    commands: [
      { name: 'RssSync', label: 'RSS sync' },
      { name: 'RefreshMonitoredDownloads', label: 'Refresh downloads' },
      { name: 'MissingMoviesSearch', label: 'Search all missing' },
      { name: 'RefreshMovie', label: 'Refresh movie', target: (id) => ({ movieIds: [id] }) },
      { name: 'MoviesSearch', label: 'Search movie', target: (id) => ({ movieIds: [id] }) },
    ],
    // Fields the add form sends on top of the lookup result.
    addPayload: (found, { qualityProfileId, rootFolderPath }) => ({
      ...found,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      minimumAvailability: 'released',
      addOptions: { searchForMovie: true },
    }),
    summary: (item) => (item.hasFile ? 'Downloaded' : 'Missing'),
    sizeOf: (item) => item.sizeOnDisk,
    calendarRow: (movie) => ({ id: movie.id, title: movie.title, date: releaseDate(movie) }),
  },
  sonarr: {
    label: 'Sonarr',
    noun: 'series',
    itemPath: 'series',
    commands: [
      { name: 'RssSync', label: 'RSS sync' },
      { name: 'RefreshMonitoredDownloads', label: 'Refresh downloads' },
      { name: 'MissingEpisodeSearch', label: 'Search all missing' },
      { name: 'RefreshSeries', label: 'Refresh series', target: (id) => ({ seriesId: id }) },
      { name: 'SeriesSearch', label: 'Search series', target: (id) => ({ seriesId: id }) },
    ],
    addPayload: (found, { qualityProfileId, rootFolderPath }) => ({
      ...found,
      qualityProfileId,
      rootFolderPath,
      monitored: true,
      seasonFolder: true,
      addOptions: { searchForMissingEpisodes: true },
    }),
    summary: (item) => {
      const stats = item.statistics;
      return stats ? `${stats.episodeFileCount}/${stats.episodeCount} episodes` : item.status;
    },
    sizeOf: (item) => item.statistics?.sizeOnDisk,
    calendarRow: (ep) => ({ id: ep.id, title: episodeLabel(ep), date: ep.airDateUtc }),
  },
};

/** Check a pasted key by asking the app for its status; 200 means the key is valid. */
export const verifyKey = (app, key, token) =>
  joenetRequest(app, 'system/status', token, key.trim());

/** Radarr/Sonarr page their list endpoints as { records: [...] }; other endpoints return arrays. */
export const toRecords = (data) => (Array.isArray(data) ? data : data?.records ?? []);

/** Keep API Console paths relative to /api/v3 whatever the user pastes. */
export const normalizeConsolePath = (raw) =>
  raw.trim().replace(/^\/+/, '').replace(/^api\/v3\//, '');

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

/** yyyy-mm-dd, which is what the calendar endpoint expects. */
export const isoDay = (date) => date.toISOString().slice(0, 10);
