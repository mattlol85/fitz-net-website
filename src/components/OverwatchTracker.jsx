import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getOverwatchHistory,
  getOverwatchLeaderboard,
  getOverwatchProfile,
  saveOverwatchProfile,
  searchOverwatchPlayers,
} from '../services/api';
import '../css/OverwatchTracker.css';

const ROLE_META = {
  dps: { label: 'DPS', color: '#ef4444' },
  tank: { label: 'Tank', color: '#3b82f6' },
  heals: { label: 'Heals', color: '#10b981' },
};

const numberFormatter = new Intl.NumberFormat();
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const getPlayerId = (player) => player.playerId || player.player_id || player.id || player.battletag;
const getBattleTag = (player) => player.battleTag || player.battletag || getPlayerId(player);
const getDisplayName = (player) => player.displayName || player.display_name || player.name || getPlayerId(player);
const getAvatarUrl = (player) => player.avatarUrl || player.avatar_url || player.avatar;

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatNumber = (value) => {
  const numericValue = toNumber(value);
  if (numericValue === null) return 'N/A';
  return numberFormatter.format(numericValue);
};

const formatPercent = (value) => {
  const numericValue = toNumber(value);
  if (numericValue === null) return 'N/A';
  return `${numericValue.toFixed(1)}%`;
};

const formatDate = (value) => {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
};

const getStat = (item, keys) => {
  for (const key of keys) {
    if (item?.[key] !== null && item?.[key] !== undefined) {
      return item[key];
    }
  }

  return null;
};

