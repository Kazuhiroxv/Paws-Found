import { PET_SEXES, REPORT_TYPES } from '@/constants'
import { parseDateTime, todayAsInputValue } from '@/utils/date'

/**
 * The shape, limits and rules of a lost/found report form.
 *
 * Kept as plain functions with no React in them, so the rules can be read (and
 * argued about) in one place instead of being scattered through JSX.
 */

/** Maximum characters per field. Also applied as `maxLength` on the inputs. */
export const LIMITS = {
  petName: 40,
  breed: 60,
  primaryColor: 30,
  secondaryColor: 30,
  distinctiveMarkings: 300,
  description: 1000,
  locationLabel: 120,
  city: 60,
  province: 60,
  condition: 300,
  photoAlt: 120,
}

/** Photo upload rules. Nothing is uploaded anywhere yet — see PhotosStep. */
export const PHOTO_RULES = {
  maxCount: 5,
  maxBytes: 5 * 1024 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  accept: 'image/jpeg,image/png,image/webp',
}

export const STEPS = [
  { id: 'details', label: 'Pet details' },
  { id: 'incident', label: 'Location & date' },
  { id: 'photos', label: 'Photos' },
  { id: 'review', label: 'Review' },
]

/**
 * A blank form. Found reports have no pet name — the finder does not know it —
 * so that field is simply absent from their flow.
 *
 * @param {'lost'|'found'} reportType
 */
export function createEmptyValues(reportType) {
  return {
    reportType,
    petName: '',
    species: '',
    breed: '',
    sex: '',
    size: '',
    primaryColor: '',
    secondaryColor: '',
    distinctiveMarkings: '',
    description: '',
    incidentDate: '',
    incidentTime: '',
    locationLabel: '',
    city: '',
    province: '',
    // Optional map pin. Null until the reporter places one.
    lat: null,
    lng: null,
    condition: '',
    // Unanswered until the finder answers. "Not sure" is a real answer, so it
    // must be chosen, not assumed: preselecting it meant a finder who skipped
    // the question was recorded as having looked and not known.
    hasCollar: '',
    photos: [],
    allowPlatformContact: true,
    showPhone: false,
    showEmail: false,
  }
}

/**
 * Fill the form from an existing report, for editing.
 *
 * The inverse of `toReportInput()` below — if you add a field to one, add it to
 * the other, or edits will silently drop it.
 *
 * @param {Object} report
 */
export function valuesFromReport(report) {
  return {
    reportType: report.reportType,
    petName: report.petName ?? '',
    species: report.species,
    breed: report.breed,
    sex: report.sex,
    size: report.size,
    primaryColor: report.primaryColor,
    secondaryColor: report.secondaryColor,
    distinctiveMarkings: report.distinctiveMarkings,
    description: report.description,
    incidentDate: report.incidentDate,
    incidentTime: report.incidentTime,
    locationLabel: report.location.label,
    city: report.location.city,
    province: report.location.province,
    lat: report.location.lat,
    lng: report.location.lng,
    condition: report.condition,
    hasCollar: report.hasCollar ?? 'unknown',
    photos: report.photos.map((photo) => ({ ...photo })),
    allowPlatformContact: report.contactPreferences.allowPlatformContact,
    showPhone: report.contactPreferences.showPhone,
    showEmail: report.contactPreferences.showEmail,
  }
}

const required = (value) => !String(value ?? '').trim()

/** The species code for the catch-all category, and the collar answers. */
export const OTHER_SPECIES = 'other'
const COLLAR_ANSWERS = ['yes', 'no', 'unknown']
const SEX_ANSWERS = [PET_SEXES.MALE, PET_SEXES.FEMALE, PET_SEXES.UNKNOWN]

/**
 * Validate one step. Returns `{ field: message }` — empty means the step passes.
 *
 * Validating per step rather than all at once is what lets someone move forward
 * without being shouted at about fields they have not reached yet.
 *
 * @param {string} stepId
 * @param {Object} values
 * @returns {Record<string, string>}
 */
