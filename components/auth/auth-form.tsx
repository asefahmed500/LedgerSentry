"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function AuthForm({
  mode,
  next = "/dashboard",
}: {
  mode: "login" | "register"
  next?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      })
      const body = (await res.json()) as { ok: boolean; error?: string }
      if (!body.ok) {
        setError(body.error || "Something went wrong.")
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError("Network error — is the server running?")
    } finally {
      setPending(false)
    }
  }

  const isRegister = mode === "register"

  return (
    <div className="w-full max-w-sm border bg-card p-8 shadow-sm">
      <h1 className="text-xl font-semibold">
        {isRegister ? "Create your account" : "Sign in"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isRegister
          ? "One reviewer workspace for reconciliations and compliance."
          : "Welcome back. Your review queue is waiting."}
      </p>
      <form onSubmit={submit} className="mt-6">
        <FieldGroup>
          {isRegister ? (
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" placeholder="Asef Rahman" required />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
            {isRegister ? (
              <FieldDescription>At least 8 characters.</FieldDescription>
            ) : null}
          </Field>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ArrowRightIcon data-icon="inline-end" />
            )}
            {isRegister ? "Create account" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {isRegister ? "Already have an account? " : "New to LedgerSentry? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-primary hover:underline"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  )
}
