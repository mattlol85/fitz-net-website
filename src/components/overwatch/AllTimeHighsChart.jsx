import React, { useMemo } from 'react';
import { ROLE_META, toNumber } from './overwatchUtils';

export default function AllTimeHighsChart({ history, currentRatings }) {
  const width = 1000;
  const height = 310;
  const padding = { top: 32, right: 28, bottom: 48, left: 56 };

  const roles = useMemo(() => [
    { key: 'dps', ...ROLE_META.dps, current: toNumber(history?.dpsRating ?? currentRatings?.dps), peak: toNumber(history?.dpsPeakRating) },
    { key: 'tank', ...ROLE_META.tank, current: toNumber(history?.tankRating ?? currentRatings?.tank), peak: toNumber(history?.tankPeakRating) },
    { key: 'heals', ...ROLE_META.heals, current: toNumber(history?.healsRating ?? currentRatings?.heals), peak: toNumber(history?.healsPeakRating) },
  ].filter((r) => r.current !== null || r.peak !== null), [history, currentRatings]);

  if (roles.length === 0) {
    return (
      <div className="history-empty-state">
        <p className="tracker-muted">No SR data available yet.</p>
      </div>
    );
  }

  const allValues = roles.flatMap((r) => [r.current, r.peak]).filter((v) => v != null);
  const maxValue = Math.max(...allValues);
  const minValue = Math.max(0, Math.min(...allValues) - 300);

  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const groupWidth = usableWidth / roles.length;
  const barWidth = Math.floor(groupWidth * 0.28);
  const barGap = Math.floor(groupWidth * 0.04);
  const barsSpan = barWidth * 2 + barGap;
  const axisSteps = 4;
  const bottomY = padding.top + usableHeight;

  const toY = (value) => {
    if (value == null) return null;
    const ratio = (value - minValue) / (maxValue - minValue || 1);
    return padding.top + usableHeight * (1 - ratio);
  };

  return (
    <div className="history-chart-wrap">
      <svg className="history-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart showing all-time peak SR versus current SR per role">
        {Array.from({ length: axisSteps + 1 }).map((_, index) => {
          const y = padding.top + (usableHeight * index) / axisSteps;
          const value = Math.round(maxValue - ((maxValue - minValue) * index) / axisSteps);
          return (
            <g key={`grid-${index}`}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="history-grid-line" />
              <text x={padding.left - 10} y={y + 4} className="history-axis-label" textAnchor="end">{value}</text>
            </g>
          );
        })}

        {roles.map((role, groupIndex) => {
          const groupCx = padding.left + groupIndex * groupWidth + groupWidth / 2;
          const peakX = groupCx - barsSpan / 2;
          const currentX = peakX + barWidth + barGap;
          const peakY = toY(role.peak ?? role.current);
          const currentY = toY(role.current);

          return (
            <g key={role.key}>
              {role.peak != null && (
                <g>
                  <rect x={peakX} y={peakY} width={barWidth} height={bottomY - peakY}
                    fill={`${role.color}2a`} stroke={role.color} strokeWidth="2" rx="3" />
                  <text x={peakX + barWidth / 2} y={peakY - 6} className="history-axis-label" textAnchor="middle">{role.peak}</text>
                </g>
              )}
              {role.current != null && (
                <g>
                  <rect x={currentX} y={currentY} width={barWidth} height={bottomY - currentY}
                    fill={role.color} opacity="0.82" rx="3" />
                  <text x={currentX + barWidth / 2} y={currentY - 6} className="history-axis-label" textAnchor="middle">{role.current}</text>
                </g>
              )}
              <text x={groupCx} y={bottomY + 20} className="history-axis-label" textAnchor="middle" fontWeight="700">{role.label}</text>
            </g>
          );
        })}
      </svg>

      <div className="history-legend highs-legend">
        <div className="history-legend-item">
          <span className="highs-legend-peak-swatch" />
          <strong>All-time peak</strong>
        </div>
        <div className="history-legend-item">
          <span className="highs-legend-current-swatch" />
          <strong>This season</strong>
        </div>
      </div>
    </div>
  );
}
