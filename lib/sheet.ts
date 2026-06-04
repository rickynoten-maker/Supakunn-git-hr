import type { FAQItem } from "@/types/faq"

const CACHE_TTL_MS = 60_000

let cachedAt = 0
let cachedFAQText = ""

function normalizeSheetURL(sheetUrl: string): string {
  const trimmedUrl = sheetUrl.trim()
  const url = new URL(trimmedUrl)

  if (url.hostname !== "docs.google.com") {
    return trimmedUrl
  }

  const sheetId = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1]
  if (!sheetId) {
    return trimmedUrl
  }

  if (url.pathname.includes("/export") || url.searchParams.get("output") === "csv") {
    return trimmedUrl
  }

  const gid = url.searchParams.get("gid") ?? "0"
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

function parseCSV(csv: string): FAQItem[] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ""
  let inQuotes = false
  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]
    const next = normalized[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim())
      current = ""
      continue
    }

    if (char === "\n" && !inQuotes) {
      row.push(current.trim())
      if (row.some(Boolean)) {
        rows.push(row)
      }
      row = []
      current = ""
      continue
    }

    current += char
  }

  row.push(current.trim())
  if (row.some(Boolean)) {
    rows.push(row)
  }

  const [rawHeader, ...dataRows] = rows
  const header = rawHeader?.map((cell) => cell.trim().toLowerCase())
  if (!header) {
    return []
  }

  const questionIndex = header.findIndex((cell) => cell === "question")
  const answerIndex = header.findIndex((cell) => cell === "answer")

  if (questionIndex === -1 || answerIndex === -1) {
    throw new Error(`FAQ CSV must include question and answer headers. Found: ${header.join(", ")}`)
  }

  return dataRows
    .map((row) => ({
      question: row[questionIndex] ?? "",
      answer: row[answerIndex] ?? "",
    }))
    .filter((item) => item.question && item.answer)
}

function formatFAQ(items: FAQItem[]): string {
  if (items.length === 0) {
    return "ไม่มีข้อมูล FAQ ในระบบ"
  }

  return items.map((item) => `คำถาม: ${item.question}\nคำตอบ: ${item.answer}`).join("\n\n")
}

export async function getFAQText(): Promise<string> {
  const now = Date.now()
  if (cachedFAQText && now - cachedAt < CACHE_TTL_MS) {
    return cachedFAQText
  }

  const sheetUrl = process.env.SHEET_CSV_URL
  if (!sheetUrl) {
    throw new Error("SHEET_CSV_URL is not configured")
  }

  const normalizedSheetUrl = normalizeSheetURL(sheetUrl)

  const response = await fetch(normalizedSheetUrl, {
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch FAQ sheet: ${response.status} ${response.statusText}`)
  }

  const csv = await response.text()
  if (/^\s*</.test(csv)) {
    throw new Error("SHEET_CSV_URL returned HTML, not CSV. Check that the sheet is public or use a CSV export URL.")
  }

  const faqItems = parseCSV(csv)
  cachedFAQText = formatFAQ(faqItems)
  cachedAt = now

  return cachedFAQText
}
