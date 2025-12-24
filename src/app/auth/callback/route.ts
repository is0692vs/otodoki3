import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    // Validate and normalize the 'next' parameter to prevent open-redirect
    let normalizedNext = '/'
    if (next.startsWith('/') && !next.startsWith('//')) {
        // Reject URL scheme patterns (e.g., javascript:, data:, etc.) but allow valid paths with colons
        const lowerNext = next.toLowerCase();
        // Use regex to detect URL schemes at the start of the string
        const hasURLScheme = /^[a-z][a-z0-9+.-]*:/i.test(lowerNext);
        
        if (hasURLScheme || lowerNext.includes('\\')) {
            normalizedNext = '/';
        } else {
            // Resolve dot-segments (e.g., /../ or /./)
            try {
                const url = new URL(next, 'http://dummy.com');
                // Only use pathname if protocol is http and hostname is dummy
                if (url.protocol === 'http:' && url.hostname === 'dummy.com') {
                    normalizedNext = url.pathname;
                }
            } catch {
                normalizedNext = '/';
            }
        }
    }

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('OAuth code exchange failed:', error.message)
        }

        if (!error) {
            // Get redirect host - validate x-forwarded-host against allowlist
            const forwardedHost = request.headers.get('x-forwarded-host');
            const forwardedProto = request.headers.get('x-forwarded-proto');
            
            // Parse allowed hosts from environment
            // If ALLOWED_HOSTS is not set, forwarded host headers will be ignored for security
            const allowedHosts = process.env.ALLOWED_HOSTS?.split(',').map(h => h.trim().toLowerCase()) ?? [];
            
            let redirectHost = origin; // Default to current origin
            
            if (forwardedHost) {
                const lowerForwardedHost = forwardedHost.toLowerCase();
                // Only use forwardedHost if it's in the allowlist
                if (allowedHosts.length > 0 && allowedHosts.includes(lowerForwardedHost)) {
                    // Sanitize proto to only allow 'https' or 'http' (default to https)
                    const proto = forwardedProto === 'http' ? 'http' : 'https';
                    redirectHost = `${proto}://${forwardedHost}`;
                }
                // If allowlist is empty or host is not in it, fallback to origin
            }
            
            return NextResponse.redirect(`${redirectHost}${normalizedNext}`);
        }
    }

    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
