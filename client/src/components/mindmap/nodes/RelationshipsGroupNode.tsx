import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Handshake } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const RelationshipsGroupNode = memo(function RelationshipsGroupNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-rose-500/90 backdrop-blur text-white w-[180px]
        shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-rose-300" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{data.label}</div>
        {data.sublabel && <div className="text-xs text-rose-100 mt-0.5">{data.sublabel}</div>}
      </div>
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-400/30 shrink-0">
        <Handshake className="w-4.5 h-4.5 text-rose-100/70" />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-rose-300" />
    </div>
  );
});
