'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Book, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ModeToggle } from '@/components/ModeToggle';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-64 h-full bg-background border-r flex flex-col">
      <div className="p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Conversations</h1>
        <ModeToggle />
      </div>
      <Button className="mx-4 mb-4" variant="outline">
        <Plus className="mr-2 h-4 w-4" /> New Chat
      </Button>
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                {isOpen ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                <Book className="h-4 w-4 mr-2" />
                Projects
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-6 mt-2 space-y-2">
                <Button variant="ghost" className="w-full justify-start">
                  Project 1
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Project 2
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Project 3
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
