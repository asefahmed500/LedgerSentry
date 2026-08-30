import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

const SESSION_COOKIE = "ls_session"

const PROTECTED = [
  "/dashboard",
  "/api/agents",
  "/api/baseline",
  "/api/upload",
  "/api/ocr",
  "/api/trajectories",
]

const AUTH_PAGES = ["/login", "/register"]

function secret() {
  const value =
    process.env.AUTH_SECRET ||
    "ledgersentry-dev-secret-change-me-in-production-0123456789"
  return new TextEncoder().encode(value)
}

async function isValidSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return false
  try {
    await jwtVerify(token, secret())
    return true
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  const isAuthPage = AUTH_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )

  const authed = await isValidSession(request)

  if (isProtected && !authed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Sign in to continue." },
        { status: 401 },
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = `next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  if (isAuthPage && authed) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/agents/:path*",
    "/api/baseline/:path*",
    "/api/upload/:path*",
    "/api/ocr/:path*",
    "/api/trajectories/:path*",
    "/login",
    "/register",
  ],
}
