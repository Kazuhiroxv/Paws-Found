import { PET_SEXES, REPORT_TYPES } from '@/constants'
import { parseDateTime, todayAsInputValue } from '@/utils/date'
import { t } from '@/i18n'

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
  condition: 300,
  photoAlt: 120,
}

/** A lost pet's name needs at least this many letters or digits: "Bo", "R2". */
export const PET_NAME_MIN = 2

/** A description needs at least this many characters, spaces in a row counted once. */
export const DESCRIPTION_MIN = 30

/**
 * Photo rules — the same numbers the server enforces (PHOTO_MAX_PER_REPORT,
 * PHOTO_MAX_BYTES and PHOTO_TYPES in api/reports.php). There is no minimum:
 * a finder may have had no chance to take one.
 */
export const PHOTO_RULES = {
  maxCount: 5,
  maxBytes: 5 * 1024 * 1024,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  accept: 'image/jpeg,image/png,image/webp',
}

// Each label is read when shown, in the language showing (Correction 7).
export const STEPS = ['details', 'incident', 'photos', 'review'].map((id) => ({
  id,
  get label() {
    return t(`reportForm.steps.${id}`)
  },
}))

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
    // 24-hour "HH:MM", what the API stores; the form shows it with AM/PM.
    incidentTime: '',
    // True while an hour, minutes or AM/PM is chosen but not all three.
    incidentTimeIncomplete: false,
    locationLabel: '',
    // Chosen from the PSGC lists by code; the names are kept beside them for
    // the review step (Correction 3).
    areaCode: '',
    province: '',
    cityCode: '',
    city: '',
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
    incidentTimeIncomplete: false,
    locationLabel: report.location.label,
    // A report filed before the place lists has no codes, so its place has
    // to be chosen again before it can be saved.
    areaCode: report.location.areaCode ?? '',
    province: report.location.areaCode ? report.location.province : '',
    cityCode: report.location.cityCode ?? '',
    city: report.location.cityCode ? report.location.city : '',
    lat: report.location.lat,
    lng: report.location.lng,
    condition: report.condition,
    hasCollar: report.hasCollar ?? 'unknown',
    photos: report.photos.map((photo) => ({ ...photo })),
    allowPlatformContact: report.contactPreferences.allowPlatformContact,
    showEmail: report.contactPreferences.showEmail,
  }
}

const required = (value) => !String(value ?? '').trim()

/** Trimmed, with every run of spaces, tabs or line breaks counted as one space. */
export function meaningfulText(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim()
}

/**
 * What is wrong with a pet's name, or null.
 *
 * At least two letters or digits ("Bo", "CJ", "R2"), and nothing but letters,
 * digits, spaces, apostrophes, periods and hyphens ("Mi-Mi", "Mr. Bean").
 * The same rule as pet_name_problem() in api/reports.php; both are held to
 * scripts/report-rules-cases.json.
 *
 * @param {string} value
 * @param {boolean} isRequired  True for a lost report.
 */
export function petNameProblem(value, isRequired) {
  const name = meaningfulText(value)
  if (!name) return isRequired ? t('reportForm.errors.petName') : null
  if (!/^[\p{L}\p{M}\p{N} '\u2019.-]+$/u.test(name)) {
    return t('reportForm.errors.petNameCharacters')
  }
  if ((name.match(/[\p{L}\p{N}]/gu) ?? []).length < PET_NAME_MIN) {
    return t('reportForm.errors.petNameShort')
  }
  return null
}

/** How long a description is, the way the minimum counts it. */
export function descriptionLength(value) {
  return [...meaningfulText(value)].length
}

/** What is wrong with a description, or null. The same rule as the server's. */
export function descriptionProblem(value) {
  const length = descriptionLength(value)
  if (length === 0) return t('reportForm.errors.description')
  if (length < DESCRIPTION_MIN) {
    return t('reportForm.errors.descriptionShort', { min: DESCRIPTION_MIN, length })
  }
  return null
}

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
    const nameProblem = petNameProblem(values.petName, !isFound)
    if (!isFound && nameProblem) errors.petName = nameProblem
    if (required(values.species)) errors.species = t('reportForm.errors.species')
    // "Other" names no animal, so the breed field becomes "Please specify
    // animal" and is required: the report has to say what it is about.
    if (values.species === OTHER_SPECIES && required(values.breed)) {
      errors.breed = t('reportForm.errors.otherKind')
    }
    if (isFound && !COLLAR_ANSWERS.includes(values.hasCollar)) {
      errors.hasCollar = t('reportForm.errors.collar')
    }
    if (required(values.size)) errors.size = t('reportForm.errors.size')
    if (!SEX_ANSWERS.includes(values.sex)) errors.sex = t('reportForm.errors.sex')
    if (required(values.primaryColor)) {
      errors.primaryColor = t('reportForm.errors.colour')
    }

    // "At least one useful characteristic": colour alone matches hundreds of
    // animals, so a report needs a breed or a distinguishing feature too.
    if (required(values.breed) && required(values.distinctiveMarkings)) {
      errors.distinctiveMarkings =
        t('reportForm.errors.identify')
    }
  }

  if (stepId === 'incident') {
    if (required(values.incidentDate)) {
      errors.incidentDate = isFound ? t('reportForm.errors.dateFound') : t('reportForm.errors.dateLost')
    } else {
      const date = parseDateTime(values.incidentDate)
      if (Number.isNaN(date.getTime())) {
        errors.incidentDate = t('reportForm.errors.dateInvalid')
      } else if (values.incidentDate > todayAsInputValue()) {
        // Calendar day against calendar day, the same "today" as the date
        // input's own max. Read as a moment it was UTC midnight, 8 AM in the
        // Philippines, so a report dated today was refused every morning.
        errors.incidentDate = t('reportForm.errors.dateFuture')
      }
    }

    if (values.incidentTimeIncomplete) {
      errors.incidentTime = t('reportForm.errors.time')
    }

    if (required(values.locationLabel)) {
      errors.locationLabel = isFound
        ? t('reportForm.errors.placeFound')
        : t('reportForm.errors.placeLost')
    }
    if (required(values.areaCode)) errors.province = t('reportForm.errors.area')
    if (required(values.cityCode)) errors.city = t('reportForm.errors.city')

    const problem = descriptionProblem(values.description)
    if (problem) errors.description = problem

    // A report nobody can answer helps nobody. Either way will do; which is
    // the reporter's choice. A phone number is never shown on a report
    // (Correction 3), so it is not one of them.
    if (!values.allowPlatformContact && !values.showEmail) {
      errors.contact = t('reportForm.errors.contact')
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
    petName: isFound ? null : meaningfulText(values.petName),
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
      areaCode: values.areaCode,
      cityCode: values.cityCode,
      city: values.city,
      province: values.province,
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
      showEmail: values.showEmail,
    },
  }
}

/**
 * Fallback alt text when the reporter did not describe a photo. Stored with
 * the photograph, so it stays in English whatever the language showing: what
 * is saved does not depend on who saved it (Correction 7).
 */
export function defaultPhotoAlt(values) {
  const parts = [values.primaryColor, values.breed || values.species].filter(Boolean)
  return parts.length > 0 ? `Photo of a ${parts.join(' ')}` : 'Photo of the reported pet'
}
