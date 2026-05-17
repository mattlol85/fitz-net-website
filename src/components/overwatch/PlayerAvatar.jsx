import React from 'react';
import { getAvatarUrl, getDisplayName } from './overwatchFormatters';

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

export default PlayerAvatar;
