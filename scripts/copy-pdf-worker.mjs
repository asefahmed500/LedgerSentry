import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import path from "node:path"

const src = path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs")
const destDir = path.join(process.cwd(), "public")
const dest = path.join(destDir, "pdf.worker.min.mjs")

if (existsSync(src)) {
  mkdirSync(destDir, { recursive: true })
  copyFileSync(src, dest)
  console.log("pdf worker copied to public/")
} else {
  console.warn("pdf.worker.min.mjs not found — run npm install first")
}
