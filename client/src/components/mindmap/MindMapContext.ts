import { createContext, useContext } from 'react';

interface MindMapEditContext {
  onUpdateField: (nodeId: string, field: string, value: string) => void;
}

export const MindMapContext = createContext<MindMapEditContext | null>(null);

export function useMindMapEdit() {
  return useContext(MindMapContext);
}
