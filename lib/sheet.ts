import type { FAQItem } from "@/types/faq"

const CACHE_TTL_MS = 60_000

let cachedAt = 0
let cachedFAQText = ""

function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

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
      cells.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseCSV(csv: string): FAQItem[] {
  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const rows = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCSVLine)

  const [header, ...dataRows] = rows
  if (!header) {
    return []
  }

  const questionIndex = header.findIndex((cell) => cell.toLowerCase() === "question")
  const answerIndex = header.findIndex((cell) => cell.toLowerCase() === "answer")

  if (questionIndex === -1 || answerIndex === -1) {
    throw new Error("FAQ CSV must include question and answer headers")
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

  const response = await fetch(sheetUrl, {
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch FAQ sheet: ${response.status}`)
  }

  const csv = await response.text()
  const faqItems = parseCSV(csv)
  cachedFAQText = formatFAQ(faqItems)
  cachedAt = now

  return cachedFAQText
}
