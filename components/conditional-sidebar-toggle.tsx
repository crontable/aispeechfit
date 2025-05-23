'use client';

import React from 'react';
import { SidebarToggle } from './sidebar-toggle';
import { useSidebar } from './sidebar/sidebar-provider';

export function ConditionalSidebarToggle() {
  const { isOpen, isMobile } = useSidebar();
  
  // 모바일에서 사이드바가 열려있으면 버튼 숨기기
  // 그 외 환경에서는 사이드바가 닫혀 있을 때만 토글 버튼 표시
  if ((isMobile && isOpen) || (!isMobile && isOpen)) {
    return null;
  }
  
  return <SidebarToggle />;
} 