import type { ProjectionResult } from 'shared/types';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAUD } from '../../utils/calculations';
import { TrendingUp, Landmark, CalendarCheck, PiggyBank } from 'lucide-react';

export type ProjectionCardId = 'netWorthRetirement' | 'superRetirement' | 'debtFree' | 'finalNetWorth';

interface Props {
  result: ProjectionResult;
  activeCard: ProjectionCardId | null;
  onCardClick: (id: ProjectionCardId | null) => void;
}

export function ProjectionSummaryStrip({ result, activeCard, onCardClick }: Props) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  const cards: { id: ProjectionCardId; icon: typeof TrendingUp; label: string; value: string; color: string }[] = [
    {
      id: 'netWorthRetirement',
      icon: TrendingUp,
      label: 'Net Worth at Retirement',
      value: result.netWorthAtRetirement !== null ? formatAUD(result.netWorthAtRetirement) : 'N/A',
      color: 'text-blue-400',
    },
    {
      id: 'superRetirement',
      icon: PiggyBank,
      label: 'Super at Retirement',
      value: result.superAtRetirement !== null ? formatAUD(result.superAtRetirement) : 'N/A',
      color: 'text-green-400',
    },
    {
      id: 'debtFree',
      icon: CalendarCheck,
      label: 'Debt Free In',
      value: result.yearsUntilDebtFree !== null ? `${result.yearsUntilDebtFree} years` : 'N/A',
      color: 'text-amber-400',
    },
    {
      id: 'finalNetWorth',
      icon: Landmark,
      label: 'Final Net Worth',
      value: result.yearData.length > 0 ? formatAUD(result.yearData[result.yearData.length - 1].netWorth) : 'N/A',
      color: 'text-purple-400',
    },
  ];

  return (
    <div className={`shrink-0 border-t px-4 py-3 transition-colors duration-300
      ${isDark ? 'bg-[#0f0f1a]/80 border-white/10' : 'bg-white border-gray-200'}`}
    >
      <div className="flex gap-3 overflow-x-auto">
        {cards.map((card) => {
          const isActive = activeCard === card.id;
          return (
            <button
              key={card.id}
              onClick={() => onCardClick(isActive ? null : card.id)}
              className={`cursor-pointer flex-1 min-w-[160px] rounded-lg px-4 py-3 text-left transition-all
                ${isActive
                  ? isDark
                    ? 'bg-white/[0.08] border border-white/20 ring-1 ring-white/10'
                    : 'bg-blue-50 border border-blue-200 ring-1 ring-blue-100'
                  : isDark
                    ? 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]'
                    : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                <span className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                  {card.label}
                </span>
              </div>
              <p className={`text-lg font-semibold font-mono ${isDark ? 'text-white/90' : 'text-gray-900'}`}>
                {card.value}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
