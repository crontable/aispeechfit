import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';

export function ContentArea() {
  return (
    <div className="flex-1 flex flex-col">
      <ScrollArea className="flex-1 p-4">{/* Chat messages will go here */}</ScrollArea>
      <div className="p-4 border-t">
        <form className="flex space-x-2">
          <Input className="flex-1" placeholder="Type your message..." />
          <Button type="submit">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
