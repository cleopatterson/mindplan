import { useState, useMemo } from 'react';
import type { FinancialPlan } from 'shared/types';
import {
  netWorth,
  totalAssets,
  totalLiabilities,
  assetAllocation,
  liquidityBreakdown,
  entityConcentration,
  formatAUD,
  netWorthNodeIds,
  allAssetNodeIds,
  liquidAssetNodeIds,
  entityNodeIds,
} from '../../utils/calculations';
import { ChevronDown, ChevronUp, DollarSign, PieChart, Droplets, Building2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface SummaryBarProps {
  data: FinancialPlan;
  onToggleHighlight: (nodeIds: string[]) => void;
}

export function SummaryBar({ data, onToggleHighlight }: SummaryBarProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const toggleExpanded = () => {
    if (expanded) {
      setActiveCard(null);
      onToggleHighlight([]);
    }
    setExpanded(!expanded);
  };

  const handleCardClick = (id: string, nodeIds: string[]) => {
    if (activeCard === id) {
      setActiveCard(null);
      onToggleHighlight([]);
    } else {
      setActiveCard(id);
      onToggleHighlight(nodeIds);
    }
  };

  const cards = useMemo(() => {
    const nw = netWorth(data);
    const allocation = assetAllocation(data);
    const liquidity = liquidityBreakdown(data);
    const concentration = entityConcentration(data);

    return [
      {
        id: 'net-worth',
        icon: <DollarSign className="w-4 h-4" />,
        title: 'Net Worth',
        value: formatAUD(nw),
        detail: `Assets ${formatAUD(totalAssets(data))} — Liabilities ${formatAUD(totalLiabilities(data))}`,
        color: nw >= 0 ? 'text-emerald-400' : 'text-red-400',
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
        nodeIds: allAssetNodeIds(data),
      },
      {
        id: 'liquidity',
        icon: <Droplets className="w-4 h-4" />,
        title: 'Liquidity',
        value: `${liquidity.liquid}% liquid`,
        detail: `${liquidity.illiquid}% illiquid`,
        color: liquidity.liquid < 20 ? 'text-amber-400' : 'text-white/70',
        nodeIds: liquidAssetNodeIds(data),
      },
      {
        id: 'concentration',
        icon: <Building2 className="w-4 h-4" />,
        title: 'Concentration',
        value: concentration[0] ? `${concentration[0].name}: ${concentration[0].pct}%` : 'N/A',
        detail: `${concentration.length} entities`,
        color: 'text-white/70',
        nodeIds: concentration[0] ? entityNodeIds(data, concentration[0].name) : [],
      },
    ];
  }, [data]);

  return (
    <div className="shrink-0 bg-[#0f0f1a] border-t border-white/10">
      {/* Toggle button */}
      <div className="flex justify-center">
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-1.5 px-4 py-1
            text-white/40 text-xs hover:text-white/60 transition-colors"
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
              className={`
                flex-1 min-w-[180px] rounded-xl border px-4 py-3 cursor-pointer transition-all
                ${activeCard === card.id
                  ? 'bg-white/10 border-blue-500/50 ring-1 ring-blue-500/30'
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                }
              `}
            >
              <div className="flex items-center gap-1.5 text-white/40 mb-1">
                {card.icon}
                <span className="text-[10px] font-medium uppercase tracking-wide">{card.title}</span>
              </div>
              <div className={`text-sm font-semibold ${card.color} truncate`}>{card.value}</div>
              <div className="text-[10px] text-white/25 mt-0.5 truncate">{card.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
