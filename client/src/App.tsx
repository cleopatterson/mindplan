import { useFinancialData } from './hooks/useFinancialData';
import { LandingPage } from './components/landing/LandingPage';
import { ParseProgress } from './components/upload/ParseProgress';
import { Dashboard } from './components/Dashboard';
import { ExportModal, type ExportOptions } from './components/export/ExportModal';
import type { MindMapHandle } from './components/mindmap/MindMap';
import { LogoFull } from './components/Logo';
import { RotateCcw, Download, Loader2, Sun, Moon } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import { usePdfExport } from './hooks/usePdfExport';
import { ThemeContext, type Theme } from './contexts/ThemeContext';

export default function App() {
  const {
    appState, data, error,
    selectedNodeIds, selectNode,
    highlightedNodeIds, toggleHighlight, clearHighlight,
    hoveredNodeIds, hoverHighlight,
    userLinks, addLink, removeLink,
    insights, insightsLoading, dismissInsight,
    uploadFile, reset, resolveGap, updateNodeField, addNode, deleteNode,
    newNodeId, clearNewNodeId,
  } = useFinancialData();
  const mapRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<MindMapHandle>(null);
  const { exportPdf, exporting } = usePdfExport();
  const [showExportModal, setShowExportModal] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('mindplan-theme') as Theme) ?? 'dark',
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('mindplan-theme', next);
      return next;
    });
  }, []);

  const handleExport = (options: ExportOptions) => {
    if (!data) return;
    exportPdf(mapRef.current, mindMapRef.current, data, options)
      .then(() => setShowExportModal(false))
      .catch((err) => console.error('Export failed:', err));
  };

  if (appState === 'upload') {
    return <LandingPage onUpload={uploadFile} error={error} />;
  }

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`h-screen flex flex-col overflow-hidden select-none transition-colors duration-300
        ${isDark ? 'bg-[#0f0f1a]' : 'bg-gray-100'}`}
      >
        <header className={`shrink-0 border-b px-5 py-3 flex items-center justify-between transition-colors duration-300
          ${isDark ? 'border-white/10' : 'border-gray-200 bg-white'}`}
        >
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset} title="Back to home">
            <LogoFull size="sm" dark={isDark} />
            <span className={`text-xs hidden sm:block transition-colors
              ${isDark ? 'text-white/25 group-hover:text-white/40' : 'text-gray-400 group-hover:text-gray-600'}`}
            >Legacy Wealth Blueprint</span>
          </div>

          <div className="flex items-center gap-3">
            {appState === 'dashboard' && (
              <button
                onClick={toggleTheme}
                className={`cursor-pointer p-2 rounded-lg transition-colors
                  ${isDark ? 'text-white/30 hover:text-white/60 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            {appState === 'dashboard' && (
              <button
                onClick={reset}
                className={`cursor-pointer flex items-center gap-2 text-sm transition-colors
                  ${isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}
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
              insights={insights}
              insightsLoading={insightsLoading}
              onDismissInsight={dismissInsight}
              onDeleteNode={deleteNode}
              onCreateChildNode={addNode}
              newNodeId={newNodeId}
              onClearNewNodeId={clearNewNodeId}
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
    </ThemeContext.Provider>
  );
}
