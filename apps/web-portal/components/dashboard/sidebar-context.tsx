'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface SidebarContextType {
  openGroupId: string | null;
  setOpenGroupId: (id: string | null) => void;
  toggleGroup: (id: string) => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroupId(prev => prev === id ? null : id);
  }, []);

  return (
    <SidebarContext.Provider value={{ openGroupId, setOpenGroupId, toggleGroup }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
