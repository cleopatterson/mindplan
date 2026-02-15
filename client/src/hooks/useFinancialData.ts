import { useState, useCallback } from 'react';
import type { FinancialPlan, ParseResponse } from 'shared/types';

export type AppState = 'upload' | 'parsing' | 'dashboard';

export function useFinancialData() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [data, setData] = useState<FinancialPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    setAppState('parsing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse', { method: 'POST', body: formData });
      const json: ParseResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Failed to parse document');
      }

      setData(json.data);
      setAppState('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAppState('upload');
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setSelectedNodeId(null);
    setAppState('upload');
  }, []);

  return { appState, data, error, selectedNodeId, setSelectedNodeId, uploadFile, reset };
}
