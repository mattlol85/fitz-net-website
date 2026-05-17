const RANK_ICON_BASE = 'https://static.playoverwatch.com/img/pages/career/icons/rank/';

// Per-division hashes indexed as [div1, div2, div3, div4, div5] (div1 = highest)
const RANK_ICON_HASHES = {
  Bronze:      ['5daef87bda', 'a5bc9cc7f7', '6318f87459', '6b6e7959d4', 'b60536e7dd'],
  Silver:      ['210286a329', 'f6715c92e2', 'f8d27c0087', 'a9cdcd1a39', 'c961f2424d'],
  Gold:        ['44f03fb9ca', 'c8e5a08e32', 'f715b68968', '14f100ffe2', '4f4894b821'],
  Platinum:    ['20b0d8762c', '2251fd0f3e', 'e6885ae77f', 'a34efd83ff', '4f95a19d84'],
  Diamond:     ['92db6b597a', '249463eb77', '5808b1a384', 'c11a83dff7', 'cccbb1eb8c'],
  Master:      ['0fd3354b84', 'f736990f04', 'cb03be0a6e', '397f8722e0', 'b2647075c1'],
  Grandmaster: ['05b9b32f3e', '8d1da21638', 'e55e61f68f', '5055bd7666', 'd7df688b4b'],
};

export const ROLE_META = {
  dps: { label: 'DPS', color: '#ef4444' },
  tank: { label: 'Tank', color: '#3b82f6' },
  heals: { label: 'Heals', color: '#10b981' },
};

export const RANK_TIERS = [
  { name: 'Bronze',      short: 'Brz',  base: 0    },
  { name: 'Silver',      short: 'Slv',  base: 500  },
  { name: 'Gold',        short: 'Gold', base: 1000 },
  { name: 'Platinum',    short: 'Plat', base: 1500 },
  { name: 'Diamond',     short: 'Dia',  base: 2000 },
  { name: 'Master',      short: 'Mstr', base: 2500 },
  { name: 'Grandmaster', short: 'GM',   base: 3000 },
];

export const srToRankLabel = (sr, short = false) => {
  if (sr == null) return 'N/A';
  const value = Math.round(sr);
  if (value >= 3500) return short ? 'Champ' : 'Champion';
  const tierIndex = Math.min(Math.floor(value / 500), 6);
  const tier = RANK_TIERS[tierIndex];
  const division = 5 - Math.floor((value - tier.base) / 100);
  return `${short ? tier.short : tier.name} ${division}`;
};

export const srToRankIcon = (sr) => {
  if (sr == null) return null;
  const value = Math.round(sr);
  if (value >= 3500) return null; // Champion — no icon available yet
  const tierIndex = Math.min(Math.floor(value / 500), 6);
  const tier = RANK_TIERS[tierIndex];
  const divNumber = 5 - Math.floor((value - tier.base) / 100);
  const hashes = RANK_ICON_HASHES[tier.name];
  if (!hashes) return null;
  return `${RANK_ICON_BASE}${tier.name}Tier-${divNumber}-${hashes[divNumber - 1]}.png`;
};

export const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const normalizeHistoryPoints = (points = [], fallbackRating = null) => {
  const source = Array.isArray(points) ? points : [];
  const normalized = source
    .map((point, index) => ({
      label: point?.label || point?.season || point?.date || point?.timestamp || `Point ${index + 1}`,
      rating: toNumber(point?.rating ?? point?.sr ?? point?.value ?? fallbackRating),
      recordedAt: point?.recordedAt || point?.recorded_at || point?.updatedAt || point?.updated_at || null,
    }))
    .filter((point) => point.rating !== null);

  if (normalized.length === 0 && fallbackRating !== null) {
    return [{ label: 'Current', rating: fallbackRating, recordedAt: null }];
  }

  return normalized;
};

export const buildChartPoints = (series, width, height, padding) => {
  const flattened = series.flatMap((entry) => entry.points.map((point) => point.rating));
  if (flattened.length === 0) return null;

  let min = Math.min(...flattened);
  let max = Math.max(...flattened);
  if (min === max) {
    min -= 50;
    max += 50;
  }

  return series.map((entry) => {
    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;
    const count = Math.max(entry.points.length - 1, 1);

    const points = entry.points.map((point, index) => {
      const x = padding.left + (usableWidth * (entry.points.length === 1 ? 0.5 : index / count));
      const yRatio = (point.rating - min) / (max - min);
      const y = padding.top + (usableHeight * (1 - yRatio));
      return { ...point, x, y };
    });

    return { ...entry, points };
  });
};
