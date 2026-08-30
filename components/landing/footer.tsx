import { Logo } from "@/components/logo"

const footerLinks = [
  { label: "Product", href: "#features" },
  { label: "Agents", href: "#agents-demo" },
  { label: "Metrics", href: "#metrics" },
  { label: "Dashboard", href: "/dashboard" },
]

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-sm text-muted-foreground">
            One agent, two jobs: reconcile payments, enforce contracts.
          </p>
        </div>
        <nav className="flex items-center gap-6">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">
          &copy; 2026 LedgerSentry — micro1 Frontier Engineering Challenge
          submission
        </p>
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
          <span>GLM-5.3-Flash · Z.AI</span>
          <span>Trajectory-logged decisions</span>
        </div>
      </div>
    </footer>
  )
}
