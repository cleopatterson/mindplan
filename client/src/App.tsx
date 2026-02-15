import { useFinancialData } from './hooks/useFinancialData';
import { UploadZone } from './components/upload/UploadZone';
import { ParseProgress } from './components/upload/ParseProgress';
import { Dashboard } from './components/Dashboard';
import { RotateCcw } from 'lucide-react';

export default function App() {
  const { appState, data, error, selectedNodeId, setSelectedNodeId, uploadFile, reset } =
    useFinancialData();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">MindPlan</h1>
          <p className="text-sm text-gray-500">Financial Structure Visualiser</p>
        </div>
        {appState === 'dashboard' && (
          <button
            onClick={reset}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            New upload
          </button>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        {appState === 'upload' && <UploadZone onUpload={uploadFile} error={error} />}
        {appState === 'parsing' && <ParseProgress />}
        {appState === 'dashboard' && data && (
          <Dashboard
            data={data}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        )}
      </main>
    </div>
  );
}
