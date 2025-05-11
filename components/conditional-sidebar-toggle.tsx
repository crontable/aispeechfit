'use client';

import React from 'react';
import { SidebarToggle } from './sidebar-toggle';
import { useSidebar } from './sidebar/sidebar-provider';

export function ConditionalSidebarToggle() {
  const { isOpen } = useSidebar();
  
  // 사이드바가 닫혀 있을 때만 토글 버튼 표시
  if (!isOpen) {
    return <SidebarToggle />;
  }
  
  // 사이드바가 열려 있을 때는 버튼 표시하지 않음
  return null;
} 