import { CircleCheck, Lightbulb, Lock } from 'lucide-react'
import { REPORT_TYPES } from '@/constants'
import { t, tList } from '@/i18n'

/**
 * What makes a report worth filing, beside the form that files it.
 *
 * The wizard validates; this teaches. They are different jobs, and the form
 * was doing only the first — somebody could fill every required field
 * correctly and still write "brown dog, lost yesterday", which passes
 * validation and helps nobody.
 *
 * Every tip here is about information the system genuinely uses: the matching
 * algorithm compares species, breed, colour, size, location and date, and
 * weights distinctive features. Nothing on this panel describes a capability
 * the system does not have.
 *
 * @param {Object} props
 * @param {'lost'|'found'} props.reportType
 */
export function ReportGuidance({ reportType }) {
  const isFound = reportType === REPORT_TYPES.FOUND
  const tips = tList(isFound ? 'reportForm.guidance.foundTips' : 'reportForm.guidance.lostTips')

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
      <section className="flex flex-col gap-3 rounded-card border border-accent/25 bg-warm-band p-5">
        <h2 className="flex items-center gap-2 font-semibold text-fg">
          <Lightbulb size={18} className="shrink-0 text-accent-hover" aria-hidden="true" />
          {t('reportForm.guidance.title')}
        </h2>

        <ul className="flex flex-col gap-2.5 text-sm text-fg-muted">
          {tips.map((tip) => (
            <li key={tip} className="flex gap-2.5">
              <CircleCheck
                size={16}
                className="mt-0.5 shrink-0 text-accent-hover"
                aria-hidden="true"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Two descriptions of the same animal. Telling somebody to "be
          specific" is advice; showing them the difference is a worked example,
          and it costs four lines. */}
      <section className="flex flex-col gap-3 rounded-card border border-border bg-panel p-5">
        <h2 className="font-semibold text-fg">{t('reportForm.guidance.difference')}</h2>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-fg-muted">{t('reportForm.guidance.hard')}</p>
          <blockquote className="rounded-control border border-border bg-sunken px-3 py-2 text-sm text-fg-muted italic">
            {isFound ? t('reportForm.guidance.hardFound') : t('reportForm.guidance.hardLost')}
          </blockquote>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-fg">{t('reportForm.guidance.easy')}</p>
          <blockquote className="rounded-control border border-brand/25 bg-brand-soft px-3 py-2 text-sm text-fg">
            {isFound ? t('reportForm.guidance.easyFound') : t('reportForm.guidance.easyLost')}
          </blockquote>
        </div>

        <p className="text-sm text-fg-muted">
          {t('reportForm.guidance.why')}
        </p>
      </section>

      <p className="flex items-start gap-2.5 px-1 text-sm text-fg-muted">
        <Lock size={16} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden="true" />
        <span>
          {t('reportForm.guidance.privacy')}
        </span>
      </p>
    </aside>
  )
}
