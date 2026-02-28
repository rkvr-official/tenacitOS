import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth disabled by user request.
// This makes the dashboard fully accessible (tailnet/public, depending on how it's exposed)
// and avoids slow unauthenticated hydration loops.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Keep matching all non-static routes so auth doesn't accidentally come back via stale edge config.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
