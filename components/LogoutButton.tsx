'use client';

import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
  const supabase = createClient();
  const router = useRouter();

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error('로그아웃 중 오류가 발생했습니다');
        console.error('로그아웃 오류:', error);
        return;
      }
      
      toast.success('로그아웃 되었습니다');
      router.push('/sign-in');
    } catch (err) {
      toast.error('로그아웃 중 오류가 발생했습니다');
      console.error('로그아웃 오류:', err);
    }
  }

  return (
    <Button 
      onClick={signOut} 
      variant={variant} 
      size={size}
      className="rounded-full"
      aria-label="로그아웃"
    >
      {showIcon && <LogOut size={18} />}
      {showText && <span className="ml-2">로그아웃</span>}
    </Button>
  );
}
