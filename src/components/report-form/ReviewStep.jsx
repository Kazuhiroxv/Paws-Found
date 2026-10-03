import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { AREA_LABEL, PET_SEX_LABELS, PET_SIZE_LABELS, REPORT_TYPES, speciesLabel } from '@/constants'
import { formatDate, formatTime12Hour } from '@/utils/date'
import { ReportTypeBadge } from '@/components/ReportTypeBadge'

/**
 * Step 4 — everything the reporter entered, laid out to be checked before it
 * goes public. `onEditStep` sends them back to the step that owns a field
 * rather than making them click Back repeatedly.
 */
export function ReviewStep({ values, onEditStep }) {
  const isFound = values.reportType === REPORT_TYPES.FOUND
  const primaryPhoto = values.photos.find((photo) => photo.isPrimary) ?? values.photos[0]

  const petRows = [
    !isFound && ['Name', values.petName],
    ['Species', speciesLabel(values.species)],
    // For "Other" the same field names the animal, so it is labelled as one.
    [values.species === 'other' ? 'Animal' : 'Breed', values.breed],
    ['Size', PET_SIZE_LABELS[values.size]],
    ['Sex', PET_SEX_LABELS[values.sex]],
    ['Main colour', values.primaryColor],
    ['Other colour', values.secondaryColor],
    ['Distinctive features', values.distinctiveMarkings],
    isFound && ['Collar', collarLabel(values.hasCollar)],
    isFound && ['Condition', values.condition],
  ].filter(Boolean)

  const incidentRows = [
    [isFound ? 'Date found' : 'Date last seen', formatDate(values.incidentDate)],
    ['Approximate time', formatTime12Hour(values.incidentTime)],
    [AREA_LABEL, values.province],
    ['City or municipality', values.city],
    ['Where', values.locationLabel],
    ['Map pin', values.lat != null ? 'Placed (shown as an approximate area)' : 'None'],
    ['Description', values.description],
  ]

  const contactRows = [
    ['Reach me through a Pet Coordinator', yesNo(values.allowPlatformContact)],
    ['Show email address', yesNo(values.showEmail)],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ReportTypeBadge reportType={values.reportType} />
        <p className="text-sm text-fg-muted">
          Check the details below. You can edit the report after submitting it.
        </p>
      </div>

      <Section title="Pet details" onEdit={() => onEditStep('details')} rows={petRows} />
      <Section
        title={isFound ? 'Where you found them' : 'Where they went missing'}
        onEdit={() => onEditStep('incident')}
        rows={incidentRows}
      />

      <section className="flex flex-col gap-3">
        <SectionHeading title="Photos" onEdit={() => onEditStep('photos')} />
        {values.photos.length === 0 ? (
          <p className="text-sm text-fg-muted">No photos added.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {values.photos.map((photo) => (
              <li key={photo.id} className="relative">
                <img
                  src={photo.url ?? photoPlaceholder}
                  alt={photo.alt || 'Photo of the reported pet'}
                  className="size-24 rounded-control object-cover"
                />
                {photo === primaryPhoto && (
                  <span className="absolute bottom-1 left-1 rounded-sm bg-panel/90 px-1 text-[0.6875rem] font-medium text-fg">
                    Main
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section title="Contact preferences" onEdit={() => onEditStep('incident')} rows={contactRows} />
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
              {value || <span className="text-fg-muted">Not given</span>}
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
        Edit<span className="sr-only"> {title}</span>
      </button>
    </div>
  )
}

function collarLabel(value) {
  if (value === 'yes') return 'Yes'
  if (value === 'no') return 'No'
  return 'Not sure'
}

function yesNo(value) {
  return value ? 'Yes' : 'No'
}
