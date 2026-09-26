import { TriangleAlert, Lock } from 'lucide-react'
import { Container } from '@/components/ui'
import { ReportForm } from '@/components/report-form/ReportForm'
import { ReportGuidance } from '@/components/report-form/ReportGuidance'
import { REPORT_TYPES } from '@/constants'
import landscapeStrip from '@/assets/img-021-landscape-strip.webp'

export function ReportLostPage() {
  return (
    <div className="lost-ground relative isolate -my-8 overflow-hidden py-8">
      {/* IMG-021 behind the page introduction, fading out before the
          form begins. The wizard is a long task and the reference gives
          it a place to start rather than a bare heading; below the fade
          the fields sit on plain canvas, where they belong. Hidden below
          `sm` — the header stacks there and the artwork would push the
          first field off a phone screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-72 overflow-hidden sm:block"
      >
        <img src={landscapeStrip} alt="" className="size-full object-cover object-[70%_60%] opacity-55" />
        <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface" />
      </div>

      {/* The wizard owns its own two-column layout, so the step indicator can
          run the full width above the fields and the guidance. */}
      <Container width="page" className="flex flex-col gap-8">
        <title>Report a lost pet · Paws&Found</title>

        <div className="flex max-w-3xl flex-col gap-3 border-b border-border pb-6">
            <p className="inline-flex w-fit items-center gap-2 rounded-pill bg-lost-soft px-3 py-1 text-sm font-semibold text-lost">
              <TriangleAlert size={15} aria-hidden="true" />
              Report lost
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-balance text-fg sm:text-4xl">
              Report a lost pet
            </h1>
            <p className="text-lg text-fg-muted">Help the community know what to look for.</p>
            <p className="max-w-prose text-fg-muted">
              We&apos;ll compare these details with pets found nearby. It takes a few minutes,
              and you can edit anything afterwards.
            </p>

            <p className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
              <Lock size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
              Exact addresses are never shown publicly.
            </p>
        </div>

        {/* The guidance is passed in, and the wizard renders it second in the
            DOM as well as on screen — Tab reaches the fields first. Nobody
            arrives here wanting to read the advice before filling anything in. */}
        <ReportForm
          reportType={REPORT_TYPES.LOST}
          guidance={<ReportGuidance reportType={REPORT_TYPES.LOST} />}
        />
      </Container>
    </div>
  )
}
