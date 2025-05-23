'use client';

import { useSidebar } from '@/components/sidebar/sidebar-provider';
import { useEffect, useState } from 'react';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { isOpen } = useSidebar();
  const [isMobile, setIsMobile] = useState(false);
  
  // 화면 크기 변경 감지
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // 초기 체크
    checkIsMobile();
    
    // 리사이즈 이벤트 리스너
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  return (
    <main 
      className={`
        flex-1 overflow-auto transition-all duration-200 ease-in-out
        ${isOpen ? 'md:w-[calc(100%-16rem)]' : 'md:w-full'}
        ${isMobile && isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
      `}
    >
      <div className={`
        mx-auto py-4
        px-2 sm:px-4 md:px-6 lg:px-8
        max-w-none sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl
      `}>
        {children}
      </div>
    </main>
  );
} 