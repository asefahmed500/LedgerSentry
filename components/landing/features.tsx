import {
  GitCompareIcon,
  LayersIcon,
  QuoteIcon,
  ScanLineIcon,
  SplitIcon,
  UserCheckIcon,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const features = [
  {
    icon: SplitIcon,
    title: "Partial payments",
    description:
      "Flags \u201c62% received\u201d instead of silently writing off the gap.",
  },
  {
    icon: LayersIcon,
    title: "Batched settlements",
    description:
      "Sum-checks one payment across three invoices before it claims a match.",
  },
  {
    icon: GitCompareIcon,
    title: "Fuzzy vendor names",
    description:
      "\u201cABC Trading\u201d vs \u201cABC Traders Ltd\u201d — resolved with a score, not a shrug.",
  },
  {
    icon: ScanLineIcon,
    title: "OCR'd scans",
    description:
      "GLM vision reads scanned invoices; tesseract.js as the offline fallback.",
  },
  {
    icon: QuoteIcon,
    title: "Clause-level citations",
    description:
      "Every violation quotes the exact clause and the rule it conflicts with.",
  },
  {
    icon: UserCheckIcon,
    title: "Human-in-the-loop",
    description:
      "Low confidence never auto-decides. It routes to review.",
  },
]

export function Features() {
  return (
    <section id="features" className="bg-section-alt py-20 md:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6">
        <h2 className="text-3xl font-semibold md:text-4xl">
          Built for the messy 20%
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Rule-based matchers handle the clean 80% and go quiet. These are the
          cases that still land on a human&rsquo;s desk — until now.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-fit bg-muted p-2 text-foreground">
                    <feature.icon />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
