import { useEffect, useRef, useState } from 'react'
import { userService } from '@/services'
import { t } from '@/i18n'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * Cloudflare's "are you a person" check on the registration form.
 *
 * The widget produces a token; the token proves nothing here. It is a string
 * the browser handed us and a script can hand us one too. It only means
 * anything once the API asks Cloudflare whether that token was issued for this
 * site and has not already been spent — which `turnstile_or_fail()` does in
 * api/tokens.php. This component's entire job is to obtain the string.
 *
 * The site key comes from GET /api/config at run time, not from the build. A
 * site key is meant to be public, but baking it in would mean rebuilding the
 * image to change it, and the same image has to run with or without a
 * Turnstile site in front of it.
 *
 * When Turnstile is switched off — which is every local install — this renders
 * nothing and registration carries on. The server is the one that decides
 * whether a token is required, so an absent widget cannot skip the check.
 *
 * @param {(token: string | null) => void} props.onToken
 * @param {number} props.attempt  changing it redraws the widget, because a
 *        Turnstile token is single-use and a refused submission leaves a spent
 *        one on screen looking perfectly fine.
 */
export function Turnstile({ onToken, attempt = 0 }) {
  const [config, setConfig] = useState(null)
  const container = useRef(null)

  useEffect(() => {
    let cancelled = false

    userService
      .getPublicConfig()
      .then((result) => {
        if (!cancelled) setConfig(result)
      })
      // A config call that fails leaves the widget absent. The server still
      // refuses a registration without a token, so this fails closed.
      .catch(() => {
        if (!cancelled) setConfig({ turnstileEnabled: false })
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!config?.turnstileEnabled || !config.turnstileSiteKey || !container.current) return

    const node = container.current
    let widgetId = null

    const render = () => {
      if (!window.turnstile || !node.isConnected) return
      node.innerHTML = ''
      widgetId = window.turnstile.render(node, {
        sitekey: config.turnstileSiteKey,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }

    if (window.turnstile) {
      render()
    } else if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = render
      document.head.append(script)
    } else {
      document.querySelector(`script[src="${SCRIPT_SRC}"]`).addEventListener('load', render)
    }

    return () => {
      if (widgetId !== null && window.turnstile) {
        window.turnstile.remove(widgetId)
      }
    }
  }, [config, attempt, onToken])

  if (!config?.turnstileEnabled) return null

  return (
    <div className="flex flex-col gap-2">
      <div ref={container} />
      <p className="text-sm text-fg-muted">
        {t('ui.turnstile')}
      </p>
    </div>
  )
}
