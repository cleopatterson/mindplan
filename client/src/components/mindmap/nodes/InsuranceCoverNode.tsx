import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Heart, ShieldCheck, Zap, Wallet } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';
import { useTheme } from '../../../contexts/ThemeContext';

const COVER_ICONS: Record<string, typeof Heart> = {
  life: Heart,
  tpd: ShieldCheck,
  trauma: Zap,
  income_protection: Wallet,
};

export const InsuranceCoverNode = memo(function InsuranceCoverNode({ data }: { data: NodeData }) {
  const isDark = useTheme() === 'dark';
  const Icon = COVER_ICONS[data.insuranceCoverType || ''] || Heart;

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg backdrop-blur border w-[200px] text-sm
        transition-colors
        ${isDark
          ? 'bg-cyan-500/20 border-cyan-400/30 text-white/90 hover:brightness-110'
          : 'bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-50 shadow-sm shadow-cyan-100/50'}
      `}
    >
      <Handle type="target" position={Position.Left} className={isDark ? '!bg-cyan-300/50' : '!bg-cyan-400'} />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{data.label}</div>
        {data.sublabel && <div className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-cyan-600/70'}`}>{data.sublabel}</div>}
      </div>
      <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${isDark ? 'bg-cyan-400/10' : 'bg-cyan-50'}`}>
        <Icon className={`w-4 h-4 ${isDark ? 'text-cyan-300/50' : 'text-cyan-400'}`} />
      </div>
    </div>
  );
});
