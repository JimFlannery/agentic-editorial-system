import { NextRequest, NextResponse } from "next/server"

/**
 * Subdomain / custom-domain routing
 *
 * Journals can be accessed via their own domain, e.g.:
 *   https://AgenticES.NEJM.com  →  /journal/NEJM/...
 *
 * The domain-to-acronym mapping is resolved at the infrastructure layer
 * (nginx, Cloudflare Transform Rule, or a CDN worker) which injects the
 * X-Journal-Acronym header before the request reaches Next.js.
 *
 * nginx example:
 *   add_header X-Journal-Acronym "NEJM";
 *
 * Cloudflare Transform Rule example:
 *   Set HTTP request header  X-Journal-Acronym  to  lookup_json_string(...)
 *
 * The middleware reads that header and transparently rewrites the request
 * so the entire app is scoped to /journal/[acronym] — with no change to the
 * URL the visitor sees in their browser.
 */

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? ""

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? ""
  const pathname = request.nextUrl.pathname

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  // Already scoped to a journal path — nothing to do
  if (pathname.startsWith("/journal/")) {
    return NextResponse.next()
  }

  // Custom domain: infrastructure layer injects the journal acronym
  const acronymFromHeader = request.headers.get("x-journal-acronym")
  if (acronymFromHeader) {
    const url = request.nextUrl.clone()
    // Rewrite e.g. /editorial/queue → /journal/NEJM/editorial/queue
    url.pathname = `/journal/${acronymFromHeader}${pathname === "/" ? "" : pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
}
