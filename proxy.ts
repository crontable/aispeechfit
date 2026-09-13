import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/') return NextResponse.redirect(new URL('/study', request.url));
  // Every protected page and API checks the database session itself.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!api|_next/static|_next/image|favicon.ico/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
