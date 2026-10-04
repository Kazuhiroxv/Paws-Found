import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CircleCheck, Save, X } from 'lucide-react'
import { Button, Card, CardBody, CardFooter, RequiredNote } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { REPORT_TYPE_LABELS, REPORT_TYPES, speciesLabel } from '@/constants'
import { categoryService, userService, petService } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/utils/cn'
import { revealFirstInvalid, useRevealWhen } from '@/utils/reveal'
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
import { t } from '@/i18n'
import { useLanguage } from '@/i18n/useLanguage'
import { errorText } from '@/i18n/apiErrors'

const loadActiveCategories = () => categoryService.getActiveCategories()

/**
 * The steps that contain at least one required field.
 *
 * Photographs are optional — a finder often has no chance to take one — and
 * the review step only repeats what has already been entered.
 */
const STEPS_WITH_REQUIRED_FIELDS = ['details', 'incident']

/** The contact checkboxes, which are validated as one group. */
const CONTACT_FIELDS = ['allowPlatformContact', 'showEmail']

/**
 * Fields whose error is shown under a different name: the place is chosen by
 * code but its message sits on the Province and City lists, and the time's
 * three parts share one message.
 */
const ERROR_KEY_OF = {
  areaCode: 'province',
  cityCode: 'city',
  incidentTimeIncomplete: 'incidentTime',
}

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
export function ReportForm({ reportType, report, draft = null, guidance }) {
  const isEditing = Boolean(report)
  const [isAskingAboutPhoto, setIsAskingAboutPhoto] = useState(false)
  const navigate = useNavigate()

  const [values, setValues] = useState(() => {
    if (report) return valuesFromReport(report)
    // A saved draft carries the form's own fields; the rest start empty.
    if (draft) {
      const { id: _id, updatedAt: _updatedAt, ...saved } = draft
      return { ...createEmptyValues(draft.reportType), ...saved, photos: [] }
    }
    return createEmptyValues(reportType)
  })

  // Saved drafts (Correction 4): kept in MySQL, so a report can be finished
  // later or on another device. The id is the draft being written over.
  const [draftId, setDraftId] = useState(draft?.id ?? null)
  const [draftState, setDraftState] = useState(null)
  // What the form looked like when it opened, so Cancel can tell "changed my
  // mind before typing anything" from "about to lose ten minutes of work".
  const startingValues = useRef(values)
  const [errors, setErrors] = useState({})
  const [stepIndex, setStepIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [photoWarning, setPhotoWarning] = useState(null)
  const [createdReport, setCreatedReport] = useState(null)

  // Species come from the managed category list, not a hard-coded constant, so
  // a category an administrator adds is immediately fileable against.
  const { data: categories } = useAsync(loadActiveCategories)

  // The five seeded kinds in the language showing; one an administrator
  // added keeps its stored name (Correction 7).
  const speciesOptions = (categories ?? []).map((category) => ({
    value: category.id,
    label: speciesLabel(category.id, category.label),
  }))

  // The messages beside the fields are written when a step is checked. When
  // the language changes while some are showing, the same fields are checked
  // again so the messages come back in the new language (Correction 7) —
  // during render, as React recommends for state that follows another value.
  const { language } = useLanguage()
  const [errorsLanguage, setErrorsLanguage] = useState(language)
  if (errorsLanguage !== language) {
    setErrorsLanguage(language)
    if (Object.keys(errors).length > 0) {
      const fresh = validateStep(STEPS[stepIndex].id, values)
      setErrors(Object.fromEntries(Object.keys(errors).filter((key) => fresh[key]).map((key) => [key, fresh[key]])))
    }
  }

  const headingRef = useRef(null)
  const step = STEPS[stepIndex]
  const isLastStep = stepIndex === STEPS.length - 1

  // Move focus to the new step's heading, or a keyboard user is left at the
  // bottom of the form with no idea the page changed.
  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex])

  // A refused Next or Submit takes the person to the first field that refused
  // it, not just the step heading — the problem may be a long way down. A
  // counter rather than the errors themselves, so this runs on a refusal and
  // not every time a fixed field clears its own error. Declared after the
  // effect above so that, when a submit jumps back to an earlier step, the
  // invalid field wins over the heading.
  const formAreaRef = useRef(null)
  const [refusals, setRefusals] = useState(0)
  useEffect(() => {
    if (refusals) revealFirstInvalid(formAreaRef.current)
  }, [refusals])

  const handleChange = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }))
    // Clear a field's error as soon as it is touched, rather than making the
    // reporter press Next again to find out whether they fixed it.
    // The contact choices share one error: ticking any of the three answers
    // it, so touching any of them clears it.
    const key = CONTACT_FIELDS.includes(field) ? 'contact' : (ERROR_KEY_OF[field] ?? field)
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
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
    if (Object.keys(stepErrors).length > 0) {
      setRefusals((count) => count + 1)
      return
    }

    // A new lost report with no photo gets one gentle question. Photos stay
    // optional: somebody may have none to hand at 2am. Not asked of a finder,
    // who may not have had the chance to take one, and not on an edit, where
    // the owner has already been asked once.
    if (
      step.id === 'photos' &&
      !isEditing &&
      values.reportType === REPORT_TYPES.LOST &&
      values.photos.length === 0 &&
      !isAskingAboutPhoto
    ) {
      setIsAskingAboutPhoto(true)
      return
    }

    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))
  }

  /**
   * Leave without filing anything.
   *
   * Confirms only when something has actually been typed — an empty form has
   * nothing to lose and a dialog over it is just a second click. `window.confirm`
   * rather than ConfirmDialog: this is the one case where the answer has to
   * arrive before the navigation does, and a real report wizard is not the
   * place to invent a modal state machine for it.
   */
  const continueWithoutPhoto = () => {
    setIsAskingAboutPhoto(false)
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1))
  }

  const handleCancel = () => {
    const untouched = JSON.stringify(values) === JSON.stringify(startingValues.current)
    if (untouched || window.confirm(t('reportForm.discard'))) {
      navigate(isEditing ? `/pet/${report.id}` : '/')
    }
  }

  /**
   * Save the form as it stands, complete or not. The server checks only that
   * what is there is real (a listed colour, a place from the list, a real
   * date); completeness is for Submit for review.
   *
   * Photographs are not kept with a draft — they are uploaded only with the
   * report itself — and the confirmation says so when there are some.
   */
  const handleSaveDraft = async () => {
    // Kinds, not sentences: the words are chosen when shown, in the
    // language showing.
    setDraftState({ kind: 'saving' })
    try {
      const saved = await petService.saveDraft(values, draftId)
      setDraftId(saved.id)
      // So a reload, or the link, opens this draft again. Not a navigation:
      // the form, its step and its photographs stay as they are.
      window.history.replaceState(window.history.state, '', `?draft=${saved.id}`)
      setDraftState({ kind: 'saved', withPhotos: values.photos.length > 0 })
    } catch (caught) {
      setDraftState({
        kind: 'failed',
        detail: errorText(caught),
      })
    }
  }

  const handleSubmit = async () => {
    // Re-check every step, in case someone jumped back and emptied a field.
    for (const candidate of STEPS) {
      const stepErrors = validateStep(candidate.id, values)
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        setStepIndex(STEPS.indexOf(candidate))
        setRefusals((count) => count + 1)
        return
      }
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (isEditing) {
        // Details first; if that fails nothing else is attempted and the error
        // shows here. Then the photos, whose failure is carried to the report
        // page rather than hidden: the details did save, and the owner should
        // know exactly which part did not.
        await petService.updateReport(report.id, toReportInput(values, report.reporterId))

        let photoWarning = null
        try {
          await petService.saveEditedPhotos(report.id, report.photos, values.photos)
        } catch (photoFailed) {
          photoWarning = errorText(photoFailed)
        }

        // Straight back to the report — an "edited!" screen would just be an
        // extra click between them and the thing they were fixing.
        navigate(`/pet/${report.id}`, photoWarning ? { state: { photoWarning } } : undefined)
        return
      }

      const user = await userService.getCurrentUser()
      // A draft being submitted is deleted by the server in the same step.
      const created = await petService.createReport(toReportInput(values, user.id), draftId)

      // The photographs go up separately, once the report has an id. A failure
      // here is reported on its own rather than as a failed submission: the
      // report exists and is searchable, and saying otherwise would send
      // somebody away thinking they still have to file it.
      try {
        await petService.uploadReportPhotos(created.id, values.photos)
      } catch (uploadFailed) {
        setPhotoWarning(
          errorText(uploadFailed),
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
    <div ref={formAreaRef} className="flex flex-col gap-7" onKeyDown={handleKeyDown}>
      {/* Full width, above both columns: the progress belongs to the whole
          task, not to the column the fields happen to be in. */}
      <Stepper steps={STEPS} currentIndex={stepIndex} />

      {/* The second column only when there is guidance to put in it: the edit
          page has none, and an empty 20rem column squeezed its form. */}
      <div className={cn('grid items-start gap-8 lg:gap-10', guidance && 'lg:grid-cols-[minmax(0,1fr)_20rem]')}>
      <Card>
        <div className="border-b border-border px-6 py-5">
          <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">
            {t('reportForm.stepOf', { step: stepIndex + 1, total: STEPS.length })}
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 text-2xl font-semibold tracking-tight text-fg outline-none"
          >
            {step.label}
          </h2>
          <p className="mt-1.5 text-fg-muted">{t(`reportForm.hints.${step.id}`)}</p>

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
            <LocationDateStep
              values={values}
              errors={errors}
              onChange={handleChange}
            />
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
              {/* "Check", not "fix" or "fill in": some of these are a date in
                  the future or not enough to identify the pet, not blanks. */}
              {t('reportForm.checkFields', { count: Object.keys(errors).length })}
            </p>
          )}

          {submitError && (
            <p role="alert" className="text-sm text-danger">
              {t('reportForm.submitFailed', { message: errorText(submitError) })}
            </p>
          )}
        </CardBody>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 px-6">
          {/* Back steps through the wizard and was disabled at step one, which
              left the first step with no way out but the browser's own Back
              button. Somebody who opened this by mistake, or changed their
              mind, needs a marked door — so Cancel takes the place Back cannot
              fill, and asks first if anything has been typed. */}
          {stepIndex === 0 ? (
            <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
              <X size={16} aria-hidden="true" />
              {t('common.cancel')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
              disabled={isSubmitting}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {t('common.back')}
            </Button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* A new report can be put down and finished later (Correction
                4). An edit saves the report itself, so it has no draft. */}
            {!isEditing && (
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                isLoading={draftState?.kind === 'saving'}
              >
                <Save size={16} aria-hidden="true" />
                {t('reportForm.saveDraft')}
              </Button>
            )}

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
                {t('common.continue')}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            )}
          </div>

          {/* Announced, and in words: saved, or why not. */}
          <p
            role="status"
            data-draft-status={draftState?.kind ?? ''}
            className={cn(
              'w-full text-sm',
              draftState?.kind === 'failed' ? 'text-danger' : 'text-fg-muted',
              !draftState && 'sr-only',
            )}
          >
            {draftMessage(draftState)}
          </p>
        </CardFooter>
      </Card>

      {guidance}
      </div>

      {/* Never says a photo makes the matching faster: matching compares the
          details, not the pictures. What a photo does is let people, and a
          coordinator checking a claim, recognise the pet. */}
      <ConfirmDialog
        isOpen={isAskingAboutPhoto}
        title={t('reportForm.noPhoto.title')}
        confirmLabel={t('reportForm.noPhoto.skip')}
        cancelLabel={t('reportForm.noPhoto.add')}
        cancelVariant="primary"
        tone="secondary"
        onCancel={() => setIsAskingAboutPhoto(false)}
        onConfirm={continueWithoutPhoto}
      >
        {t('reportForm.noPhoto.body')}
      </ConfirmDialog>
    </div>
  )
}

