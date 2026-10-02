import { useCallback, useState } from 'react'
import { Checkbox, Input, Select, Textarea } from '@/components/ui'
import { LocationPicker } from '@/components/LazyMaps'
import { REPORT_TYPES } from '@/constants'
import { referenceService } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { timeFrom12Hour, timeTo12Hour, todayAsInputValue } from '@/utils/date'
import { cn } from '@/utils/cn'
import { DESCRIPTION_MIN, LIMITS, descriptionLength } from './reportFormModel'

const loadProvinces = () => referenceService.getProvinces()

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

/**
 * Step 2 — when and where, plus how the reporter can be contacted.
 *
 * The place is chosen, not typed (Correction 3): a province, then a city or
 * municipality in it, both from the Philippine Standard Geographic Code via
 * the API. Three different things are asked for and kept apart: the place
 * (chosen), the spot in the reporter's own words (typed), and an optional pin
 * (clicked). None of them changes another.
 */
export function LocationDateStep({ values, errors, onChange }) {
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

        <TimeOfDayField
          value={values.incidentTime}
          error={errors.incidentTime}
          onChange={(time, isIncomplete) => {
            onChange('incidentTime', time)
            onChange('incidentTimeIncomplete', isIncomplete)
          }}
        />
      </div>

      <PlaceFields values={values} errors={errors} onChange={onChange} />

      <Input
        label={isFound ? 'Where you found the pet' : 'Where your pet was last seen'}
        required
        value={values.locationLabel}
        onChange={(event) => onChange('locationLabel', event.target.value)}
        error={errors.locationLabel}
        maxLength={LIMITS.locationLabel}
        placeholder="e.g. Near the public market, Barangay Poblacion"
        hint="The barangay, a street or a landmark, in your own words. Please do not give an exact home address."
      />

      <LocationPicker
        reportType={values.reportType}
        lat={values.lat}
        lng={values.lng}
        onChange={(lat, lng) => {
          onChange('lat', lat)
          onChange('lng', lng)
        }}
      />

      <DescriptionField
        isFound={isFound}
        value={values.description}
        error={errors.description}
        onChange={(description) => onChange('description', description)}
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
          Your phone number is never shown on a report. A Pet Coordinator can see it when
          checking a possible match, and passes messages on. Your email address is shown only
          if you tick it, and only to people who are signed in.
        </p>

        <Checkbox
          label="Let people reach me through a Pet Coordinator"
          checked={values.allowPlatformContact}
          onChange={(event) => onChange('allowPlatformContact', event.target.checked)}
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

/**
 * Province, then the cities and municipalities of that province.
 *
 * Changing the province empties the city, because a city belongs to exactly
 * one province: keeping it would let "Quezon City" sit under Cebu. Nothing
 * else moves — not the written location, and not the pin.
 */
function PlaceFields({ values, errors, onChange }) {
  const { data: provinces, error: provincesError } = useAsync(loadProvinces)
  const loadCities = useCallback(() => referenceService.getCities(values.provinceCode), [values.provinceCode])
  const { data: cities, error: citiesError, isLoading: citiesLoading } = useAsync(loadCities)
  const listFailed = provincesError || citiesError

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Province"
          required
          value={values.provinceCode}
          onChange={(event) => {
            const code = event.target.value
            const province = (provinces ?? []).find((item) => item.code === code)
            onChange('provinceCode', code)
            onChange('province', province?.name ?? '')
            onChange('cityCode', '')
            onChange('city', '')
          }}
          error={errors.province}
          placeholder={provinces ? 'Choose one' : 'Loading…'}
          options={(provinces ?? []).map((province) => ({ value: province.code, label: province.name }))}
          hint="Metro Manila is listed as one entry."
        />

        <Select
          label="City or municipality"
          required
          value={values.cityCode}
          onChange={(event) => {
            const code = event.target.value
            const city = (cities ?? []).find((item) => item.code === code)
            onChange('cityCode', code)
            onChange('city', city?.name ?? '')
          }}
          error={errors.city}
          disabled={!values.provinceCode}
          placeholder={
            !values.provinceCode ? 'Choose the province first' : citiesLoading ? 'Loading…' : 'Choose one'
          }
          options={(cities ?? []).map((city) => ({ value: city.code, label: city.name }))}
        />
      </div>

      {listFailed && (
        <p role="alert" className="text-sm text-danger">
          The list of places could not be loaded. Check your connection and open this step
          again.
        </p>
      )}
    </div>
  )
}

/**
 * The approximate time, on a 12-hour clock with AM or PM chosen explicitly
 * (Correction 3). Hands the parent a 24-hour "HH:MM" — what the API and the
 * TIME column store — or "" when no time is given.
 *
 * Optional: all three empty means "I do not know". Half a time ("7" with no
 * AM or PM) is not a time, so it is reported as incomplete rather than
 * guessed at.
 */
function TimeOfDayField({ value, error, onChange }) {
  const [parts, setParts] = useState(() => timeTo12Hour(value))

  const update = (field, next) => {
    const draft = { ...parts, [field]: next }
    // Choosing an hour on its own means "on the hour" until said otherwise.
    if (field === 'hour' && next && !draft.minute) draft.minute = '00'
    setParts(draft)
    const time = timeFrom12Hour(draft)
    const isEmpty = !draft.hour && !draft.period
    onChange(time, !time && !isEmpty)
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-medium text-fg">Approximate time</legend>
      <div className="grid grid-cols-3 gap-2">
        <Select
          label="Hour"
          value={parts.hour}
          onChange={(event) => update('hour', event.target.value)}
          options={[{ value: '', label: '--' }, ...HOURS.map((h) => ({ value: h, label: h }))]}
          aria-invalid={error && !parts.hour ? true : undefined}
        />
        <Select
          label="Minutes"
          value={parts.minute}
          onChange={(event) => update('minute', event.target.value)}
          options={[{ value: '', label: '--' }, ...MINUTES.map((m) => ({ value: m, label: m }))]}
          aria-invalid={error && !parts.minute ? true : undefined}
        />
        <Select
          label="AM or PM"
          value={parts.period}
          onChange={(event) => update('period', event.target.value)}
          options={[
            { value: '', label: '--' },
            { value: 'AM', label: 'AM' },
            { value: 'PM', label: 'PM' },
          ]}
          aria-invalid={error && !parts.period ? true : undefined}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm leading-relaxed text-danger">
          {error}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-fg-muted">
          Optional; roughly is fine. 12:00 PM is noon, 12:00 AM is midnight.
        </p>
      )}
    </fieldset>
  )
}

/**
 * The description, with a running count towards the minimum, so "too short"
 * is visible while typing rather than discovered at Continue. Spaces in a row
 * count once, the same as the server counts them.
 */
function DescriptionField({ isFound, value, error, onChange }) {
  const length = descriptionLength(value)
  const enough = length >= DESCRIPTION_MIN

  return (
    <Textarea
      label="Description"
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      maxLength={LIMITS.description}
      rows={4}
      placeholder={
        isFound
          ? 'e.g. Found wandering along the service road early in the morning. Calm, let me pick him up. Safe at our house and has been fed.'
          : 'e.g. Slipped out of the gate while we were unloading groceries. Friendly but nervous around traffic, usually hides under parked cars.'
      }
      hint={
        <>
          What happened, and how the pet behaves around strangers.{' '}
          <span className={cn('font-medium', enough ? 'text-fg' : 'text-fg-muted')} data-description-count>
            {length} / {DESCRIPTION_MIN} minimum{enough ? ' — enough' : ''}
          </span>
        </>
      }
    />
  )
}
