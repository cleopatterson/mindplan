import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export function LiabilityNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        px-3 py-2 rounded-lg bg-red-50 border border-red-300 min-w-[160px]
        shadow-sm hover:shadow transition-shadow text-sm
        ${data.hasMissingData ? 'border-dashed' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-red-400" />
      <div className="font-medium text-red-800">{data.label}</div>
      {data.sublabel && <div className="text-xs text-red-500 mt-0.5">{data.sublabel}</div>}
    </div>
  );
}
