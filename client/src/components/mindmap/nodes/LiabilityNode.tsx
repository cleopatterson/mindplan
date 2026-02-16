import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export function LiabilityNode({ data }: { data: NodeData }) {
  const isLeft = data.side === 'left';

  return (
    <div
      className={`
        px-3 py-2 rounded-lg bg-red-500/20 backdrop-blur border border-red-400/40
        text-red-200 min-w-[140px] text-sm
        hover:bg-red-500/30 transition-colors
        ${data.hasMissingData ? 'border-dashed' : ''}
      `}
    >
      <Handle
        type="target"
        position={isLeft ? Position.Right : Position.Left}
        className="!bg-red-400/60"
      />
      <div className="font-medium">{data.label}</div>
      {data.sublabel && <div className="text-xs text-red-300/70 mt-0.5">{data.sublabel}</div>}
    </div>
  );
}
