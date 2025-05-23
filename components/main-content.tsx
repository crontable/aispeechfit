'use client';

import { useSidebar } from '@/components/sidebar/sidebar-provider';
import { SIDEBAR } from '@/constant';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { isOpen, isMobile } = useSidebar();

  return (
    <main 
      className={`
        flex-1 overflow-auto transition-all duration-200 ease-in-out
        ${isOpen ? `md:${SIDEBAR.CLASSES.DESKTOP_CALC_WIDTH}` : 'md:w-full'}
        ${isMobile && isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}
      `}
    >
      <div className="container mx-auto py-4">
        {children}
      </div>
    </main>
  );
} 