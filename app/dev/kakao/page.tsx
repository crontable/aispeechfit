import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isKakaoTestEnabled, missingKakaoSettings } from '@/lib/kakao-test/config';
import { getKakaoTestRuntime } from '@/lib/kakao-test/server';
import { readKakaoStatus } from '@/lib/kakao-test/verification';
import KakaoTestPanel from './panel';

export const dynamic = 'force-dynamic';

export default async function KakaoTestPage() {
  if (!isKakaoTestEnabled() || (await headers()).get('host') !== 'localhost:3000') notFound();
  const missing = missingKakaoSettings();
  let signedIn = false;
  let setupError = false;
  let status = null;
  if (!missing.length) {
    try {
      const { auth, pool } = getKakaoTestRuntime();
      const session = await auth.api.getSession({ headers: await headers() });
      signedIn = !!session;
      if (session) status = await readKakaoStatus(pool, session);
    } catch { setupError = true; }
  }
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
    <p className="mb-3 text-sm font-semibold text-slate-500">AI 스피치핏 · 개발 앱 검증</p>
    <h1 className="mb-4 text-3xl font-bold">카카오 전화번호 연동</h1>
    <p className="mb-8 leading-7 text-slate-600">카카오로 로그인한 뒤 서버에서 앱과 계정이 일치하는지 확인하고, 동의한 전화번호를 개발용 DB에 저장합니다.</p>
    {missing.length > 0 ? <section className="rounded-xl border p-6">
      <h2 className="mb-3 font-semibold">환경 변수 입력이 필요합니다.</h2>
      <p className="mb-3">.env.local에서 다음 항목을 채운 뒤 개발 서버를 다시 실행하세요.</p>
      <ul className="list-inside list-disc">{missing.map((key) => <li key={key}>{key}</li>)}</ul>
    </section> : setupError ? <p role="alert">인증 DB에 연결하지 못했습니다. 개발용 DB와 스키마 설정을 확인해 주세요.</p>
      : <KakaoTestPanel signedIn={signedIn} status={status} />}
  </main>;
}
