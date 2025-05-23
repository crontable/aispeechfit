'use client';

import { Button } from '@/components/ui/button';
import { DEFAULT_BASE_URL } from '@/constant';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${DEFAULT_BASE_URL}/auth/callback`,
      },
    });

    if (data.url) {
      router.push(data.url);
    }

    console.log('google', data, error);
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
    <div className="relative w-full max-w-md px-4 pt-4 space-y-3">
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
  );
}
