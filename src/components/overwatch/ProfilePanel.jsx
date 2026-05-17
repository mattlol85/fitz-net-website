import React from 'react';
import RoleCard from './RoleCard';
import { formatNumber, formatPercent, formatDate, getStat } from './overwatchFormatters';

function ProfilePanel({ loading, profile, history, profileLabel, currentRatings, rankedMatches }) {
  return (
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
            <RoleCard role="dps" value={currentRatings.dps} subtitle="Current" />
            <RoleCard role="tank" value={currentRatings.tank} subtitle="Current" />
            <RoleCard role="heals" value={currentRatings.heals} subtitle="Current" />
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
  );
}

export default ProfilePanel;
