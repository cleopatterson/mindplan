import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';
import { useTheme } from '../../../contexts/ThemeContext';

export const InsuranceClientNode = memo(function InsuranceClientNode({ data }: { data: NodeData }) {
  const isDark = useTheme() === 'dark';

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3.5 py-2 rounded-xl backdrop-blur w-[200px]
        transition-shadow border
        ${isDark
          ? 'bg-cyan-500/30 text-white shadow-sm shadow-cyan-500/10 hover:shadow-md hover:shadow-cyan-500/20 border-cyan-400/20'
          : 'bg-white text-cyan-800 shadow-sm shadow-cyan-100/50 hover:shadow-md hover:shadow-cyan-200/50 border-cyan-300'}
      `}
    >
      <Handle type="target" position={Position.Left} className={isDark ? '!bg-cyan-300' : '!bg-cyan-400'} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{data.label}</div>
        {data.sublabel && (
          <div className={`text-xs mt-0.5 ${isDark ? 'text-cyan-200/60' : 'text-cyan-600/60'}`}>{data.sublabel}</div>
        )}
      </div>
      <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${isDark ? 'bg-cyan-400/15' : 'bg-cyan-50'}`}>
        <User className={`w-4 h-4 ${isDark ? 'text-cyan-200/50' : 'text-cyan-400'}`} />
      </div>
      <Handle type="source" position={Position.Right} className={isDark ? '!bg-cyan-300' : '!bg-cyan-400'} />
    </div>
  );
});
