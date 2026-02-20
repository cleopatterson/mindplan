import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User, Baby } from 'lucide-react';
import type { NodeData } from '../../../utils/transformToGraph';

export const FamilyMemberNode = memo(function FamilyMemberNode({ data }: { data: NodeData }) {
  const isGrandchild = data.familyRelationship === 'grandson' || data.familyRelationship === 'granddaughter';
  const Icon = isGrandchild ? Baby : User;

  return (
    <div
      className={`
        cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg backdrop-blur border text-white/90 w-[180px] text-sm
        hover:brightness-110 transition-colors
        ${isGrandchild
          ? 'bg-amber-400/10 border-amber-300/20'
          : 'bg-amber-500/20 border-amber-400/30'}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-300/50" />
      <div className="flex-1 min-w-0">
        <div className={isGrandchild ? 'font-normal' : 'font-medium'}>{data.label}</div>
        {data.sublabel && <div className={`text-xs mt-0.5 ${isGrandchild ? 'text-white/40' : 'text-white/60'}`}>{data.sublabel}</div>}
      </div>
      <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${isGrandchild ? 'bg-amber-400/5' : 'bg-amber-400/10'}`}>
        <Icon className={`w-4 h-4 ${isGrandchild ? 'text-amber-300/30' : 'text-amber-300/50'}`} />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-amber-300/50" />
    </div>
  );
});
