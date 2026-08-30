# LedgerSentry

**One agent, two jobs:** it reconciles what you were paid against what you invoiced, and checks whether what you agreed to (the PO/contract) matches what's actually happening. Both are "does reality match the paperwork" problems — the same matching-and-confidence-scoring reasoning loop applied twice.

> micro1 Frontier Engineering Challenge 2026 submission

---

## The problem

**Who has this problem:** the finance/ops lead at a small or mid-sized business (and their vendors). Every month they manually cross-check three things: did each payment we received match an invoice we sent, and does each vendor's PO comply with our procurement policy?

**The bottleneck:** payments arrive partial, batched, or mislabeled ("ABC Trading" vs "ABC Traders Ltd"); contract terms are buried in prose. Rule-based systems handle the clean 80% and go quiet. The messy 20% is a human squinting at two PDFs side by side — and that's where money leaks and compliance gaps hide. Unmatched invoices become bad debt; unflagged non-compliant PO terms become unenforceable contracts. Both fail silently until an audit or dispute.

**Why solving it matters:** the check is recurring, evidence-heavy, and judgment-based — exactly the shape of work an agent with the right tools can do faster, with every decision carrying a confidence score and a full audit trail, escalating to a human when unsure.

## What it does

| | Baseline (v1) | Agent (v2) |
|---|---|---|
| **Reconciliation** | Exact amount (<1%) + 5-day window + vendor substring → matched/unmatched | Handles partial payments, batched settlements, fuzzy vendor names, OCR'd scans. Outputs `matched/partial/unmatched` + **confidence score** + plain-language explanation |
| **Compliance** | Keyword presence per rule → pass/fail | Judges intent vs wording, cites the exact clause verbatim, marks genuinely unclear rules `ambiguous`, never auto-flags without evidence |
| **Escalation** | none | Confidence below threshold → **human review queue**, never auto-decided |

