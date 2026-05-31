import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  // Refresh session — keeps auth token alive
  const { data: { user } } = await supabase.auth.getUser();

  const path           = request.nextUrl.pathname;
  const isLoginPage    = path === '/login';
  const isOnboarding   = path === '/onboarding';
  const isApiRoute     = path.startsWith('/api/');

  // API routes handle their own auth (session check or WEBHOOK_SECRET header).
  // Redirecting them to /login would return HTML instead of a proper response.
  if (isApiRoute) return supabaseResponse;

  // Neprijavljeni → /login (preserve intended destination for post-login redirect)
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Prijavljeni na /login → /dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Prijavljeni bez kluba → /onboarding
  // has_club se postavlja u user_metadata nakon fn_registriraj_novi_klub()
  // Provjera: nema has_club u JWT → jednom DB upit za potvrdu
  if (user && !isOnboarding && !isApiRoute) {
    const hasClub = user.user_metadata?.has_club === true;

    if (!hasClub) {
      // Provjeri u bazi (samo za korisnike bez has_club u metapodacima)
      const { data: profil } = await supabase
        .from('profili')
        .select('klub_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profil?.klub_id) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        return NextResponse.redirect(url);
      }

      // Korisnik ima klub ali nema has_club u metapodacima (stariji računi)
      // Postavljamo has_club kako bi naredni zahtjevi preskočili DB provjeru
      await supabase.auth.updateUser({ data: { has_club: true } });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
