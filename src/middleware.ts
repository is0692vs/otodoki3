import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicPaths = ['/login', '/waitlist', '/auth/callback']

const ALLOWED_EMAIL_LIST =
    process.env.ALLOWED_EMAILS?.split(',').map((value) => value.trim().toLowerCase()) ?? [];

function isAllowedEmail(email: string): boolean {
    return ALLOWED_EMAIL_LIST.includes(email.toLowerCase());
}

function createRedirectWithCookies(
    request: NextRequest,
    supabaseResponse: NextResponse,
    pathname: string
): NextResponse {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirectResponse = NextResponse.redirect(url);
    // Copy cookies from supabaseResponse to preserve session
    supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
}

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in middleware');
        return new NextResponse('Internal Server Error: Application is not configured correctly.', { status: 500 });
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    let user = null
    try {
        const {
            data: { user: fetchedUser },
        } = await supabase.auth.getUser()
        user = fetchedUser
    } catch (error) {
        console.error('Error getting user in middleware:', error)
        // On auth error, redirect to login
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    const path = request.nextUrl.pathname

    if (publicPaths.some((publicPath) => path.startsWith(publicPath))) {
        if (user && path === '/login') {
            return createRedirectWithCookies(request, supabaseResponse, '/')
        }
        return supabaseResponse
    }

    if (!user) {
        return createRedirectWithCookies(request, supabaseResponse, '/login');
    }

    if (user.email && !isAllowedEmail(user.email)) {
        return createRedirectWithCookies(request, supabaseResponse, '/waitlist');
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
