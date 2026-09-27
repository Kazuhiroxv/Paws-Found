import { Input, Select, Textarea } from '@/components/ui'
import { PET_SEX_LABELS, PET_SIZE_LABELS, REPORT_TYPES } from '@/constants'
import { optionsFromLabels } from '@/utils/options'
import { LIMITS, OTHER_SPECIES } from './reportFormModel'

/**
 * Step 1 — what the animal looks like.
 *
 * Shared by both report types. A found report drops the pet name and asks for
 * a collar and condition instead, because that is what a finder can actually
 * observe.
 */
export function PetDetailsStep({ values, errors, onChange, speciesOptions = [] }) {
  const isFound = values.reportType === REPORT_TYPES.FOUND

  return (
    <div className="flex flex-col gap-8">
      {!isFound && (
        <Input
          label="Pet name"
          required
          value={values.petName}
          onChange={(event) => onChange('petName', event.target.value)}
          error={errors.petName}
          maxLength={LIMITS.petName}
          placeholder="e.g. Milo"
          hint="What you call out when looking for them."
        />
      )}

      <FieldGroup
        title="What kind of animal"
        hint="Species and size are the first things the system compares, so get these right even if you have to guess the breed."
      >
      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Species"
          required
          value={values.species}
          onChange={(event) => {
            const next = event.target.value
            // Switching into or out of "Other" changes what the next field
            // means, so its value goes: "Turtle" is not a dog's breed, and a
            // dog's breed is not an animal.
            if ((values.species === OTHER_SPECIES) !== (next === OTHER_SPECIES)) onChange('breed', '')
            onChange('species', next)
          }}
          error={errors.species}
          placeholder="Choose one"
          options={speciesOptions}
        />

        {/* The same `breed` value either way; for "Other" it names the animal
            (the API stores it under the Other category just like a breed). */}
        {values.species === OTHER_SPECIES ? (
          <Input
            label="Please specify animal"
            required
            value={values.breed}
            onChange={(event) => onChange('breed', event.target.value)}
            maxLength={LIMITS.breed}
            placeholder="e.g. Rabbit, Parrot, Turtle"
            error={errors.breed}
          />
        ) : (
          <Input
            label="Breed"
            value={values.breed}
            onChange={(event) => onChange('breed', event.target.value)}
            maxLength={LIMITS.breed}
            placeholder="e.g. Shih Tzu, Aspin, Puspin"
            hint="An honest guess is fine."
          />
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Size"
          required
          value={values.size}
          onChange={(event) => onChange('size', event.target.value)}
          error={errors.size}
          placeholder="Choose one"
          options={optionsFromLabels(PET_SIZE_LABELS)}
        />

        <Select
          label="Sex"
          value={values.sex}
          onChange={(event) => onChange('sex', event.target.value)}
          options={optionsFromLabels(PET_SEX_LABELS)}
        />
      </div>
      </FieldGroup>

      <FieldGroup
        title="How they look"
        hint="Colour plus one distinguishing feature is usually enough to tell a pet apart from every other pet of the same breed."
      >

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Main colour"
          required
          value={values.primaryColor}
          onChange={(event) => onChange('primaryColor', event.target.value)}
          error={errors.primaryColor}
          maxLength={LIMITS.primaryColor}
          placeholder="e.g. Brown"
        />

        <Input
          label="Other colour"
          value={values.secondaryColor}
          onChange={(event) => onChange('secondaryColor', event.target.value)}
          maxLength={LIMITS.secondaryColor}
          placeholder="e.g. White"
        />
      </div>

      <Textarea
        label="Distinctive features"
        value={values.distinctiveMarkings}
        onChange={(event) => onChange('distinctiveMarkings', event.target.value)}
        error={errors.distinctiveMarkings}
        maxLength={LIMITS.distinctiveMarkings}
        rows={3}
        placeholder="e.g. White patch on the chest, one ear does not stand up, red collar with a bell."
        hint="The details that tell this pet apart from every other pet of the same colour."
      />
      </FieldGroup>

      {isFound && (
        <FieldGroup title="When you found them" hint="Anything you could observe on the spot.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Was it wearing a collar?"
            required
            value={values.hasCollar}
            onChange={(event) => onChange('hasCollar', event.target.value)}
            placeholder="Choose one"
            error={errors.hasCollar}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'unknown', label: 'Not sure' },
            ]}
          />

          <Input
            label="Condition"
            value={values.condition}
            onChange={(event) => onChange('condition', event.target.value)}
            maxLength={LIMITS.condition}
            placeholder="e.g. Alert, no visible injuries"
            hint="How the pet seemed when you found it."
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
