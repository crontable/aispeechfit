import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/utils/supabase/server";
import { ROUTE_PATH } from "@/app/routes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? ROUTE_PATH.STUDY;
  const signInUrl = new URL(ROUTE_PATH.SIGN_IN, origin);

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(signInUrl);
      }

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(new URL(`${origin}${next}`, request.url));
      }

      if (forwardedHost) {
        return NextResponse.redirect(new URL(`https://${forwardedHost}${next}`, request.url));
      }

      return NextResponse.redirect(new URL(`${origin}${next}`, request.url));
    } catch {
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.redirect(signInUrl);
}
