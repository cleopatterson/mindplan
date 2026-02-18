import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export const EstateGroupNode = memo(function EstateGroupNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer px-4 py-2.5 rounded-xl bg-indigo-500/90 backdrop-blur text-white w-[200px]
        shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-300" />
      <div className="font-semibold text-sm">{data.label}</div>
      {data.sublabel && <div className="text-xs text-indigo-100 mt-0.5">{data.sublabel}</div>}
      <Handle type="source" position={Position.Right} className="!bg-indigo-300" />
    </div>
  );
});
