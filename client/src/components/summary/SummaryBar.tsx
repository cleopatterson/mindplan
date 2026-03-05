import { useState, useMemo } from 'react';
import type { FinancialPlan } from 'shared/types';
import {
  netWorth,
  totalAssets,
  totalLiabilities,
  assetAllocation,
  liquidityBreakdown,
  debtRatio,
  formatAUD,
  netWorthNodeIds,
  allAssetNodeIds,
  liquidAssetNodeIds,
  allLiabilityNodeIds,
  unvaluedAssetStats,
} from '../../utils/calculations';
import { ChevronDown, ChevronUp, DollarSign, PieChart, Droplets, TrendingDown, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface SummaryBarProps {
  data: FinancialPlan;
  activeCard: string | null;
  onCardClick: (id: string | null, nodeIds: string[]) => void;
  onHoverHighlight: (nodeIds: string[]) => void;
}

export function SummaryBar({ data, activeCard, onCardClick, onHoverHighlight }: SummaryBarProps) {
  const isDark = useTheme() === 'dark';
  const [expanded, setExpanded] = useState(true);

  const toggleExpanded = () => {
    if (expanded && activeCard) {
      onCardClick(null, []);
    }
    setExpanded(!expanded);
  };

  const handleCardClick = (id: string, nodeIds: string[]) => {
    if (activeCard === id) {
      onCardClick(null, []);
    } else {
      onCardClick(id, nodeIds);
    }
  };

  const unvalued = useMemo(() => unvaluedAssetStats(data), [data]);

  const cards = useMemo(() => {
    const nw = netWorth(data);
    const allocation = assetAllocation(data);
    const liquidity = liquidityBreakdown(data);
    const debt = debtRatio(data);

    return [
      {
        id: 'net-worth',
        icon: <DollarSign className="w-4 h-4" />,
        title: 'Net Worth',
        value: formatAUD(nw),
        detail: `Assets ${formatAUD(totalAssets(data))} — Liabilities ${formatAUD(totalLiabilities(data))}`,
        color: nw >= 0 ? 'text-emerald-400' : 'text-red-400',
        lightColor: nw >= 0 ? 'text-emerald-600' : 'text-red-600',
        nodeIds: netWorthNodeIds(data),
      },
      {
        id: 'allocation',
        icon: <PieChart className="w-4 h-4" />,
        title: 'Allocation',
        value: Object.entries(allocation)
          .slice(0, 3)
          .map(([type, pct]) => `${type}: ${pct}%`)
          .join(', '),
        detail: `${Object.keys(allocation).length} asset types`,
        color: 'text-white/70',
        lightColor: 'text-gray-700',
        nodeIds: allAssetNodeIds(data),
      },
      {
        id: 'liquidity',
        icon: <Droplets className="w-4 h-4" />,
        title: 'Liquidity',
        value: `${liquidity.liquid}% liquid`,
        detail: `${liquidity.illiquid}% illiquid`,
        color: liquidity.liquid < 20 ? 'text-amber-400' : 'text-white/70',
        lightColor: liquidity.liquid < 20 ? 'text-amber-600' : 'text-gray-700',
        nodeIds: liquidAssetNodeIds(data),
      },
      {
        id: 'debt-ratio',
        icon: <TrendingDown className="w-4 h-4" />,
        title: 'Debt Ratio',
        value: `${debt}%`,
        detail: `Liabilities ${formatAUD(totalLiabilities(data))} of ${formatAUD(totalAssets(data))} assets`,
        color: debt > 50 ? 'text-red-400' : debt > 30 ? 'text-amber-400' : 'text-emerald-400',
        lightColor: debt > 50 ? 'text-red-600' : debt > 30 ? 'text-amber-600' : 'text-emerald-600',
        nodeIds: allLiabilityNodeIds(data),
      },
    ];
  }, [data]);

  return (
    <div className={`summary-bar shrink-0 border-t ${isDark ? 'bg-[#0f0f1a] border-white/10' : 'bg-white border-gray-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]'}`}>
      {/* Toggle button */}
      <div className="flex justify-center">
        <button
          onClick={toggleExpanded}
          className={`summary-toggle cursor-pointer flex items-center gap-1.5 px-4 py-1
            text-xs transition-colors ${isDark ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide summary
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Summary
            </>
          )}
        </button>
      </div>

      {/* Cards row */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${expanded ? 'max-h-40 pb-3 px-4' : 'max-h-0 pb-0 px-4'}
        `}
      >
        <div className="flex gap-3 overflow-x-auto">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id, card.nodeIds)}
              onMouseEnter={() => {
                if (activeCard !== card.id) onHoverHighlight(card.nodeIds);
              }}
              onMouseLeave={() => onHoverHighlight([])}
              className={`
                summary-card group flex-1 min-w-[180px] rounded-xl border px-4 py-3 cursor-pointer
                transition-all duration-200
                ${activeCard === card.id
                  ? isDark
                    ? 'card-active bg-white/10 border-blue-500/50 ring-1 ring-blue-500/30 scale-[1.02] shadow-lg shadow-blue-500/10'
                    : 'card-active bg-blue-50 border-blue-300 ring-1 ring-blue-300/50 scale-[1.02] shadow-lg shadow-blue-500/10'
                  : isDark
                    ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/25 hover:scale-[1.01] hover:shadow-md hover:shadow-white/5'
                    : 'bg-gray-50/80 border-gray-200 hover:bg-white hover:border-gray-300 hover:scale-[1.01] hover:shadow-md hover:shadow-gray-200/50'
                }
              `}
            >
              <div className={`card-header flex items-center gap-1.5 mb-1 transition-colors duration-200 ${
                activeCard === card.id
                  ? isDark ? 'text-blue-400/70' : 'text-blue-500/70'
                  : isDark ? 'text-white/40 group-hover:text-white/60' : 'text-gray-400 group-hover:text-gray-500'
              }`}>
                {card.icon}
                <span className="text-[10px] font-medium uppercase tracking-wide">{card.title}</span>
              </div>
              <div className={`text-sm font-semibold ${isDark ? card.color : card.lightColor} truncate transition-colors duration-200`}>{card.value}</div>
              <div className={`card-detail text-[10px] mt-0.5 truncate transition-colors duration-200 ${
                activeCard === card.id
                  ? isDark ? 'text-white/40' : 'text-gray-500'
                  : isDark ? 'text-white/25 group-hover:text-white/35' : 'text-gray-400 group-hover:text-gray-500'
              }`}>{card.detail}</div>
            </div>
          ))}
        </div>
        {unvalued.pct > 30 && (
          <div className={`flex items-center gap-1.5 mt-2 px-1 text-[11px] ${isDark ? 'text-amber-400/80' : 'text-amber-600/80'}`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Asset totals are approximate — {unvalued.unvalued} of {unvalued.total} assets have no value</span>
          </div>
        )}
      </div>
    </div>
  );
}
