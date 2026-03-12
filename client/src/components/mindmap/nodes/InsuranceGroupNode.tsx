import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Shield } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const InsuranceGroupNode = memo(function InsuranceGroupNode({ data }: { data: NodeData }) {
  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-cyan-500/90 backdrop-blur text-white w-[200px]
        shadow-md shadow-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/30 transition-shadow
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-cyan-300" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{data.label}</div>
        {data.sublabel && <div className="text-xs text-cyan-100 mt-0.5">{data.sublabel}</div>}
      </div>
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-400/30 shrink-0">
        <Shield className="w-4.5 h-4.5 text-cyan-100/70" />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-cyan-300" />
    </div>
  );
});
