import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Sunset, TrendingUp, Shield, ScrollText, Palmtree, GraduationCap, Package, ChevronRight, ChevronDown } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

const CATEGORY_ICONS: Record<string, typeof Sunset> = {
  Retirement: Sunset,
  Wealth: TrendingUp,
  Protection: Shield,
  Estate: ScrollText,
  Lifestyle: Palmtree,
  Education: GraduationCap,
  Other: Package,
};

export const GoalCategoryGroupNode = memo(function GoalCategoryGroupNode({ data }: { data: NodeData }) {
  const category = data.goalGroupCategory ?? 'Other';
  const Icon = CATEGORY_ICONS[category] ?? Package;
  const isExpanded = data.isExpanded ?? false;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-teal-600/80 backdrop-blur text-white w-[200px]
        shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-teal-300" />
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-400/30 shrink-0">
        <Icon className="w-4.5 h-4.5 text-teal-100/70" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{data.label}</div>
        {data.sublabel && <div className="text-xs text-teal-200 mt-0.5">{data.sublabel}</div>}
      </div>
      <Chevron className="w-4 h-4 text-teal-300/70 shrink-0" />
      <Handle type="source" position={Position.Right} className="!bg-teal-300" />
    </div>
  );
});
