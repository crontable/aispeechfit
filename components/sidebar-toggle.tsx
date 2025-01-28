'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/sidebar/sidebar-provider';

export function SidebarToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <Button variant="outline" size="icon" onClick={toggleSidebar}>
      <Menu className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}
