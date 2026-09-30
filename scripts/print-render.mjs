/**
 * Renders a print page (an SVG or a whole HTML page) to a PDF and a 300 DPI
 * PNG beside it, with the same Chrome the UI checks use. Called by
 * scripts/erd.py and scripts/print_sheets.py.
 *
 *   node scripts/print-render.mjs <file.svg|file.html> <width mm> <height mm>
 */
/* global document -- read inside page.evaluate(), which runs in the browser */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const [file, widthMm, heightMm] = process.argv.slice(2)
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const px = (mm) => Math.round((Number(mm) / 25.4) * 96)
const width = px(widthMm)
const height = px(heightMm)

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
// 96 CSS pixels per inch; 3.125 device pixels to each of those is 300 DPI.
await page.setViewport({ width, height, deviceScaleFactor: 3.125 })

if (file.endsWith('.svg')) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0 }
    html, body { margin: 0; background: #fff }
    svg { display: block; width: ${widthMm}mm; height: ${heightMm}mm }
  </style></head><body>${readFileSync(file, 'utf8')}</body></html>`)
} else {
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' })
}

const base = file.replace(/\.(svg|html)$/, '')
await page.pdf({ path: `${base}.pdf`, width: `${widthMm}mm`, height: `${heightMm}mm`, printBackground: true, pageRanges: '1' })
await page.screenshot({ path: `${base}.png`, clip: { x: 0, y: 0, width, height } })

// Anything past the page edge would be cut off in print, silently.
const overflow = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  height: document.documentElement.scrollHeight,
}))
if (overflow.width > width + 1 || overflow.height > height + 1) {
  console.error(`${file}: content is ${overflow.width}x${overflow.height}, page is ${width}x${height}`)
  process.exitCode = 1
}
await browser.close()
