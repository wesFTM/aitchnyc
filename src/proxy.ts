import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isDashboardRole, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", pathname);

  if (pathname.startsWith("/admin")) {
    if (!session || !isDashboardRole(session.role)) return NextResponse.redirect(login);
  } else if (!session) {
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/properties/:path*"],
};
