import { useFinancialData } from './hooks/useFinancialData';
import { useAuth } from './hooks/useAuth';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { ParseProgress } from './components/upload/ParseProgress';
import { Dashboard } from './components/Dashboard';
import { ExportModal, type ExportOptions } from './components/export/ExportModal';
import type { MindMapHandle } from './components/mindmap/MindMap';
import { LogoFull } from './components/Logo';
import { RotateCcw, Download, Loader2, Sun, Moon, LogOut } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import { usePdfExport } from './hooks/usePdfExport';
import { ThemeContext, type Theme } from './contexts/ThemeContext';

export default function App() {
  const { user, loading: authLoading, signIn, signOut, resetPassword, getIdToken } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const {
    appState, data, error,
    selectedNodeIds, selectNode,
    highlightedNodeIds, toggleHighlight, clearHighlight,
    hoveredNodeIds, hoverHighlight,
    userLinks, addLink, removeLink,
    insights, insightsLoading, dismissInsight,
    uploadFile, reset, resolveGap, updateNodeField, addNode, deleteNode,
    newNodeId, clearNewNodeId,
  } = useFinancialData(getIdToken);
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

  const handleSignOut = useCallback(async () => {
    await signOut();
    reset();
    setShowLogin(false);
  }, [signOut, reset]);

  // Auth loading — show spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    );
  }

  // Not logged in — show login page or landing
  if (!user) {
    if (showLogin) {
      return (
        <LoginPage
          onSignIn={signIn}
          onResetPassword={resetPassword}
          onBack={() => setShowLogin(false)}
        />
      );
    }
    return <LandingPage onLogin={() => setShowLogin(true)} />;
  }

  // Logged in — upload state
  if (appState === 'upload') {
    const firstName = user.displayName?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there';
    return <LandingPage user={{ firstName }} onUpload={uploadFile} onSignOut={handleSignOut} error={error} />;
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
            <button
              onClick={handleSignOut}
              className={`cursor-pointer p-2 rounded-lg transition-colors
                ${isDark ? 'text-white/30 hover:text-white/60 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
          {(appState === 'parsing' || appState === 'completing') && (
            <ParseProgress complete={appState === 'completing'} />
          )}
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
