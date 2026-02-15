import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';

const ENTITY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  trust: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-900', badge: 'text-green-600' },
  smsf: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', badge: 'text-orange-600' },
  company: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', badge: 'text-purple-600' },
  partnership: { bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-900', badge: 'text-teal-600' },
};

export function EntityNode({ data }: { data: NodeData }) {
  const colors = ENTITY_COLORS[data.entityType || 'trust'];

  return (
    <div
      className={`
        px-4 py-3 rounded-xl ${colors.bg} border-2 ${colors.border} min-w-[180px]
        shadow-sm hover:shadow-md transition-shadow
        ${data.hasMissingData ? 'border-dashed' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} className={`!${colors.border.replace('border-', 'bg-')}`} />
      <div className={`font-semibold ${colors.text} text-sm`}>{data.label}</div>
      {data.sublabel && <div className={`text-xs ${colors.badge} mt-0.5`}>{data.sublabel}</div>}
      <Handle type="source" position={Position.Bottom} className={`!${colors.border.replace('border-', 'bg-')}`} />
    </div>
  );
}
