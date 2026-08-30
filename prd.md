# LedgerSentry — Product Requirements Document
**micro1 Frontier Engineering Challenge 2026 Submission**

> One agent, two jobs: it reconciles what you were paid against what you invoiced, and checks whether what you agreed to (the PO/contract) matches what's actually happening. Both are "does reality match the paperwork" problems — same underlying matching-and-confidence-scoring engine, two document types.

---

## 1. Problem Statement

**Who:** Finance/ops staff at SMEs (and their vendors/suppliers) who manually cross-check three things every month:
1. Did the payment we received match an invoice we sent? (amount, date, payer — but real payments come in partial, batched, or mislabeled)
2. Does this vendor's contract/PO comply with our procurement policy? (payment terms, liability caps, delivery SLAs — buried in prose, easy to miss)

**Bottleneck:** Both tasks are pattern-matching against messy, semi-structured documents (bank statements, scanned invoices, PO PDFs, policy docs) that rule-based systems handle only for the clean 80% of cases. The remaining 20% — partial payments, fuzzy vendor names, OCR noise, ambiguous contract clauses — still gets done by a human squinting at two PDFs side by side, and that's where money leaks and compliance gaps hide.

**Why it matters:** Unmatched invoices become bad debt or duplicate payments. Unflagged non-compliant PO terms become unenforceable contracts later. Both failure modes are silent until an audit or a dispute.

---

## 2. Scope Lock

**In scope (v1 — Baseline):**
- Rule-based invoice-to-transaction matcher (exact amount + date window + vendor string match)
- Keyword/regex-based PO compliance checker against a fixed rulebook

**In scope (v2 — Advanced, the agent):**
- Agentic reconciliation: handles partial payments, multi-invoice settlements, fuzzy vendor names, OCR'd scanned invoices, and outputs a confidence score + explanation instead of binary accept/reject
- Agentic compliance review: reads a PO/contract, cross-references clauses against the rulebook, cites the specific clause and rule it conflicts with, routes ambiguous cases to human review instead of guessing
- Shared audit log: every agent decision (match or flag) is logged with its reasoning, confidence, and evidence, reviewable by a human

**Explicitly out of scope (say no to these under time pressure):**
- Real bank/bKash/Nagad API integrations — use a synthetic transaction feed
- Multi-user auth/roles — single reviewer role is enough
- Any actual payment or contract action being taken — this is read/flag/recommend only, human approves everything (required by the rulebook anyway)
- OCR model training — use an off-the-shelf OCR (Tesseract or Claude vision) as a black box

---

## 3. Baseline Solution Spec

