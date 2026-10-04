import { useCallback, useState } from 'react'
import { Input, Select, Textarea } from '@/components/ui'
import { PET_SEX_LABELS, PET_SIZE_LABELS, REPORT_TYPES, colourLabel } from '@/constants'
import { referenceService } from '@/services'
import { useAsync } from '@/hooks/useAsync'
import { optionsFromLabels } from '@/utils/options'
import { LIMITS, OTHER_SPECIES } from './reportFormModel'
import { t } from '@/i18n'

const loadColours = () => referenceService.getColours()

/** The breed select's value for "it is not in the list — let me type it". */
const TYPED_BREED = '__typed__'

/**
 * Step 1 — what the animal looks like.
 *
 * Shared by both report types. A found report drops the pet name and asks for
 * a collar and condition instead, because that is what a finder can actually
 * observe.
 */
export function PetDetailsStep({ values, errors, onChange, speciesOptions = [] }) {
  const isFound = values.reportType === REPORT_TYPES.FOUND

  // Colours and breeds come from the database through the API (Correction 3),
  // never from a list in this file.
  const { data: colours } = useAsync(loadColours)
  const colourOptions = (colours ?? []).map((colour) => ({ value: colour.name, label: colourLabel(colour.name) }))
  const saysOther = values.primaryColor === 'Other' || values.secondaryColor === 'Other'

  return (
    <div className="flex flex-col gap-8">
      {!isFound && (
        <Input
          label={t('reportForm.details.petName')}
          required
          value={values.petName}
          onChange={(event) => onChange('petName', event.target.value)}
          error={errors.petName}
          maxLength={LIMITS.petName}
          placeholder={t('reportForm.details.petNamePlaceholder')}
          hint={t('reportForm.details.petNameHint')}
        />
      )}

      <FieldGroup
        title={t('reportForm.details.kindTitle')}
        hint={t('reportForm.details.kindHint')}
      >
      {/* The one rule that spans two fields, said before it can fail: an
          asterisk on either would be untrue, since either one satisfies it.
          Not shown for "Other", where naming the animal already does. */}
      {values.species !== OTHER_SPECIES && (
        <p className="text-sm text-fg">
          {t('reportForm.details.breedOrFeature')}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label={t('reportForm.details.species')}
          required
          value={values.species}
          onChange={(event) => {
            const next = event.target.value
            // A breed belongs to one species, so changing the species clears
            // it: "Shih Tzu" is not a cat's breed, "Turtle" is not a dog's,
            // and the breed list itself changes with the species.
            if (next !== values.species) onChange('breed', '')
            onChange('species', next)
          }}
          error={errors.species}
          placeholder={t('common.chooseOne')}
          options={speciesOptions}
        />

        {/* The same `breed` value either way; for "Other" it names the animal
            (the API stores it under the Other category just like a breed). */}
        {values.species === OTHER_SPECIES ? (
          <Input
            label={t('reportForm.details.specify')}
            required
            value={values.breed}
            onChange={(event) => onChange('breed', event.target.value)}
            maxLength={LIMITS.breed}
            placeholder={t('reportForm.details.specifyPlaceholder')}
            error={errors.breed}
          />
        ) : (
          // Keyed by species, so "type it" does not carry over to the next one.
          <BreedField
            key={values.species}
            species={values.species}
            value={values.breed}
            onChange={(breed) => onChange('breed', breed)}
          />
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label={t('reportForm.details.size')}
          required
          value={values.size}
          onChange={(event) => onChange('size', event.target.value)}
          error={errors.size}
          placeholder={t('common.chooseOne')}
          options={optionsFromLabels(PET_SIZE_LABELS)}
        />

        {/* Unanswered until answered, like the collar question: "Unknown" is
            a real answer (a finder often cannot tell), not something to
            assume for someone who skipped the field. */}
        <Select
          label={t('reportForm.details.sex')}
          required
          value={values.sex}
          onChange={(event) => onChange('sex', event.target.value)}
          error={errors.sex}
          placeholder={t('common.chooseOne')}
          options={optionsFromLabels(PET_SEX_LABELS)}
        />
      </div>
      </FieldGroup>

      <FieldGroup
        title={t('reportForm.details.lookTitle')}
        hint={t('reportForm.details.lookHint')}
      >

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label={t('reportForm.details.mainColour')}
          required
          value={values.primaryColor}
          onChange={(event) => onChange('primaryColor', event.target.value)}
          error={errors.primaryColor}
          placeholder={t('common.chooseOne')}
          options={colourOptions}
        />

        <Select
          label={t('reportForm.details.otherColour')}
          value={values.secondaryColor}
          onChange={(event) => onChange('secondaryColor', event.target.value)}
          options={[{ value: '', label: t('reportForm.details.none') }, ...colourOptions]}
          hint={t('reportForm.details.otherColourHint')}
        />
      </div>

      {/* "Other" is an honest answer, but it says nothing on its own, so the
          form asks for the words. It never counts as two reports agreeing. */}
      {saysOther && (
        <p className="text-sm text-fg">
          {t('reportForm.details.otherColourNote')}
        </p>
      )}

      <Textarea
        label={t('reportForm.details.features')}
        value={values.distinctiveMarkings}
        onChange={(event) => onChange('distinctiveMarkings', event.target.value)}
        error={errors.distinctiveMarkings}
        maxLength={LIMITS.distinctiveMarkings}
        rows={3}
        placeholder={t('reportForm.details.featuresPlaceholder')}
        hint={t('reportForm.details.featuresHint')}
      />
      </FieldGroup>

      {isFound && (
        <FieldGroup title={t('reportForm.details.foundTitle')} hint={t('reportForm.details.foundHint')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label={t('reportForm.details.collar')}
            required
            value={values.hasCollar}
            onChange={(event) => onChange('hasCollar', event.target.value)}
            placeholder={t('common.chooseOne')}
            error={errors.hasCollar}
            options={[
              { value: 'yes', label: t('common.yes') },
              { value: 'no', label: t('common.no') },
              { value: 'unknown', label: t('common.notSure') },
            ]}
          />

          <Input
            label={t('reportForm.details.condition')}
            value={values.condition}
            onChange={(event) => onChange('condition', event.target.value)}
            maxLength={LIMITS.condition}
            placeholder={t('reportForm.details.conditionPlaceholder')}
            hint={t('reportForm.details.conditionHint')}
          />
        </div>
        </FieldGroup>
      )}
    </div>
  )
}

/**
 * A titled group of related fields.
 *
 * A wizard step with eight bare inputs reads as a wall; grouping them under a
 * heading and a line of context turns it into two or three small decisions.
 */
function FieldGroup({ title, hint, children }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="text-lg font-semibold text-fg" aria-hidden="true">
          {title}
        </p>
        {hint && <p className="mt-1 text-sm text-fg-muted">{hint}</p>}
      </div>
      {children}
    </fieldset>
  )
}

/**
 * Breed, chosen from the suggested breeds of the species (Correction 3).
 *
 * "Not sure" leaves it empty, which is what a finder usually has to say.
 * "Mixed breed" is one of the listed breeds. A breed that is not listed can
 * still be typed: it is kept on this report, but it is never added to the
 * list anybody else sees (pet_breeds.is_listed).
 */
function BreedField({ species, value, onChange }) {
  const loadBreeds = useCallback(() => referenceService.getBreeds(species), [species])
  const { data: breeds } = useAsync(loadBreeds)
  const listed = (breeds ?? []).map((breed) => breed.name)
  // Typing is a mode the reporter chose, or the only way to show a breed
  // that is not on the list (a report filed before the list existed).
  const [isTyping, setIsTyping] = useState(false)
  const showsTyped = isTyping || (Boolean(value) && breeds !== null && !listed.includes(value))

  return (
    <div className="flex flex-col gap-3">
      <Select
        label={t('reportForm.details.breed')}
        value={showsTyped ? TYPED_BREED : value}
        onChange={(event) => {
          const next = event.target.value
          setIsTyping(next === TYPED_BREED)
          onChange(next === TYPED_BREED ? '' : next)
        }}
        disabled={!species}
        hint={species ? t('reportForm.details.breedHint') : t('reportForm.details.speciesFirst')}
        options={[
          { value: '', label: t('common.notSure') },
          ...listed.map((name) => ({ value: name, label: name })),
          { value: TYPED_BREED, label: t('reportForm.details.notListed') },
        ]}
      />
      {showsTyped && (
        <Input
          label={t('reportForm.details.typeBreed')}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={LIMITS.breed}
          placeholder={t('reportForm.details.typeBreedPlaceholder')}
          hint={t('reportForm.details.typeBreedHint')}
        />
      )}
    </div>
  )
}
