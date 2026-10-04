import { Clock, Lock, TriangleAlert } from 'lucide-react'
import { Container } from '@/components/ui'
import { RouteOrnament } from '@/components/Ornament'
import { NewReportForm } from '@/components/report-form/ReportForm'
import { ReportGuidance } from '@/components/report-form/ReportGuidance'
import { REPORT_TYPES } from '@/constants'
import landscapeStrip from '@/assets/img-021-landscape-strip.webp'
import { t } from '@/i18n'

export function ReportLostPage() {
  return (
    <div className="lost-ground relative isolate -my-8 overflow-hidden py-8">
      {/* IMG-021 behind the page introduction, fading out before the
          form begins. The wizard is a long task and the reference gives
          it a place to start rather than a bare heading; below the fade
          the fields sit on plain canvas, where they belong. Hidden below
          `sm` — the header stacks there and the artwork would push the
          first field off a phone screen.

          Warmed with amber across the whole strip, so the two report pages are told
          apart before a word is read: lost is the urgent, searching one. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-72 overflow-hidden sm:block"
      >
        <img src={landscapeStrip} alt="" className="size-full object-cover object-[70%_60%] opacity-55" />
        <span className="absolute inset-0 bg-accent/20 mix-blend-multiply" />
        <span className="absolute inset-0 bg-gradient-to-r from-lost-soft/80 via-lost-soft/30 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface" />
      </div>
      {/* Search routes, for the report that starts a search. */}
      <RouteOrnament tone="amber" size={460} strength={2} className="-top-16 -right-20" />

      {/* The wizard owns its own two-column layout, so the step indicator can
          run the full width above the fields and the guidance. */}
      <Container width="page" className="flex flex-col gap-8">
        <title>{`${t('nav.reportLost')} · Paws&Found`}</title>

        {/* On its own surface rather than straight on the artwork. The text
            used to sit on IMG-021 in muted ink, and what was behind any one
            word depended on the crop — a signpost, a mountain, open sky. A
            panel makes its contrast its own. */}
        <div className="flex max-w-3xl flex-col gap-3 rounded-card border border-border border-l-4 border-l-accent bg-panel/95 p-5 shadow-raised backdrop-blur-sm sm:p-7">
          <p className="inline-flex w-fit items-center gap-2 rounded-pill bg-lost-soft px-3 py-1 text-sm font-semibold text-lost">
            <TriangleAlert size={15} aria-hidden="true" />
            {t('reportPage.lostBadge')}
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-balance text-fg sm:text-4xl">
            {t('reportPage.lostTitleBefore')} <span className="text-lost">{t('reportPage.lostWord')}</span>{' '}
            {t('reportPage.titleAfter')}
          </h1>
          <p className="text-lg text-fg">{t('reportPage.lostLead')}</p>
          <p className="max-w-prose text-fg">
            {t('reportPage.lostBody')}
          </p>

          <ul className="mt-1 flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-2 font-medium text-lost">
              <Clock size={15} className="shrink-0" aria-hidden="true" />
              {t('reportPage.lostUrgent')}
            </li>
            <li className="flex items-center gap-2 text-fg-muted">
              <Lock size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
              {t('reportPage.noAddress')}
            </li>
          </ul>
        </div>

        {/* The guidance is passed in, and the wizard renders it second in the
            DOM as well as on screen — Tab reaches the fields first. Nobody
            arrives here wanting to read the advice before filling anything in. */}
        <NewReportForm
          reportType={REPORT_TYPES.LOST}
          guidance={<ReportGuidance reportType={REPORT_TYPES.LOST} />}
        />
      </Container>
    </div>
  )
}
