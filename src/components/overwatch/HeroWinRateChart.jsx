import React, { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

const HERO_COLORS = {
  mercy:   '#00bfff',
  moira:   '#c77dff',
  kiriko:  '#ff6b6b',
  ana:     '#56cfe1',
  lucio:   '#a7c957',
  zenyatta:'#ffd60a',
  illari:  '#f4a261',
  mizuki:  '#90e0ef',
};

const DEFAULT_COLORS = ['#7ee8a2', '#ff9c00', '#e040fb'];

function getHeroColor(heroKey, index) {
  return HERO_COLORS[heroKey?.toLowerCase()] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

const domainForWinRate = (values) => {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  if (valid.length === 0) return [0, 100];
  const lo = Math.max(0, Math.floor((Math.min(...valid) - 10) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...valid) + 10) / 10) * 10);
  return [lo, hi];
};

export default function HeroWinRateChart({ hero, index }) {
  const color = getHeroColor(hero.heroKey, index);

  const data = useMemo(() =>
    (hero.history ?? []).map((p) => ({ label: p.label, winRate: p.winRate })),
  [hero.history]);

  const domain = useMemo(() => domainForWinRate(data.map((d) => d.winRate)), [data]);

  const gradId = `grad-hero-${hero.heroKey}`;

  if (data.length === 0) {
    return (
      <div className="role-chart-wrap">
        <div className="role-chart-heading">
          <span className="role-chart-label" style={{ color }}>{hero.heroName}</span>
        </div>
        <p className="tracker-muted">No data yet — come back after a few cron cycles.</p>
      </div>
    );
  }

  return (
    <div className="role-chart-wrap">
      <div className="role-chart-heading">
        <span className="role-chart-label" style={{ color }}>{hero.heroName}</span>
        <strong className="role-chart-sr" style={{ color }}>
          {data[data.length - 1]?.winRate?.toFixed(0) ?? '—'}% win rate
        </strong>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
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
            tickFormatter={(val) => `${val}%`}
            width={44}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => value != null ? [`${value.toFixed(1)}%`, 'Win Rate'] : ['No data', 'Win Rate']}
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
            dataKey="winRate"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradId})`}
            dot={({ cx, cy, payload }) =>
              payload.winRate != null
                ? <circle key={`dot-${payload.label}`} cx={cx} cy={cy} r={4} fill={color} strokeWidth={0} />
                : null
            }
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
