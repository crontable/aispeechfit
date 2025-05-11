'use client';

import { useSidebar } from '@/components/sidebar/sidebar-provider';
import { SidebarToggle } from './sidebar-toggle';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { isOpen } = useSidebar();

  return (
    <main 
      className={`
        flex-1 overflow-auto transition-all duration-200 ease-in-out
        ${isOpen ? 'md:w-[calc(100%-16rem)]' : 'md:w-full'}
      `}
    >
      <div className="container mx-auto py-4">
        {children}
      </div>
    </main>
  );
} 