function submitLabel(isEditing, isSubmitting) {
  if (isEditing) return isSubmitting ? t('common.saving') : t('reportForm.saveChanges')
  // Not "Post": a Pet Coordinator reviews it before anyone else sees it.
  return isSubmitting ? t('reportForm.submitting') : t('reportForm.submit')
}

/** What the draft line says, in the language showing. */
function draftMessage(state) {
  if (!state) return ''
  if (state.kind === 'saving') return t('common.saving')
  if (state.kind === 'saved') return state.withPhotos ? t('reportForm.draftSavedPhotos') : t('reportForm.draftSaved')
  return t('reportForm.draftFailed', { message: state.detail })
}

/**
 * The wizard for a NEW report, opening a saved draft when the address says
 * `?draft=12`. Used by the Report lost and Report found pages.
 */
export function NewReportForm({ reportType, guidance }) {
  const [params] = useSearchParams()
  const requested = params.get('draft')
  const loadDraft = useCallback(
    () => (requested ? petService.getDraft(requested) : Promise.resolve(null)),
    [requested],
  )
  const { data: draft, error, isLoading } = useAsync(loadDraft)

  if (requested && isLoading) {
    return <p className="text-fg-muted">{t('reportForm.openingDraft')}</p>
  }
  if (requested && (error || !draft)) {
    return (
      <p role="alert" className="text-fg">
        {t('reportForm.draftGone')}{' '}
        <Link to="/dashboard/reports" className="font-medium text-brand underline">
          {t('reportForm.seeMyReports')}
        </Link>
        .
      </p>
    )
  }
  if (draft && draft.reportType !== reportType) {
    return (
      <p role="alert" className="text-fg">
        {t('reportForm.draftOtherType', { type: REPORT_TYPE_LABELS[draft.reportType] ?? draft.reportType })}{' '}
        <Link to={`/report/${draft.reportType}?draft=${draft.id}`} className="font-medium text-brand underline">
          {t('reportForm.openThere')}
        </Link>
        .
      </p>
    )
  }

  return <ReportForm key={draft?.id ?? 'new'} reportType={reportType} draft={draft} guidance={guidance} />
}

