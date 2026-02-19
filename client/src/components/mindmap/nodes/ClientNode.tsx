import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const ClientNode = memo(function ClientNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer px-4 py-2.5 rounded-xl bg-blue-500/90 backdrop-blur text-white w-[200px]
        shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-shadow
        text-right
      `}
    >
      <Handle type="target" position={Position.Right} className="!bg-blue-300" />
      <div className="flex items-center gap-1.5 justify-end">
        <div className="font-semibold text-sm">{data.label}</div>
        <User className="w-3.5 h-3.5 text-blue-200/60 shrink-0" />
      </div>
      {data.sublabel && <div className="text-xs text-blue-100 mt-0.5">{data.sublabel}</div>}
      <Handle type="source" position={Position.Left} className="!bg-blue-300" />
    </div>
  );
});
