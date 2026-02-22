import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Handshake } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const RelationshipNode = memo(function RelationshipNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg backdrop-blur border text-white/90 w-[200px] text-sm
        hover:brightness-110 transition-colors
        bg-rose-500/20 border-rose-400/30
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-rose-300/50" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{data.label}</div>
        {data.sublabel && <div className="text-xs mt-0.5 text-white/60">{data.sublabel}</div>}
      </div>
      <div className="flex items-center justify-center w-7 h-7 rounded-md shrink-0 bg-rose-400/10">
        <Handshake className="w-4 h-4 text-rose-300/50" />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-rose-300/50" />
    </div>
  );
});
