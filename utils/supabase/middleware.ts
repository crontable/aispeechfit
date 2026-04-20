import { ROUTE_PATH } from "@/app/routes";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type SupabaseCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // console.log("#####", request.nextUrl.pathname);
  // console.log("\tSUPABASE Middleware 진입 > user:", user);

  const pathname = request.nextUrl.pathname;

  // ROOT 접근 시 /study로 리다이렉트
  if (pathname === ROUTE_PATH.ROOT) {
    return NextResponse.redirect(new URL(ROUTE_PATH.STUDY, request.url));
  }

  // 로그인 페이지 처리 - 로그인 되어 있을 경우 /study로 리다이렉트
  if (pathname === ROUTE_PATH.SIGN_IN) {
    if (user) return NextResponse.redirect(new URL(ROUTE_PATH.STUDY, request.url));
    return supabaseResponse;
  }

  // /study로 시작하는 모든 경로에 대해 권한 체크 적용
  if (pathname.startsWith(ROUTE_PATH.STUDY)) {
    if (!user) {
      // 로그인 정보가 없을 경우 로그인 페이지로 넘김
      const url = request.nextUrl.clone();
      url.pathname = ROUTE_PATH.SIGN_IN;
      return NextResponse.redirect(url);
    }
    
    // 로그인 이후 이용권 확인
    const now = new Date().toISOString();
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('started_at', now)
      .gte('expires_at', now)
      .limit(1);
    
    // 이용권이 없거나 현재 유효한 이용권이 없는 경우
    if (ticketsError || !tickets || tickets.length === 0) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTE_PATH.UNAUTHORIZED;
      return NextResponse.redirect(url);
    }
  }

  // unauthorized 페이지 접근 시에는 그대로 통과 (나머지 모든 경로 포함)

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
