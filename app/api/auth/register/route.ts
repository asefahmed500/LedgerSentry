import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth"

export async function POST(request: Request) {
  let body: { name?: string; email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const name = String(body.name || "").trim()
  const email = String(body.email || "").trim().toLowerCase()
  const password = String(body.password || "")

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ ok: false, error: "Name must be 2-80 characters" }, { status: 400 })
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 })
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ ok: false, error: "Password must be 8-128 characters" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ ok: false, error: "An account with this email already exists" }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
    select: { id: true, name: true, email: true },
  })

  const token = await createSessionToken(user.id, user.email)
  await setSessionCookie(token)
  return NextResponse.json({ ok: true, user })
}
