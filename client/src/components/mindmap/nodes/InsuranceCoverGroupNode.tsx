import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Heart, ShieldCheck, Zap, Wallet, ChevronRight, ChevronDown } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';
import { useTheme } from '../../../contexts/ThemeContext';

const COVER_ICONS: Record<string, typeof Heart> = {
  life: Heart,
  tpd: ShieldCheck,
  trauma: Zap,
  income_protection: Wallet,
};

export const InsuranceCoverGroupNode = memo(function InsuranceCoverGroupNode({ data }: { data: NodeData }) {
  const isDark = useTheme() === 'dark';
  const Icon = COVER_ICONS[data.insuranceCoverType || ''] || Heart;
  const isExpanded = data.isExpanded ?? false;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl backdrop-blur w-[200px]
        transition-shadow border
        ${isDark
          ? 'bg-cyan-600/80 text-white shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 border-cyan-400/30'
          : 'bg-cyan-500 text-white shadow-md shadow-cyan-300/30 hover:shadow-lg hover:shadow-cyan-400/40 border-cyan-400'}
      `}
    >
      <Handle type="target" position={Position.Left} className={isDark ? '!bg-cyan-300' : '!bg-cyan-200'} />
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${isDark ? 'bg-cyan-400/20' : 'bg-cyan-400/30'}`}>
        <Icon className="w-4.5 h-4.5 text-cyan-100/70" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{data.label}</div>
        {data.sublabel && <div className="text-xs text-cyan-100/70 mt-0.5">{data.sublabel}</div>}
      </div>
      <Chevron className="w-4 h-4 text-cyan-200/70 shrink-0" />
      <Handle type="source" position={Position.Right} className={isDark ? '!bg-cyan-300' : '!bg-cyan-200'} />
    </div>
  );
});
