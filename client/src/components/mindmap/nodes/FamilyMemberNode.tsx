import { Handle, Position } from '@xyflow/react';
import type { NodeData } from '../../../utils/transformToGraph';
import { InlineEditSlot } from './InlineEditSlot';

export function FamilyMemberNode({ id, data }: { id: string; data: NodeData }) {
  const isGrandchild = data.familyRelationship === 'grandson' || data.familyRelationship === 'granddaughter';

  return (
    <div
      className={`
        cursor-pointer px-3 py-2 rounded-lg backdrop-blur border text-white/90 min-w-[140px] text-sm
        hover:brightness-110 transition-colors
        ${isGrandchild
          ? 'bg-amber-400/10 border-amber-300/20'
          : 'bg-amber-500/20 border-amber-400/30'}
      `}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-300/50" />
      <div className={isGrandchild ? 'font-normal' : 'font-medium'}>{data.label}</div>
      {data.sublabel && <div className={`text-xs mt-0.5 ${isGrandchild ? 'text-white/40' : 'text-white/60'}`}>{data.sublabel}</div>}
      {data.missingFields?.map((mf) => (
        <InlineEditSlot key={mf.field} nodeId={id} field={mf.field} placeholder={mf.placeholder} />
      ))}
      <Handle type="source" position={Position.Right} className="!bg-amber-300/50" />
    </div>
  );
}