**3a. Invoice Matcher (baseline)**
- Input: list of invoices (vendor, amount, due date, invoice #) + list of transactions (payer string, amount, date)
- Logic: match if `abs(amount_diff) < 1%` AND `date within 5 days` AND `vendor string exact/substring match`
- Output: matched / unmatched, no explanation

**3b. Compliance Checker (baseline)**
- Input: PO/contract text + a rulebook (list of required clauses, e.g. "payment terms ≤ 30 days", "liability cap ≥ contract value")
- Logic: regex/keyword search for clause presence; flag if a required keyword is missing
- Output: pass/fail per rule, no citation, no nuance

**Acceptance test for both:** must run end-to-end on the synthetic dataset (Section 6) and produce a scored output file.

---

## 4. Advanced Solution Spec (the agent)

**Core mechanism:** A single agent loop (see Section 5) shared across both tasks, differing only in the tools and rubric it's given. This is the "unique" part worth defending to judges — you're not building two agents, you're building one document-reconciliation reasoning pattern applied twice.

**4a. Invoice Matcher (advanced)**
- Handles: partial payments (transaction < invoice amount, flag as "partial, X% received"), batched settlements (one transaction matches N invoices, sum-check), fuzzy vendor names (edit distance / embedding similarity instead of exact match), OCR'd invoices (extract fields via vision model first, then match)
- Output per invoice: `matched | partial | unmatched`, confidence score (0-100), plain-language explanation ("matched to TXN#4821: amount differs by 2%, vendor name 'ABC Traders Ltd' vs 'ABC Trading' resolved via fuzzy match, confidence 87%")
- Ambiguous cases (confidence < threshold) → routed to a human review queue, not auto-decided

**4b. Compliance Checker (advanced)**
- Handles: clauses stated in different wording than the rulebook, conflicting clauses, missing-but-implied terms
- Output per rule: `compliant | violation | ambiguous`, with the exact quoted clause and which rule it conflicts with, and a one-line rationale
- Ambiguous cases → routed to human review, never auto-flagged as violation without evidence

**Metrics that prove the improvement (Section 7):**
- Match accuracy % (baseline vs. advanced) on the same synthetic dataset
- False-positive rate (wrongly auto-matched/wrongly flagged compliant) — this is the one that matters more than raw accuracy, since it's the expensive failure mode
- Compliance-check precision/recall vs. a hand-labeled test set

**What to try and be ready to cut:** full embedding-based semantic search over vendor history (nice-to-have, cut first if time-constrained), auto-generating the rulebook from a contract template (interesting but scope creep — do it only if baseline+advanced are solid with hours to spare).

---

## 5. Agent Architecture

**Framework:** Claude API with tool-calling (Anthropic SDK), agentic loop pattern — consistent with your existing [[invoicematch-ai]] design. (LangGraph is a reasonable alternative if you want explicit state-graph control over the human-checkpoint routing; default to plain tool-calling loop for hackathon time constraints — less scaffolding to debug.)

**Tools exposed to the agent:**
- `extract_document_fields(file)` — OCR/vision extraction for scanned invoices or PO PDFs
- `fuzzy_match_vendor(name_a, name_b)` — string/embedding similarity score
- `lookup_transaction(filters)` — query the synthetic transaction feed
- `lookup_rulebook(clause_type)` — query the compliance rules
- `flag_for_human_review(item, reason)` — the escape hatch when confidence is low

**Human checkpoints (required by the challenge rulebook):**
- Any match/flag below the confidence threshold is written to a review queue, not auto-resolved
- No consequential action (marking an invoice "paid," rejecting a PO) happens without explicit human approval in the UI — the agent only recommends

**Trajectory capture:** log every tool call, its input/output, and the agent's running reasoning to a structured JSON log per document processed — this becomes your submission's agent trajectory evidence directly, so build the logger before you build the agent loop, not after.

---

## 6. Data Plan

- Synthetic invoice set (50-100 invoices): generate with realistic Bangladesh SME vendor names, amounts, dates — include deliberately messy cases (typo'd vendor names, invoices split across 2 payments, one payment covering 3 invoices)
- Synthetic transaction feed matching the above, with injected noise
- 10-15 sample scanned invoice images (render invoice data as an image, or use a couple of genuinely scanned-looking samples) to exercise the OCR path
- A rulebook (10-15 rules) + 15-20 synthetic PO/contract texts, some compliant, some violating 1-2 rules, some ambiguous — hand-label these yourself for the precision/recall ground truth

---

## 7. Evaluation Plan

| Metric | Baseline | Advanced | How measured |
|---|---|---|---|
| Invoice match accuracy | run on full synthetic set | run on full synthetic set | % correctly matched vs. ground truth |
| False-positive match rate | | | % wrongly auto-matched |
| Partial/batch handling | N/A (baseline can't do this) | | % correctly identified as partial/batched |
| Compliance precision | | | of flagged violations, % actually violations |
| Compliance recall | | | of actual violations, % caught |

Report all five side-by-side in the README — this table *is* your "Measured Improvement" evidence.

---

## 8. Tech Stack

- **Frontend/API:** Next.js App Router
- **DB/ORM:** PostgreSQL + Prisma
- **Agent:** Claude API (tool-calling), structured trajectory logging to Postgres or JSON files
- **Queue (optional, if time allows):** BullMQ + Redis for async document processing
- **OCR:** Claude vision or Tesseract for scanned invoice extraction
- **Review UI:** simple Next.js dashboard — review queue, side-by-side document view, approve/reject buttons

---

## 9. Submission Mapping

- **README:** intended user → bottleneck → why it matters (Section 1) → setup → Improvement Changelog (log each iteration: "v1 baseline exact-match, 62% accuracy" → "v2 added fuzzy vendor matching, 78%" → "v3 added partial-payment detection, 91%"...) → main failure mode (be honest — probably OCR errors on low-quality scans) + hot take
- **Reproduction guide:** clean-env setup, seed script for synthetic data, exact run commands for baseline/advanced/eval, expected output, runtime/cost estimate
- **Video (≤5 min):** show the baseline failing on a messy case → same case handled by the agent with confidence + explanation → the metrics table → the one thing that moved the needle most → the embedding-search idea you cut and why
- **Agent trajectories:** export the structured JSON logs for 3-5 representative documents (one clean match, one partial payment, one fuzzy-name case, one compliance ambiguity routed to human review)

---

## 10. Time Budget (fill in actuals as you go)

| Phase | Est. hours |
|---|---|
| Synthetic data generation | 4-5 |
| Baseline (both matchers) | 3-4 |
| Agent loop + tools | 8-10 |
| Trajectory logging | 2 |
| Review UI | 4-5 |
| Metrics + eval scripts | 3 |
| README + reproduction guide | 3 |
| Video | 2 |
| Buffer | remainder |