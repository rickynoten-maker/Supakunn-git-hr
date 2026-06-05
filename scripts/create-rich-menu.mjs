import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const LINE_API_BASE = "https://api.line.me/v2/bot"
const LINE_DATA_API_BASE = "https://api-data.line.me/v2/bot"
const WIDTH = 2500
const HEIGHT = 1686

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
if (!token) {
  throw new Error("LINE_CHANNEL_ACCESS_TOKEN is required")
}

const imagePath = resolve(process.env.RICH_MENU_IMAGE_PATH ?? "assets/rich-menu.jpg")

async function lineFetch(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${init.method ?? "GET"} ${url} failed: ${response.status} ${body}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

const richMenu = {
  size: {
    width: WIDTH,
    height: HEIGHT,
  },
  selected: true,
  name: "Supakunn HR Rich Menu",
  chatBarText: "เมนู HR",
  areas: [
    {
      bounds: {
        x: 0,
        y: 0,
        width: 833,
        height: HEIGHT,
      },
      action: {
        type: "message",
        label: "ติดต่อ HR",
        text: "ติดต่อ HR",
      },
    },
    {
      bounds: {
        x: 833,
        y: 0,
        width: 834,
        height: HEIGHT,
      },
      action: {
        type: "message",
        label: "แผนกทั้งหมด",
        text: "แผนกทั้งหมด",
      },
    },
    {
      bounds: {
        x: 1667,
        y: 0,
        width: 833,
        height: HEIGHT,
      },
      action: {
        type: "message",
        label: "สาขาทั้งหมด",
        text: "สาขาทั้งหมด",
      },
    },
  ],
}

console.log("creating_rich_menu")
const created = await lineFetch(`${LINE_API_BASE}/richmenu`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(richMenu),
})

const richMenuId = created.richMenuId
console.log("created_rich_menu", richMenuId)

const image = await readFile(imagePath)
console.log("uploading_rich_menu_image", imagePath)
await lineFetch(`${LINE_DATA_API_BASE}/richmenu/${richMenuId}/content`, {
  method: "POST",
  headers: {
    "Content-Type": "image/jpeg",
  },
  body: image,
})

console.log("setting_default_rich_menu", richMenuId)
await lineFetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
  method: "POST",
  headers: {},
})

console.log("done", { richMenuId })
