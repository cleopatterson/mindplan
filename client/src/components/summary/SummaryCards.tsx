import { useState } from 'react';
import type { FinancialPlan } from 'shared/types';
import {
  netWorth,
  totalAssets,
  totalLiabilities,
  assetAllocation,
  liquidityBreakdown,
  entityConcentration,
  entityEquity,
  formatAUD,
} from '../../utils/calculations';
import { X, DollarSign, PieChart, Droplets, Building2 } from 'lucide-react';

interface SummaryCardsProps {
  data: FinancialPlan;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  if (dismissed.size >= 4) return null;

  const nw = netWorth(data);
  const allocation = assetAllocation(data);
  const liquidity = liquidityBreakdown(data);
  const concentration = entityConcentration(data);

  const cards = [
    {
      id: 'net-worth',
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Net Worth',
      value: formatAUD(nw),
      detail: `Assets ${formatAUD(totalAssets(data))} — Liabilities ${formatAUD(totalLiabilities(data))}`,
      color: nw >= 0 ? 'text-green-700' : 'text-red-700',
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
      color: 'text-gray-700',
    },
    {
      id: 'liquidity',
      icon: <Droplets className="w-5 h-5" />,
      title: 'Liquidity',
      value: `${liquidity.liquid}% liquid`,
      detail: `${liquidity.illiquid}% in illiquid assets`,
      color: liquidity.liquid < 20 ? 'text-amber-700' : 'text-gray-700',
    },
    {
      id: 'concentration',
      icon: <Building2 className="w-5 h-5" />,
      title: 'Entity Concentration',
      value: concentration[0] ? `${concentration[0].name}: ${concentration[0].pct}%` : 'N/A',
      detail: `${concentration.length} entities`,
      color: 'text-gray-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards
        .filter((c) => !dismissed.has(c.id))
        .map((card) => (
          <div
            key={card.id}
            className="bg-white rounded-xl border border-gray-200 p-4 relative group"
          >
            <button
              onClick={() => dismiss(card.id)}
              className="absolute top-2 right-2 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              {card.icon}
              <span className="text-xs font-medium uppercase tracking-wide">{card.title}</span>
            </div>
            <div className={`text-lg font-semibold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.detail}</div>
          </div>
        ))}
    </div>
  );
}
