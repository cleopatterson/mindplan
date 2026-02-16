import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

const ENTITY_COLORS: Record<string, { bg: string; shadow: string; handle: string; badge: string }> = {
  trust:       { bg: 'bg-emerald-500/90', shadow: 'shadow-emerald-500/20', handle: '!bg-emerald-300', badge: 'text-emerald-100' },
  smsf:        { bg: 'bg-orange-500/90',  shadow: 'shadow-orange-500/20',  handle: '!bg-orange-300',  badge: 'text-orange-100' },
  company:     { bg: 'bg-purple-500/90',  shadow: 'shadow-purple-500/20',  handle: '!bg-purple-300',  badge: 'text-purple-100' },
  partnership: { bg: 'bg-teal-500/90',    shadow: 'shadow-teal-500/20',    handle: '!bg-teal-300',    badge: 'text-teal-100' },
};

export function EntityNode({ data }: { data: NodeData }) {
  const c = ENTITY_COLORS[data.entityType || 'trust'];

  // Right side: target on left (from family), source on right (to assets)
  return (
    <div
      className={`
        px-4 py-2.5 rounded-xl ${c.bg} backdrop-blur text-white min-w-[160px]
        shadow-md ${c.shadow} hover:shadow-lg transition-shadow
        ${data.hasMissingData ? 'border border-dashed border-white/40' : ''}
      `}
    >
      <Handle type="target" position={Position.Left} className={c.handle} />
      <div className="font-semibold text-sm">{data.label}</div>
      {data.sublabel && <div className={`text-xs ${c.badge} mt-0.5`}>{data.sublabel}</div>}
      <Handle type="source" position={Position.Right} className={c.handle} />
    </div>
  );
}
