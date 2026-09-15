import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

/** Edge middleware must stay under Vercel invocation limits. */
export const MIDDLEWARE_FETCH_TIMEOUT_MS = 2500;

function createTimedFetch(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (init?.signal) {
      init.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { response: supabaseResponse, user: null };
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      global: {
        fetch: createTimedFetch(MIDDLEWARE_FETCH_TIMEOUT_MS),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response: supabaseResponse, user: user ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[middleware] Supabase auth skipped:', message);
    return { response: supabaseResponse, user: null };
  }
}
