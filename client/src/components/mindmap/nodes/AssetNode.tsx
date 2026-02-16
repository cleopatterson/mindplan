import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

export function AssetNode({ data }: { data: NodeData }) {
  const isLeft = data.side === 'left';

  return (
    <div
      className={`
        px-3 py-2 rounded-lg bg-white/10 backdrop-blur border border-white/20
        text-white/90 min-w-[140px] text-sm
        hover:bg-white/15 transition-colors
        ${data.hasMissingData ? 'border-dashed' : ''}
      `}
    >
      <Handle
        type="target"
        position={isLeft ? Position.Right : Position.Left}
        className="!bg-white/50"
      />
      <div className="font-medium">{data.label}</div>
      {data.sublabel && <div className="text-xs text-white/60 mt-0.5">{data.sublabel}</div>}
    </div>
  );
}
