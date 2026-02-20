import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const EstateClientNode = memo(function EstateClientNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-indigo-500/30 backdrop-blur text-white w-[200px]
        shadow-sm shadow-indigo-500/10 hover:shadow-md hover:shadow-indigo-500/20 transition-shadow
        ${data.hasIssue ? 'border border-red-400/40' : 'border border-indigo-400/20'}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-300" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{data.label}</div>
        {data.sublabel && (
          <div className={`text-xs mt-0.5 ${data.hasIssue ? 'text-red-300/70' : 'text-indigo-200/60'}`}>
            {data.sublabel}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-400/15 shrink-0">
        <User className="w-4 h-4 text-indigo-200/50" />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-indigo-300" />
    </div>
  );
});
