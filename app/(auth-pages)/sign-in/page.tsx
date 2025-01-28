'use client';

import { Message } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';

export default function Login() {
  const supabase = createClient();

  async function signInWithKakao() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
    });
    console.log('kakao', data, error);
  }

  return (
    <div>
      <h1>로그인</h1>
      <Button onClick={signInWithKakao}>카카오 로그인</Button>
    </div>
  );
}
