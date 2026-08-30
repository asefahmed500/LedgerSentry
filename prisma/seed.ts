import "dotenv/config"

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/client"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import sharp from "sharp"

import {
  AMBIGUOUS_CLAUSES,
  COMPLIANT_CLAUSES,
  PO_CLOSING,
  PO_PREAMBLE,
  PO_SECTION_ORDER,
  RULEBOOK,
  VIOLATION_CLAUSES,
  VENDORS,
  VENDOR_TYPOS,
  PAYER_PREFIXES,
  PAYER_SUFFIXES,
} from "./seed-data"

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260829)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const bdt = (n: number) => Math.round(n * 100) / 100

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const PUBLIC_DIR = path.join(process.cwd(), "public")
const SCANS_DIR = path.join(PUBLIC_DIR, "scans")
const POLICY_DIR = path.join(PUBLIC_DIR, "policy")

interface InvoiceDraft {
  number: string
  vendor: string
  vendorClean: string
  amount: number
  issueDate: Date
  dueDate: Date
  isScanned: boolean
  imagePath: string | null
  expectedMatch: "matched" | "partial" | "unmatched"
  batchKey: string | null
}

interface TransactionDraft {
  reference: string
  payer: string
  amount: number
  date: Date
  channel: string
  coversKey: string | null
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/m\/s|ltd\.?|limited|\(bd\)|[.&]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function invoiceSvg(inv: {
  number: string
  vendor: string
  amount: number
  issueDate: Date
  dueDate: Date
  rotate: number
  speckleSeed: number
}) {
  const speckles: string[] = []
  let s = inv.speckleSeed
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  for (let i = 0; i < 160; i++) {
    const x = rnd() * 900
    const y = rnd() * 1200
    const r = 0.5 + rnd() * 1.4
    const o = 0.04 + rnd() * 0.1
    speckles.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#333" opacity="${o.toFixed(2)}"/>`)
  }
  const line = (x: number, y: number, w: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="1.6" fill="#d8d8d4"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <rect width="900" height="1200" fill="#f7f6f2"/>
  <g transform="rotate(${inv.rotate} 450 600)">
    <rect x="70" y="60" width="760" height="1080" fill="#ffffff" stroke="#c9c9c4" stroke-width="2"/>
    <text x="110" y="150" font-family="Georgia, serif" font-size="40" font-weight="bold" fill="#1a1a1a">INVOICE</text>
    <text x="110" y="195" font-family="Georgia, serif" font-size="22" fill="#333333">Invoice No: ${xmlEscape(inv.number)}</text>
    <text x="110" y="230" font-family="Georgia, serif" font-size="22" fill="#333333">Date: ${inv.issueDate.toISOString().slice(0, 10)}</text>
    <text x="110" y="265" font-family="Georgia, serif" font-size="22" fill="#333333">Due Date: ${inv.dueDate.toISOString().slice(0, 10)}</text>
    ${line(110, 300, 680)}
    <text x="110" y="345" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#1a1a1a">Billed by: ${xmlEscape(inv.vendor)}</text>
    <text x="110" y="385" font-family="Georgia, serif" font-size="20" fill="#444444">Bill to: Dhaka Procurement Office</text>
    ${line(110, 420, 680)}
    <text x="110" y="465" font-family="Georgia, serif" font-size="20" fill="#333333">Description</text>
    <text x="640" y="465" font-family="Georgia, serif" font-size="20" fill="#333333">Amount (BDT)</text>
    ${line(110, 485, 680)}
    <text x="110" y="530" font-family="Georgia, serif" font-size="20" fill="#333333">Supply of goods per schedule A</text>
    <text x="640" y="530" font-family="Georgia, serif" font-size="20" fill="#333333">${inv.amount.toFixed(2)}</text>
    <text x="110" y="575" font-family="Georgia, serif" font-size="20" fill="#333333">Delivery and handling</text>
    <text x="640" y="575" font-family="Georgia, serif" font-size="20" fill="#333333">0.00</text>
    ${line(110, 610, 680)}
    <text x="110" y="665" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#1a1a1a">Total Due: BDT ${inv.amount.toFixed(2)}</text>
    ${line(110, 700, 680)}
    <text x="110" y="745" font-family="Georgia, serif" font-size="18" fill="#555555">Payment via bank transfer. Please quote invoice number.</text>
    <text x="110" y="775" font-family="Georgia, serif" font-size="18" fill="#555555">Thank you for your business.</text>
  </g>
  ${speckles.join("")}
</svg>`
}

async function renderInvoiceImage(inv: InvoiceDraft, idx: number) {
  const svg = invoiceSvg({
    number: inv.number,
    vendor: inv.vendor,
    amount: inv.amount,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    rotate: (rand() - 0.5) * 1.4,
    speckleSeed: 1000 + idx * 37,
  })
  const file = path.join(SCANS_DIR, `${inv.number.toLowerCase()}.png`)
  await sharp(Buffer.from(svg)).png().toFile(file)
  return `/scans/${inv.number.toLowerCase()}.png`
}

async function renderPolicyPdf(title: string, paragraphs: string[]) {
  const pdf = await PDFDocument.create()
  const font = await pdfDoc_font(pdf)
  let page = pdf.addPage([595, 842])
  const { height } = page.getSize()
  let y = height - 70

  const wrap = (text: string, size: number, maxWidth: number) => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let cur = ""
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w
      if (font.regular.widthOfTextAtSize(candidate, size) > maxWidth) {
        if (cur) lines.push(cur)
        cur = w
      } else {
        cur = candidate
      }
    }
    if (cur) lines.push(cur)
    return lines
  }

  const write = (text: string, size: number, dy: number, bold = false) => {
    if (y < 70) {
      page = pdf.addPage([595, 842])
      y = height - 70
    }
    page.drawText(text, { x: 60, y, size, font: bold ? font.bold : font.regular, color: rgb(0.1, 0.1, 0.1) })
    y -= dy
  }

  write(title, 16, 30, true)
  for (const p of paragraphs) {
    const isHeading = p.endsWith(":") && p.length < 40
    for (const l of wrap(p, isHeading ? 12 : 10.5, 475)) {
      write(l, isHeading ? 12 : 10.5, isHeading ? 20 : 16, isHeading)
    }
    y -= 4
  }
  const bytes = await pdf.save()
  return bytes
}

async function pdfDoc_font(pdf: PDFDocument) {
  return {
    regular: await pdf.embedFont(StandardFonts.TimesRoman),
    bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
  }
}

async function main() {
  await mkdir(SCANS_DIR, { recursive: true })
  await mkdir(POLICY_DIR, { recursive: true })

  console.log("Clearing existing data...")
  await prisma.evalResult.deleteMany()
  await prisma.agentStep.deleteMany()
  await prisma.agentRun.deleteMany()
  await prisma.reviewItem.deleteMany()
  await prisma.complianceResult.deleteMany()
  await prisma.matchResult.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.policyDocument.deleteMany()
  await prisma.rule.deleteMany()

  console.log("Seeding rulebook...")
  await prisma.rule.createMany({
    data: RULEBOOK.map((r) => ({ ...r })),
  })

  // ---- Invoices + transactions ----
  const invoices: InvoiceDraft[] = []
  const transactions: TransactionDraft[] = []
  let invCounter = 1
  let txnCounter = 1
  const baseDate = new Date("2026-05-15T00:00:00Z")

  const nextDates = () => {
    const issue = new Date(baseDate.getTime() + randInt(0, 70) * 86400000)
    const due = new Date(issue.getTime() + randInt(15, 30) * 86400000)
    return { issue, due }
  }
  const payDate = (due: Date) => new Date(due.getTime() + randInt(-3, 3) * 86400000)
  const newNumber = () => `INV-2026-${String(invCounter++).padStart(4, "0")}`
  const newRef = () => `TXN#${String(txnCounter++).padStart(4, "0")}`

  const pushClean = (count: number, scannedRate = 0.15) => {
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS)
      const { issue, due } = nextDates()
      const amount = bdt(randInt(50, 2500) * 1000 + rand() * 900)
      const isScanned = rand() < scannedRate
      invoices.push({
        number: newNumber(),
        vendor,
        vendorClean: normalizeName(vendor),
        amount,
        issueDate: issue,
        dueDate: due,
        isScanned,
        imagePath: null,
        expectedMatch: "matched",
        batchKey: null,
      })
      const payer =
        pick(PAYER_PREFIXES) + vendor + pick(PAYER_SUFFIXES)
      transactions.push({
        reference: newRef(),
        payer,
        amount,
        date: payDate(due),
        channel: rand() < 0.7 ? "bank" : "bkash",
        coversKey: null,
      })
    }
  }

