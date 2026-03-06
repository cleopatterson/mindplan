import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Line, ComposedChart,
} from 'recharts';
import type { ProjectionResult } from 'shared/types';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAUD } from '../../utils/calculations';

interface Props {
  result: ProjectionResult;
}

const COLORS = {
  property: { light: '#3b82f6', dark: '#60a5fa' },   // blue
  shares:   { light: '#8b5cf6', dark: '#a78bfa' },   // purple
  super:    { light: '#10b981', dark: '#34d399' },   // green
  cash:     { light: '#f59e0b', dark: '#fbbf24' },   // amber
  vehicle:  { light: '#6b7280', dark: '#9ca3af' },   // gray
  other:    { light: '#ec4899', dark: '#f472b6' },   // pink
  liabilities: { light: '#ef4444', dark: '#f87171' }, // red
};

const CATEGORY_LABELS: Record<string, string> = {
  property: 'Property',
  shares: 'Shares & Funds',
  super: 'Super & Pension',
  cash: 'Cash',
  vehicle: 'Vehicles',
  other: 'Other',
  liabilities: 'Liabilities',
};

function compactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function ProjectionChart({ result }: Props) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  const categories = useMemo(() => {
    // Only include categories that have non-zero values somewhere
    const cats = ['property', 'shares', 'super', 'cash', 'vehicle', 'other'] as const;
    return cats.filter((cat) =>
      result.yearData.some((d) => d[cat] !== 0),
    );
  }, [result]);

  const hasLiabilities = result.yearData.some((d) => d.liabilities < 0);

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={result.yearData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="year"
            stroke={textColor}
            tick={{ fontSize: 12, fill: textColor }}
            tickLine={{ stroke: textColor }}
          />
          <YAxis
            stroke={textColor}
            tick={{ fontSize: 12, fill: textColor }}
            tickLine={{ stroke: textColor }}
            tickFormatter={compactCurrency}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className={`rounded-lg shadow-xl border px-4 py-3 text-sm
                  ${isDark ? 'bg-[#1a1a2e] border-white/10' : 'bg-white border-gray-200'}`}
                >
                  <p className={`font-semibold mb-2 ${isDark ? 'text-white/90' : 'text-gray-900'}`}>
                    {label}
                  </p>
                  {payload
                    .filter((p) => p.value !== 0)
                    .sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value)))
                    .map((entry) => (
                      <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className={isDark ? 'text-white/60' : 'text-gray-600'}>
                            {entry.dataKey === 'netWorth' ? 'Net Worth' : CATEGORY_LABELS[entry.dataKey as string] ?? entry.dataKey}
                          </span>
                        </div>
                        <span className={`font-mono ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
                          {formatAUD(Number(entry.value))}
                        </span>
                      </div>
                    ))}
                </div>
              );
            }}
          />

          {/* Stacked areas for asset categories */}
          {categories.map((cat) => (
            <Area
              key={cat}
              type="monotone"
              dataKey={cat}
              stackId="assets"
              fill={COLORS[cat][isDark ? 'dark' : 'light']}
              stroke={COLORS[cat][isDark ? 'dark' : 'light']}
              fillOpacity={0.6}
              strokeWidth={0}
            />
          ))}

          {/* Liabilities below zero */}
          {hasLiabilities && (
            <Area
              type="monotone"
              dataKey="liabilities"
              stackId="debts"
              fill={COLORS.liabilities[isDark ? 'dark' : 'light']}
              stroke={COLORS.liabilities[isDark ? 'dark' : 'light']}
              fillOpacity={0.4}
              strokeWidth={0}
            />
          )}

          {/* Net worth line */}
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke={isDark ? '#ffffff' : '#111827'}
            strokeWidth={2.5}
            dot={false}
            strokeDasharray="6 3"
          />

          {/* Zero line */}
          <ReferenceLine y={0} stroke={textColor} strokeWidth={1} />

          {/* Milestone markers */}
          {result.milestones.map((m, i) => (
            <ReferenceLine
              key={i}
              x={m.year}
              stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
              strokeDasharray="4 4"
              label={{
                value: m.label,
                position: 'top',
                fill: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                fontSize: 11,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
