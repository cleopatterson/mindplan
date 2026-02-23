import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Crown } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const FamilyNode = memo(function FamilyNode({ data }: { data: NodeData }) {
  return (
    <div className="cursor-pointer flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white text-gray-900 font-bold text-base shadow-lg border-2 border-white/80">
      <Handle type="source" position={Position.Left} id="left" className="!bg-white" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-white" />
      <Crown className="w-5 h-5 text-amber-500 shrink-0" />
      {data.label}
    </div>
  );
});
