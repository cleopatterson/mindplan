import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Home, CreditCard, HandCoins, Receipt, AlertTriangle } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';
import type { Liability } from 'shared/types';
import { useTheme } from '../../../contexts/ThemeContext';

const LIABILITY_ICONS: Record<Liability['type'], typeof Home> = {
  mortgage: Home,
  loan: HandCoins,
  credit_card: CreditCard,
  other: Receipt,
};

export const LiabilityNode = memo(function LiabilityNode({ data }: { data: NodeData }) {
  const isLeft = data.side === 'left';
  const isDark = useTheme() === 'dark';
  const Icon = LIABILITY_ICONS[data.liabilityType as Liability['type']] || Receipt;

  const iconBox = (
    <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${isDark ? 'bg-red-400/10' : 'bg-red-50'}`}>
      <Icon className={`w-4 h-4 ${isDark ? 'text-red-300/60' : 'text-red-400'}`} />
    </div>
  );

  return (
    <div
      className={`
        cursor-pointer relative flex items-center gap-2.5 px-3 py-2 rounded-lg backdrop-blur w-[230px] text-sm
        transition-colors border
        ${isDark
          ? 'bg-red-500/20 border-red-400/40 text-red-200 hover:bg-red-500/30'
          : 'bg-white border-red-300 text-red-700 hover:bg-red-50 shadow-sm shadow-red-100/50'
        }
      `}
    >
      <Handle
        type="target"
        position={isLeft ? Position.Right : Position.Left}
        className={isDark ? '!bg-red-400/60' : '!bg-red-400'}
      />
      {isLeft && iconBox}
      <div className={`flex-1 min-w-0 ${isLeft ? 'text-right' : 'text-left'}`}>
        <div className="font-medium truncate">{data.label}</div>
        <div className={`flex items-center gap-1.5 mt-0.5 ${isLeft ? 'justify-end' : ''}`}>
          {data.sublabel && <span className={`text-xs ${isDark ? 'text-red-300/70' : 'text-red-500/70'}`}>{data.sublabel}</span>}
          {data.isJoint && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full leading-none ${isDark ? 'bg-blue-400/15 text-blue-300/70' : 'bg-blue-100 text-blue-600'}`}>
              Joint
            </span>
          )}
        </div>
      </div>
      {!isLeft && iconBox}
      {data.hasGap && (
        <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4.5 h-4.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/30">
          <AlertTriangle className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </div>
  );
});
