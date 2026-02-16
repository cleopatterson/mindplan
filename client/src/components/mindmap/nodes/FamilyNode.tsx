import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export function FamilyNode({ data }: { data: NodeData }) {
  return (
    <div className="px-6 py-3 rounded-2xl bg-white text-gray-900 font-bold text-base shadow-lg border-2 border-white/80">
      <Handle type="source" position={Position.Left} id="left" className="!bg-white" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-white" />
      {data.label}
    </div>
  );
}
