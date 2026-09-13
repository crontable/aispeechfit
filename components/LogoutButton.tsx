'use client';

import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showIcon?: boolean;
  showText?: boolean;
}

export default function LogoutButton({
  variant = 'ghost',
  size = 'icon',
  showIcon = true,
  showText = false,
}: LogoutButtonProps) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      const { error } = await authClient.signOut();

      if (error) {
        toast.error(error.message || '로그아웃 중 오류가 발생했습니다');
        setPending(false);
        return;
      }

      toast.success('로그아웃 되었습니다');
      window.location.replace('/sign-in');
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그아웃 중 오류가 발생했습니다';
      toast.error(message);
      setPending(false);
    }
  }

  return (
    <Button 
      onClick={signOut} 
      variant={variant} 
      size={size}
      className="rounded-full"
      aria-label="로그아웃"
      disabled={pending}
      aria-busy={pending}
    >
      {showIcon && <LogOut size={18} />}
      {showText && <span className="ml-2">로그아웃</span>}
    </Button>
  );
}
