/**
 * Renders the ERD SVG to an A3 landscape PDF and a 300 DPI PNG, with the same
 * Chrome the UI checks use. Called by scripts/erd.py.
 *
 *   node scripts/erd-render.mjs docs/diagrams/erd-a3.svg
 */
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const svgPath = process.argv[2]
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const svg = readFileSync(svgPath, 'utf8')

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
// 420 x 297 mm at 96 CSS pixels per inch; 3.125 of those per device pixel is 300 DPI.
await page.setViewport({ width: 1587, height: 1123, deviceScaleFactor: 3.125 })
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: 420mm 297mm; margin: 0 }
  html, body { margin: 0; background: #fff }
  svg { display: block; width: 420mm; height: 297mm }
</style></head><body>${svg}</body></html>`)

await page.pdf({ path: svgPath.replace(/\.svg$/, '.pdf'), width: '420mm', height: '297mm', printBackground: true, pageRanges: '1' })
await page.screenshot({ path: svgPath.replace(/\.svg$/, '.png'), clip: { x: 0, y: 0, width: 1587, height: 1123 } })
await browser.close()
