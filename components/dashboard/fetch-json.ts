export const FETCH_TIMEOUT_MS = 180_000

export async function fetchJson(
  input: string,
  init?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    const body = (await res.json().catch(() => ({
      ok: false,
      error: `Unexpected response (${res.status})`,
    }))) as { ok: boolean; error?: string } & Record<string, unknown>
    if (!res.ok && body.error === undefined) {
      body.ok = false
      body.error = `Request failed (${res.status})`
    }
    return body
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        error: `Timed out after ${Math.round(timeoutMs / 1000)}s — the agent may still be finishing. Refresh to see results.`,
      }
    }
    return { ok: false, error: "Network error — is the server running?" }
  } finally {
    clearTimeout(timer)
  }
}
