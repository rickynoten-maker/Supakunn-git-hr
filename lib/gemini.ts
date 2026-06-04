import { GoogleGenAI } from "@google/genai"

export const DEFAULT_REPLY =
  "ขออภัยค่ะ ข้อมูลนี้ยังไม่มีในระบบ กรุณาติดต่อฝ่าย HR โดยตรงเพื่อตรวจสอบข้อมูลที่ถูกต้องค่ะ"

const GEMINI_TIMEOUT_MS = 7_500

interface GeminiResponse {
  text: string
  finishReason?: string
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured")
  }

  return new GoogleGenAI({ apiKey })
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("gemini_timeout")), timeoutMs)
    }),
  ])
}

export async function askGemini(prompt: string): Promise<GeminiResponse> {
  try {
    const ai = getClient()
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 1.0,
          maxOutputTokens: 1024,
        },
      }),
      GEMINI_TIMEOUT_MS,
    )

    const finishReason = response.candidates?.[0]?.finishReason
    const thoughtsTokenCount = response.usageMetadata?.thoughtsTokenCount
    const candidatesTokenCount = response.usageMetadata?.candidatesTokenCount

    console.log({
      finishReason,
      thoughtsTokenCount,
      candidatesTokenCount,
    })

    if (finishReason === "MAX_TOKENS") {
      return {
        text: DEFAULT_REPLY,
        finishReason,
      }
    }

    const text = response.text?.trim() || DEFAULT_REPLY
    return {
      text,
      finishReason,
    }
  } catch (err) {
    if (err instanceof Error && err.message === "gemini_timeout") {
      return {
        text: DEFAULT_REPLY,
        finishReason: "TIMEOUT",
      }
    }

    throw err
  }
}
