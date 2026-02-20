import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText, Pen, ShieldCheck, Pin } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

const ESTATE_ITEM_ICONS: Record<string, typeof FileText> = {
  will: FileText,
  poa: Pen,
  guardianship: ShieldCheck,
  super_nomination: Pin,
};

export const EstateItemNode = memo(function EstateItemNode({ data }: { data: NodeData }) {
  const hasIssue = data.hasIssue;
  const Icon = ESTATE_ITEM_ICONS[data.estateItemType || ''] || FileText;

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg backdrop-blur border text-white/90 w-[200px] text-sm
        hover:brightness-110 transition-colors
        ${hasIssue
          ? 'bg-red-500/20 border-red-400/40'
          : 'bg-indigo-500/20 border-indigo-400/30'}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-indigo-300/50" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{data.label}</div>
        {data.sublabel && <div className="text-xs text-white/60 mt-0.5">{data.sublabel}</div>}
      </div>
      <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${hasIssue ? 'bg-red-400/10' : 'bg-indigo-400/10'}`}>
        <Icon className={`w-4 h-4 ${hasIssue ? 'text-red-300/50' : 'text-indigo-300/50'}`} />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-indigo-300/20 !w-1.5 !h-1.5" />
    </div>
  );
});
