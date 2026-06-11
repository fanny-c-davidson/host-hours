import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

// Public routes that do not require authentication.
// Everything else is treated as protected by default.
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/reset-password'];
const PUBLIC_PREFIXES = ['/auth', '/invite'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function updateSession(request: NextRequest) {
  // Start with a pass-through response; cookie writes below will update it.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies onto both the request (for downstream middleware) and
          // the response (so the browser receives refreshed tokens).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: always call getUser() before any conditional returns.
  // This is what refreshes the session and keeps the auth token alive.
  // Do NOT use getSession() here — it reads from the cookie without revalidating.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;

  // Supabase may redirect auth codes to the root if the redirect URL isn't
  // in the allowed list. Forward them to the callback handler.
  if (pathname === '/' && searchParams.get('code')) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    callbackUrl.searchParams.set('code', searchParams.get('code')!);
    callbackUrl.searchParams.set('next', '/settings/password');
    return NextResponse.redirect(callbackUrl);
  }

  // Catch Supabase auth errors (e.g. expired password reset links) on the root
  // and redirect to the reset-password page with a friendly message.
  if (pathname === '/' && searchParams.get('error_code') === 'otp_expired') {
    const resetUrl = request.nextUrl.clone();
    resetUrl.pathname = '/reset-password';
    resetUrl.search = '?expired=true';
    return NextResponse.redirect(resetUrl);
  }

  // Redirect unauthenticated users away from protected routes.
  if (!user && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname); // preserve intended destination
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to avoid showing login
  // when already signed in. Respect the `next` param if present.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const next = searchParams.get('next');
    const target = next?.startsWith('/') ? next : '/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Return the supabaseResponse so cookies are forwarded correctly.
  // Do not return a plain NextResponse.next() here — the token refresh
  // cookies would be lost.
  return supabaseResponse;
}
