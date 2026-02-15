import { useRef } from 'react';
import type { FinancialPlan } from 'shared/types';
import { MindMap } from './mindmap/MindMap';
import { DetailPanel } from './detail/DetailPanel';
import { SummaryCards } from './summary/SummaryCards';
import { GapsChecklist } from './gaps/GapsChecklist';
import { ExportButton } from './export/ExportButton';
import { usePdfExport } from '../hooks/usePdfExport';

interface DashboardProps {
  data: FinancialPlan;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

export function Dashboard({ data, selectedNodeId, onSelectNode }: DashboardProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const { exportPdf, exporting } = usePdfExport();

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SummaryCards data={data} />
        <ExportButton onClick={() => exportPdf(mapRef.current, data)} exporting={exporting} />
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div ref={mapRef} className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <MindMap data={data} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />
        </div>

        {selectedNodeId && (
          <DetailPanel data={data} nodeId={selectedNodeId} onClose={() => onSelectNode(null)} />
        )}
      </div>

      {data.dataGaps.length > 0 && <GapsChecklist gaps={data.dataGaps} entities={data.entities} />}
    </div>
  );
}
