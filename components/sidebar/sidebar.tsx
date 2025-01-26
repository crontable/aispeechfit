'use client';

import * as React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Book, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/sidebar/sidebar-provider';

export function Sidebar() {
  const { isOpen, toggleSidebar } = useSidebar();

  return (
    <div
      className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-background border-r transform transition-transform duration-200 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      md:relative md:translate-x-0
    `}
    >
      <div className="flex justify-between items-center p-4 border-b md:hidden">
        <h2 className="font-semibold">Menu</h2>
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Accordion type="multiple" className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger className="px-4">
            <div className="flex items-center">
              <Book className="mr-2 h-4 w-4" />
              <span>Project 1</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="px-4 py-2">
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger className="px-4">
            <div className="flex items-center">
              <Book className="mr-2 h-4 w-4" />
              <span>Project 2</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="px-4 py-2">
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
