import { NextResponse } from "next/server"
import { messagingApi, validateSignature, type WebhookEvent } from "@line/bot-sdk"

import { askGemini, DEFAULT_REPLY } from "@/lib/gemini"
import { buildSystemPrompt } from "@/lib/prompt"
import { getFAQText } from "@/lib/sheet"

const SHEET_ERROR_REPLY =
  "ขออภัยค่ะ ระบบข้อมูล HR กำลังมีปัญหาชั่วคราว กรุณาติดต่อฝ่าย HR โดยตรงค่ะ"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getLineClient(): messagingApi.MessagingApiClient {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured")
  }

  return new messagingApi.MessagingApiClient({
    channelAccessToken,
  })
}

async function replyText(replyToken: string, text: string): Promise<void> {
  try {
    const client = getLineClient()
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    })
  } catch (err) {
    console.error("line_reply_error", err)
  }
}

function getUserText(event: WebhookEvent): string | null {
  if (event.type !== "message") {
    return null
  }

  if (event.message.type !== "text") {
    return null
  }

  return event.message.text.trim()
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  const userMessage = getUserText(event)
  if (!userMessage || !("replyToken" in event)) {
    return
  }

  let faqText: string
  try {
    faqText = await getFAQText()
  } catch (err) {
    console.error("sheet_error", err)
    await replyText(event.replyToken, SHEET_ERROR_REPLY)
    return
  }

  try {
    const prompt = buildSystemPrompt(faqText, userMessage)
    const geminiResponse = await askGemini(prompt)
    await replyText(event.replyToken, geminiResponse.text || DEFAULT_REPLY)
  } catch (err) {
    console.error("gemini_error", err)
    await replyText(event.replyToken, DEFAULT_REPLY)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET
    if (!channelSecret) {
      throw new Error("LINE_CHANNEL_SECRET is not configured")
    }

    const signature = request.headers.get("x-line-signature") ?? ""
    const body = await request.text()

    if (!validateSignature(body, channelSecret, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(body) as { events?: WebhookEvent[] }
    const events = payload.events ?? []
    await Promise.all(events.map(handleEvent))

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error("line_webhook_error", err)
    return NextResponse.json({ ok: true }, { status: 200 })
  }
}
