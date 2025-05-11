'use client';

import React, { useEffect, useState } from 'react';
import { SidebarToggle } from './sidebar-toggle';
import { useSidebar } from './sidebar/sidebar-provider';

export function ConditionalSidebarToggle() {
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
  
  // 모바일에서 사이드바가 열려있으면 버튼 숨기기
  // 그 외 환경에서는 사이드바가 닫혀 있을 때만 토글 버튼 표시
  if ((isMobile && isOpen) || (!isMobile && isOpen)) {
    return null;
  }
  
  return <SidebarToggle />;
} 