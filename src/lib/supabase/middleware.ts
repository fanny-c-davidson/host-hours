import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

// Public routes that do not require authentication.
// Everything else is treated as protected by default.
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/reset-password'];
const PUBLIC_PREFIXES = ['/auth']; // covers /auth/callback, /auth/confirm, etc.

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

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes.
  if (!user && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname); // preserve intended destination
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages to avoid showing login
  // when already signed in.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  // Return the supabaseResponse so cookies are forwarded correctly.
  // Do not return a plain NextResponse.next() here — the token refresh
  // cookies would be lost.
  return supabaseResponse;
}
