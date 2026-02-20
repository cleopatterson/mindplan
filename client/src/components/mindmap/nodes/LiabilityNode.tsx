import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Home, CreditCard, HandCoins, Receipt } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';
import type { Liability } from 'shared/types';

const LIABILITY_ICONS: Record<Liability['type'], typeof Home> = {
  mortgage: Home,
  loan: HandCoins,
  credit_card: CreditCard,
  other: Receipt,
};

export const LiabilityNode = memo(function LiabilityNode({ data }: { data: NodeData }) {
  const isLeft = data.side === 'left';
  const Icon = LIABILITY_ICONS[data.liabilityType as Liability['type']] || Receipt;

  const iconBox = (
    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-red-400/10 shrink-0">
      <Icon className="w-4 h-4 text-red-300/60" />
    </div>
  );

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg bg-red-500/20 backdrop-blur border border-red-400/40
        text-red-200 w-[230px] text-sm
        hover:bg-red-500/30 transition-colors
      `}
    >
      <Handle
        type="target"
        position={isLeft ? Position.Right : Position.Left}
        className="!bg-red-400/60"
      />
      {isLeft && iconBox}
      <div className={`flex-1 min-w-0 ${isLeft ? 'text-right' : 'text-left'}`}>
        <div className="font-medium truncate">{data.label}</div>
        <div className={`flex items-center gap-1.5 mt-0.5 ${isLeft ? 'justify-end' : ''}`}>
          {data.sublabel && <span className="text-xs text-red-300/70">{data.sublabel}</span>}
          {data.isJoint && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-400/15 text-blue-300/70 leading-none">
              Joint
            </span>
          )}
        </div>
      </div>
      {!isLeft && iconBox}
      <Handle
        type="source"
        position={isLeft ? Position.Left : Position.Right}
        className="!bg-red-400/20 !w-1.5 !h-1.5"
      />
    </div>
  );
});
