'use client';

import * as React from 'react';
import { createContext, useContext, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingOverlay } from '@/components/loading-overlay';
import { BREAKPOINTS } from '@/constant';

interface SidebarContextType {
  isOpen: boolean;
  isLoading: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  startLoading: () => void;
  stopLoading: () => void;
  handleMobileNavigation: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 화면 크기 감지 및 반응형 사이드바 자동 조절
  React.useEffect(() => {
    const checkIsMobile = () => {
      const newIsMobile = window.innerWidth < BREAKPOINTS.MOBILE_MAX;
      const prevIsMobile = isMobile;
      
      setIsMobile(newIsMobile);
      
      // 모바일에서 데스크탑으로 변경된 경우 자동으로 사이드바 열기
      if (prevIsMobile && !newIsMobile) {
        setIsOpen(true);
      }
      // 데스크탑에서 모바일로 변경된 경우 사이드바 닫기 (선택적)
      else if (!prevIsMobile && newIsMobile) {
        setIsOpen(false);
      }
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, [isMobile]); // isMobile을 의존성에 추가하여 이전 상태와 비교

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

  // 모바일에서 네비게이션 클릭 시 사이드바 자동 닫기 기능
  const handleMobileNavigation = () => {
    startLoading();
    // 모바일 환경에서만 사이드바를 닫음
    if (isMobile) {
      setIsOpen(false);
    }
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
        isMobile,
        toggleSidebar,
        setSidebarOpen,
        startLoading,
        stopLoading,
        handleMobileNavigation,
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
