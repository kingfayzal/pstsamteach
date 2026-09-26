import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "st_session";

/**
 * Optimistic gate only: bounce requests with no session cookie to the login
 * page. Real authorization happens in layouts, queries and services.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/learn/:path*", "/teach/:path*", "/admin/:path*", "/account/:path*"],
};
