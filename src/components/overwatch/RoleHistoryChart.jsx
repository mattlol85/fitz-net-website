import React, { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { srToRankLabel, srToRankIcon } from './overwatchUtils';

const isSeasonLabel = (label) => /^Season\s+\d+$/i.test(label);

const fillSeasonGaps = (points) => {
  const seasonNums = points.map((p) => parseInt(p.label.replace(/\D/g, ''), 10)).filter(Number.isFinite);
  if (seasonNums.length === 0) return points;
  const min = Math.min(...seasonNums);
  const max = Math.max(...seasonNums);
  const byLabel = Object.fromEntries(points.map((p) => [p.label, p.sr]));
  const filled = [];
  for (let s = min; s <= max; s++) {
    const label = `Season ${s}`;
    filled.push({ label, sr: byLabel[label] ?? null });
  }
  return filled;
};

const dataDomain = (values, pad = 150) => {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  if (valid.length === 0) return ['auto', 'auto'];
  const lo = Math.max(0, Math.min(...valid) - pad);
  const hi = Math.min(4000, Math.max(...valid) + pad);
  return [Math.floor(lo / 100) * 100, Math.ceil(hi / 100) * 100];
};

export default function RoleHistoryChart({ role }) {
  const data = useMemo(() => {
    const raw = role.points.map((p) => ({ label: p.label, sr: p.rating }));
    if (raw.length > 0 && isSeasonLabel(raw[0].label)) {
      return fillSeasonGaps(raw);
    }
    return raw;
  }, [role.points]);

  const domain = useMemo(() => dataDomain(data.map((d) => d.sr)), [data]);

  if (data.length === 0) {
    return (
      <div className="role-chart-empty">
        <div className="role-chart-heading">
          <span className="role-chart-label" style={{ color: role.color }}>{role.label}</span>
        </div>
        <p className="tracker-muted">No data yet.</p>
      </div>
    );
  }

  const gradId = `grad-${role.key}`;

  const rankIcon = srToRankIcon(role.sr);

  return (
    <div className="role-chart-wrap">
      <div className="role-chart-heading">
        <span className="role-chart-label" style={{ color: role.color }}>{role.label}</span>
        <div className="role-chart-rank">
          {rankIcon && <img src={rankIcon} alt={srToRankLabel(role.sr)} className="role-rank-icon" />}
          <strong className="role-chart-sr">{srToRankLabel(role.sr)}</strong>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={role.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={role.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tickFormatter={(val) => srToRankLabel(val, true)}
            width={60}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => value != null ? [srToRankLabel(value), role.label] : ['No data', role.label]}
            contentStyle={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
            labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
            cursor={{ stroke: 'var(--border-color)', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="sr"
            stroke={role.color}
            strokeWidth={2.5}
            fill={`url(#${gradId})`}
            dot={({ cx, cy, payload }) =>
              payload.sr != null
                ? <circle key={`dot-${payload.label}`} cx={cx} cy={cy} r={4} fill={role.color} strokeWidth={0} />
                : null
            }
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}