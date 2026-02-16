import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export function ClientNode({ data }: { data: NodeData }) {
  // Left side: target on right (from family), source on left (to personal assets)
  return (
    <div
      className={`
        px-4 py-2.5 rounded-xl bg-blue-500/90 backdrop-blur text-white min-w-[160px]
        shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-shadow
        ${data.hasMissingData ? 'border border-dashed border-blue-300' : ''}
      `}
    >
      <Handle type="target" position={Position.Right} className="!bg-blue-300" />
      <div className="font-semibold text-sm">{data.label}</div>
      {data.sublabel && <div className="text-xs text-blue-100 mt-0.5">{data.sublabel}</div>}
      <Handle type="source" position={Position.Left} className="!bg-blue-300" />
    </div>
  );
}
