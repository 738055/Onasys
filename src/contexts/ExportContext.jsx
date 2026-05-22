import { createContext, useContext } from 'react';

const ExportContext = createContext(null);

export function ExportProvider({ children, value }) {
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

export function useExportContext() {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error('useExportContext must be used inside ExportProvider');
  return ctx;
}
