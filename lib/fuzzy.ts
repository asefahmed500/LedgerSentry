import type { FuzzyMatchResult } from "@/lib/types"

export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bm\/s\b|\bltd\.?|\blimited|\(bd\)|[.,&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0
  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1)
  const s1Matches = new Array<boolean>(len1).fill(false)
  const s2Matches = new Array<boolean>(len2).fill(false)
  let matches = 0
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0
  let transpositions = 0
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }
  transpositions /= 2
  return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3
}

export function jaroWinkler(s1: string, s2: string): number {
  const jaroScore = jaro(s1, s2)
  if (jaroScore === 0) return 0
  let prefix = 0
  const maxPrefix = 4
  while (prefix < maxPrefix && prefix < s1.length && prefix < s2.length && s1[prefix] === s2[prefix]) {
    prefix++
  }
  return jaroScore + prefix * 0.1 * (1 - jaroScore)
}

function tokenSetSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean))
  const setB = new Set(b.split(" ").filter(Boolean))
  if (setA.size === 0 || setB.size === 0) return 0
  let common = 0
  for (const t of setA) {
    if (setB.has(t)) common++
  }
  return (2 * common) / (setA.size + setB.size)
}

export function fuzzyMatchVendor(nameA: string, nameB: string): FuzzyMatchResult {
  const a = normalizeEntityName(nameA)
  const b = normalizeEntityName(nameB)
  if (a === b) return { score: 100, verdict: "exact" }
  const jw = jaroWinkler(a, b)
  const tokens = tokenSetSimilarity(a, b)
  const score = Math.round(Math.max(jw, tokens * 0.92) * 100)
  let verdict: FuzzyMatchResult["verdict"]
  if (score >= 97) verdict = "exact"
  else if (score >= 85) verdict = "strong"
  else if (score >= 70) verdict = "moderate"
  else if (score >= 55) verdict = "weak"
  else verdict = "different"
  return { score, verdict }
}

export function isFuzzyNameMatch(nameA: string, nameB: string, threshold = 70): boolean {
  const a = normalizeEntityName(nameA)
  const b = normalizeEntityName(nameB)
  if (a.includes(b) || b.includes(a)) return true
  return fuzzyMatchVendor(nameA, nameB).score >= threshold
}
