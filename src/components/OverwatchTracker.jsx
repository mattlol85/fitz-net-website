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
import { ROLE_META, normalizeHistoryPoints, toNumber } from './overwatch/overwatchUtils';
import { getPlayerId, getDisplayName, getStat, normalizeRankedMatches, formatDate } from './overwatch/overwatchFormatters';
import PlayerAvatar from './overwatch/PlayerAvatar';
import LeaderboardPanel from './overwatch/LeaderboardPanel';
import ProfilePanel from './overwatch/ProfilePanel';
import SeasonProgressionChart from './overwatch/SeasonProgressionChart';
import RoleHistoryChart from './overwatch/RoleHistoryChart';

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

  const rankedRoles = useMemo(() => {
    const roles = [
      { key: 'dps', ...ROLE_META.dps, sr: toNumber(currentRatings.dps), points: normalizeHistoryPoints(history?.dpsSeasonHistory, currentRatings.dps) },
      { key: 'tank', ...ROLE_META.tank, sr: toNumber(currentRatings.tank), points: normalizeHistoryPoints(history?.tankSeasonHistory, currentRatings.tank) },
      { key: 'heals', ...ROLE_META.heals, sr: toNumber(currentRatings.heals), points: normalizeHistoryPoints(history?.healsSeasonHistory, currentRatings.heals) },
    ];
    return roles.sort((a, b) => (b.sr ?? -1) - (a.sr ?? -1));
  }, [history, currentRatings]);

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

      {!profileLabel && (<section className="tracker-panel lookup-panel">
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
      </section>)}

      <section className="tracker-layout">
        <ProfilePanel
          loading={loading}
          profile={profile}
          history={history}
          profileLabel={profileLabel}
          currentRatings={currentRatings}
          rankedMatches={rankedMatches}
        />
        <LeaderboardPanel loading={loading} sortedLeaderboard={sortedLeaderboard} />
      </section>

      {profileLabel && !loading && (
        <>
          <section className="tracker-panel chart-panel-section">
            <div className="panel-copy">
              <h2>Current season progression</h2>
              <p>Role SR over time for DPS, Tank, and Heals this season.</p>
            </div>
            <SeasonProgressionChart history={{ ...history, ...currentRatings }} />
          </section>

          <section className="tracker-panel chart-panel-section">
            <div className="panel-copy">
              <h2>Role SR history</h2>
              <p>Historical SR per role, sorted by current rank.</p>
            </div>
            <div className="role-chart-grid">
              {rankedRoles.map((role) => (
                <RoleHistoryChart key={role.key} role={role} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default OverwatchTracker;

