import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CircleCheck } from 'lucide-react'
import { Button, Card, CardBody, CardFooter, RequiredNote } from '@/components/ui'
import { REPORT_TYPES } from '@/constants'
import { categoryService, userService, petService } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/utils/cn'
import { PetDetailsStep } from './PetDetailsStep'
import { LocationDateStep } from './LocationDateStep'
import { PhotosStep } from './PhotosStep'
import { ReviewStep } from './ReviewStep'
import {
  STEPS,
  createEmptyValues,
  toReportInput,
  validateStep,
  valuesFromReport,
} from './reportFormModel'

const loadActiveCategories = () => categoryService.getActiveCategories()

/**
 * The steps that contain at least one required field.
 *
 * Photographs are optional — a finder often has no chance to take one — and
 * the review step only repeats what has already been entered.
 */
const STEPS_WITH_REQUIRED_FIELDS = ['details', 'incident']

/**
 * The lost/found reporting wizard.
 *
 * One component serves both report types — the fields that differ are handled
 * inside each step, because the two flows are 80% the same and two near-copies
 * would drift apart (docs/ui-inventory.md).
 *
 * Steps are validated as you leave them, so nobody is warned about fields they
 * have not reached.
 *
 * The same component handles editing: pass an existing `report` and it prefills
 * from it, saves with `updateReport`, and returns to the report instead of
 * showing the "submitted" screen. Same fields, same validation, one place to
 * change either.
 *
 * @param {Object} props
 * @param {'lost'|'found'} [props.reportType]  Required when creating.
 * @param {Object} [props.report]  Pass to edit an existing report.
 * @param {React.ReactNode} [props.guidance]  Rendered beside the step. The
 *   form owns the two-column layout rather than the page, so the step
 *   indicator can span both columns above it — which is what stops the
 *   guidance reading as an unrelated card parked next to a form.
 */
