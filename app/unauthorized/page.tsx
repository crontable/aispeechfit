import { redirect } from 'next/navigation';
import { requireConfirmedSession, getTicketAccess } from '@/lib/auth/access';
import { SUBSCRIPTION_REQUEST_FORM_URL } from '@/constant';
import { Button } from '@/components/ui/button';
import LogoutButton from '@/components/LogoutButton';
export const dynamic = 'force-dynamic';
export default async function UnauthorizedPage() {
  const session = await requireConfirmedSession();
  const access = await getTicketAccess(session);
  if (access.state === 'active') redirect('/study');
  const unavailable = access.state === 'unavailable';
  const subscriptionUrl = SUBSCRIPTION_REQUEST_FORM_URL + encodeURIComponent(session.user.email);
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 text-center">
    <h1 className="text-2xl font-bold">{unavailable ? '이용권을 확인하지 못했습니다' : '이용권이 필요합니다'}</h1>
    <p>{unavailable ? '일시적으로 이용권 정보를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.' : '학습을 시작하려면 유효한 이용권이 필요합니다.'}</p>
    <p className="text-sm text-slate-600">현재 로그인 계정 · {session.user.email}</p>
    <Button asChild>{unavailable ? <a href="/unauthorized">다시 확인</a> : <a href={subscriptionUrl} target="_blank" rel="noopener noreferrer">이용권 신청하기</a>}</Button>
    <LogoutButton showText size="default" />
  </main>;
}
