'use client';

import { Message } from '@/components/form-message';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';

export default function Login(props: { searchParams: Message }) {
  const searchParams = props.searchParams;
  const supabase = createClient();

  async function signInWithKakao() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
    });
  }

  return (
    <div>
      <h1>로그인</h1>
      <Button onClick={signInWithKakao}>카카오 로그인</Button>
    </div>
  );
}
