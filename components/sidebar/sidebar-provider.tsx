'use client';

import * as React from 'react';
import { createContext, useContext, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingOverlay } from '@/components/loading-overlay';

interface SidebarContextType {
  isOpen: boolean;
  isLoading: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  startLoading: () => void;
  stopLoading: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 사이드바 토글 함수
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // 사이드바 열림 상태 설정 함수
  const setSidebarOpen = (open: boolean) => {
    setIsOpen(open);
  };

  // 로딩 시작 함수
  const startLoading = () => {
    setIsLoading(true);
  };

  // 로딩 종료 함수
  const stopLoading = () => {
    setIsLoading(false);
  };

  // 페이지 변경 감지 및 로딩 상태 관리
  React.useEffect(() => {
    stopLoading();
  }, [pathname]);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isLoading,
        toggleSidebar,
        setSidebarOpen,
        startLoading,
        stopLoading,
      }}
    >
      {children}
      <LoadingOverlay isLoading={isLoading} />
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