export function validateStep(stepId, values) {
  const errors = {}
  const isFound = values.reportType === REPORT_TYPES.FOUND

  if (stepId === 'details') {
    if (!isFound && required(values.petName)) {
      errors.petName = "Enter your pet's name, so people know what to call out."
    }
    if (required(values.species)) errors.species = 'Choose the kind of animal.'
    // "Other" names no animal, so the breed field becomes "Please specify
    // animal" and is required: the report has to say what it is about.
    if (values.species === OTHER_SPECIES && required(values.breed)) {
      errors.breed = 'Tell us what kind of animal this is.'
    }
    if (isFound && !COLLAR_ANSWERS.includes(values.hasCollar)) {
      errors.hasCollar = 'Choose Yes, No, or Not sure.'
    }
    if (required(values.size)) errors.size = 'Choose a size.'
    if (!SEX_ANSWERS.includes(values.sex)) errors.sex = 'Choose Male, Female, or Unknown.'
    if (required(values.primaryColor)) {
      errors.primaryColor = 'Enter the main colour — it is one of the first things people notice.'
    }

    // "At least one useful characteristic": colour alone matches hundreds of
    // animals, so a report needs a breed or a distinguishing feature too.
    if (required(values.breed) && required(values.distinctiveMarkings)) {
      errors.distinctiveMarkings =
        'Add a breed or at least one distinctive feature — a scar, a collar, an unusual marking. Colour on its own is rarely enough to identify a pet.'
    }
  }

  if (stepId === 'incident') {
    if (required(values.incidentDate)) {
      errors.incidentDate = isFound ? 'Enter the date you found the pet.' : 'Enter the date your pet went missing.'
    } else {
      const date = parseDateTime(values.incidentDate)
      if (Number.isNaN(date.getTime())) {
        errors.incidentDate = 'Enter a valid date.'
      } else if (values.incidentDate > todayAsInputValue()) {
        // Calendar day against calendar day, the same "today" as the date
        // input's own max. Read as a moment it was UTC midnight, 8 AM in the
        // Philippines, so a report dated today was refused every morning.
        errors.incidentDate = 'The date cannot be in the future.'
      }
    }

    if (required(values.locationLabel)) {
      errors.locationLabel = isFound
        ? 'Describe where you found the pet.'
        : 'Describe where your pet was last seen.'
    }
    if (required(values.city)) errors.city = 'Enter the city or municipality.'
    // A report nobody can answer helps nobody. Any one way will do; which is
    // the reporter's choice.
    if (!values.allowPlatformContact && !values.showPhone && !values.showEmail) {
      errors.contact = 'Choose at least one way people or Pet Coordinators can reach you.'
    }
    if (required(values.province)) errors.province = 'Enter the province.'

    if (required(values.description)) {
      errors.description = 'Add a short description — behaviour, temperament, anything that helps.'
    }
  }

  // The photos step has no required fields: a finder may have had no chance to
  // take a photo, and blocking them would lose the report entirely. Per-file
  // problems are reported as the files are chosen.

  return errors
}

/**
 * Turn form values into the shape `petService.createReport()` expects.
 *
 * Location precision is always "approximate" — a public report must never
 * point at someone's address (CLAUDE.md §14).
 *
 * @param {Object} values
 * @param {string} reporterId
 */
export function toReportInput(values, reporterId) {
  const isFound = values.reportType === REPORT_TYPES.FOUND

  return {
    reportType: values.reportType,
    petName: isFound ? null : values.petName.trim(),
    species: values.species,
    breed: values.breed.trim(),
    sex: values.sex,
    size: values.size,
    primaryColor: values.primaryColor.trim(),
    secondaryColor: values.secondaryColor.trim(),
    distinctiveMarkings: values.distinctiveMarkings.trim(),
    description: values.description.trim(),
    incidentDate: values.incidentDate,
    incidentTime: values.incidentTime,
    location: {
      label: values.locationLabel.trim(),
      city: values.city.trim(),
      province: values.province.trim(),
      lat: values.lat,
      lng: values.lng,
      // Always approximate: reporters are asked for an area, never an address.
      precision: 'approximate',
    },
    condition: isFound ? values.condition.trim() : '',
    // The select already holds 'yes' | 'no' | 'unknown', which is exactly what
    // the API validates and the column stores. It is passed through untouched:
    // this field used to be translated into a boolean for the mock data layer,
    // which meant 'yes' arrived as true and was refused with a 422, and 'no'
    // arrived as false, became null, and was stored as 'unknown' without any
    // error at all. A lost report is never asked the question, so it sends the
    // column's own default rather than null.
    hasCollar: isFound ? values.hasCollar : 'unknown',
    photos: values.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      alt: photo.alt.trim() || defaultPhotoAlt(values),
      isPrimary: photo.isPrimary,
    })),
    reporterId,
    contactPreferences: {
      allowPlatformContact: values.allowPlatformContact,
      showPhone: values.showPhone,
      showEmail: values.showEmail,
    },
  }
}

/** Fallback alt text when the reporter did not describe a photo. */
export function defaultPhotoAlt(values) {
  const parts = [values.primaryColor, values.breed || values.species].filter(Boolean)
  return parts.length > 0 ? `Photo of a ${parts.join(' ')}` : 'Photo of the reported pet'
}
