'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/client';
function LoginForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function login() {
    setBusy(true); setMessage('');
    try {
      const result = await authClient.signIn.social({ provider: 'kakao', callbackURL: '/auth/complete', errorCallbackURL: '/sign-in?error=login' });
      if (result.error) throw new Error();
    } catch { setMessage('로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'); setBusy(false); }
  }
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-slate-600">카카오 계정으로 로그인하고 전화번호를 확인한 뒤 이용권을 확인합니다.</p>
    {params.has('error') && <p role="alert" className="text-sm text-red-700">로그인이 완료되지 않았습니다. 다시 시도해 주세요.</p>}
    <Button className="w-full bg-[#FEE500] text-black hover:bg-[#FDD835]" disabled={busy} onClick={login}>
      {busy ? '카카오로 이동 중…' : '카카오로 로그인'}
    </Button>
    <p role="status" aria-live="polite" className="text-sm text-red-700">{message}</p>
  </div>;
}

export default function Login() { return <Suspense fallback={<p>로그인 화면을 준비하고 있습니다.</p>}><LoginForm /></Suspense>; }
