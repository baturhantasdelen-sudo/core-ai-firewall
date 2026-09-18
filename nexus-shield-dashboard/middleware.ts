import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

function safeRedirectPath(path: string | null): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return null;
  }
  if (path.startsWith('/login')) {
    return null;
  }
  return path;
}

export async function middleware(request: NextRequest) {
  try {
    const { response, user } = await updateSession(request);
    const { pathname } = request.nextUrl;

    if (
      process.env.NEXUS_DEMO_BYPASS_AUTH === '1' &&
      pathname.startsWith('/dashboard')
    ) {
      return response;
    }

    if (pathname.startsWith('/dashboard') && !user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname === '/login' && user) {
      const next = safeRedirectPath(request.nextUrl.searchParams.get('next'));
      const destination = next ?? '/dashboard';
      return NextResponse.redirect(new URL(destination, request.url));
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[middleware] Passing through after error:', message);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Run auth middleware only on app pages — skip static assets, Next internals,
     * and API routes (webhooks/health must not block on Supabase).
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|map)$).*)',
  ],
};
