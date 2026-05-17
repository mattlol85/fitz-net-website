import { toNumber } from './overwatchUtils';

export const numberFormatter = new Intl.NumberFormat();
export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const getPlayerId = (player) => player.playerId || player.player_id || player.id || player.battletag;
export const getBattleTag = (player) => player.battleTag || player.battletag || getPlayerId(player);
export const getDisplayName = (player) => player.displayName || player.display_name || player.name || getPlayerId(player);
export const getAvatarUrl = (player) => player.avatarUrl || player.avatar_url || player.avatar;

export const formatNumber = (value) => {
  const numericValue = toNumber(value);
  if (numericValue === null) return 'N/A';
  return numberFormatter.format(numericValue);
};

export const formatPercent = (value) => {
  const numericValue = toNumber(value);
  if (numericValue === null) return 'N/A';
  return `${numericValue.toFixed(1)}%`;
};

export const formatDate = (value) => {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
};

export const getStat = (item, keys) => {
  for (const key of keys) {
    if (item?.[key] !== null && item?.[key] !== undefined) {
      return item[key];
    }
  }

  return null;
};

export const normalizeRankedMatches = (matches = []) => {
  const source = Array.isArray(matches) ? matches : [];

  return source.slice(0, 10).map((match, index) => {
    const resultText = (match?.result || match?.outcome || match?.status || '').toString();
    const win = typeof match?.win === 'boolean'
      ? match.win
      : ['w', 'win', 'won', 'victory', 'victorious', '1', 'true', 'yes'].includes(resultText.trim().toLowerCase());

    return {
      key: `${match?.playedAt || match?.timestamp || index}-${index}`,
      result: win ? 'W' : 'L',
      win,
      mode: match?.mode || match?.gamemode || match?.gameMode || 'Competitive',
      map: match?.map || match?.mapName || '',
      scoreFor: match?.scoreFor ?? match?.score_for ?? null,
      scoreAgainst: match?.scoreAgainst ?? match?.score_against ?? null,
      playedAt: match?.playedAt || match?.played_at || match?.timestamp || match?.date || null,
    };
  });
};
