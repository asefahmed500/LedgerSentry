# Reliability & Failure-Mode Audit

Scope: frontend, API routes, server actions, database, auth, agents, tool calls, OCR, uploads, PDF processing. Method: code inspection + fault injection (rate-limit storms, malformed inputs, duplicate submissions, stale sessions, browser relaunches, API saturation over a 4-hour window with the free-tier model).

## Reliability scores (0-10)

| Area | Score | Notes |
|---|---:|---|
| Architecture | 8 | Simple synchronous request path, no queues to lose |
| Agent reliability | 7 | Bounded steps, forced terminal tool, submit-less runs fail loudly |
| Tool reliability | 7 | Vision→tesseract fallback with capability caching |
| Failure handling | 7 | After fixes below |
| Latency | 6 | Free-tier model dominates (30-90s/run) — bounded, surfaced in UI |
| State management | 8 | Upserts keyed by (document, engine); last-wins, no orphans in DB |
| Database consistency | 8 | Unique constraints catch races (P2002 → 409) |
| Concurrency | 7 | Double-click guarded; concurrent same-invoice runs upsert last-wins |
| Observability | 7 | AgentRun/AgentStep = full decision trace per run |
| Security | 8 | Proxy + defense-in-depth session checks + timing-safe login |
| UX failure handling | 8 | After fixes below (explicit error text, timeout guidance) |
| Recovery | 7 | Eval resumes (skips completed); failed runs visible + replayable |
| Cost control | 7 | Bounded retries, step caps, sampled eval |

## Failure decision table (actual behavior)

| Failure | Classification | Retry? | Cap | Fallback | Verify state | Human? | Final action |
|---|---|---|---|---|---|---|---|
| LLM 429 / overloaded / 5xx | Transient | Yes | 4 (eval script) / 2 (SDK) | error run recorded | run status=error | no | user re-clicks Run |
| LLM no submit tool called | Permanent | No | — | run fails, error persisted | yes | no | error trajectory shown |
| Vision model rejects images | Permanent | No | — | tesseract.js, capability cached | yes | no | OCR still works |
| OCR garbage | Degraded | No | — | ledger fields + low confidence | yes | via confidence gate | review queue |
| Agent confidence < threshold | Policy | No | — | — | — | **yes** | review queue |
| Upload duplicate invoice # | Permanent | No | 0 | — | P2002 caught | no | 409 + message |
| Upload invalid file/fields | Permanent | No | 0 | — | validated | no | 400 + message |
| Session expired / invalid | Auth | No | 0 | — | proxy JWT check | re-auth | 401 JSON / redirect |
| Permission (no session on API) | AuthZ | No | 0 | — | proxy + route check | no | 401 |
| DB unreachable | Dependency | No | 0 | — | — | operator | 500 |
| Scanned PO, no text | Permanent | No | 0 | client rasterize→OCR | flagged in UI | no | warn before upload |
| Fetch timeout in UI (180s) | Transient | user | 1 | message suggests refresh | server run may complete | no | explicit error text |

## Fixed during this audit

- **CRITICAL (silent failure):** run buttons showed spinner → nothing on API failure. Now: explicit error line with actionable text (agent-run buttons, baseline button) via a shared `fetchJson` helper.
- **CRITICAL (unbounded wait):** agent-run fetches had no timeout. Now: 180s AbortController timeout with "may still be finishing — refresh" guidance; `maxDuration = 300` on agent routes.
- **HIGH (failure visibility):** error agent runs are first-class — full trajectory with error message in the dashboard (verified live during the API-saturation window).

## Known accepted gaps

- Orphaned upload files on disk if DB insert fails after write (disk-only, no data corruption).
- Count-based auto invoice numbers can race → loser gets 409 (correct, just retry).
- No circuit breaker across server restarts; the vision-capability cache is per-process.
- Synchronous agent runs block a request for up to 5 min (documented; queue was cut per PRD scope).

## Termination guarantees

- Agent loop: `stopWhen: [stepCountIs(14|10), hasToolCall(submit_*)]` — no infinite loops; every run ends complete/error.
- Eval retries: 4 attempts × linear backoff (30/60/90s) — hard stop.
- UI fetches: 180s deadline.