The agent runs a single tool-calling loop (GLM-4.7-Flash via [zhipu-ai-provider](https://www.npmjs.com/package/zhipu-ai-provider) on the Z.AI open platform) over five tools:

- `extract_document_fields` — GLM vision OCR for scanned invoices, with automatic tesseract.js fallback when the configured model doesn't accept images
- `fuzzy_match_vendor` — Jaro-Winkler + token-set similarity
- `lookup_transaction` — query the synthetic payment feed
- `lookup_rulebook` — fetch procurement rules
- `flag_for_human_review` — the escape hatch

Every tool call, its input/output, and the agent's reasoning is persisted step-by-step (`AgentRun` / `AgentStep` tables) — the trajectory logs **are** the audit trail, viewable in the dashboard, exportable as JSON, and five representative trajectories ship in [`trajectories/`](./trajectories).

| Trajectory | What to look for |
|---|---|
| [`01-clean-exact-match.json`](./trajectories/01-clean-exact-match.json) | Minimal tool use — extract → lookup → submit, high confidence |
| [`02-fuzzy-vendor-name.json`](./trajectories/02-fuzzy-vendor-name.json) | `fuzzy_match_vendor` resolving a name the baseline substring rule rejects |
| [`03-partial-payment.json`](./trajectories/03-partial-payment.json) | `partial, X% received` instead of a silent write-off |
| [`04-compliance-violation-cited.json`](./trajectories/04-compliance-violation-cited.json) | Verbatim clause quoted against the rule it conflicts with |
| [`05-compliance-ambiguous-human-review.json`](./trajectories/05-compliance-ambiguous-human-review.json) | `ambiguous` routed to the review queue instead of guessed |

## Measured improvement

**Primary metric: invoice match accuracy** on the seeded dataset (80 invoices / 80 payments with hand-labeled ground truth, including deliberate typos, partial payments, one-payment-covers-many batches, and unmatched noise). One challenging case class — invoices where the payer name contains a real typo — is called out separately because it is where the baseline loses most of its accuracy.

Both engines run the **same** evaluation cases and are scored against the same ground truth. Agent scoring used an evenly-spaced subset when run on the free tier (`--sample=12`); both engines were then scored on that same subset for a fair comparison.

| Metric | Baseline | Agent | Change |
|---|---|---|---|
| Invoice match accuracy (primary) | see `npm run eval` | see `npm run eval -- --with-agent` | in `/dashboard/metrics` |
| False-positive match rate | see eval | see eval | the expensive failure mode |
| Partial/batch handling | N/A | see eval | baseline cannot do this |
| Compliance precision | see eval | see eval | of flagged violations, % actually violations |
| Compliance recall | see eval | see eval | of actual violations, % caught |
| Human time per invoice (manual baseline process) | ~5–10 min squinting at two documents | seconds to approve/escalate | agent drafts the decision + evidence |
| Cost per invoice | staff time | ~$0 on glm-4.7-flash free tier | API calls only |

Live numbers render at **/dashboard/metrics** straight from the `EvalResult` table — every claim connects to a rerunnable command.

### Improvement changelog

| Stage | What we tried and why | Evidence | Decision / learning |
|---|---|---|---|
| Baseline | Strict rules (amount <1%, date ±5d, vendor substring) — the "reasonable basic way" | 75% accuracy, 0% partial handling, ~55% compliance precision, ~43% recall | Starting point; fails on typos, partials, batches, reworded clauses |
| Iteration 1 | Agent with the 5 PRD tools + submit tool as the terminal step | Exact matches succeed with cited evidence | Kept — tool-calling loop with a forced final tool proved reliable |
| Iteration 2 | Fuzzy vendor matching as an agent tool (Jaro-Winkler + token-set) | "ABC Trading" vs "ABC Traders Ltd" resolves with a score, not a shrug | Kept — recovers the typo cases the baseline loses |
| Iteration 3 | Partial-payment + batch sum-check logic in the agent rubric | `partial, X% received`; batch sums verified before claiming | Kept — the baseline structurally cannot do this |
| Iteration 4 | OCR path: GLM vision first; automatic tesseract.js fallback when the model rejects images | Free-tier text models reject image input — fallback keeps scans working | Kept — confidence from OCR/ledger agreement feeds match confidence |
| Iteration 5 | Ledger record is authoritative; OCR is corroboration only | Uploaded-invoice test: agent matched at 95% while explicitly noting the OCR/ledger invoice-number discrepancy | Kept — this is what makes real user uploads safe |
| Iteration 6 | Ambiguity as a first-class outcome + confidence-gated human routing | PO-2026-010's vague warranty clause → `ambiguous` → review queue, not a guess | Kept — the review queue is the product |
| Removed | Embedding-based vendor history search | Cut per PRD scope lock; Jaro-Winkler covered the synthetic typo cases | Nice-to-have, revisit with real vendor history |
| Removed | Live LLM demo on the public landing page | Burned free-tier quota on anonymous traffic; replaced with a simulated trace + real runs behind auth | Landing sells; dashboard proves |
| Removed | BullMQ + Redis job queue | PRD marks it optional; synchronous runs with polling were enough at this volume | Revisit for real throughput |

### Main failure mode

**OCR errors on low-quality scans.** When extraction misreads an amount, everything downstream inherits the error. Mitigation: extraction confidence is derived from agreement with the human-verified ledger record and propagated into match confidence; low-confidence extractions route to human review rather than auto-deciding. But a garbled scan can still produce a confidently-wrong fuzzy match if the corruption is plausible.

**Hot take:** the agent's most valuable output isn't the match — it's the *reasoned "I'm not sure."* A rules engine never says it; an LLM agent with a review-queue escape hatch finally can, and that's what actually stops money leaking.

## Stack

- **Next.js 16.2.6** (App Router, Turbopack) + **Tailwind v4** + **shadcn/ui** (base-nova)
- **PostgreSQL + Prisma 7.10** (driver adapter `@prisma/adapter-pg`)
- **AI:** `ai@6.0.271` + `zhipu-ai-provider@0.4.0` → Z.AI `glm-4.7-flash` (agents + OCR; any vision-capable GLM upgrades extraction automatically)
- **OCR:** GLM vision (primary), tesseract.js 7 (automatic fallback)
- **PDF:** react-pdf 10 (pdf.js) for in-app PO viewing; pdf-lib for synthetic PO generation
- Node.js 24.x / TypeScript 5.x

**Tools used to build it:** coding agents (opencode) with GLM models; disclosed per the challenge policy. Everything in this repo was built during the competition window.

## Reproduction guide

### Prerequisites

- Node.js 20.9+ (tested on 24), PostgreSQL running locally
- A Z.AI API key (free tier works): https://z.ai/model-api

### Setup

```bash
# 1. install dependencies (postinstall also copies the pdf.js worker into public/)
npm install

# 2. create the database (if it doesn't exist)
createdb leadgerdendb   # or: CREATE DATABASE leadgerdendb; in psql

# 3. configure environment
cp .env.example .env    # then paste your ZHIPU_API_KEY

# 4. schema + client
npx prisma migrate deploy   # or: npx prisma migrate dev
npx prisma generate

# 5. seed the synthetic dataset
npm run db:seed
# Expected output ends with:
# Seed complete: { invoices: 80, matched: ~59, partial: 8, unmatched: ~13, transactions: 80, policies: 18 }
# (also writes public/scans/*.png invoice images and public/policy/*.pdf PO files)
```

### Run

```bash
npm run dev        # http://localhost:3000
```

- `/` — landing page (hero collage from real ledger rows, simulated agent trace, live metrics)
- `/register` → `/dashboard` — create the reviewer account (JWT session)
- `/dashboard/uploads` — upload a scanned invoice (3-step wizard, OCR autofill, optional PO link) or a PO PDF (digital or scanned)
- `/dashboard/policies` — the procurement rulebook (CRUD)
- `/dashboard/reconciliation` — run baseline (all) or the agent per invoice; explanations + confidence
- `/dashboard/compliance` — PO table, in-app PDF viewer, agent findings with clause citations
- `/dashboard/reports` — agent findings across every processed document
- `/dashboard/review` — human review queue (approve/reject with side-by-side evidence)
- `/dashboard/trajectories` — full tool-call logs per agent run (JSON export button)
- `/dashboard/metrics` — baseline vs agent comparison

### Eval

```bash
npm run eval                    # baseline over everything, scores both tasks
npm run eval -- --with-agent    # + agent runs (auto-retries free-tier rate limits)
npm run eval -- --with-agent --sample=12   # agent on an evenly-spaced subset, both engines scored on it
npm run eval -- --with-agent --force      # re-run even if agent results exist
```

Runtime/cost: baseline is instant and free. With `--with-agent`, each invoice run makes 2-5 GLM calls and each PO run 2-3; on the free tier the script auto-retries with backoff — expect ~1-2 min per document on `--sample=12` (roughly 20-40 min total). Cost on `glm-4.7-flash` is $0; paid tiers would be a few cents. Results land in `EvalResult` and /dashboard/metrics.

### Expected output

The eval prints per-engine score lines, e.g.:

```
BASELINE reconciliation — accuracy 75% | FP rate 0% | partial handling N/A (correct 60/80)
AGENT reconciliation      — accuracy <X>% | FP rate <X>% | partial handling <X>% (correct <X>/<X>)
BASELINE compliance — precision 54.5% | recall 42.9% (flagged 11, correct 6/14 true violations)
AGENT compliance    — precision <X>% | recall <X>% (...)
```

Final measured values are stored in the `EvalResult` table and rendered at `/dashboard/metrics`.

## Scope notes (deliberate no's)

- No real bank/bKash/Nagad integrations — synthetic feed
- No multi-user auth — single reviewer role (JWT-protected workspace)
- Read/flag/recommend only — the agent never takes consequential action without human approval (challenge ground rule 4)
