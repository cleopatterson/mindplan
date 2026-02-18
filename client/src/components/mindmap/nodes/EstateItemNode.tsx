import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';
export const EstateItemNode = memo(function EstateItemNode({ data }: { data: NodeData }) {
  const hasIssue = data.hasIssue;

  return (
    <div
      className={`
        cursor-pointer px-3 py-2 rounded-lg backdrop-blur border text-white/90 w-[200px] text-sm
        hover:brightness-110 transition-colors
        ${hasIssue
          ? 'bg-red-500/20 border-red-400/40'
          : 'bg-indigo-500/20 border-indigo-400/30'}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-300/50" />
      <div className="font-medium">{data.label}</div>
      {data.sublabel && <div className="text-xs text-white/60 mt-0.5">{data.sublabel}</div>}
      <Handle type="source" position={Position.Right} className="!bg-indigo-300/20 !w-1.5 !h-1.5" />
    </div>
  );
});
