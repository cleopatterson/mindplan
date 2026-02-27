import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Home, Shield, TrendingUp, Banknote, ShieldCheck, Car, Package, Briefcase, Landmark, ChevronRight, ChevronDown } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

const CATEGORY_ICONS: Record<string, typeof Home> = {
  Property: Home,
  Super: Shield,
  Pension: Landmark,
  Shares: TrendingUp,
  'Managed Funds': Briefcase,
  Cash: Banknote,
  Insurance: ShieldCheck,
  Vehicle: Car,
  Other: Package,
};

export const AssetGroupNode = memo(function AssetGroupNode({ data }: { data: NodeData }) {
  const category = data.assetGroupCategory ?? 'Other';
  const Icon = CATEGORY_ICONS[category] ?? Package;
  const isExpanded = data.isExpanded ?? false;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-500/90 backdrop-blur text-white w-[200px]
        shadow-md shadow-slate-500/20 hover:shadow-lg hover:shadow-slate-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Right} className="!bg-slate-300" />
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-400/30 shrink-0">
        <Icon className="w-4.5 h-4.5 text-slate-100/70" />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className="font-semibold text-sm">{data.label}</div>
        {data.sublabel && <div className="text-xs text-slate-200 mt-0.5">{data.sublabel}</div>}
      </div>
      <Chevron className="w-4 h-4 text-slate-300/70 shrink-0" />
      <Handle type="source" position={Position.Left} className="!bg-slate-300" />
    </div>
  );
});
