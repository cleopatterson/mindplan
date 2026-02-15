import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export function ClientNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        px-5 py-3 rounded-xl bg-blue-50 border-2 border-blue-400 min-w-[200px]
        shadow-sm hover:shadow-md transition-shadow
        ${data.hasMissingData ? 'border-dashed' : ''}
      `}
    >
      <div className="font-semibold text-blue-900 text-sm">{data.label}</div>
      {data.sublabel && <div className="text-xs text-blue-600 mt-0.5">{data.sublabel}</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400" />
    </div>
  );
}
