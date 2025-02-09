'use client';

import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  async function signInWithKakao() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
    });

    if (data.url) {
      router.push(data.url);
    }

    console.log('kakao', data, error);
  }

  return (
    <div>
      <h1>로그인</h1>
      <Button onClick={signInWithKakao}>카카오 로그인</Button>
    </div>
  );
}
