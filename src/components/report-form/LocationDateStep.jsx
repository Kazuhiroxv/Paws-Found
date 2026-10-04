import { useCallback, useState } from 'react'
import { Checkbox, Input, Select, Textarea } from '@/components/ui'
import { LocationPicker } from '@/components/LazyMaps'
import { areaHint, areaLabel, REPORT_TYPES } from '@/constants'
import { referenceService } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { timeFrom12Hour, timeTo12Hour, todayAsInputValue } from '@/utils/date'
import { cn } from '@/utils/cn'
import { DESCRIPTION_MIN, LIMITS, descriptionLength } from './reportFormModel'
import { t } from '@/i18n'

const loadAreas = () => referenceService.getAreas()

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
          label={isFound ? t('reportForm.place.dateFound') : t('reportForm.place.dateLost')}
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
        label={isFound ? t('reportForm.place.whereFound') : t('reportForm.place.whereLost')}
        required
        value={values.locationLabel}
        onChange={(event) => onChange('locationLabel', event.target.value)}
        error={errors.locationLabel}
        maxLength={LIMITS.locationLabel}
        placeholder={t('reportForm.place.wherePlaceholder')}
        hint={t('reportForm.place.whereHint')}
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
          {t('reportForm.place.reachTitle')} <span className="text-danger" aria-hidden="true">*</span>
        </legend>

        <p className="text-sm text-fg-muted">
          {t('reportForm.place.reachBody')}
        </p>

        <Checkbox
          label={t('reportForm.place.viaCoordinator')}
          checked={values.allowPlatformContact}
          onChange={(event) => onChange('allowPlatformContact', event.target.checked)}
        />
        <Checkbox
          label={t('reportForm.place.showEmail')}
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
 * A province (or Metro Manila), then the cities and municipalities in it.
 *
 * The first list is of AREAS (Correction 3A): PSA's 82 provinces, plus Metro
 * Manila and BARMM's Special Geographic Area, which PSA files under no
 * province. Changing it empties the city, because a city belongs to exactly
 * one area: keeping it would let "Quezon City" sit under Cebu. Nothing else
 * moves — not the written location, and not the pin.
 */
function PlaceFields({ values, errors, onChange }) {
  const { data: areas, error: areasError } = useAsync(loadAreas)
  const loadCities = useCallback(() => referenceService.getCities(values.areaCode), [values.areaCode])
  const { data: cities, error: citiesError, isLoading: citiesLoading } = useAsync(loadCities)
  const listFailed = areasError || citiesError

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label={areaLabel()}
          required
          value={values.areaCode}
          onChange={(event) => {
            const code = event.target.value
            const area = (areas ?? []).find((item) => item.code === code)
            onChange('areaCode', code)
            // `province` is the stored column's old name: it holds the
            // area's name, "Metro Manila" included.
            onChange('province', area?.name ?? '')
            onChange('cityCode', '')
            onChange('city', '')
          }}
          error={errors.province}
          placeholder={areas ? t('common.chooseOne') : t('common.loading')}
          options={(areas ?? []).map((area) => ({ value: area.code, label: area.name }))}
          hint={areaHint()}
        />

        <Select
          label={t('labels.city')}
          required
          value={values.cityCode}
          onChange={(event) => {
            const code = event.target.value
            const city = (cities ?? []).find((item) => item.code === code)
            onChange('cityCode', code)
            onChange('city', city?.name ?? '')
          }}
          error={errors.city}
          disabled={!values.areaCode}
          placeholder={
            !values.areaCode ? t('reportForm.place.areaFirst') : citiesLoading ? t('common.loading') : t('common.chooseOne')
          }
          options={(cities ?? []).map((city) => ({ value: city.code, label: city.name }))}
        />
      </div>

      {listFailed && (
        <p role="alert" className="text-sm text-danger">
          {t('reportForm.place.listFailed')}
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
      <legend className="text-sm font-medium text-fg">{t('reportForm.place.time')}</legend>
      <div className="grid grid-cols-3 gap-2">
        <Select
          label={t('reportForm.place.hour')}
          value={parts.hour}
          onChange={(event) => update('hour', event.target.value)}
          options={[{ value: '', label: '--' }, ...HOURS.map((h) => ({ value: h, label: h }))]}
          aria-invalid={error && !parts.hour ? true : undefined}
        />
        <Select
          label={t('reportForm.place.minutes')}
          value={parts.minute}
          onChange={(event) => update('minute', event.target.value)}
          options={[{ value: '', label: '--' }, ...MINUTES.map((m) => ({ value: m, label: m }))]}
          aria-invalid={error && !parts.minute ? true : undefined}
        />
        <Select
          label={t('reportForm.place.period')}
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
          {t('reportForm.place.timeHint')}
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
      label={t('reportForm.place.description')}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      maxLength={LIMITS.description}
      rows={4}
      placeholder={
        isFound
          ? t('reportForm.place.descriptionFound')
          : t('reportForm.place.descriptionLost')
      }
      hint={
        <>
          {t('reportForm.place.descriptionHint')}{' '}
          <span className={cn('font-medium', enough ? 'text-fg' : 'text-fg-muted')} data-description-count>
            {t(enough ? 'reportForm.place.countEnough' : 'reportForm.place.count', { length, min: DESCRIPTION_MIN })}
          </span>
        </>
      }
    />
  )
}
