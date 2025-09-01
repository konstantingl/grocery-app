import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  try {
    // Skip middleware for API routes and static files
    if (
      request.nextUrl.pathname.startsWith('/api/') ||
      request.nextUrl.pathname.startsWith('/_next/') ||
      request.nextUrl.pathname.includes('.')
    ) {
      return NextResponse.next()
    }

    // Only apply middleware if Supabase is properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey || 
        supabaseUrl.includes('your_supabase_url_here') || 
        supabaseKey.includes('your_supabase_anon_key_here')) {
      // Supabase not configured, allow all requests
      return NextResponse.next()
    }

    const { supabase, response } = createClient(request)
    
    // Check if user is authenticated for protected routes
    const { data: { user } } = await supabase.auth.getUser()
    
    // Protect /my-lists route
    if (request.nextUrl.pathname.startsWith('/my-lists') && !user) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}