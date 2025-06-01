'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { DEFAULT_BASE_URL } from '@/constant';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { isInAppBrowser } from '@/utils/browser-detection';
import InAppBrowserWarning from '@/components/InAppBrowserWarning';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const [showWarning, setShowWarning] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    const inAppStatus = isInAppBrowser();
    setIsInApp(inAppStatus);
    
    // 인앱 브라우저 감지 시 초기 알림
    if (inAppStatus) {
      toast.warning('인앱 브라우저가 감지되었습니다. Google 로그인이 제한될 수 있습니다.', {
        duration: 5000,
      });
    }
  }, []);

  async function signInWithGoogle() {
    // 인앱 브라우저에서 Google 로그인 시도 시 경고 표시
    if (isInApp) {
      setShowWarning(true);
      toast.error('인앱 브라우저에서는 Google 로그인이 지원되지 않습니다. 외부 브라우저를 사용해주세요.', {
        duration: 6000,
      });
      return;
    }

    try {
      toast.loading('Google 로그인 중...', { id: 'google-login' });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${DEFAULT_BASE_URL}/auth/callback`,
        },
      });

      if (error) {
        toast.error('로그인 중 오류가 발생했습니다.', { id: 'google-login' });
        console.error('Google 로그인 오류:', error);
        return;
      }

      if (data.url) {
        toast.success('Google 로그인 페이지로 이동합니다.', { id: 'google-login' });
        router.push(data.url);
      }

      console.log('google', data, error);
    } catch (err) {
      toast.error('로그인 중 예상치 못한 오류가 발생했습니다.', { id: 'google-login' });
      console.error('Google 로그인 예외:', err);
    }
  }

  // async function signInWithKakao() {
  //   const { data, error } = await supabase.auth.signInWithOAuth({
  //     provider: 'kakao',
  //     options: {
  //       redirectTo: `${DEFAULT_BASE_URL}/auth/callback`,
  //     },
  //   });

  //   if (data.url) {
  //     router.push(data.url);
  //   }

  //   console.log('kakao', data, error);
  // }

  return (
    <>
      <div className="relative w-full max-w-md px-4 pt-4 space-y-3">
        {/* 인앱 브라우저 경고 배너 */}
        {isInApp && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-amber-800 font-medium mb-1">
                  인앱 브라우저 감지됨
                </p>
                <p className="text-amber-700">
                  Google 로그인이 제한될 수 있습니다. 외부 브라우저 사용을 권장합니다.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button 
          className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300" 
          onClick={signInWithGoogle}
        >
          구글 로그인
        </Button>
        {/* <Button className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-black" onClick={signInWithKakao}>
          카카오 로그인
        </Button> */}
      </div>

      {/* 인앱 브라우저 경고 모달 */}
      {showWarning && (
        <InAppBrowserWarning onClose={() => setShowWarning(false)} />
      )}
    </>
  );
}
