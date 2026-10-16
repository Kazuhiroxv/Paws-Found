// Launch Chrome for a browser suite as a visitor who has already agreed to the
// current Privacy Notice.
//
// Since 2026-10-16 every visitor must agree to the notice in a dialog before
// the site can be used. A suite testing something else would otherwise meet
// that dialog on its first page. So every page this browser opens starts with
// the browser's own note of the agreement already set (the same note the
// dialog writes when a guest presses "I agree"). Signed-in seeded accounts are
// already agreed in the seed.
//
// The suites that test the dialog itself open a page with `?privacy-ask` in
// its address, and the note is not set for that page.
// The callback given to evaluateOnNewDocument runs inside the page.
/* global window */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
export const PRIVACY_NOTICE_VERSION = fs.readFileSync(path.join(ROOT, 'api', 'config.php'), 'utf8')
  .split("define('PRIVACY_NOTICE_VERSION', '")[1].split("'")[0]
export const PRIVACY_NOTE_KEY = 'paws:privacy-notice'

/** Set the note on every page `owner` (a browser or a browser context) opens. */
function agreeOnEveryPage(owner) {
  const newPage = owner.newPage.bind(owner)
  owner.newPage = async (...args) => {
    const page = await newPage(...args)
    await page.evaluateOnNewDocument((key, version) => {
      if (new URLSearchParams(window.location.search).has('privacy-ask')) return
      try {
        if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, version)
      } catch {
        // No storage on this page (about:blank): nothing to set.
      }
    }, PRIVACY_NOTE_KEY, PRIVACY_NOTICE_VERSION)
    return page
  }
}

export async function launchAgreed(puppeteer, options) {
  const browser = await puppeteer.launch(options)
  agreeOnEveryPage(browser)
  const createBrowserContext = browser.createBrowserContext.bind(browser)
  browser.createBrowserContext = async (...args) => {
    const context = await createBrowserContext(...args)
    agreeOnEveryPage(context)
    return context
  }
  return browser
}
