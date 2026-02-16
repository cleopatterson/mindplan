import { useState } from 'react';
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
import { X, DollarSign, PieChart, Droplets, Building2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface SummaryCardsProps {
  data: FinancialPlan;
  onToggleHighlight: (nodeIds: string[]) => void;
}

export function SummaryCards({ data, onToggleHighlight }: SummaryCardsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(id));
    if (activeCard === id) {
      setActiveCard(null);
      onToggleHighlight([]);
    }
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

  if (dismissed.size >= 4) return null;

  const nw = netWorth(data);
  const allocation = assetAllocation(data);
  const liquidity = liquidityBreakdown(data);
  const concentration = entityConcentration(data);

  const cards: { id: string; icon: ReactNode; title: string; value: string; detail: string; color: string; nodeIds: string[] }[] = [
    {
      id: 'net-worth',
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Net Worth',
      value: formatAUD(nw),
      detail: `Assets ${formatAUD(totalAssets(data))} — Liabilities ${formatAUD(totalLiabilities(data))}`,
      color: nw >= 0 ? 'text-emerald-400' : 'text-red-400',
      nodeIds: netWorthNodeIds(data),
    },
    {
      id: 'allocation',
      icon: <PieChart className="w-5 h-5" />,
      title: 'Asset Allocation',
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
      icon: <Droplets className="w-5 h-5" />,
      title: 'Liquidity',
      value: `${liquidity.liquid}% liquid`,
      detail: `${liquidity.illiquid}% in illiquid assets`,
      color: liquidity.liquid < 20 ? 'text-amber-400' : 'text-white/70',
      nodeIds: liquidAssetNodeIds(data),
    },
    {
      id: 'concentration',
      icon: <Building2 className="w-5 h-5" />,
      title: 'Entity Concentration',
      value: concentration[0] ? `${concentration[0].name}: ${concentration[0].pct}%` : 'N/A',
      detail: `${concentration.length} entities`,
      color: 'text-white/70',
      nodeIds: concentration[0] ? entityNodeIds(data, concentration[0].name) : [],
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {cards
        .filter((c) => !dismissed.has(c.id))
        .map((card) => (
          <div
            key={card.id}
            onClick={() => handleCardClick(card.id, card.nodeIds)}
            className={`
              rounded-xl border p-4 relative group cursor-pointer transition-all
              ${activeCard === card.id
                ? 'bg-white/10 border-blue-500/50 ring-1 ring-blue-500/30'
                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
              }
            `}
          >
            <button
              onClick={(e) => dismiss(card.id, e)}
              className="absolute top-2 right-2 text-white/20 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-white/40 mb-1">
              {card.icon}
              <span className="text-xs font-medium uppercase tracking-wide">{card.title}</span>
            </div>
            <div className={`text-lg font-semibold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-white/30 mt-0.5">{card.detail}</div>
          </div>
        ))}
    </div>
  );
}
