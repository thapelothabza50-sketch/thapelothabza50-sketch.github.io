import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/shop")) {
    const method = request.method.toUpperCase();
    const allowedMethods = new Set(["GET", "POST", "PATCH"]);
    if (!allowedMethods.has(method)) {
      return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const isMutatingRequest = method !== "GET";
    if (isMutatingRequest && !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/shop/:path*"],
};
