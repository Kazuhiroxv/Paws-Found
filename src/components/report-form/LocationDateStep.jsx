import { Checkbox, Input, Textarea } from '@/components/ui'
import { LocationPicker } from '@/components/LazyMaps'
import { REPORT_TYPES } from '@/constants'
import { todayAsInputValue } from '@/utils/date'
import { cn } from '@/utils/cn'
import { LIMITS } from './reportFormModel'

/**
 * Step 2 — when and where, plus how the reporter can be contacted.
 *
 * Location is captured as free text and a city/province for now. Dropping a
 * pin on a map is Phase 8; the fields here already match what the map will
 * fill in, so nothing needs restructuring then.
 */
export function LocationDateStep({ values, errors, onChange, hasPhone = true }) {
  const isFound = values.reportType === REPORT_TYPES.FOUND

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={isFound ? 'Date found' : 'Date last seen'}
          type="date"
          required
          value={values.incidentDate}
          onChange={(event) => onChange('incidentDate', event.target.value)}
          error={errors.incidentDate}
          max={todayAsInputValue()}
        />

        <Input
          label="Approximate time"
          type="time"
          value={values.incidentTime}
          onChange={(event) => onChange('incidentTime', event.target.value)}
          hint="Roughly is fine."
        />
      </div>

      <Input
        label={isFound ? 'Where you found the pet' : 'Where your pet was last seen'}
        required
        value={values.locationLabel}
        onChange={(event) => onChange('locationLabel', event.target.value)}
        error={errors.locationLabel}
        maxLength={LIMITS.locationLabel}
        placeholder="e.g. Near the public market, Barangay Poblacion"
        hint="Describe the area or a nearby landmark — please do not give an exact home address."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="City or municipality"
          required
          value={values.city}
          onChange={(event) => onChange('city', event.target.value)}
          error={errors.city}
          maxLength={LIMITS.city}
          placeholder="e.g. Makati City"
        />

        <Input
          label="Province"
          required
          value={values.province}
          onChange={(event) => onChange('province', event.target.value)}
          error={errors.province}
          maxLength={LIMITS.province}
          placeholder="e.g. Metro Manila"
        />
      </div>

      <LocationPicker
        reportType={values.reportType}
        lat={values.lat}
        lng={values.lng}
        onChange={(lat, lng) => {
          onChange('lat', lat)
          onChange('lng', lng)
        }}
      />

      <Textarea
        label="Description"
        required
        value={values.description}
        onChange={(event) => onChange('description', event.target.value)}
        error={errors.description}
        maxLength={LIMITS.description}
        rows={4}
        placeholder={
          isFound
            ? 'e.g. Found wandering along the service road early in the morning. Calm, let me pick him up. Safe at our house and has been fed.'
            : 'e.g. Slipped out of the gate while we were unloading groceries. Friendly but nervous around traffic, usually hides under parked cars.'
        }
        hint="What happened, and how the pet behaves around strangers."
      />

      <fieldset
        className={cn(
          'flex flex-col gap-3 rounded-card border p-4',
          errors.contact ? 'border-danger' : 'border-border',
        )}
        aria-describedby={errors.contact ? 'contact-error' : undefined}
        aria-invalid={errors.contact ? true : undefined}
      >
        <legend className="px-1 text-sm font-medium text-fg">
          How can people reach you? <span className="text-danger" aria-hidden="true">*</span>
        </legend>

        <p className="text-sm text-fg-muted">
          Your phone number and email are shown on the report only if you tick them. A Pet
          Coordinator can always see how to reach you when checking a possible match.
        </p>

        <Checkbox
          label="Let people reach me through a Pet Coordinator"
          checked={values.allowPlatformContact}
          onChange={(event) => onChange('allowPlatformContact', event.target.checked)}
        />
        <Checkbox
          label="Show my phone number on the report"
          hint={hasPhone ? 'Faster, but anyone can see it.' : 'Add a phone number in your profile to use this option.'}
          checked={values.showPhone && hasPhone}
          disabled={!hasPhone}
          onChange={(event) => onChange('showPhone', event.target.checked)}
        />
        <Checkbox
          label="Show my email address on the report"
          checked={values.showEmail}
          onChange={(event) => onChange('showEmail', event.target.checked)}
        />

        {errors.contact && (
          <p id="contact-error" className="text-sm font-medium text-danger">
            {errors.contact}
          </p>
        )}
      </fieldset>
    </div>
  )
}
