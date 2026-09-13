'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import LogoutButton from '@/components/LogoutButton';
const messages: Record<string, string> = {
  phone_consent_required: '카카오 전화번호 제공 동의가 필요합니다. 다시 로그인하여 동의를 확인해 주세요.',
  phone_missing: '카카오 계정에서 전화번호를 받지 못했습니다.',
  phone_invalid: '전화번호를 확인하지 못했습니다.',
  session_expired: '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.',
};
export default function CompleteLogin() {
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('카카오 전화번호를 확인하고 있습니다.');
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch('/api/kakao/verify', { method: 'POST', signal: controller.signal })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => {
        if (!active) return;
        if (ok && data.sessionChecked) { window.location.replace('/study'); return; }
        setMessage(messages[data.errorCode] || '확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        setBusy(false);
      }).catch(() => {
        if (!active) return;
        setMessage('서버에 연결하지 못했습니다. 다시 시도해 주세요.'); setBusy(false);
      });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
    <h1 className="text-2xl font-bold">로그인을 마무리하고 있어요</h1>
    <p role="status" aria-live="polite">{message}</p>
    {!busy && <Button onClick={() => { setBusy(true); setAttempt((value) => value + 1); }}>다시 확인</Button>}
    <LogoutButton showText size="default" />
  </main>;
}
