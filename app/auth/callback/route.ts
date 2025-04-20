import { NextResponse } from 'next/server';
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server';
import { ROUTE_PATH } from '@/app/routes';
import { cookies, headers } from 'next/headers';

export async function GET(request: Request) {
  // app/auth/callback/route.ts — 기존 코드 맨 위쪽(IMPORT 다음 줄)에 추가
  console.log('▶ callback URL   :', request.url); // 전체 콜백 URI
  console.log('▶ code 파라미터  :', new URL(request.url).searchParams.get('code'));
  console.log('▶ session 쿠키   :', (await cookies()).get('sb-access-token')?.value);

  /* ─────── [추가] 진입 직후 값 확인 ─────── */
  {
    const url = new URL(request.url);
    const rawCookie = (await headers()).get('cookie') ?? '(없음)';
    console.info('■■ DEBUG‑CB ■■', {
      fullURL: url.href,
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state'),
      cookie: rawCookie,
    });
  }
  /* ─────────────────────────────────────── */

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? ROUTE_PATH.STUDY;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(new URL(`${origin}${next}`, request.url));
      } else if (forwardedHost) {
        return NextResponse.redirect(new URL(`https://${forwardedHost}${next}`, request.url));
      } else {
        return NextResponse.redirect(new URL(`${origin}${next}`, request.url));
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
