import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/db"
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth"

const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8DGjOtYtT9GLPFcBzT4Z9mMTURoCa6"

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const email = String(body.email || "").trim().toLowerCase()
  const password = String(body.password || "")

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : await bcrypt.compare(password, DUMMY_HASH)
  if (!user || !passwordOk) {
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 })
  }

  const token = await createSessionToken(user.id, user.email)
  await setSessionCookie(token)
  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email },
  })
}
