import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const ClientNode = memo(function ClientNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-500/90 backdrop-blur text-white w-[200px]
        shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Right} className="!bg-blue-300" />
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-400/30 shrink-0">
        <User className="w-4.5 h-4.5 text-blue-100/70" />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className="font-semibold text-sm">{data.label}</div>
        {data.sublabel && <div className="text-xs text-blue-100 mt-0.5">{data.sublabel}</div>}
      </div>
      <Handle type="source" position={Position.Left} className="!bg-blue-300" />
    </div>
  );
});
