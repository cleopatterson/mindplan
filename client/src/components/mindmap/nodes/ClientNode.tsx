import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';
import { InlineEditSlot } from './InlineEditSlot';

export function ClientNode({ id, data }: { id: string; data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer px-4 py-2.5 rounded-xl bg-blue-500/90 backdrop-blur text-white min-w-[160px]
        shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Right} className="!bg-blue-300" />
      <div className="font-semibold text-sm">{data.label}</div>
      {data.sublabel && <div className="text-xs text-blue-100 mt-0.5">{data.sublabel}</div>}
      {data.missingFields?.map((mf) => (
        <InlineEditSlot key={mf.field} nodeId={id} field={mf.field} placeholder={mf.placeholder} />
      ))}
      <Handle type="source" position={Position.Left} className="!bg-blue-300" />
    </div>
  );
}
