import { useId } from 'react'
import { ChevronDown, Languages } from 'lucide-react'
import { LANGUAGES, languageInfo, t } from '@/i18n'
import { useLanguage } from '@/i18n/useLanguage'
import { cn } from '@/utils/cn'

/**
 * English or Filipino (Correction 7).
 *
 * A native select: every keyboard and screen reader already knows how to use
 * one, and the language showing is its value. The label names both languages,
 * so a person who does not read the one on screen can still find it.
 *
 * `compact` is for the desktop header, where seven links, the workspace and
 * the account already share one row: the box shows the language's short code
 * (EN, FIL) over the same select, which still reads its full name to a screen
 * reader and lists full names when opened.
 *
 * Changing it re-renders the page in place: the route, the session and
 * anything typed into a form all stay.
 */
export function LanguageSwitcher({ className, compact = false }) {
  const { language, setLanguage } = useLanguage()
  const id = useId()

  return (
    <div
      className={cn(
        'relative flex items-center rounded-control border border-border bg-panel',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand',
        className,
      )}
    >
      <label htmlFor={id} className="sr-only">
        {t('shell.language.label')}
      </label>
      <Languages size={15} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-fg-muted" />
      {compact && (
        <span aria-hidden="true" className="pointer-events-none pr-6 pl-7 text-sm font-medium text-fg">
          {languageInfo(language).short}
        </span>
      )}
      <select
        id={id}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        data-language-switcher=""
        className={cn(
          'h-9 appearance-none rounded-control bg-transparent py-1.5 pr-7 pl-8 text-sm text-fg outline-none',
          // Laid over the short code, invisible but fully operable.
          compact && 'absolute inset-0 w-full cursor-pointer opacity-0',
        )}
      >
        {LANGUAGES.map((option) => (
          // Each name in its own language, the convention for a language
          // menu: "Filipino" is what a Filipino reader looks for.
          <option key={option.code} value={option.code} lang={option.htmlLang}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2 text-fg-muted" />
    </div>
  )
}