export function ReportForm({ reportType, report, guidance }) {
  const isEditing = Boolean(report)
  const navigate = useNavigate()

  const [values, setValues] = useState(() =>
    report ? valuesFromReport(report) : createEmptyValues(reportType),
  )
  const [errors, setErrors] = useState({})
  const [stepIndex, setStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [photoWarning, setPhotoWarning] = useState(null)
  const [createdReport, setCreatedReport] = useState(null)

  // Species come from the managed category list, not a hard-coded constant, so
  // a category an administrator adds is immediately fileable against.
  const { data: categories } = useAsync(loadActiveCategories)
  const speciesOptions = (categories ?? []).map((category) => ({
    value: category.id,
    label: category.label,
  }))

  const headingRef = useRef(null)
  const step = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1

  // Move focus to the new step's heading, or a keyboard user is left at the
  // bottom of the form with no idea the page changed.
  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex])

  const handleChange = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    // Clear a field's error as soon as it is touched, rather than making the
    // reporter press Next again to find out whether they fixed it.
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const goToStep = (index) => {
    setErrors({})
    setStepIndex(index)
  }

  /**
   * Enter, inside a single-line field, moves to the next step.
   *
   * The wizard is not a `<form>`, so until now Enter did nothing at all —
   * which is its own kind of broken: somebody finishes typing, presses Enter
   * out of habit, and the page sits there.
   *
   * Three deliberate exclusions:
   *   * the review step, where Enter would file the report. Submitting is a
   *     decision, and it stays a deliberate click.
   *   * textareas, where Enter is a new line and always should be.
   *   * buttons and links, which have their own Enter behaviour already.
   */
  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || isLastStep || isSubmitting) return

    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    event.preventDefault()
    handleNext()
  }

  const handleNext = () => {
    const stepErrors = validateStep(step.id, values)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))
  }

  const handleSubmit = async () => {
    // Re-check every step, in case someone jumped back and emptied a field.
    for (const candidate of STEPS) {
      const stepErrors = validateStep(candidate.id, values)
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        setStepIndex(STEPS.indexOf(candidate))
        return
      }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (isEditing) {
        await petService.updateReport(report.id, toReportInput(values, report.reporterId))
        // Straight back to the report — an "edited!" screen would just be an
        // extra click between them and the thing they were fixing.
        navigate(`/pet/${report.id}`)
        return
      }

      const user = await userService.getCurrentUser()
      const created = await petService.createReport(toReportInput(values, user.id))

      // The photographs go up separately, once the report has an id. A failure
      // here is reported on its own rather than as a failed submission: the
      // report exists and is searchable, and saying otherwise would send
      // somebody away thinking they still have to file it.
      try {
        await petService.uploadReportPhotos(created.id, values.photos)
      } catch (uploadFailed) {
        setPhotoWarning(
          uploadFailed instanceof Error ? uploadFailed.message : String(uploadFailed),
        )
      }

      setCreatedReport(created)
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (createdReport) {
    return <SubmissionSuccess report={createdReport} photoWarning={photoWarning} />
  }

  return (
    // onKeyDown on the wrapper rather than on each field: one rule, in one
    // place, for every control the wizard will ever contain.
    <div className="flex flex-col gap-7" onKeyDown={handleKeyDown}>
      {/* Full width, above both columns: the progress belongs to the whole
          task, not to the column the fields happen to be in. */}
      <Stepper steps={STEPS} currentIndex={stepIndex} />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <Card>
        <div className="border-b border-border px-6 py-5">
          <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 text-2xl font-semibold tracking-tight text-fg outline-none"
          >
            {step.label}
          </h2>
          <p className="mt-1.5 text-fg-muted">{STEP_HINTS[step.id]}</p>

          {/* Only on the steps that actually have a required field. Saying it
              above the photographs step, which has none, would teach the
              reader to stop reading it. */}
          {STEPS_WITH_REQUIRED_FIELDS.includes(step.id) && (
            <RequiredNote className="mt-2 text-sm text-fg-muted" />
          )}
        </div>

        <CardBody className="flex flex-col gap-6 px-6 py-6">

          {step.id === 'details' && (
            <PetDetailsStep
              values={values}
              errors={errors}
              onChange={handleChange}
              speciesOptions={speciesOptions}
            />
          )}
          {step.id === 'incident' && (
            <LocationDateStep values={values} errors={errors} onChange={handleChange} />
          )}
          {step.id === 'photos' && <PhotosStep values={values} onChange={handleChange} />}
          {step.id === 'review' && (
            <ReviewStep
              values={values}
              onEditStep={(id) => goToStep(STEPS.findIndex((item) => item.id === id))}
            />
          )}

          {Object.keys(errors).length > 0 && (
            <p role="alert" className="text-sm text-danger">
              Please fix the highlighted {Object.keys(errors).length === 1 ? 'field' : 'fields'}{' '}
              before continuing.
            </p>
          )}

          {submitError && (
            <p role="alert" className="text-sm text-danger">
              The report could not be submitted: {submitError.message}
            </p>
          )}
        </CardBody>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 px-6">
          <Button
            variant="ghost"
            onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
            disabled={stepIndex === 0 || isSubmitting}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </Button>

          {isLastStep ? (
            <Button
              variant={values.reportType === REPORT_TYPES.LOST ? 'accent' : 'primary'}
              onClick={handleSubmit}
              isLoading={isSubmitting}
            >
              <Check size={16} aria-hidden="true" />
              {submitLabel(isEditing, isSubmitting)}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Continue
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          )}
        </CardFooter>
      </Card>

      {guidance}
      </div>
    </div>
  )
}

function submitLabel(isEditing, isSubmitting) {
  if (isEditing) return isSubmitting ? 'Saving…' : 'Save changes'
  return isSubmitting ? 'Submitting…' : 'Submit report'
}

/** One line of context per step, shown under its heading. */
/** Four words under the step you are on, so the progress says what it wants. */
const STEP_SUBLABELS = {
  details: 'What the animal looks like',
  incident: 'Where and when',
  photos: 'Add clear photographs',
  review: 'Check and submit',
}

