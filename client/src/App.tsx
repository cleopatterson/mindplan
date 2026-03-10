import { useFinancialData } from './hooks/useFinancialData';
import { useAuth } from './hooks/useAuth';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { ParseProgress } from './components/upload/ParseProgress';
import { Dashboard } from './components/Dashboard';
import { ExportModal, type ExportOptions } from './components/export/ExportModal';
import type { MindMapHandle } from './components/mindmap/MindMap';
import { LogoFull } from './components/Logo';
import { Network, TrendingUp, Download, Upload, Loader2, Sun, Moon, LogOut, MessageSquarePlus } from 'lucide-react';
import { useRef, useState, useCallback, lazy, Suspense } from 'react';
import { usePdfExport } from './hooks/usePdfExport';
import { ThemeContext, type Theme } from './contexts/ThemeContext';
import { FeedbackPanel } from './components/feedback/FeedbackPanel';

const ProjectionView = lazy(() => import('./components/projection/ProjectionView').then((m) => ({ default: m.ProjectionView })));

type ViewMode = 'mindmap' | 'projection';

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
  const [viewMode, setViewMode] = useState<ViewMode>('mindmap');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [projectionSettingsOpen, setProjectionSettingsOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
        <header className={`shrink-0 border-b px-5 py-3 grid grid-cols-[1fr_auto_1fr] items-center transition-colors duration-300
          ${isDark ? 'border-white/10' : 'border-gray-200 bg-white'}`}
        >
          {/* Left — logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={reset} title="Back to home">
            <LogoFull size="sm" dark={isDark} />
            <span className={`text-xs hidden sm:block transition-colors
              ${isDark ? 'text-white/25 group-hover:text-white/40' : 'text-gray-400 group-hover:text-gray-600'}`}
            >Legacy Wealth Blueprint</span>
          </div>

          {/* Centre — view toggle (projection gated by VITE_ENABLE_PROJECTION) */}
          <div className="flex justify-center">
            {appState === 'dashboard' && import.meta.env.VITE_ENABLE_PROJECTION && (
              <div className={`flex rounded-lg border p-0.5 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-100'}`}>
                <button
                  onClick={() => setViewMode('mindmap')}
                  className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${viewMode === 'mindmap'
                      ? isDark ? 'bg-white/10 text-white/90 shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                      : isDark ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  title="Mind Map view"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Map</span>
                </button>
                <button
                  onClick={() => setViewMode('projection')}
                  className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                    ${viewMode === 'projection'
                      ? isDark ? 'bg-white/10 text-white/90 shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                      : isDark ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  title="Projection view"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Projection</span>
                </button>
              </div>
            )}
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => setShowFeedback(true)}
              className={`cursor-pointer p-2 rounded-lg transition-colors
                ${isDark ? 'text-white/30 hover:text-white/60 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Send feedback"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className={`cursor-pointer p-2 rounded-lg transition-colors
                ${isDark ? 'text-white/30 hover:text-white/60 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
              <>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      reset();
                      // Small delay to allow state reset before uploading
                      setTimeout(() => uploadFile(file), 50);
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  className={`cursor-pointer p-2 rounded-lg transition-colors
                    ${isDark ? 'text-white/30 hover:text-white/60 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  title="Upload new document"
                >
                  <Upload className="w-4 h-4" />
                </button>
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
              </>
            )}
          </div>
        </header>

        <main className="flex-1 min-h-0 flex items-center justify-center">
          {(appState === 'parsing' || appState === 'completing') && (
            <ParseProgress complete={appState === 'completing'} />
          )}
          {appState === 'dashboard' && data && viewMode === 'mindmap' && (
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
          {appState === 'dashboard' && data && viewMode === 'projection' && (
            <Suspense fallback={<Loader2 className="w-6 h-6 text-white/30 animate-spin" />}>
              <ProjectionView
                data={data}
                getIdToken={getIdToken}
                settingsOpen={projectionSettingsOpen}
                onToggleSettings={() => setProjectionSettingsOpen((p) => !p)}
              />
            </Suspense>
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

        {/* Feedback panel */}
        {showFeedback && user && (
          <FeedbackPanel user={user} onClose={() => setShowFeedback(false)} />
        )}

        {/* Logout confirmation */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className={`rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 ${isDark ? 'bg-[#1a1a2e] border border-white/10' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/10">
                  <LogOut className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className={`font-semibold ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Sign out?</h3>
              </div>
              <p className={`text-sm mb-5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                Are you sure you want to sign out? Any unsaved changes will be lost.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className={`cursor-pointer px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-white/50 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleSignOut();
                  }}
                  className="cursor-pointer px-4 py-2 text-sm rounded-lg bg-orange-500/90 text-white hover:bg-orange-500 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}