/** One line of context per step, shown under its heading. */
/** Four words under the step you are on, so the progress says what it wants. */


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
    <nav aria-label={t('reportForm.progress')} className="rounded-card border border-border bg-layer px-4 py-4 sm:px-6">
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
                  <span className="sr-only">{t('reportForm.stepOfSr', { step: index + 1, total: steps.length })}</span>
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
                    {t(`reportForm.sublabels.${step.id}`)}
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

  // This card replaces the whole wizard, and the Submit button was at the
  // bottom of its longest step. Without this the window stayed down there,
  // the confirmation sat above it out of sight, and it looked as though
  // nothing had happened — which is what was seen at the defense.
  const confirmationRef = useRevealWhen(true)

  return (
    <Card>
      <CardBody
        ref={confirmationRef}
        tabIndex={-1}
        className="flex scroll-mt-24 flex-col items-center gap-3 py-10 text-center outline-none"
      >
        <CircleCheck size={40} className="text-success" aria-hidden="true" />

        <h2 className="text-xl font-semibold text-fg">{t('reportForm.success.title')}</h2>

        {/* The report saved; only the photographs did not. Said plainly, with
            what to do about it, rather than hidden behind a generic error. */}
        {photoWarning && (
          <p
            role="alert"
            className="max-w-prose rounded-control border border-border bg-accent-soft px-3 py-2 text-sm text-fg"
          >
            {t('reportForm.success.photoWarning', { message: photoWarning })}
          </p>
        )}

        {/* Never "your report is now live": it is not (Correction 4). */}
        <p className="max-w-prose text-fg">
          {t('reportForm.success.body')}
        </p>
        <p className="max-w-prose text-sm text-fg-muted">
          {isLost ? t('reportForm.success.lost') : t('reportForm.success.found')}
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button as={Link} to={`/pet/${report.id}`}>
            {t('reportForm.success.view')}
          </Button>
          <Button as={Link} to="/dashboard/reports" variant="secondary">
            {t('reportForm.success.myReports')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