const STEP_HINTS = {
  details: 'What the animal looks like. These are the details the system compares against other reports.',
  incident: 'When and where it happened, and how people can reach you.',
  photos: 'A clear photo is the single most useful thing you can add.',
  review: 'Check everything before it goes public. You can edit the report afterwards.',
}

/**
 * Progress indicator.
 *
 * An ordered list, so a screen reader gets "step 2 of 4" from the structure
 * rather than from colour. On mobile the labels drop away and only the numbered
 * markers remain — four labels do not fit at 390px without wrapping into an
 * unreadable stack.
 */
function Stepper({ steps, currentIndex }) {
  return (
    // A tinted rail, so the progress reads as the frame around the form
    // rather than another row of content floating on the canvas.
    <nav aria-label="Report progress" className="rounded-card border border-border bg-layer px-4 py-4 sm:px-6">
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex
          const isDone = index < currentIndex

          return (
            <li key={step.id} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                {/* Connectors are decorative; the list order carries meaning. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-1 flex-1 rounded-pill',
                    index === 0 && 'invisible',
                    isDone || isCurrent ? 'bg-brand' : 'bg-border',
                  )}
                />

                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold transition-colors',
                    isDone && 'border-brand bg-brand text-fg-inverted',
                    // Filled, not outlined. An outlined circle beside a filled
                    // "done" one reads as the weaker of the two, which is the
                    // wrong way round: where you ARE matters more than where
                    // you have been. The ring lifts it off the rail.
                    isCurrent && 'border-brand bg-brand text-fg-inverted ring-4 ring-brand-soft',
                    !isDone && !isCurrent && 'border-border bg-panel text-fg-muted',
                  )}
                >
                  <span className="sr-only">Step {index + 1} of {steps.length}: </span>
                  {isDone ? <Check size={18} aria-hidden="true" /> : index + 1}
                </span>

                <span
                  aria-hidden="true"
                  className={cn(
                    'h-1 flex-1 rounded-pill',
                    index === steps.length - 1 && 'invisible',
                    isDone ? 'bg-brand' : 'bg-border',
                  )}
                />
              </div>

              <span className="hidden flex-col items-center gap-0.5 text-center sm:flex">
                <span
                  className={cn(
                    'text-sm',
                    isCurrent ? 'font-semibold text-fg' : 'text-fg-muted',
                  )}
                >
                  {step.label}
                </span>
                {/* Only under the step you are on. Under all four it became a
                    paragraph of small print holding the progress apart. */}
                {isCurrent && (
                  <span className="max-w-40 text-xs leading-snug text-fg-muted">
                    {STEP_SUBLABELS[step.id]}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function SubmissionSuccess({ report, photoWarning }) {
  const isLost = report.reportType === REPORT_TYPES.LOST

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        <CircleCheck size={40} className="text-success" aria-hidden="true" />

        <h2 className="text-xl font-semibold text-fg">Report submitted</h2>

        {/* The report saved; only the photographs did not. Said plainly, with
            what to do about it, rather than hidden behind a generic error. */}
        {photoWarning && (
          <p
            role="alert"
            className="max-w-prose rounded-control border border-border bg-accent-soft px-3 py-2 text-sm text-fg"
          >
            Your report was saved, but the photographs could not be uploaded:{' '}
            {photoWarning} You can add them by editing the report.
          </p>
        )}

        <p className="max-w-prose text-sm text-fg-muted">
          {isLost
            ? 'Your lost pet report is now public and searchable. If a found report matches its details, you will be notified about the possible match.'
            : 'Thank you for reporting this pet. The report is now public, and if a lost report matches its details, both sides will be told about the possible match.'}
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button as={Link} to={`/pet/${report.id}`}>
            View the report
          </Button>
          <Button as={Link} to="/dashboard/reports" variant="secondary">
            My reports
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
