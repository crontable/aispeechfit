'use client';

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { SUBSCRIPTION_REQUEST_FORM_URL } from "@/constant";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkTicketAndRedirect = async () => {
      try {
        // 사용자 정보 가져오기
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (currentUser) {
          setUser(currentUser);
          
          // 현재 유효한 티켓이 있는지 확인
          const now = new Date().toISOString();
          const { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('is_active', true)
            .lte('started_at', now)
            .gte('expires_at', now)
            .limit(1);
          
          // 유효한 티켓이 있으면 /study로 리다이렉션
          if (!ticketsError && tickets && tickets.length > 0) {
            router.push('/study');
            return;
          }
        }
      } catch (error) {
        console.error('티켓 확인 중 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkTicketAndRedirect();
  }, [router, supabase]);

  // 로딩 중일 때는 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-50">
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm" />
        <div className="relative w-full max-w-md px-4 py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">확인 중...</p>
        </div>
      </div>
    );
  }

  const SUBSCRIPTION_REQUEST_URL_EMAIL_FILLED = `${SUBSCRIPTION_REQUEST_FORM_URL}${user?.email}`;
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-50">
      <div className="fixed inset-0 bg-white/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">이용권이 필요합니다</h1>
        <p className="mb-2">
          서비스를 이용하기 위해서는 이용권을 신청해야 합니다.
        </p>
        <p className="mb-2">
          <strong>아래의 링크에서 이용권을 신청해주세요.</strong>
        </p>
        {user && (
          <p className="mb-6 text-sm text-gray-600">
            현재 로그인 계정: {user.email}
          </p>
        )}
        <div className="flex justify-center">
          <Button asChild>
            <a href={SUBSCRIPTION_REQUEST_URL_EMAIL_FILLED} target="_blank" rel="noopener noreferrer">
              이용권 신청하기
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
} 