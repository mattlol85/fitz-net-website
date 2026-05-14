import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getOverwatchLeaderboard,
  getOverwatchProfile,
  saveOverwatchProfile,
  searchOverwatchPlayers,
} from '../services/api';
import '../css/OverwatchTracker.css';

const numberFormatter = new Intl.NumberFormat();

const getPlayerId = (player) => player.playerId || player.player_id || player.id || player.battletag;
const getDisplayName = (player) => player.displayName || player.display_name || player.name || getPlayerId(player);
const getAvatarUrl = (player) => player.avatarUrl || player.avatar_url || player.avatar;

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  return numberFormatter.format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'N/A';
  return `${numericValue.toFixed(1)}%`;
};

const getStat = (item, keys) => {
  for (const key of keys) {
    if (item?.[key] !== null && item?.[key] !== undefined) {
      return item[key];
    }
  }

  return null;
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

function OverwatchTracker() {
  const { token, isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savingPlayerId, setSavingPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((first, second) => {
      const firstWins = Number(getStat(first, ['gamesWon', 'games_won']) || 0);
      const secondWins = Number(getStat(second, ['gamesWon', 'games_won']) || 0);
      const firstWinrate = Number(getStat(first, ['winrate', 'winRate', 'win_rate']) || 0);
      const secondWinrate = Number(getStat(second, ['winrate', 'winRate', 'win_rate']) || 0);

      return secondWins - firstWins || secondWinrate - firstWinrate;
    });
  }, [leaderboard]);

  const loadTrackerData = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [profileResponse, leaderboardResponse] = await Promise.all([
      getOverwatchProfile(token),
      getOverwatchLeaderboard(token),
    ]);

    if (profileResponse.success) {
      setProfile(profileResponse.profile);
    } else {
      setProfile(null);
    }

    if (leaderboardResponse.success) {
      setLeaderboard(leaderboardResponse.leaderboard);
    } else {
      setError(leaderboardResponse.message);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTrackerData();
  }, [token]);

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

  const handleSave = async (player) => {
    const playerId = getPlayerId(player);
    setSavingPlayerId(playerId);
    setMessage('');
    setError('');

    const response = await saveOverwatchProfile(playerId, token);
    if (response.success) {
      setProfile(response.profile);
      setMessage(response.message);
      setSearchResults([]);
      setQuery('');
      await loadTrackerData();
    } else {
      setError(response.message);
    }

    setSavingPlayerId(null);
  };

  if (!isAuthenticated()) {
    return (
      <main className="overwatch-tracker">
        <section className="tracker-empty-state">
          <h1>Overwatch Tracker</h1>
          <p>Log in to connect your Overwatch profile and compare stats with the Fitz-Net server.</p>
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
        {profile?.overwatchPlayerId || profile?.playerId ? (
          <div className="current-profile">
            <PlayerAvatar player={profile} />
            <div>
              <span>Linked profile</span>
              <strong>{getDisplayName(profile)}</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="tracker-panel lookup-panel">
        <div className="panel-copy">
          <h2>Find your player</h2>
          <p>Search with a username or BattleTag. BattleTags use a dash in place of the hash, like Name-1234.</p>
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
                    onClick={() => handleSave(player)}
                    disabled={savingPlayerId === playerId}
                  >
                    {savingPlayerId === playerId ? 'Saving...' : 'Save'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="tracker-layout">
        <article className="tracker-panel profile-panel">
          <h2>Your Stats</h2>
          {loading ? (
            <p className="tracker-muted">Loading tracker data...</p>
          ) : profile?.overwatchPlayerId || profile?.playerId ? (
            <div className="stat-grid">
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
              <div>
                <span>Damage</span>
                <strong>{formatNumber(getStat(profile, ['damage']))}</strong>
              </div>
              <div>
                <span>Healing</span>
                <strong>{formatNumber(getStat(profile, ['healing']))}</strong>
              </div>
            </div>
          ) : (
            <p className="tracker-muted">Save a player from search results to join the leaderboard.</p>
          )}
        </article>

        <article className="tracker-panel leaderboard-panel">
          <div className="leaderboard-heading">
            <h2>Server Top Users</h2>
            <span>{sortedLeaderboard.length} linked</span>
          </div>
          {loading ? (
            <p className="tracker-muted">Loading leaderboard...</p>
          ) : sortedLeaderboard.length > 0 ? (
            <div className="leaderboard-list">
              {sortedLeaderboard.map((player, index) => (
                <div className="leaderboard-row" key={getPlayerId(player) || player.username}>
                  <span className="leaderboard-rank">{index + 1}</span>
                  <PlayerAvatar player={player} size="small" />
                  <div className="leaderboard-player">
                    <strong>{player.username || getDisplayName(player)}</strong>
                    <span>{getDisplayName(player)}</span>
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
              ))}
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
