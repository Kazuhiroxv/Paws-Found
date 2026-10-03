import { HandHeart, Lock, ShieldCheck } from 'lucide-react'
import { Container } from '@/components/ui'
import { NewReportForm } from '@/components/report-form/ReportForm'
import { ReportGuidance } from '@/components/report-form/ReportGuidance'
import { REPORT_TYPES } from '@/constants'
import landscapeStrip from '@/assets/img-021-landscape-strip.webp'

export function ReportFoundPage() {
  return (
    <div className="found-ground relative isolate -my-8 overflow-hidden py-8">
      {/* IMG-021 behind the page introduction, fading out before the
          form begins. The wizard is a long task and the reference gives
          it a place to start rather than a bare heading; below the fade
          the fields sit on plain canvas, where they belong. Hidden below
          `sm` — the header stacks there and the artwork would push the
          first field off a phone screen.

          Cooled with teal across the strip and no search ornament: the finder
          is not searching, they are keeping an animal safe until its owner
          is confirmed. The calmer of the two report pages on purpose. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-72 overflow-hidden sm:block"
      >
        <img src={landscapeStrip} alt="" className="size-full object-cover object-[70%_60%] opacity-55" />
        <span className="absolute inset-0 bg-brand/15 mix-blend-multiply" />
        <span className="absolute inset-0 bg-gradient-to-r from-found-soft/85 via-found-soft/40 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface" />
      </div>

      {/* The wizard owns its own two-column layout, so the step indicator can
          run the full width above the fields and the guidance. */}
      <Container width="page" className="flex flex-col gap-8">
        <title>Report a found pet · Paws&Found</title>

        {/* On its own surface rather than straight on the artwork — see the
            note on ReportLostPage. */}
        <div className="flex max-w-3xl flex-col gap-3 rounded-card border border-border border-l-4 border-l-brand bg-panel/95 p-5 shadow-raised backdrop-blur-sm sm:p-7">
          <p className="inline-flex w-fit items-center gap-2 rounded-pill bg-found-soft px-3 py-1 text-sm font-semibold text-found">
            <HandHeart size={15} aria-hidden="true" />
            Report found
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-balance text-fg sm:text-4xl">
            Report a <span className="text-found">found</span> pet
          </h1>
          <p className="text-lg text-fg">Give the owner the best chance of recognising them.</p>
          <p className="max-w-prose text-fg">
            We&apos;ll compare these details with pets reported missing nearby. It takes a few
            minutes, and you can edit anything afterwards.
          </p>

          <ul className="mt-1 flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-2 font-medium text-found">
              <ShieldCheck size={15} className="shrink-0" aria-hidden="true" />
              Keep the pet safe where you are. A coordinator verifies the owner before any
              handover.
            </li>
            <li className="flex items-center gap-2 text-fg-muted">
              <Lock size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
              Exact addresses are never shown publicly.
            </li>
          </ul>
        </div>

        <NewReportForm
          reportType={REPORT_TYPES.FOUND}
          guidance={<ReportGuidance reportType={REPORT_TYPES.FOUND} />}
        />
      </Container>
    </div>
  )
}
