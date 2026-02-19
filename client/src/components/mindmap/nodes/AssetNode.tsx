import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Home, TrendingUp, Banknote, Shield, Car, ShieldCheck, Wallet } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';
import type { Asset } from 'shared/types';

const ASSET_ICONS: Record<Asset['type'], typeof Home> = {
  property: Home,
  shares: TrendingUp,
  managed_fund: TrendingUp,
  cash: Banknote,
  super: Shield,
  vehicle: Car,
  insurance: ShieldCheck,
  other: Wallet,
};

export const AssetNode = memo(function AssetNode({ data }: { data: NodeData }) {
  const isLeft = data.side === 'left';
  const Icon = ASSET_ICONS[data.assetType as Asset['type']] || Wallet;

  return (
    <div
      className={`
        cursor-pointer px-3 py-2 rounded-lg bg-white/10 backdrop-blur border border-white/20
        text-white/90 w-[230px] text-sm
        hover:bg-white/15 transition-colors
        ${isLeft ? 'text-right' : 'text-left'}
      `}
    >
      <Handle
        type="target"
        position={isLeft ? Position.Right : Position.Left}
        className="!bg-white/50"
      />
      <div className={`flex items-center gap-1.5 ${isLeft ? 'flex-row-reverse' : ''}`}>
        <Icon className="w-3.5 h-3.5 text-white/40 shrink-0" />
        <div className="font-medium truncate">{data.label}</div>
      </div>
      {data.sublabel && <div className="text-xs text-white/60 mt-0.5">{data.sublabel}</div>}
      <Handle
        type="source"
        position={isLeft ? Position.Left : Position.Right}
        className="!bg-white/20 !w-1.5 !h-1.5"
      />
    </div>
  );
});
