const steps = [
  {
    number: "01",
    title: "Seed your ledger",
    description:
      "Load the synthetic dataset — invoices, payments, and POs, with the deliberate mess baked in: typo'd vendors, split payments, scanned scans.",
  },
  {
    number: "02",
    title: "Run baseline vs agent",
    description:
      "Strict rules handle the clean 80% for free. The agent takes the messy 20% with tools, evidence, and a confidence score on every decision.",
  },
  {
    number: "03",
    title: "Approve in review queue",
    description:
      "Low-confidence calls land in the review queue with side-by-side evidence and full trajectory logs. A human approves or rejects — the agent only recommends.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6">
        <h2 className="text-3xl font-semibold md:text-4xl">How it works</h2>
        <p className="max-w-2xl text-muted-foreground">
          Three steps from raw documents to defensible decisions.
        </p>
        <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col gap-3 border-t pt-6">
              <p className="font-mono text-4xl font-semibold text-primary">
                {step.number}
              </p>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
