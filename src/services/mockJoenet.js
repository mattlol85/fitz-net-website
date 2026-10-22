/**
 * Canned Radarr/Sonarr v3 responses for VITE_USE_MOCK_API mode, so the Joenet
 * Admin Panel can be developed without the proxy or a real Joenet host.
 * Library data is kept in memory so toggles and deletes stick until a reload.
 * Any non-empty key is accepted except "invalid", which mimics a bad key.
 */

const clone = (value) => JSON.parse(JSON.stringify(value));

const MOCK_ITEMS = {
  radarr: [
    { id: 1, title: 'Blade Runner 2049', year: 2017, monitored: true, hasFile: true, sizeOnDisk: 14_500_000_000, status: 'released' },
    { id: 2, title: 'Dune: Part Two', year: 2024, monitored: true, hasFile: false, sizeOnDisk: 0, status: 'released' },
    { id: 3, title: 'The Thing', year: 1982, monitored: false, hasFile: true, sizeOnDisk: 8_200_000_000, status: 'released' },
  ],
  sonarr: [
    { id: 1, title: 'Severance', year: 2022, monitored: true, status: 'continuing', statistics: { episodeFileCount: 19, episodeCount: 19, sizeOnDisk: 32_000_000_000 } },
    { id: 2, title: 'Andor', year: 2022, monitored: true, status: 'ended', statistics: { episodeFileCount: 12, episodeCount: 24, sizeOnDisk: 21_000_000_000 } },
    { id: 3, title: 'Firefly', year: 2002, monitored: false, status: 'ended', statistics: { episodeFileCount: 14, episodeCount: 14, sizeOnDisk: 9_000_000_000 } },
  ],
};

const MOCK_LOOKUP = {
  radarr: [
    { title: 'Arrival', year: 2016, tmdbId: 329865, overview: 'A linguist works with the military to communicate with alien lifeforms.' },
    { title: 'Sicario', year: 2015, tmdbId: 273481, overview: 'An FBI agent joins a task force against the drug cartels.' },
  ],
  sonarr: [
    { title: 'Slow Horses', year: 2022, tvdbId: 396021, overview: 'Disgraced MI5 agents are exiled to a dead-end department.' },
    { title: 'Silo', year: 2023, tvdbId: 403245, overview: 'Thousands of people live in a giant underground silo.' },
  ],
};

let items;

const resetItems = () => {
  items = clone(MOCK_ITEMS);
};
resetItems();

const MOCK_QUEUE = [
  { id: 11, title: 'Dune.Part.Two.2024.2160p', status: 'downloading', size: 20_000_000_000, sizeleft: 8_000_000_000, timeleft: '00:42:10', protocol: 'torrent' },
  { id: 12, title: 'Andor.S02E05.1080p', status: 'queued', size: 3_000_000_000, sizeleft: 3_000_000_000, timeleft: '01:10:00', protocol: 'usenet' },
];

const MOCK_HISTORY = [
  { id: 21, sourceTitle: 'Blade.Runner.2049.2017.1080p', eventType: 'downloadFolderImported', date: '2026-10-20T18:12:00Z' },
  { id: 22, sourceTitle: 'Severance.S02E10.1080p', eventType: 'grabbed', date: '2026-10-19T02:30:00Z' },
];

const respond = (data, status = 200) => ({ success: true, status, data });
const fail = (status, message) => ({ success: false, status, message });

export const resetMockJoenet = resetItems;

/** Mirrors joenetRequest(): resolves { success, status, data } or { success: false, status, message }. */
export const handleMockJoenet = async (app, path, key, { method = 'GET', body } = {}) => {
  if (!['radarr', 'sonarr'].includes(app)) return fail(404, 'Unknown app');
  if (!key || key === 'invalid') return fail(401, 'Joenet rejected the API key (or your session expired).');

  const [pathOnly] = path.split('?');
  const [resource, id, ...rest] = pathOnly.split('/').filter(Boolean);
  const itemPath = app === 'radarr' ? 'movie' : 'series';
  const list = items[app];

  if (resource === 'system' && id === 'status') {
    return respond({
      appName: app === 'radarr' ? 'Radarr' : 'Sonarr',
      version: app === 'radarr' ? '5.14.0.9383' : '4.0.9.2244',
      osName: 'debian',
      branch: 'main',
      startTime: '2026-10-01T08:00:00Z',
    });
  }
  if (resource === 'health') return respond([{ type: 'warning', source: 'IndexerStatusCheck', message: 'Indexers unavailable due to failures: MockIndexer' }]);
  if (resource === 'diskspace') return respond([{ path: '/media', label: 'media', freeSpace: 1_200_000_000_000, totalSpace: 4_000_000_000_000 }]);
  if (resource === 'qualityprofile') return respond([{ id: 1, name: 'Any' }, { id: 4, name: 'HD-1080p' }]);
  if (resource === 'rootfolder') return respond([{ id: 1, path: '/media/library', freeSpace: 1_200_000_000_000 }]);
  if (resource === 'tag') return respond([{ id: 1, label: 'kids' }, { id: 2, label: '4k' }]);
  if (resource === 'queue') {
    if (method === 'DELETE') return respond({});
    return respond({ page: 1, pageSize: 50, totalRecords: MOCK_QUEUE.length, records: clone(MOCK_QUEUE) });
  }
  if (resource === 'history') return respond({ page: 1, pageSize: 50, totalRecords: MOCK_HISTORY.length, records: clone(MOCK_HISTORY) });
  if (resource === 'calendar') {
    const airDate = new Date(Date.now() + 2 * 86_400_000).toISOString();
    return respond(
      app === 'radarr'
        ? [{ id: 2, title: 'Dune: Part Two', digitalRelease: airDate }]
        : [{ id: 31, title: 'Pilot', seasonNumber: 1, episodeNumber: 1, airDateUtc: airDate, series: { title: 'Slow Horses' } }]
    );
  }
  if (resource === 'wanted' && id === 'missing') {
    return respond({
      page: 1,
      pageSize: 25,
      totalRecords: 1,
      records:
        app === 'radarr'
          ? [{ id: 2, title: 'Dune: Part Two', year: 2024, digitalRelease: '2024-05-14T00:00:00Z' }]
          : [{ id: 41, title: 'The Gold Rush', seasonNumber: 2, episodeNumber: 3, airDateUtc: '2025-01-10T02:00:00Z', series: { title: 'Andor' } }],
    });
  }
  if (resource === 'command') {
    if (method === 'POST') return respond({ id: 99, name: body?.name ?? 'Unknown', status: 'queued', queued: new Date().toISOString() }, 201);
    return respond([{ id: 98, name: 'RssSync', status: 'completed', queued: '2026-10-22T07:00:00Z' }]);
  }

  if (resource === itemPath) {
    if (id === 'lookup') return respond(clone(MOCK_LOOKUP[app]));
    if (id === undefined) {
      if (method === 'POST') {
        const created = { ...body, id: Math.max(0, ...list.map((i) => i.id)) + 1 };
        list.push(created);
        return respond(clone(created), 201);
      }
      return respond(clone(list));
    }
    const index = list.findIndex((i) => String(i.id) === id);
    if (index === -1 || rest.length) return fail(404, 'NotFound');
    if (method === 'PUT') {
      list[index] = { ...list[index], ...body };
      return respond(clone(list[index]));
    }
    if (method === 'DELETE') {
      list.splice(index, 1);
      return respond({});
    }
    return respond(clone(list[index]));
  }

  return fail(404, 'NotFound');
};
