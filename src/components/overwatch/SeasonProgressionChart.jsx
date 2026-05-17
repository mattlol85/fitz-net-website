import React, { useMemo } from 'react';
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { ROLE_META, normalizeHistoryPoints, srToRankLabel } from './overwatchUtils';

const dataDomain = (values, pad = 150) => {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  if (valid.length === 0) return ['auto', 'auto'];
  const lo = Math.max(0, Math.min(...valid) - pad);
  const hi = Math.min(4000, Math.max(...valid) + pad);
  return [Math.floor(lo / 100) * 100, Math.ceil(hi / 100) * 100];
};

export default function SeasonProgressionChart({ history }) {
  const chartData = useMemo(() => {
    const dpsPoints = normalizeHistoryPoints(history?.dpsHistory || history?.dps, history?.dpsRating);
    const tankPoints = normalizeHistoryPoints(history?.tankHistory || history?.tank, history?.tankRating);
    const healsPoints = normalizeHistoryPoints(history?.healsHistory || history?.heals, history?.healsRating);

    const labelSet = new Set([
      ...dpsPoints.map((p) => p.label),
      ...tankPoints.map((p) => p.label),
      ...healsPoints.map((p) => p.label),
    ]);

    const dpsMap = Object.fromEntries(dpsPoints.map((p) => [p.label, p.rating]));
    const tankMap = Object.fromEntries(tankPoints.map((p) => [p.label, p.rating]));
    const healsMap = Object.fromEntries(healsPoints.map((p) => [p.label, p.rating]));

    return Array.from(labelSet).map((label) => {
      const point = { label };
      if (dpsMap[label] != null) point.dps = dpsMap[label];
      if (tankMap[label] != null) point.tank = tankMap[label];
      if (healsMap[label] != null) point.heals = healsMap[label];
      return point;
    });
  }, [history]);

  const domain = useMemo(() => {
    const all = chartData.flatMap((d) => [d.dps, d.tank, d.heals]);
    return dataDomain(all);
  }, [chartData]);

  if (chartData.length === 0 || chartData.every((d) => d.dps == null && d.tank == null && d.heals == null)) {
    return (
      <div className="history-empty-state">
        <p className="tracker-muted">No SR history data is available yet. Check back after playing ranked matches.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <AreaChart data={chartData} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <defs>
          <linearGradient id="gradDps" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={ROLE_META.dps.color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={ROLE_META.dps.color} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradTank" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={ROLE_META.tank.color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={ROLE_META.tank.color} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradHeals" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={ROLE_META.heals.color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={ROLE_META.heals.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.4} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={domain}
          tickFormatter={(val) => srToRankLabel(val, true)}
          width={70}
          tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, name) => [srToRankLabel(value), ROLE_META[name]?.label ?? name]}
          contentStyle={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
          labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}
          cursor={{ stroke: 'var(--border-color)', strokeWidth: 1 }}
        />
        <Legend formatter={(value) => ROLE_META[value]?.label ?? value} wrapperStyle={{ paddingTop: 8 }} />
        <Area type="monotone" dataKey="dps"   stroke={ROLE_META.dps.color}   strokeWidth={2.5} fill="url(#gradDps)"   dot={{ r: 4, fill: ROLE_META.dps.color,   strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
        <Area type="monotone" dataKey="heals" stroke={ROLE_META.heals.color} strokeWidth={2.5} fill="url(#gradHeals)" dot={{ r: 4, fill: ROLE_META.heals.color, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
        <Area type="monotone" dataKey="tank"  stroke={ROLE_META.tank.color}  strokeWidth={2.5} fill="url(#gradTank)"  dot={{ r: 4, fill: ROLE_META.tank.color,  strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}