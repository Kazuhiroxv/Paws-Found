import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Link } from 'react-router-dom'
import { areaLabel, colourLabel, PET_SEX_LABELS, PET_SIZE_LABELS, REPORT_TYPES, speciesLabel } from '@/constants'
import { formatDate, formatTime12Hour } from '@/utils/date'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'
import { t } from '@/i18n'
import { Rich } from '@/i18n/Rich'

/**
 * Step 4 — everything the reporter entered, laid out to be checked before it
 * goes public. `onEditStep` sends them back to the step that owns a field
 * rather than making them click Back repeatedly.
 */
export function ReviewStep({ values, onEditStep }) {
  const isFound = values.reportType === REPORT_TYPES.FOUND
  const primaryPhoto = values.photos.find((photo) => photo.isPrimary) ?? values.photos[0]

  const petRows = [
    !isFound && [t('reportForm.review.name'), values.petName],
    [t('reportForm.details.species'), speciesLabel(values.species)],
    // For "Other" the same field names the animal, so it is labelled as one.
    [values.species === 'other' ? t('reportForm.review.animal') : t('reportForm.details.breed'), values.breed],
    [t('reportForm.details.size'), PET_SIZE_LABELS[values.size]],
    [t('reportForm.details.sex'), PET_SEX_LABELS[values.sex]],
    [t('reportForm.details.mainColour'), colourLabel(values.primaryColor)],
    [t('reportForm.details.otherColour'), colourLabel(values.secondaryColor)],
    [t('reportForm.details.features'), values.distinctiveMarkings],
    isFound && [t('reportForm.review.collar'), collarLabel(values.hasCollar)],
    isFound && [t('reportForm.details.condition'), values.condition],
  ].filter(Boolean)

  const incidentRows = [
    [isFound ? t('reportForm.place.dateFound') : t('reportForm.place.dateLost'), formatDate(values.incidentDate)],
    [t('reportForm.place.time'), formatTime12Hour(values.incidentTime)],
    [areaLabel(), values.province],
    [t('labels.city'), values.city],
    [t('reportForm.review.where'), values.locationLabel],
    [t('reportForm.review.pin'), values.lat != null ? t('reportForm.review.pinPlaced') : t('reportForm.details.none')],
    [t('reportForm.place.description'), values.description],
  ]

  const contactRows = [
    [t('reportForm.review.viaCoordinator'), yesNo(values.allowPlatformContact)],
    [t('reportForm.review.showEmail'), yesNo(values.showEmail)],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ReportTypeBadge reportType={values.reportType} />
        <p className="text-sm text-fg-muted">
          {t('reportForm.review.intro')}
        </p>
      </div>

      <Section title={t('reportForm.steps.details')} onEdit={() => onEditStep('details')} rows={petRows} />
      <Section
        title={isFound ? t('reportForm.review.whereFound') : t('reportForm.review.whereLost')}
        onEdit={() => onEditStep('incident')}
        rows={incidentRows}
      />

      <section className="flex flex-col gap-3">
        <SectionHeading title={t('reportForm.steps.photos')} onEdit={() => onEditStep('photos')} />
        {values.photos.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('reportForm.review.noPhotos')}</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {values.photos.map((photo) => (
              <li key={photo.id} className="relative">
                <img
                  src={photo.url ?? photoPlaceholder}
                  alt={photo.alt || t('reportForm.review.photoAlt')}
                  className="size-24 rounded-control object-cover"
                />
                {photo === primaryPhoto && (
                  <span className="absolute bottom-1 left-1 rounded-sm bg-panel/90 px-1 text-[0.6875rem] font-medium text-fg">
                    {t('reportForm.review.main')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section title={t('reportForm.review.contact')} onEdit={() => onEditStep('incident')} rows={contactRows} />

      {/* Correction 7: the short form of the disclaimer, where a report is
          about to be sent. Informational — no checkbox: submitting already
          says the reporter means it, and nobody is asked to certify what
          they cannot know (docs/DECISIONS.md). */}
      <p data-submit-notice="" className="rounded-control border border-border bg-sunken px-3 py-2 text-sm text-fg-muted">
        <Rich
          k="disclaimer.short.submit"
          tags={{
            link: (text) => (
              <Link to="/disclaimer" target="_blank" rel="noopener" className="font-medium text-brand underline">
                {text}
              </Link>
            ),
          }}
        />
      </p>
    </div>
  )
}

function Section({ title, rows, onEdit }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title={title} onEdit={onEdit} />
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="text-sm break-words text-fg">
              {value || <span className="text-fg-muted">{t('common.notGiven')}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function SectionHeading({ title, onEdit }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
      <h3 className="font-semibold text-fg">{title}</h3>
      <button
        type="button"
        onClick={onEdit}
        className="text-sm font-medium text-brand hover:text-brand-hover hover:underline"
      >
        {t('common.edit')}<span className="sr-only"> {title}</span>
      </button>
    </div>
  )
}

function collarLabel(value) {
  if (value === 'yes') return t('common.yes')
  if (value === 'no') return t('common.no')
  return t('common.notSure')
}

function yesNo(value) {
  return value ? t('common.yes') : t('common.no')
}
