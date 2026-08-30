import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/db"

export const SESSION_COOKIE = "ls_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function secret() {
  const value =
    process.env.AUTH_SECRET ||
    "ledgersentry-dev-secret-change-me-in-production-0123456789"
  return new TextEncoder().encode(value)
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function createSessionToken(userId: string, email: string) {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.sub !== "string") return null
    return { userId: payload.sub, email: String(payload.email || "") }
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
}

export async function getCurrentUser() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  })
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = MAX_AGE_SECONDS
