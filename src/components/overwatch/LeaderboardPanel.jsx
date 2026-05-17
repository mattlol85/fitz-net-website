import React from 'react';
import PlayerAvatar from './PlayerAvatar';
import { getBattleTag, getDisplayName, getPlayerId, formatNumber, formatPercent, getStat } from './overwatchFormatters';

function LeaderboardPanel({ loading, sortedLeaderboard }) {
  return (
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
  );
}

export default LeaderboardPanel;
