# Supakunn-git-hr

LINE HR FAQ bot for Supakunn Clinic. The webhook receives LINE text messages,
loads FAQ data from a public Google Sheet CSV, asks Gemini with a single
guardrailed Thai HR prompt, and replies through LINE Messaging API.

## Environment

Create `.env.local` for local development or set these values in Vercel:

```env
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

GEMINI_API_KEY=

SHEET_CSV_URL=
```

`SHEET_CSV_URL` must be a public CSV URL with the first row headers:

```csv
question,answer
เวลาทำงาน,ฝ่าย HR เปิดทำการ...
ลางานยังไง,พนักงานสามารถ...
```

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
```

Webhook URL:

```txt
https://YOUR_DOMAIN/api/line-webhook
```
