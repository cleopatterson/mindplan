import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export function AssetNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 min-w-[160px]
        shadow-sm hover:shadow transition-shadow text-sm
        ${data.hasMissingData ? 'border-dashed' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="font-medium text-gray-800">{data.label}</div>
      {data.sublabel && <div className="text-xs text-gray-500 mt-0.5">{data.sublabel}</div>}
    </div>
  );
}
