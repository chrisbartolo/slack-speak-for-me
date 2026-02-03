import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth/session';

const protectedRoutes = [
  '/dashboard',
  '/admin', // Admin routes require auth; role check happens at page level via requireAdmin()
];
const publicRoutes = ['/', '/login', '/callback', '/install', '/docs'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if route needs protection
  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(route + '/')
  );
  const isPublicRoute = publicRoutes.some(
    (route) => path === route || path.startsWith(route + '/')
  );

  // Get session from cookie
  const cookie = request.cookies.get('session')?.value;
  const session = await decrypt(cookie);

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !session?.userId) {
    const loginUrl = new URL('/login', request.nextUrl);
    loginUrl.searchParams.set('return', path);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page to dashboard
  if (isPublicRoute && session?.userId && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (except our OAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, etc.
     */
    '/((?!api/(?!slack)|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
};
