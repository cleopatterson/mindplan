import { useFinancialData } from './hooks/useFinancialData';
import { LandingPage } from './components/landing/LandingPage';
import { ParseProgress } from './components/upload/ParseProgress';
import { Dashboard } from './components/Dashboard';
import { ExportModal, type ExportOptions } from './components/export/ExportModal';
import type { MindMapHandle } from './components/mindmap/MindMap';
import { LogoFull } from './components/Logo';
import { RotateCcw, Download, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { usePdfExport } from './hooks/usePdfExport';

export default function App() {
  const {
    appState, data, error,
    selectedNodeIds, selectNode,
    highlightedNodeIds, toggleHighlight, clearHighlight,
    hoveredNodeIds, hoverHighlight,
    userLinks, addLink, removeLink,
    uploadFile, reset, resolveGap, updateNodeField,
  } = useFinancialData();
  const mapRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<MindMapHandle>(null);
  const { exportPdf, exporting } = usePdfExport();
  const [showExportModal, setShowExportModal] = useState(false);

  const handleExport = (options: ExportOptions) => {
    exportPdf(mapRef.current, mindMapRef.current, data!, options).then(() => {
      setShowExportModal(false);
    });
  };

  if (appState === 'upload') {
    return <LandingPage onUpload={uploadFile} error={error} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0f0f1a] select-none">
      <header className="shrink-0 border-b border-white/10 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={reset} title="Back to home">
          <LogoFull size="sm" />
          <span className="text-xs text-white/25 hidden sm:block group-hover:text-white/40 transition-colors">Financial Structure Visualiser</span>
        </div>

        <div className="flex items-center gap-3">
          {appState === 'dashboard' && (
            <button
              onClick={reset}
              className="cursor-pointer flex items-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors"
              title="Upload new plan"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {appState === 'dashboard' && (
            <button
              onClick={() => setShowExportModal(true)}
              disabled={exporting}
              className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white
                bg-gradient-to-r from-blue-600 to-purple-600
                hover:from-blue-500 hover:to-purple-500
                disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 flex items-center justify-center">
        {appState === 'parsing' && <ParseProgress />}
        {appState === 'dashboard' && data && (
          <Dashboard
            data={data}
            mapRef={mapRef}
            mindMapRef={mindMapRef}
            selectedNodeIds={selectedNodeIds}
            onSelectNode={selectNode}
            highlightedNodeIds={highlightedNodeIds}
            onToggleHighlight={toggleHighlight}
            onClearHighlight={clearHighlight}
            hoveredNodeIds={hoveredNodeIds}
            onHoverHighlight={hoverHighlight}
            onResolveGap={resolveGap}
            onUpdateField={updateNodeField}
            userLinks={userLinks}
            onAddLink={addLink}
            onRemoveLink={removeLink}
          />
        )}
      </main>

      {/* Export modal */}
      {showExportModal && data && (
        <ExportModal
          data={data}
          mapElement={mapRef.current}
          exporting={exporting}
          onExport={handleExport}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
