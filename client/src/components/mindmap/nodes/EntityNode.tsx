import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Scale, Landmark, Building2, Users } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

const ENTITY_ICONS: Record<string, typeof Scale> = {
  trust: Scale,
  smsf: Landmark,
  company: Building2,
  partnership: Users,
};

const ENTITY_COLORS: Record<string, { bg: string; shadow: string; handle: string; badge: string; iconBg: string; iconColor: string }> = {
  trust:       { bg: 'bg-emerald-500/90', shadow: 'shadow-emerald-500/20', handle: '!bg-emerald-300', badge: 'text-emerald-100', iconBg: 'bg-emerald-400/30', iconColor: 'text-emerald-100/70' },
  smsf:        { bg: 'bg-orange-500/90',  shadow: 'shadow-orange-500/20',  handle: '!bg-orange-300',  badge: 'text-orange-100',  iconBg: 'bg-orange-400/30',  iconColor: 'text-orange-100/70' },
  company:     { bg: 'bg-purple-500/90',  shadow: 'shadow-purple-500/20',  handle: '!bg-purple-300',  badge: 'text-purple-100',  iconBg: 'bg-purple-400/30',  iconColor: 'text-purple-100/70' },
  partnership: { bg: 'bg-teal-500/90',    shadow: 'shadow-teal-500/20',    handle: '!bg-teal-300',    badge: 'text-teal-100',    iconBg: 'bg-teal-400/30',    iconColor: 'text-teal-100/70' },
};

export const EntityNode = memo(function EntityNode({ data }: { data: NodeData }) {
  const c = ENTITY_COLORS[data.entityType || 'trust'];
  const isTrustLike = data.entityType === 'trust' || data.entityType === 'smsf';
  const Icon = ENTITY_ICONS[data.entityType || 'trust'] || Scale;

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${c.bg} backdrop-blur text-white w-[240px]
        shadow-md ${c.shadow} hover:shadow-lg transition-shadow
      `}
    >
      <Handle type="target" position={Position.Right} className={c.handle} />
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${c.iconBg} shrink-0`}>
        <Icon className={`w-4.5 h-4.5 ${c.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0 text-right">
        {isTrustLike && data.trusteeName ? (
          <>
            <div className={`text-[10px] ${c.badge} opacity-80`}>{data.trusteeName}</div>
            <div className="font-semibold text-sm">ATF {data.label}</div>
            <div className={`text-[10px] ${c.badge} mt-0.5 uppercase tracking-wide opacity-60`}>{data.entityType}</div>
          </>
        ) : (
          <>
            <div className="font-semibold text-sm">{data.label}</div>
            {data.sublabel && <div className={`text-xs ${c.badge} mt-0.5`}>{data.sublabel}</div>}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Left} className={c.handle} />
    </div>
  );
});
