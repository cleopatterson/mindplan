import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export const FamilyGroupNode = memo(function FamilyGroupNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer px-4 py-2.5 rounded-xl bg-amber-500/90 backdrop-blur text-white w-[180px]
        shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-300" />
      <div className="font-semibold text-sm">{data.label}</div>
      {data.sublabel && <div className="text-xs text-amber-100 mt-0.5">{data.sublabel}</div>}
      <Handle type="source" position={Position.Right} className="!bg-amber-300" />
    </div>
  );
});