  const pushFuzzy = (count: number) => {
    const vendors = Object.keys(VENDOR_TYPOS)
    for (let i = 0; i < count; i++) {
      const vendor = vendors[i % vendors.length]
      const { issue, due } = nextDates()
      const amount = bdt(randInt(80, 2200) * 1000 + rand() * 900)
      invoices.push({
        number: newNumber(),
        vendor,
        vendorClean: normalizeName(vendor),
        amount,
        issueDate: issue,
        dueDate: due,
        isScanned: i < 4,
        imagePath: null,
        expectedMatch: "matched",
        batchKey: null,
      })
      transactions.push({
        reference: newRef(),
        payer: VENDOR_TYPOS[vendor],
        amount,
        date: payDate(due),
        channel: "bank",
        coversKey: null,
      })
    }
  }

  const pushPartial = (count: number) => {
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS)
      const { issue, due } = nextDates()
      const amount = bdt(randInt(100, 2000) * 1000 + rand() * 900)
      const pct = 0.35 + rand() * 0.35
      invoices.push({
        number: newNumber(),
        vendor,
        vendorClean: normalizeName(vendor),
        amount,
        issueDate: issue,
        dueDate: due,
        isScanned: i < 2,
        imagePath: null,
        expectedMatch: "partial",
        batchKey: null,
      })
      transactions.push({
        reference: newRef(),
        payer: pick(PAYER_PREFIXES) + vendor,
        amount: bdt(amount * pct),
        date: payDate(due),
        channel: "bank",
        coversKey: null,
      })
    }
  }

  const pushBatches = () => {
    const groups: number[][] = [
      [randInt(60, 180), randInt(60, 180)],
      [randInt(50, 150), randInt(50, 150), randInt(50, 150)],
      [randInt(80, 200), randInt(80, 200)],
    ]
    groups.forEach((amounts, g) => {
      const key = `BATCH-2026-${g + 1}`
      const vendor = pick(VENDORS)
      const { issue, due } = nextDates()
      const batchInvoices: InvoiceDraft[] = []
      for (const amt of amounts) {
        batchInvoices.push({
          number: newNumber(),
          vendor,
          vendorClean: normalizeName(vendor),
          amount: bdt(amt * 1000 + rand() * 900),
          issueDate: issue,
          dueDate: due,
          isScanned: false,
          imagePath: null,
          expectedMatch: "matched",
          batchKey: key,
        })
      }
      invoices.push(...batchInvoices)
      transactions.push({
        reference: newRef(),
        payer: pick(PAYER_PREFIXES) + vendor,
        amount: bdt(batchInvoices.reduce((s, i) => s + i.amount, 0)),
        date: payDate(due),
        channel: "bank",
        coversKey: key,
      })
    })
  }

  const pushUnmatched = (count: number) => {
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS)
      const { issue, due } = nextDates()
      invoices.push({
        number: newNumber(),
        vendor,
        vendorClean: normalizeName(vendor),
        amount: bdt(randInt(50, 2400) * 1000 + rand() * 900),
        issueDate: issue,
        dueDate: due,
        isScanned: false,
        imagePath: null,
        expectedMatch: "unmatched",
        batchKey: null,
      })
    }
  }

  const pushMismatched = (count: number) => {
    for (let i = 0; i < count; i++) {
      const vendor = pick(VENDORS)
      const { issue, due } = nextDates()
      const amount = bdt(randInt(60, 1800) * 1000 + rand() * 900)
      const off = amount * (0.02 + rand() * 0.13) * (rand() < 0.5 ? -1 : 1)
      invoices.push({
        number: newNumber(),
        vendor,
        vendorClean: normalizeName(vendor),
        amount,
        issueDate: issue,
        dueDate: due,
        isScanned: false,
        imagePath: null,
        expectedMatch: "unmatched",
        batchKey: null,
      })
      transactions.push({
        reference: newRef(),
        payer: vendor,
        amount: bdt(amount + off),
        date: payDate(due),
        channel: "bank",
        coversKey: null,
      })
    }
  }

  pushClean(42)
  pushFuzzy(10)
  pushPartial(8)
  pushBatches()
  pushUnmatched(9)
  pushMismatched(4)

  // distractor noise
  for (let i = 0; i < 8; i++) {
    const vendor = pick(VENDORS)
    transactions.push({
      reference: newRef(),
      payer: `${pick(PAYER_PREFIXES)}${vendor}${pick(PAYER_SUFFIXES)}`,
      amount: bdt(randInt(10, 3000) * 1000 + rand() * 900),
      date: new Date(baseDate.getTime() + randInt(0, 110) * 86400000),
      channel: "bank",
      coversKey: null,
    })
  }
  const nonVendorPayers = ["SALARY DISBURSEMENT", "OFFICE RENT DHAKA", "UTILITY BILL PAY", "FUEL REIMBURSEMENT", "TAX PAYMENT NBR"]
  for (const payer of nonVendorPayers) {
    transactions.push({
      reference: newRef(),
      payer,
      amount: bdt(randInt(10, 900) * 1000 + rand() * 900),
      date: new Date(baseDate.getTime() + randInt(0, 110) * 86400000),
      channel: "bank",
      coversKey: null,
    })
  }

  console.log(`Rendering ${invoices.filter((i) => i.isScanned).length} scanned invoice images...`)
  let scanIdx = 0
  for (const inv of invoices) {
    if (inv.isScanned) {
      inv.imagePath = await renderInvoiceImage(inv, scanIdx++)
    }
  }

  console.log(`Inserting ${invoices.length} invoices and ${transactions.length} transactions...`)
  await prisma.invoice.createMany({
    data: invoices.map((i) => ({ ...i })),
  })
  await prisma.transaction.createMany({
    data: transactions.map((t) => ({ ...t })),
  })

  // ---- Policy documents ----
  console.log("Generating policy documents...")
  type DocPlan = {
    vendor: string
    violations: string[]
    ambiguous: string[]
  }
  const plans: DocPlan[] = [
    { vendor: "ABC Traders Ltd", violations: [], ambiguous: [] },
    { vendor: "Rahman & Sons", violations: ["R-01"], ambiguous: [] },
    { vendor: "Dhaka Textiles Mills", violations: ["R-03"], ambiguous: [] },
    { vendor: "Bengal Plastic Works", violations: ["R-07"], ambiguous: [] },
    { vendor: "Meghna Food Products", violations: ["R-11"], ambiguous: [] },
    { vendor: "Padma Printing Press", violations: ["R-01", "R-03"], ambiguous: [] },
    { vendor: "Chittagong Steel House", violations: ["R-05"], ambiguous: [] },
    { vendor: "Sylhet Tea Estates", violations: ["R-02"], ambiguous: [] },
    { vendor: "Jamuna Hardware", violations: [], ambiguous: ["R-01"] },
    { vendor: "Karnaphuli Paper Mills", violations: [], ambiguous: ["R-03", "R-07"] },
    { vendor: "Borak Electric Supply", violations: [], ambiguous: ["R-04", "R-11"] },
    { vendor: "Surma Chemicals", violations: ["R-08"], ambiguous: [] },
    { vendor: "Modhumoti Agro Ltd", violations: ["R-09"], ambiguous: [] },
    { vendor: "Shitalakshya Knitwear", violations: ["R-12"], ambiguous: [] },
    { vendor: "Ahsania Handicrafts", violations: [], ambiguous: ["R-05", "R-06"] },
    { vendor: "Bay Steels Ltd", violations: ["R-04", "R-10"], ambiguous: [] },
    { vendor: "Nabila Cosmetics", violations: [], ambiguous: ["R-02", "R-09", "R-12"] },
    { vendor: "Rupayan Furniture", violations: ["R-06"], ambiguous: [] },
  ]

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]
    const po = `PO-2026-${String(i + 1).padStart(3, "0")}`
    const paragraphs: string[] = [PO_PREAMBLE(plan.vendor, po)]
    for (const { code, heading } of PO_SECTION_ORDER) {
      if (plan.violations.includes(code) && VIOLATION_CLAUSES[code] === "") continue
      paragraphs.push(`${heading}`)
      if (plan.violations.includes(code)) paragraphs.push(VIOLATION_CLAUSES[code])
      else if (plan.ambiguous.includes(code)) paragraphs.push(AMBIGUOUS_CLAUSES[code])
      else paragraphs.push(COMPLIANT_CLAUSES[code])
    }
    paragraphs.push(PO_CLOSING)

    const pdfBytes = await renderPolicyPdf(po, paragraphs)
    const relPath = `/policy/${po.toLowerCase()}.pdf`
    await writeFile(path.join(POLICY_DIR, `${po.toLowerCase()}.pdf`), pdfBytes)

    await prisma.policyDocument.create({
      data: {
        title: po,
        vendor: plan.vendor,
        text: paragraphs.join("\n\n"),
        pdfPath: relPath,
        expectedViolations: plan.violations,
      },
    })
  }

  const counts = {
    invoices: invoices.length,
    matched: invoices.filter((i) => i.expectedMatch === "matched").length,
    partial: invoices.filter((i) => i.expectedMatch === "partial").length,
    unmatched: invoices.filter((i) => i.expectedMatch === "unmatched").length,
    scanned: invoices.filter((i) => i.isScanned).length,
    transactions: transactions.length,
    policies: plans.length,
  }
  console.log("Seed complete:", counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
