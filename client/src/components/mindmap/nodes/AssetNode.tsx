import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Home, TrendingUp, Banknote, Shield, Car, ShieldCheck, Wallet, Briefcase } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';
import type { Asset } from 'shared/types';

const ASSET_ICONS: Record<Asset['type'], typeof Home> = {
  property: Home,
  shares: TrendingUp,
  managed_fund: Briefcase,
  cash: Banknote,
  super: Shield,
  vehicle: Car,
  insurance: ShieldCheck,
  other: Wallet,
};

export const AssetNode = memo(function AssetNode({ data }: { data: NodeData }) {
  const isLeft = data.side === 'left';
  const Icon = ASSET_ICONS[data.assetType as Asset['type']] || Wallet;

  const iconBox = (
    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.08] shrink-0">
      <Icon className="w-4 h-4 text-white/50" />
    </div>
  );

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/10 backdrop-blur border border-white/20
        text-white/90 w-[230px] text-sm
        hover:bg-white/15 transition-colors
      `}
    >
      <Handle
        type="target"
        position={isLeft ? Position.Right : Position.Left}
        className="!bg-white/50"
      />
      {isLeft && iconBox}
      <div className={`flex-1 min-w-0 ${isLeft ? 'text-right' : 'text-left'}`}>
        <div className="font-medium truncate">{data.label}</div>
        <div className={`flex items-center gap-1.5 mt-0.5 ${isLeft ? 'justify-end' : ''}`}>
          {data.sublabel && <span className="text-xs text-white/60">{data.sublabel}</span>}
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
        className="!bg-white/20 !w-1.5 !h-1.5"
      />
    </div>
  );
});
