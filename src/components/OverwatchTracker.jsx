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

const DIVISION_KEYS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'];
const DIVISION_META = {
  bronze:      { label: 'Bronze',      color: '#c97a3a', bg: 'rgba(201,122,58,0.12)',   border: 'rgba(201,122,58,0.35)'  },
  silver:      { label: 'Silver',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',   border: 'rgba(148,163,184,0.35)' },
  gold:        { label: 'Gold',        color: '#eab308', bg: 'rgba(234,179,8,0.1)',     border: 'rgba(234,179,8,0.35)'   },
  platinum:    { label: 'Platinum',    color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',    border: 'rgba(34,211,238,0.35)'  },
  diamond:     { label: 'Diamond',     color: '#818cf8', bg: 'rgba(129,140,248,0.1)',   border: 'rgba(129,140,248,0.35)' },
  master:      { label: 'Master',      color: '#c084fc', bg: 'rgba(192,132,252,0.12)',  border: 'rgba(192,132,252,0.4)'  },
  grandmaster: { label: 'Grandmaster', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   border: 'rgba(251,146,60,0.4)'   },
  champion:    { label: 'Champion',    color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',    border: 'rgba(244,63,94,0.4)'    },
};

const divisionToStep = (division, tier) => {
  if (!division) return null;
  const idx = DIVISION_KEYS.indexOf(division.toLowerCase());
  if (idx < 0) return null;
  return idx * 5 + (5 - (tier || 5));
};

const formatRank = (division, tier) => {
  if (!division) return 'Unranked';
  const meta = DIVISION_META[division.toLowerCase()];
  const label = meta ? meta.label : division.charAt(0).toUpperCase() + division.slice(1).toLowerCase();
  return tier !== null && tier !== undefined ? `${label} ${tier}` : label;
};

const getDivMeta = (division) => (division ? DIVISION_META[division.toLowerCase()] : null);

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

const normalizeHistoryPoints = (points = [], fallbackDivision = null, fallbackTier = null) => {
  const source = Array.isArray(points) ? points : [];
  const fallbackStep = divisionToStep(fallbackDivision, fallbackTier);

  const normalized = source
    .map((point, index) => {
      const step = divisionToStep(point?.division, point?.tier) ?? divisionToStep(point?.division, point?.tier) ?? null;
      return {
        label: point?.label || point?.season || point?.date || point?.timestamp || `Point ${index + 1}`,
        step,
        division: point?.division || null,
        tier: point?.tier || null,
        recordedAt: point?.recordedAt || point?.recorded_at || null,
      };
    })
    .filter((point) => point.step !== null);

  if (normalized.length === 0 && fallbackStep !== null) {
    return [{ label: 'Current', step: fallbackStep, division: fallbackDivision, tier: fallbackTier, recordedAt: null }];
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

// Step scale: 0 (Bronze 5) → 39 (Champion 1), Y_MIN/Y_MAX add half-step padding
const STEP_Y_MIN = -0.5;
const STEP_Y_MAX = 39.5;

const buildChartSeries = (series, width, height, padding) => {
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;

  const stepToY = (step) =>
    padding.top + usableHeight * (1 - (step - STEP_Y_MIN) / (STEP_Y_MAX - STEP_Y_MIN));

  return series.map((entry) => {
    const count = Math.max(entry.points.length - 1, 1);
    const points = entry.points.map((point, index) => ({
      ...point,
      x: padding.left + usableWidth * (entry.points.length === 1 ? 0.5 : index / count),
      y: stepToY(point.step),
    }));
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

function RankCard({ role, division, tier }) {
  const roleMeta = ROLE_META[role];
  const divMeta = getDivMeta(division);

  return (
    <div className="rank-card" data-role={role}>
      <span className="rank-card-role" style={{ color: roleMeta.color }}>{roleMeta.label}</span>
      {divMeta ? (
        <div className="rank-badge" style={{ color: divMeta.color, background: divMeta.bg, borderColor: divMeta.border }}>
          <strong className="rank-badge-division">{divMeta.label}</strong>
          {tier !== null && tier !== undefined && (
            <span className="rank-badge-tier">Tier {tier}</span>
          )}
        </div>
      ) : (
        <div className="rank-badge rank-badge-unranked">
          <strong>Unranked</strong>
        </div>
      )}
      <div className="rank-card-bar" style={{ background: roleMeta.color }} />
    </div>
  );
}

function HistoryChart({ rankings }) {
  const width = 1000;
  const height = 380;
  const padding = { top: 20, right: 28, bottom: 36, left: 116 };
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;

  const stepToY = (step) =>
    padding.top + usableHeight * (1 - (step - STEP_Y_MIN) / (STEP_Y_MAX - STEP_Y_MIN));

  const chartSeries = useMemo(() => {
    const raw = [
      { key: 'dps',   ...ROLE_META.dps,   points: normalizeHistoryPoints(rankings.dps?.history,   rankings.dps?.division,   rankings.dps?.tier)   },
      { key: 'tank',  ...ROLE_META.tank,  points: normalizeHistoryPoints(rankings.tank?.history,  rankings.tank?.division,  rankings.tank?.tier)  },
      { key: 'heals', ...ROLE_META.heals, points: normalizeHistoryPoints(rankings.heals?.history, rankings.heals?.division, rankings.heals?.tier) },
    ].filter((s) => s.points.length > 0);
    return buildChartSeries(raw, width, height, padding);
  }, [rankings]);

  if (chartSeries.length === 0) {
    return (
      <div className="history-empty-state">
        <p className="tracker-muted">No rank data available. Link your BattleTag to load current competitive ranks.</p>
      </div>
    );
  }

  return (
    <div className="history-chart-wrap">
      <svg className="history-chart rank-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Competitive rank chart by role">

        {/* Division background bands + y-axis labels */}
        {DIVISION_KEYS.map((divKey, divIdx) => {
          const meta = DIVISION_META[divKey];
          const yTop    = stepToY(divIdx * 5 + 4.5);
          const yBottom = stepToY(divIdx * 5 - 0.5);
          const midY    = (yTop + yBottom) / 2;
          return (
            <g key={divKey}>
              <rect x={padding.left} y={yTop} width={usableWidth} height={Math.max(yBottom - yTop, 0)} fill={meta.bg} />
              <line x1={padding.left} x2={width - padding.right} y1={yTop} y2={yTop} stroke={meta.border} strokeWidth="0.75" />
              <text x={padding.left - 8} y={midY + 4} textAnchor="end" fontSize="11" fontWeight="700" fill={meta.color}>
                {meta.label}
              </text>
            </g>
          );
        })}

        {/* Bottom boundary line */}
        <line x1={padding.left} x2={width - padding.right} y1={stepToY(-0.5)} y2={stepToY(-0.5)} stroke="var(--border-color)" strokeWidth="1" />

        {/* Data lines */}
        {chartSeries.map((entry) => {
          if (entry.points.length < 2) return null;
          const path = entry.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <path key={`line-${entry.key}`} d={path} fill="none" stroke={entry.color} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
          );
        })}

        {/* Data points with division-coloured glow */}
        {chartSeries.map((entry) =>
          entry.points.map((point, index) => {
            const dm = getDivMeta(point.division);
            const dotColor = dm ? dm.color : entry.color;
            return (
              <g key={`${entry.key}-${index}`}>
                <circle cx={point.x} cy={point.y} r="9" fill={dotColor} opacity="0.18" />
                <circle cx={point.x} cy={point.y} r="5.5" fill={dotColor} stroke="var(--bg-secondary)" strokeWidth="2" />
                <title>{`${entry.label}: ${formatRank(point.division, point.tier)}`}</title>
              </g>
            );
          })
        )}
      </svg>

      <div className="history-legend rank-legend">
        {chartSeries.map((entry) => {
          const current = entry.points[entry.points.length - 1];
          const dm = getDivMeta(current?.division);
          return (
            <div key={entry.key} className="history-legend-item rank-legend-item">
              <span className="history-legend-swatch" style={{ background: entry.color }} />
              <strong>{entry.label}</strong>
              {dm ? (
                <span className="rank-legend-badge" style={{ color: dm.color, background: dm.bg, borderColor: dm.border }}>
                  {formatRank(current.division, current.tier)}
                </span>
              ) : (
                <span className="tracker-muted">Unranked</span>
              )}
            </div>
          );
        })}
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

  const currentRankings = useMemo(() => ({
    dps:   { division: profile?.dpsDivision,   tier: profile?.dpsTier,   history: [] },
    tank:  { division: profile?.tankDivision,  tier: profile?.tankTier,  history: [] },
    heals: { division: profile?.healsDivision, tier: profile?.healsTier, history: [] },
  }), [profile]);

  const rankedMatches = useMemo(
    () => normalizeRankedMatches(history?.rankedMatches),
    [history],
  );

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((first, second) => {
      const firstRatings = [
        toNumber(getStat(first, ['dpsRating', 'dps_rating'])),
        toNumber(getStat(first, ['tankRating', 'tank_rating'])),
        toNumber(getStat(first, ['healsRating', 'heals_rating'])),
      ].filter((v) => v !== null);
      const secondRatings = [
        toNumber(getStat(second, ['dpsRating', 'dps_rating'])),
        toNumber(getStat(second, ['tankRating', 'tank_rating'])),
        toNumber(getStat(second, ['healsRating', 'heals_rating'])),
      ].filter((v) => v !== null);

      const firstScore = firstRatings.length > 0 ? firstRatings.reduce((s, v) => s + v, 0) / firstRatings.length : Number(getStat(first, ['winrate', 'winRate', 'win_rate']) || 0);
      const secondScore = secondRatings.length > 0 ? secondRatings.reduce((s, v) => s + v, 0) / secondRatings.length : Number(getStat(second, ['winrate', 'winRate', 'win_rate']) || 0);

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
          <p>Log in to connect your Overwatch profile, chart your competitive rank, and compare with the Fitz-Net server.</p>
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
              <p className="tracker-muted">Current season competitive rank and career stats for your linked profile.</p>
            </div>
            {history?.currentSeason ? <span className="season-pill">{history.currentSeason}</span> : null}
          </div>

          {loading ? (
            <p className="tracker-muted">Loading tracker data...</p>
          ) : profileLabel ? (
            <>
              <div className="role-card-grid">
                <RankCard role="dps"   division={profile?.dpsDivision}   tier={profile?.dpsTier}   />
                <RankCard role="tank"  division={profile?.tankDivision}  tier={profile?.tankTier}  />
                <RankCard role="heals" division={profile?.healsDivision} tier={profile?.healsTier} />
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
                  <h3>Competitive rank history</h3>
                  <p>Role rank progression for DPS, Tank, and Heals.</p>
                </div>
                <HistoryChart rankings={currentRankings} />
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
            <p className="tracker-muted">Link a BattleTag to view your rank cards and season history graph.</p>
          )}
        </article>

        <article className="tracker-panel leaderboard-panel">
          <div className="leaderboard-heading">
            <div>
              <h2>Server top users</h2>
              <p className="tracker-muted">Ranked by average role rating, then wins and winrate.</p>
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
                      {[
                        { role: 'dps',   division: getStat(player, ['dpsDivision']),   tier: getStat(player, ['dpsTier'])   },
                        { role: 'tank',  division: getStat(player, ['tankDivision']),  tier: getStat(player, ['tankTier'])  },
                        { role: 'heals', division: getStat(player, ['healsDivision']), tier: getStat(player, ['healsTier']) },
                      ].filter((r) => r.division).map((r) => {
                        const dm = getDivMeta(r.division);
                        return (
                          <span key={r.role} className="rank-pill" style={dm ? { color: dm.color, background: dm.bg, borderColor: dm.border } : {}}>
                            {ROLE_META[r.role]?.label} · {formatRank(r.division, r.tier)}
                          </span>
                        );
                      })}
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
