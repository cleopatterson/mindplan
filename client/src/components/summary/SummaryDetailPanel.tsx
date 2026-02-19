import type { FinancialPlan } from 'shared/types';
import {
  formatAUD,
  netWorth,
  totalAssets,
  totalLiabilities,
  debtRatio,
  assetAllocationDetailed,
  liquidityBreakdownDetailed,
  allLiabilitiesDetailed,
  entityConcentrationDetailed,
} from '../../utils/calculations';
import { HeroBanner, InsightPill } from '../detail/shared';
import { DollarSign, PieChart, Droplets, TrendingDown } from 'lucide-react';

interface SummaryDetailPanelProps {
  data: FinancialPlan;
  activeCard: string;
}

export function SummaryDetailPanel({ data, activeCard }: SummaryDetailPanelProps) {
  switch (activeCard) {
    case 'net-worth': return <NetWorthView data={data} />;
    case 'allocation': return <AllocationView data={data} />;
    case 'liquidity': return <LiquidityView data={data} />;
    case 'debt-ratio': return <DebtRatioView data={data} />;
    default: return null;
  }
}

// ── Allocation group colors ──

const GROUP_COLORS: Record<string, { bar: string; text: string; pill: string }> = {
  Property:  { bar: 'bg-emerald-400', text: 'text-emerald-400', pill: 'emerald' },
  Shares:    { bar: 'bg-blue-400',    text: 'text-blue-400',    pill: 'blue' },
  Cash:      { bar: 'bg-yellow-400',  text: 'text-yellow-400',  pill: 'amber' },
  Super:     { bar: 'bg-orange-400',  text: 'text-orange-400',  pill: 'orange' },
  Insurance: { bar: 'bg-cyan-400',    text: 'text-cyan-400',    pill: 'blue' },
  Vehicle:   { bar: 'bg-slate-400',   text: 'text-slate-400',   pill: 'white' },
  Other:     { bar: 'bg-gray-400',    text: 'text-gray-400',    pill: 'white' },
};

function groupColor(group: string) {
  return GROUP_COLORS[group] ?? GROUP_COLORS.Other;
}

// ── Net Worth View ──