const normalizeHistoryPoints = (points = [], fallbackRating = null) => {
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

const normalizeRankedMatches = (matches = []) => {
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

const buildChartPoints = (series, width, height, padding) => {
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

function PlayerAvatar({ player, size = 'default' }) {
  const avatarUrl = getAvatarUrl(player);
  const displayName = getDisplayName(player);

  if (avatarUrl) {
    return <img className={`overwatch-avatar ${size}`} src={avatarUrl} alt="" />;
  }

  return (
    <div className={`overwatch-avatar fallback ${size}`} aria-hidden="true">
      {displayName?.slice(0, 1)?.toUpperCase() || 'O'}
    </div>
  );
}

function RoleCard({ role, value, subtitle }) {
  const meta = ROLE_META[role];
  return (
    <div className="role-card">
      <span className="role-card-label" data-role={role} style={{ color: meta.color }}>{meta.label}</span>
      <strong>{formatNumber(value)}</strong>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  );
}

function HistoryChart({ history }) {
  const width = 1000;
  const height = 340;
  const padding = { top: 28, right: 28, bottom: 36, left: 56 };

  const chartSeries = useMemo(() => {
    const dpsPoints = normalizeHistoryPoints(history?.dpsHistory || history?.dps, history?.dpsRating);
    const tankPoints = normalizeHistoryPoints(history?.tankHistory || history?.tank, history?.tankRating);
    const healsPoints = normalizeHistoryPoints(history?.healsHistory || history?.heals, history?.healsRating);

    return [
      { key: 'dps', ...ROLE_META.dps, points: dpsPoints },
      { key: 'tank', ...ROLE_META.tank, points: tankPoints },
      { key: 'heals', ...ROLE_META.heals, points: healsPoints },
    ];
  }, [history]);

  const chartPoints = useMemo(() => buildChartPoints(chartSeries, width, height, padding), [chartSeries]);

  if (!chartPoints || chartPoints.every((entry) => entry.points.length === 0)) {
    return (
      <div className="history-empty-state">
        <p className="tracker-muted">No SR history data is available for this profile yet. Check back after playing ranked matches.</p>
      </div>
    );
  }

  const minValue = Math.min(...chartPoints.flatMap((entry) => entry.points.map((point) => point.rating)));
  const maxValue = Math.max(...chartPoints.flatMap((entry) => entry.points.map((point) => point.rating)));
  const axisSteps = 4;

  return (
    <div className="history-chart-wrap">
      <svg className="history-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line graph showing current season SR history for DPS, Tank, and Heals">
        {Array.from({ length: axisSteps + 1 }).map((_, index) => {
          const y = padding.top + ((height - padding.top - padding.bottom) * index) / axisSteps;
          const value = Math.round(maxValue - ((maxValue - minValue) * index) / axisSteps);
          return (
            <g key={`grid-${index}`}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="history-grid-line" />
              <text x={padding.left - 10} y={y + 4} className="history-axis-label" textAnchor="end">
                {value}
              </text>
            </g>
          );
        })}

        {chartPoints.map((entry) => {
          const path = entry.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
          return (
            <g key={entry.key}>
              <path d={path} className={`history-line history-line-${entry.key}`} stroke={entry.color} />
              {entry.points.map((point, index) => (
                <g key={`${entry.key}-${index}`}>
                  <circle cx={point.x} cy={point.y} r="5" className={`history-point history-point-${entry.key}`} fill={entry.color} />
                  <title>{`${entry.label}: ${point.label} (${point.rating})`}</title>
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="history-legend">
        {chartPoints.map((entry) => (
          <div key={entry.key} className="history-legend-item">
            <span className="history-legend-swatch" style={{ background: entry.color }} />
            <strong>{entry.label}</strong>
            <span>{entry.points.length} points</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverwatchTracker() {
  const { token, isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [battleTagInput, setBattleTagInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savingBattleTag, setSavingBattleTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showProfileDetails, setShowProfileDetails] = useState(false);

  const currentRatings = useMemo(() => ({
    dps: getStat(profile, ['dpsRating', 'dps_rating']),
    tank: getStat(profile, ['tankRating', 'tank_rating']),
    heals: getStat(profile, ['healsRating', 'heals_rating']),
  }), [profile]);

  const rankedMatches = useMemo(
    () => normalizeRankedMatches(history?.rankedMatches),
    [history],
  );

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((first, second) => {
      const firstAverage = [
        toNumber(getStat(first, ['dpsRating', 'dps_rating'])),
        toNumber(getStat(first, ['tankRating', 'tank_rating'])),
        toNumber(getStat(first, ['healsRating', 'heals_rating'])),
      ].filter((value) => value !== null);
      const secondAverage = [
        toNumber(getStat(second, ['dpsRating', 'dps_rating'])),
        toNumber(getStat(second, ['tankRating', 'tank_rating'])),
        toNumber(getStat(second, ['healsRating', 'heals_rating'])),
      ].filter((value) => value !== null);

      const firstScore = firstAverage.length > 0 ? firstAverage.reduce((sum, value) => sum + value, 0) / firstAverage.length : Number(getStat(first, ['winrate', 'winRate', 'win_rate']) || 0);
      const secondScore = secondAverage.length > 0 ? secondAverage.reduce((sum, value) => sum + value, 0) / secondAverage.length : Number(getStat(second, ['winrate', 'winRate', 'win_rate']) || 0);

      return secondScore - firstScore || Number(getStat(second, ['gamesWon', 'games_won']) || 0) - Number(getStat(first, ['gamesWon', 'games_won']) || 0);
    });
  }, [leaderboard]);

  const loadTrackerData = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [profileResponse, leaderboardResponse, historyResponse] = await Promise.all([
      getOverwatchProfile(token),
      getOverwatchLeaderboard(token),
      getOverwatchHistory(token),
    ]);

    if (profileResponse.success) {
      setProfile(profileResponse.profile);
      setBattleTagInput(profileResponse.profile?.battleTag || profileResponse.profile?.playerId || '');
    } else {
      setProfile(null);
      if (!String(profileResponse.message || '').toLowerCase().includes('overwatch profile linked')) {
        setError(profileResponse.message);
      }
    }

    if (leaderboardResponse.success) {
      setLeaderboard(leaderboardResponse.leaderboard);
    } else {
      setError(leaderboardResponse.message);
    }

    if (historyResponse.success) {
      setHistory(historyResponse.history);
    } else {
      setHistory(null);
      if (!String(historyResponse.message || '').toLowerCase().includes('overwatch profile linked')) {
        setError(historyResponse.message);
      }
    }

    setLoading(false);
  }, [token, isAuthenticated]);

  useEffect(() => {
    loadTrackerData();
  }, [loadTrackerData]);

  const handleSearch = async (event) => {
    event.preventDefault();
    setSearching(true);
    setMessage('');
    setError('');

    const response = await searchOverwatchPlayers(query, token);
    if (response.success) {
      setSearchResults(response.players);
      if (response.players.length === 0) {
        setMessage('No Overwatch players found for that search.');
      }
    } else {
      setSearchResults([]);
      setError(response.message);
    }

    setSearching(false);
  };

  const handleLinkBattleTag = async (value) => {
    const playerValue = value?.trim();
    if (!playerValue) {
      setError('Enter a BattleTag such as Name-1234.');
      return;
    }

    setSavingBattleTag(playerValue);
    setMessage('');
    setError('');

    const response = await saveOverwatchProfile(playerValue, token);
    if (response.success) {
      setProfile(response.profile);
      setBattleTagInput(response.profile?.battleTag || playerValue);
      setMessage(response.message || 'BattleTag linked successfully.');
      setSearchResults([]);
      setQuery('');
      await loadTrackerData();
    } else {
      setError(response.message);
    }

    setSavingBattleTag('');
  };

  const handleSearchSave = async (player) => {
    await handleLinkBattleTag(getPlayerId(player));
  };

  const profileLabel = profile?.battleTag || profile?.playerId;

  if (!isAuthenticated()) {
    return (
      <main className="overwatch-tracker">
        <section className="tracker-empty-state">
          <h1>Overwatch Tracker</h1>
          <p>Log in to connect your Overwatch profile, chart your SR, and compare stats with the Fitz-Net server.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="overwatch-tracker">
      <section className="tracker-header">
        <div>
          <p className="tracker-kicker">Fitz-Net scoreboard</p>
          <h1>Overwatch Tracker</h1>
        </div>
        {profileLabel ? (
          <button type="button" className="current-profile" onClick={() => setShowProfileDetails((value) => !value)}>
            <PlayerAvatar player={profile} />
            <div>
              <span>Linked BattleTag</span>
              <strong>{profileLabel}</strong>
            </div>
          </button>
        ) : null}
      </section>

      {showProfileDetails && profileLabel ? (
        <section className="tracker-panel current-profile-details">
          <h2>Linked profile details</h2>
          <div className="profile-detail-grid">
            <div>
              <span>BattleTag</span>
              <strong>{profileLabel}</strong>
            </div>
            <div>
              <span>Display name</span>
              <strong>{getDisplayName(profile)}</strong>
            </div>
            <div>
              <span>Last updated</span>
              <strong>{formatDate(profile?.lastUpdatedAt)}</strong>
            </div>
            <div>
              <span>Linked user</span>
              <strong>{profile?.username || 'N/A'}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <section className="tracker-panel lookup-panel">
        <div className="lookup-grid">
          <div>
            <div className="panel-copy">
              <h2>Link your BattleTag</h2>
              <p>Use a BattleTag like Name-1234 or Name#1234. We’ll store it in your profile and fetch current SR plus history.</p>
            </div>
            <form
              className="tracker-search compact"
              onSubmit={(event) => {
                event.preventDefault();
                handleLinkBattleTag(battleTagInput);
              }}
            >
              <input
                type="text"
                value={battleTagInput}
                onChange={(event) => setBattleTagInput(event.target.value)}
                placeholder="Enter BattleTag"
                aria-label="BattleTag"
              />
              <button type="submit" disabled={savingBattleTag === battleTagInput.trim() || loading}>
                {savingBattleTag === battleTagInput.trim() ? 'Saving...' : 'Link BattleTag'}
              </button>
            </form>
          </div>

          <div>
            <div className="panel-copy">
              <h2>Find a player</h2>
              <p>Search a username or BattleTag to find a player and attach it to your profile.</p>
            </div>
            <form className="tracker-search" onSubmit={handleSearch}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Overwatch username"
                aria-label="Overwatch username"
              />
              <button type="submit" disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        {message && <div className="tracker-message">{message}</div>}
        {error && <div className="tracker-error">{error}</div>}

        {searchResults.length > 0 && (
          <div className="player-results" aria-live="polite">
            {searchResults.map((player) => {
              const playerId = getPlayerId(player);
              return (
                <article className="player-result" key={playerId}>
                  <PlayerAvatar player={player} />
                  <div className="player-result-body">
                    <strong>{getDisplayName(player)}</strong>
                    <span>{playerId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSearchSave(player)}
                    disabled={savingBattleTag === playerId}
                  >
                    {savingBattleTag === playerId ? 'Saving...' : 'Save'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="tracker-layout">
        <article className="tracker-panel profile-panel">
          <div className="panel-header">
            <div>
              <h2>Your Overwatch stats</h2>
              <p className="tracker-muted">Current season role SR and career stats for your linked profile.</p>
            </div>
            {history?.currentSeason ? <span className="season-pill">{history.currentSeason}</span> : null}
          </div>

          {loading ? (
            <p className="tracker-muted">Loading tracker data...</p>
          ) : profileLabel ? (
            <>
              <div className="role-card-grid">
                <RoleCard role="dps" value={currentRatings.dps} subtitle="Current SR" />
                <RoleCard role="tank" value={currentRatings.tank} subtitle="Current SR" />
                <RoleCard role="heals" value={currentRatings.heals} subtitle="Current SR" />
              </div>

              <div className="stat-grid compact">
                <div>
                  <span>Games won</span>
                  <strong>{formatNumber(getStat(profile, ['gamesWon', 'games_won']))}</strong>
                </div>
                <div>
                  <span>Games played</span>
                  <strong>{formatNumber(getStat(profile, ['gamesPlayed', 'games_played']))}</strong>
                </div>
                <div>
                  <span>Winrate</span>
                  <strong>{formatPercent(getStat(profile, ['winrate', 'winRate', 'win_rate']))}</strong>
                </div>
                <div>
                  <span>KDA</span>
                  <strong>{formatNumber(getStat(profile, ['kda']))}</strong>
                </div>
              </div>

              <div className="chart-panel">
                <div className="panel-copy">
                  <h3>Current season SR history</h3>
                  <p>Role SR over time for DPS, Tank, and Heals.</p>
                </div>
                <HistoryChart history={{ ...history, ...currentRatings }} />
              </div>

              <div className="ranked-match-panel">
                <div className="panel-copy">
                  <h3>Past 10 ranked matches</h3>
                  <p>Win/loss history from your recent competitive games.</p>
                </div>
                {rankedMatches.length > 0 ? (
                  <div className="ranked-match-strip" aria-label="Recent ranked match history">
                    {rankedMatches.map((match, index) => (
                      <article
                        key={match.key}
                        className={`ranked-match-card ${match.win ? 'win' : 'loss'}`}
                        title={`${match.win ? 'Win' : 'Loss'} • ${match.mode}${match.map ? ` • ${match.map}` : ''}`}
                      >
                        <strong>{match.result}</strong>
                        <span>{match.mode}</span>
                        <span>{match.map || `Match ${index + 1}`}</span>
                        <small>{formatDate(match.playedAt)}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="tracker-muted">No recent ranked match history available for this profile.</p>
                )}
              </div>
            </>
          ) : (
            <p className="tracker-muted">Link a BattleTag to view your SR cards and season history graph.</p>
          )}
        </article>

        <article className="tracker-panel leaderboard-panel">
          <div className="leaderboard-heading">
            <div>
              <h2>Server top users</h2>
              <p className="tracker-muted">Ranked by average role SR, then wins and winrate.</p>
            </div>
            <span>{sortedLeaderboard.length} linked</span>
          </div>
          {loading ? (
            <p className="tracker-muted">Loading leaderboard...</p>
          ) : sortedLeaderboard.length > 0 ? (
            <div className="leaderboard-list">
              {sortedLeaderboard.map((player, index) => {
                const battleTag = getBattleTag(player);
                return (
                  <div className="leaderboard-row" key={getPlayerId(player) || player.username}>
                    <span className="leaderboard-rank">{index + 1}</span>
                    <PlayerAvatar player={player} size="small" />
                    <div className="leaderboard-player">
                      <strong>{player.username || getDisplayName(player)}</strong>
                      <span>{battleTag}</span>
                    </div>
                    <div className="leaderboard-roles">
                      <span>DPS {formatNumber(getStat(player, ['dpsRating', 'dps_rating']))}</span>
                      <span>Tank {formatNumber(getStat(player, ['tankRating', 'tank_rating']))}</span>
                      <span>Heals {formatNumber(getStat(player, ['healsRating', 'heals_rating']))}</span>
                    </div>
                    <div className="leaderboard-stat">
                      <strong>{formatNumber(getStat(player, ['gamesWon', 'games_won']))}</strong>
                      <span>wins</span>
                    </div>
                    <div className="leaderboard-stat">
                      <strong>{formatPercent(getStat(player, ['winrate', 'winRate', 'win_rate']))}</strong>
                      <span>winrate</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="tracker-muted">No linked Overwatch users yet.</p>
          )}
        </article>
      </section>
    </main>
  );
}

export default OverwatchTracker;
