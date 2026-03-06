import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { FinancialPlan, ProjectionSettings, ProjectionSettingsResponse } from 'shared/types';
import { useTheme } from '../../contexts/ThemeContext';
import { getDefaultSettings } from '../../utils/projectionDefaults';
import { calculateProjection } from '../../utils/projectionEngine';
import { ProjectionChart } from './ProjectionChart';
import { ProjectionSummaryStrip, type ProjectionCardId } from './ProjectionSummaryStrip';
import { ProjectionSettingsPanel } from './ProjectionSettingsPanel';
import { ProjectionDetailPanel } from './ProjectionDetailPanel';
import { X, Settings, Loader2 } from 'lucide-react';

interface Props {
  data: FinancialPlan;
  getIdToken?: () => Promise<string>;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

type PanelMode = 'settings' | 'detail' | null;

export function ProjectionView({ data, getIdToken, settingsOpen, onToggleSettings }: Props) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  const [settings, setSettings] = useState<ProjectionSettings>(() => getDefaultSettings(data));
  const [smartLoading, setSmartLoading] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [activeCard, setActiveCard] = useState<ProjectionCardId | null>(null);
  const fetchedRef = useRef(false);

  const result = useMemo(() => calculateProjection(data, settings), [data, settings]);

  // Auto-fetch smart settings on first render
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchSmartSettings();
  }, []);

  const fetchSmartSettings = useCallback(async () => {
    setSmartLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (getIdToken) {
        headers['Authorization'] = `Bearer ${await getIdToken()}`;
      }
      const res = await fetch('/api/projection-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ data }),
      });
      const json: ProjectionSettingsResponse = await res.json();
      if (json.success && json.settings) {
        setSettings((prev: ProjectionSettings) => ({
          ...prev,
          ...json.settings,
          horizonYears: json.settings!.horizonYears > 0 ? json.settings!.horizonYears : prev.horizonYears,
        }));
      }
    } catch {
      // Smart settings are non-critical — defaults still work
    } finally {
      setSmartLoading(false);
    }
  }, [data, getIdToken]);

  // Sync settings panel with external toggle
  useEffect(() => {
    if (settingsOpen) {
      setPanelMode('settings');
      setActiveCard(null);
    } else if (panelMode === 'settings') {
      setPanelMode(null);
    }
  }, [settingsOpen]);

  const handleCardClick = useCallback((id: ProjectionCardId | null) => {
    if (id) {
      setActiveCard(id);
      setPanelMode('detail');
    } else {
      setActiveCard(null);
      setPanelMode(null);
    }
  }, []);

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setActiveCard(null);
    if (panelMode === 'settings' && settingsOpen) {
      onToggleSettings();
    }
  }, [panelMode, settingsOpen, onToggleSettings]);

  const panelOpen = panelMode !== null;
  const panelTitle = panelMode === 'settings' ? 'Projection Settings' : 'Details';

  return (
    <div className="w-full h-full flex">
      {/* Chart + summary */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 relative">
          <div className={`absolute inset-0 ${isDark ? 'bg-[#1a1a2e]' : 'bg-gray-50'}`}>
            {/* Top-right: AI loading badge + settings gear */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              {smartLoading && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md border text-xs
                  ${isDark ? 'bg-purple-500/10 border-purple-400/20 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-600'}`}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI analyzing...
                </div>
              )}
              <button
                onClick={() => {
                  if (panelMode === 'settings') {
                    closePanel();
                  } else {
                    setPanelMode('settings');
                    setActiveCard(null);
                    if (!settingsOpen) onToggleSettings();
                  }
                }}
                className={`cursor-pointer p-2.5 rounded-lg backdrop-blur-md border transition-all
                  ${panelMode === 'settings'
                    ? isDark ? 'bg-blue-500/20 border-blue-400/30 text-blue-300' : 'bg-blue-100 border-blue-300 text-blue-600'
                    : isDark ? 'bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                title="Projection settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            <ProjectionChart result={result} />
          </div>
        </div>

        <ProjectionSummaryStrip
          result={result}
          activeCard={activeCard}
          onCardClick={handleCardClick}
        />
      </div>

      {/* Right panel — settings or detail */}
      <div
        className={`
          shrink-0 border-l flex flex-col overflow-hidden
          transition-[width] duration-300 ease-out
          ${isDark ? 'bg-[#0f0f1a] border-white/10' : 'bg-white border-gray-200'}
          ${panelOpen ? 'w-96' : 'w-0 border-l-0'}
        `}
      >
        <div className="w-96 h-full flex flex-col">
          <div className={`shrink-0 flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <h3 className={`font-semibold text-sm ${isDark ? 'text-white/90' : 'text-gray-900'}`}>
              {panelTitle}
            </h3>
            <button
              onClick={closePanel}
              className={`cursor-pointer transition-colors ${isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {panelMode === 'settings' && (
              <ProjectionSettingsPanel
                plan={data}
                settings={settings}
                onUpdate={setSettings}
              />
            )}
            {panelMode === 'detail' && activeCard && (
              <ProjectionDetailPanel result={result} activeCard={activeCard} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