function NetWorthView({ data }: { data: FinancialPlan }) {
  const nw = netWorth(data);
  const assets = totalAssets(data);
  const liabilities = totalLiabilities(data);
  const assetPct = assets + liabilities > 0 ? Math.round((assets / (assets + liabilities)) * 100) : 100;

  const allocation = assetAllocationDetailed(data);
  const concentration = entityConcentrationDetailed(data);

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={DollarSign}
        label={formatAUD(nw)}
        sublabel="Net Worth"
        gradient={nw >= 0
          ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-emerald-900/20'
          : 'bg-gradient-to-br from-red-500/20 via-red-600/10 to-red-900/20'}
        iconColor={nw >= 0 ? 'text-emerald-400' : 'text-red-400'}
      />

      {/* Assets vs Liabilities bar */}
      <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
          <span>Assets {formatAUD(assets)}</span>
          <span>Liabilities {formatAUD(liabilities)}</span>
        </div>
        <div className="w-full h-2.5 bg-red-400/30 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: `${assetPct}%` }} />
        </div>
      </div>

      {/* Breakdown by asset type */}
      {allocation.length > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">By Asset Type</div>
          <div className="space-y-2">
            {allocation.map((item) => {
              const gc = groupColor(item.group);
              return (
                <div key={item.group}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-white/70">{item.group}</span>
                    <span className="text-white/50">{formatAUD(item.value)} · {item.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${gc.bar} opacity-50`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Entity concentration */}
      {concentration.length > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">By Entity</div>
          <div className="space-y-2">
            {concentration.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-white/70">{item.name}</span>
                  <span className="text-white/50">{formatAUD(item.value)} · {item.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400 opacity-40" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Allocation View ──

function AllocationView({ data }: { data: FinancialPlan }) {
  const allocation = assetAllocationDetailed(data);
  const assets = totalAssets(data);

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={PieChart}
        label={`${allocation.length} Asset Groups`}
        sublabel="Allocation"
        gradient="bg-gradient-to-br from-blue-500/20 via-indigo-600/10 to-blue-900/20"
        iconColor="text-blue-400"
      />

      <div className="flex flex-wrap gap-1.5">
        <InsightPill color="blue">Total assets {formatAUD(assets)}</InsightPill>
        {allocation.length > 0 && (
          <InsightPill color="white">Largest: {allocation[0].group} ({allocation[0].pct}%)</InsightPill>
        )}
      </div>

      {/* Stacked bar preview */}
      {allocation.length > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="flex h-3 rounded-full overflow-hidden">
            {allocation.map((item) => {
              const gc = groupColor(item.group);
              return (
                <div
                  key={item.group}
                  className={`${gc.bar} opacity-50 first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${item.pct}%` }}
                  title={`${item.group}: ${item.pct}%`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Per-group breakdown */}
      <div className="space-y-2">
        {allocation.map((item) => {
          const gc = groupColor(item.group);
          return (
            <div key={item.group} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-medium ${gc.text}`}>{item.group}</span>
                <span className="text-sm font-semibold text-white/80">{formatAUD(item.value)}</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${gc.bar} opacity-50`} style={{ width: `${item.pct}%` }} />
              </div>
              <div className="text-[10px] text-white/30 mt-1">{item.pct}% of portfolio</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Liquidity View ──

function LiquidityView({ data }: { data: FinancialPlan }) {
  const liq = liquidityBreakdownDetailed(data);

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={Droplets}
        label={`${liq.liquidPct}% Liquid`}
        sublabel="Liquidity"
        gradient={liq.liquidPct < 20
          ? 'bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-amber-900/20'
          : 'bg-gradient-to-br from-cyan-500/20 via-cyan-600/10 to-cyan-900/20'}
        iconColor={liq.liquidPct < 20 ? 'text-amber-400' : 'text-cyan-400'}
      />

      <div className="flex flex-wrap gap-1.5">
        <InsightPill color="blue">Liquid {formatAUD(liq.liquidTotal)}</InsightPill>
        <InsightPill color="white">Illiquid {formatAUD(liq.illiquidTotal)}</InsightPill>
      </div>

      {/* Liquid vs illiquid bar */}
      <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
          <span>Liquid {liq.liquidPct}%</span>
          <span>Illiquid {liq.illiquidPct}%</span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-400/50 rounded-full" style={{ width: `${liq.liquidPct}%` }} />
        </div>
      </div>

      {/* Liquid assets */}
      {liq.liquidAssets.length > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Liquid Assets</div>
          <div className="space-y-1.5">
            {liq.liquidAssets.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="text-white/70 truncate mr-2">{a.name}</div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white/30 text-[10px]">{a.owner}</span>
                  <span className="text-cyan-400/80 font-medium">{formatAUD(a.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Illiquid assets */}
      {liq.illiquidAssets.length > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">Illiquid Assets</div>
          <div className="space-y-1.5">
            {liq.illiquidAssets.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="text-white/70 truncate mr-2">{a.name}</div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white/30 text-[10px]">{a.owner}</span>
                  <span className="text-white/50 font-medium">{formatAUD(a.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Debt Ratio View ──

function DebtRatioView({ data }: { data: FinancialPlan }) {
  const debt = debtRatio(data);
  const assets = totalAssets(data);
  const liabilities = totalLiabilities(data);
  const allLiabilities = allLiabilitiesDetailed(data);

  const debtColor = debt > 50 ? 'text-red-400' : debt > 30 ? 'text-amber-400' : 'text-emerald-400';
  const barColor = debt > 50 ? 'bg-red-400' : debt > 30 ? 'bg-amber-400' : 'bg-emerald-400';
  const gradient = debt > 50
    ? 'bg-gradient-to-br from-red-500/20 via-red-600/10 to-red-900/20'
    : debt > 30
    ? 'bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-amber-900/20'
    : 'bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-emerald-900/20';

  return (
    <div className="space-y-3">
      <HeroBanner
        icon={TrendingDown}
        label={`${debt}%`}
        sublabel="Debt Ratio"
        gradient={gradient}
        iconColor={debtColor}
      />

      <div className="flex flex-wrap gap-1.5">
        <InsightPill color={debt > 50 ? 'red' : debt > 30 ? 'amber' : 'emerald'}>
          {debt < 30 ? 'Healthy' : debt < 50 ? 'Moderate' : 'High'} debt level
        </InsightPill>
        <InsightPill color="white">
          {formatAUD(liabilities)} of {formatAUD(assets)} assets
        </InsightPill>
      </div>

      {/* Debt ratio bar */}
      <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
        <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
          <span>Debt-to-Asset Ratio</span>
          <span className={debtColor}>{debt}%</span>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor} opacity-50`} style={{ width: `${Math.min(debt, 100)}%` }} />
        </div>
        {/* Threshold markers */}
        <div className="flex justify-between text-[9px] text-white/20 mt-1 px-0.5">
          <span>0%</span>
          <span className="text-amber-400/30">30%</span>
          <span className="text-red-400/30">50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* All liabilities */}
      {allLiabilities.length > 0 && (
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">All Liabilities</div>
          <div className="space-y-2">
            {allLiabilities.map((l, i) => {
              const highInterest = l.interestRate != null && l.interestRate > 6;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="text-white/70 truncate mr-2">{l.name}</div>
                    <span className="text-red-400/80 font-medium shrink-0">{formatAUD(l.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/30 mt-0.5">
                    <span>{l.owner}</span>
                    <span>{l.type.replace('_', ' ')}</span>
                    {l.interestRate != null && (
                      <span className={highInterest ? 'text-red-400/60' : ''}>
                        {l.interestRate}%{highInterest ? ' (high)' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
