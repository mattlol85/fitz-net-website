import React from 'react';
import { ROLE_META, srToRankIcon, srToRankLabel } from './overwatchUtils';
import { formatNumber } from './overwatchFormatters';

function RoleCard({ role, value, subtitle }) {
  const meta = ROLE_META[role];
  const iconUrl = srToRankIcon(value);
  return (
    <div className="role-card">
      <span className="role-card-label" data-role={role} style={{ color: meta.color }}>{meta.label}</span>
      <div className="role-card-rank">
        {iconUrl && <img src={iconUrl} alt={srToRankLabel(value)} className="role-rank-icon" />}
        <strong>{formatNumber(value)}</strong>
      </div>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  );
}

export default RoleCard;
