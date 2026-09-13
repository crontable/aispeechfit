'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createAuthClient } from 'better-auth/react';

const authClient = createAuthClient();
type Status = { status: string; phoneMasked: string | null; checkedAt: string | null; sessionChecked: boolean };
const errors: Record<string, string> = {
  phone_consent_required: '전화번호 제공 동의가 필요합니다. 다시 로그인하여 동의를 완료해 주세요.',
  phone_missing: '카카오 응답에 전화번호가 없습니다. 계정의 전화번호와 앱 동의항목을 확인해 주세요.',
  phone_invalid: '카카오에서 받은 전화번호의 형식을 확인하지 못했습니다.',
  app_mismatch: '개발 앱 ID와 토큰을 발급한 앱이 다릅니다. 개발 앱 설정을 확인해 주세요.',
  account_mismatch: '세션의 카카오 계정과 응답의 계정이 일치하지 않습니다. 다시 로그인해 주세요.',
  session_expired: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
  provider_unavailable: '카카오에서 정보를 확인하지 못했습니다. 잠시 후 다시 확인하거나 다시 로그인해 주세요.',
};

export default function KakaoTestPanel({ signedIn, status }: { signedIn: boolean; status: Status | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState(status);

  async function login() {
    setBusy(true); setMessage('');
    try {
      const result = await authClient.signIn.social({ provider: 'kakao', callbackURL: '/dev/kakao', errorCallbackURL: '/dev/kakao?login_error=1' });
      if (result.error) { setMessage('카카오 로그인을 시작하지 못했습니다. 앱 키와 동의항목 설정을 확인해 주세요.'); setBusy(false); }
    } catch { setMessage('로그인 요청에 실패했습니다. 다시 시도해 주세요.'); setBusy(false); }
  }

  async function verify() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/dev/kakao/verify', { method: 'POST' });
      const data = await response.json();
      if ('status' in data) setCurrent(data);
      setMessage(response.ok ? '전화번호를 서버에서 확인하고 저장했습니다.' : errors[data.errorCode] || '검증을 완료하지 못했습니다. 설정을 확인한 뒤 다시 시도해 주세요.');
      router.refresh();
    } catch { setMessage('서버에 연결하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setMessage('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      setCurrent(null);
      router.replace('/dev/kakao');
      router.refresh();
      setBusy(false);
    } catch { setMessage('로그아웃에 실패했습니다. 다시 시도해 주세요.'); setBusy(false); }
  }

  return <section className="space-y-6 rounded-xl border border-slate-200 p-6">
    {params.has('login_error') && <p role="alert" className="text-red-700">카카오 로그인이 완료되지 않았습니다. 동의를 취소했다면 다시 로그인할 수 있습니다.</p>}
    <ol className="list-inside list-decimal space-y-3 text-slate-700">
      <li>카카오 계정 로그인 · {signedIn ? '완료' : '대기'}</li>
      <li>현재 세션의 전화번호 확인 · {current?.sessionChecked ? '완료' : '대기'}</li>
    </ol>
    {signedIn && <div className="rounded-lg bg-slate-50 p-4">
      <p>저장된 전화번호 · {current?.phoneMasked ?? '아직 없음'}</p>
      <p className="mt-2 text-sm text-slate-500">확인 시각 · {current?.checkedAt ? new Date(current.checkedAt).toLocaleString('ko-KR') : '아직 없음'}</p>
    </div>}
    <div className="flex flex-wrap gap-3">
      <button disabled={busy} onClick={signedIn ? verify : login} className="rounded-lg bg-yellow-300 px-5 py-3 font-semibold text-slate-900 disabled:opacity-50">
        {busy ? '처리 중…' : signedIn ? '카카오 전화번호 확인 및 저장' : '카카오로 로그인'}
      </button>
      {signedIn && <button disabled={busy} onClick={logout} className="rounded-lg border px-4 py-3 disabled:opacity-50">로그아웃</button>}
    </div>
    <p role="status" aria-live="polite" className="min-h-6 text-sm leading-6">{message}</p>
    <p className="text-sm leading-6 text-slate-500">이 화면에서는 전화번호를 직접 수정할 수 없습니다. 카카오에서 다시 확인한 값만 저장되며, 화면에는 끝 네 자리만 표시됩니다.</p>
  </section>;
}
