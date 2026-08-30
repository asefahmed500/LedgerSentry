"use client"

import * as React from "react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const links = [
  { label: "Product", href: "#features" },
  { label: "Agents", href: "#agents-demo" },
  { label: "Metrics", href: "#metrics" },
  { label: "How it works", href: "#how-it-works" },
]

export function LandingNavbar() {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.style.scrollBehavior = "smooth"
    }
    return () => {
      window.removeEventListener("scroll", onScroll)
      document.documentElement.style.scrollBehavior = ""
    }
  }, [])

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-5xl items-center justify-between border bg-background/80 px-4 backdrop-blur transition-shadow supports-[backdrop-filter]:bg-background/60",
          scrolled ? "shadow-md" : "shadow-sm"
        )}
      >
        <a href="#" aria-label="LedgerSentry home" className="pl-2">
          <Logo />
        </a>
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" render={<a href="/login" />}>
            Sign in
          </Button>
          <Button render={<a href="/register" />}>Get started</Button>
        </div>
      </nav>
    </header>
  )
}
