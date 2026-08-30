import { AgentDemo } from "@/components/landing/agent-demo"
import { CtaBanner } from "@/components/landing/cta"
import { Features } from "@/components/landing/features"
import { Footer } from "@/components/landing/footer"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { LandingNavbar } from "@/components/landing/navbar"
import { MetricsStrip } from "@/components/landing/metrics-strip"

export const dynamic = "force-dynamic"

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <LandingNavbar />
      <main className="flex-1">
        <Hero />
        <AgentDemo />
        <Features />
        <HowItWorks />
        <MetricsStrip />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  )
}
