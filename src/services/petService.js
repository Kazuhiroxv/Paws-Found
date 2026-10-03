/**
 * Pet report data access.
 *
 * This is the only way the UI reads or writes lost/found reports — components
 * never import from `src/mock/`. These call the PHP API; the boundary is why
 * moving off mock data changed nothing above it (CLAUDE.md §9).
 */

import { REPORT_STATUSES, REPORT_TYPES } from '@/constants'
import { NotFoundError } from './errors'
import { apiFetch, assetUrl, queryString } from './api'

/**
 * Turn an API report into the shape the components already use.
 *
 * The mapping lives here, in the service, which is the whole point of the
 * boundary: the API speaks snake_case with integer ids, the components keep
 * reading `report.petName` and `report.photos[0].url`, and neither has to know
 * about the other (CLAUDE.md §9).
 */
function fromApi(row) {
  return {
    id: row.report_id,
    reportType: row.report_type,
    status: row.status,
    petName: row.pet_name,
    species: row.species,
    breed: row.breed ?? '',
    sex: row.sex,
    size: row.size,
    primaryColor: row.primary_color ?? '',
    secondaryColor: row.secondary_color ?? '',
    distinctiveMarkings: row.distinct_features ?? '',
    description: row.description ?? '',
    incidentDate: row.incident_date,
    // MySQL returns TIME as 'HH:MM:SS'; the interface shows 'HH:MM'.
    incidentTime: row.incident_time ? row.incident_time.slice(0, 5) : '',
    condition: row.condition ?? '',
    hasCollar: row.has_collar ?? 'unknown',
    location: {
      label: row.location?.label ?? '',
      city: row.location?.city ?? '',
      province: row.location?.province ?? '',
      // The PSGC codes the place was chosen by (Correction 3). Empty for a
      // report filed before the place lists whose place was not identified.
      cityCode: row.location?.city_code ?? '',
      areaCode: row.location?.area_code ?? '',
      lat: row.location?.lat ?? null,
      lng: row.location?.lng ?? null,
      precision: 'approximate',
    },
    reporterId: row.reporter?.user_id ?? row.reporter_id ?? null,
    reporter: row.reporter ?? null,
    // The authoritative preference when the API gives it to us, which it does
    // for whoever may edit the report. Never inferred from whether a phone
    // number happened to come back: the number is optional, so an account
    // without one made `show_phone = 1` look like `false`, and an untouched
    // edit then saved that. Masked value and stored preference are two
    // different things.
    //
    // The fallback is for the public payload, which deliberately carries no
    // preferences. Nothing reads it in an edit context.
    //
    // No phone preference: a phone number is never shown on a report
    // (Correction 3), and the server ignores the old setting.
    contactPreferences: {
      allowPlatformContact:
        row.contact_preferences?.allow_platform_contact ??
        row.reporter?.accepts_messages ??
        true,
      showEmail: row.contact_preferences?.show_email ?? Boolean(row.reporter?.email),
    },
    photos: row.photos
      ? row.photos.map((photo) => ({
          id: `photo-${photo.image_id}`,
          // The server's id, so an edit can say which stored photo it means.
          imageId: photo.image_id,
          url: assetUrl(photo.path),
          alt: photo.alt,
          isPrimary: photo.is_primary,
        }))
      : // The list endpoint sends only the primary photo's filename.
        row.primary_image
        ? [
            {
              id: `photo-${row.report_id}`,
              url: assetUrl(row.primary_image),
              alt: row.primary_image_alt ?? '',
              isPrimary: true,
            },
          ]
        : [],
    statusHistory: (row.history ?? []).map((entry) => ({
      id: `log-${entry.log_id}`,
      status: entry.new_status,
      note: entry.note ?? '',
      createdAt: entry.created_at,
      actorId: entry.actor_name ?? null,
      actorName: entry.actor_name ?? null,
    })),
    updatedAt: row.updated_at,
  }
}

/**
 * List one page of reports, newest first, with the paging figures.
 *
 *
 * Every filter is optional, and they combine with AND. Keep it that way — a
 * caller that passes nothing must still get everything.
 *
 * `query` accepts:
 *   text        free text across name, breed, colours, markings, description, place
 *   reportType  'lost' | 'found'
 *   status      one of REPORT_STATUSES
 *   species     one of SPECIES
 *   size        one of PET_SIZES
 *   color       a listed colour (exact), matched against either colour field
 *   areaCode  PSGC code of a province (or Metro Manila)
 *   cityCode    PSGC code of a city or municipality
 *   city        substring of the city's name, for links that name one
 *   dateFrom    incident on or after this ISO date
 *   dateTo      incident on or before this ISO date
 *   reporterId  reports filed by one user
 *   sort        'newest' (default) | 'oldest'
 *   page        which page to return, 1-based
 *   perPage     rows per page (the API caps this at 50)
 *   limit       cap the number returned, for callers that want a short list
 */
export async function getReportsPage(query = {}) {
  const search = queryString({
    q: query.text,
    type: query.reportType,
    status: query.status,
    species: query.species,
    size: query.size,
    city: query.city,
    area_code: query.areaCode,
    city_code: query.cityCode,
    colour: query.color,
    date_from: query.dateFrom,
    date_to: query.dateTo,
    reporter_id: query.reporterId,
    sort: query.sort === 'oldest' ? 'oldest' : 'newest',
    page: query.page,
    // The pages that use `limit` want a short list, not a page of results.
    per_page: query.perPage ?? query.limit ?? 50,
  })

  const payload = await apiFetch(`/reports${search}`)

  return {
    reports: payload.data.map(fromApi),
    page: payload.meta.page,
    perPage: payload.meta.per_page,
    total: payload.meta.total,
    totalPages: payload.meta.total_pages,
  }
}

/**
 * The same list without the paging figures, for the callers that want "the
 * reports" and nothing else. Implemented on top of `getReportsPage` so there is
 * only ever one place that builds the query and maps the rows.
 */
export async function getReports(query = {}) {
  const { reports } = await getReportsPage(query)
  return reports
}

export async function getReportById(id) {
  try {
    const payload = await apiFetch(`/reports/${id}`)
    return fromApi(payload.data)
  } catch (error) {
    // Only a 404 means the report is not there. Everything else — the server
    // failing, the network dropping — is a different thing entirely, and
    // telling somebody whose pet is missing that their report "does not
    // exist" because the server is down is both wrong and alarming.
    if (error.status === 404) throw new NotFoundError(error.message)
    throw error
  }
}

export async function getReportsByUser(userId) {
  return getReports({ reporterId: userId })
}

/**
 * The most recent OPEN reports, for the homepage.
 *
 * Closed and returned cases are left out on purpose: a closed report is either
 * finished or was removed by an administrator, and neither belongs on a public
 * "recently reported" list where people are actively searching.
 */
export async function getRecentReports(limit = 6) {
  const open = [REPORT_STATUSES.ACTIVE, REPORT_STATUSES.POSSIBLE_MATCH]
  const rows = await getReports()

  return rows.filter((report) => open.includes(report.status)).slice(0, limit)
}

/**
 * Create a report. The id, timestamps and opening status entry are generated
 * here for now; the real backend will generate them instead.
 */
export async function createReport(input) {
  const payload = await apiFetch('/reports', {
    method: 'POST',
    body: JSON.stringify({
      report_type: input.reportType,
      species: input.species,
      breed: input.breed,
      // A found report has no pet name: the finder does not know it. The API
      // enforces the same rule, so this is convenience rather than control.
      pet_name: input.reportType === REPORT_TYPES.FOUND ? null : input.petName,
      size: input.size,
      sex: input.sex,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
      distinct_features: input.distinctiveMarkings,
      description: input.description,
      has_collar: input.hasCollar,
      condition: input.condition,
      incident_date: input.incidentDate,
      incident_time: input.incidentTime,
      location_label: input.location?.label,
      // The place by PSGC code; the server writes the names from its list.
      area_code: input.location?.areaCode,
      city_code: input.location?.cityCode,
      lat: input.location?.lat,
      lng: input.location?.lng,
      allow_platform_contact: input.contactPreferences?.allowPlatformContact ?? true,
      show_email: input.contactPreferences?.showEmail ?? false,
    }),
  })

  return fromApi(payload.data)
}

/**
 * Attach photographs to a report that already exists.
 *
 * Separate from createReport() because the two send different things: the
 * report is JSON, the photographs are files. They also need the report's id,
 * which does not exist until the report has been created.
 *
 * Entries without a file are skipped — an edited report carries photographs it
 * already had, and those are on the server, not in the browser.
 */
export async function uploadReportPhotos(reportId, photos = []) {
  const pending = photos.filter((photo) => photo.file)
  if (pending.length === 0) return []

  const form = new FormData()
  for (const photo of pending) {
    form.append('photos[]', photo.file)
    // Sent in step with the files, so the server can pair them up.
    form.append('alt[]', photo.alt ?? '')
  }

  const payload = await apiFetch(`/reports/${reportId}/photos`, {
    method: 'POST',
    body: form,
  })

  return payload.data
}

/**
 * Save an edited report: every field the edit form shows, in the same shape
 * createReport() sends (minus report_type, which cannot change). It used to
 * send seven of them, and the rest of an edit was silently dropped.
 */
export async function updateReport(id, input) {
  const payload = await apiFetch(`/reports/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      species: input.species,
      breed: input.breed,
      pet_name: input.reportType === REPORT_TYPES.FOUND ? null : input.petName,
      size: input.size,
      sex: input.sex,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
      distinct_features: input.distinctiveMarkings,
      description: input.description,
      has_collar: input.hasCollar,
      condition: input.condition,
      incident_date: input.incidentDate,
      incident_time: input.incidentTime,
      location_label: input.location?.label,
      // The place by PSGC code; the server writes the names from its list.
      area_code: input.location?.areaCode,
      city_code: input.location?.cityCode,
      lat: input.location?.lat,
      lng: input.location?.lng,
      allow_platform_contact: input.contactPreferences?.allowPlatformContact,
      show_email: input.contactPreferences?.showEmail,
    }),
  })

  return fromApi(payload.data)
}

/** Remove stored photos, choose the main one, rewrite descriptions. */
async function editReportPhotos(reportId, changes) {
  const payload = await apiFetch(`/reports/${reportId}/photos`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
  return payload.data
}

/**
 * Save the photo side of an edit, as the difference between the photos the
 * report had (`before`) and the ones the form now holds (`after`).
 *
 *   1. removals, description changes and a stored photo chosen as main
 *   2. new files, uploaded through the same endpoint as filing uses
 *   3. if the main photo is one of the new files, point at it now it has an id
 *
 * Removals go first so a slot freed by one can take a new file under the
 * five-photo limit. Each step says which part failed, so an owner is never
 * told everything saved when only the details did.
 */
export async function saveEditedPhotos(reportId, before, after) {
  const kept = after.filter((photo) => photo.imageId)
  const keptIds = new Set(kept.map((photo) => photo.imageId))
  const remove = before.filter((photo) => !keptIds.has(photo.imageId)).map((photo) => photo.imageId)

  const alt = {}
  for (const photo of kept) {
    const original = before.find((item) => item.imageId === photo.imageId)
    if ((original?.alt ?? '') !== (photo.alt ?? '')) alt[photo.imageId] = photo.alt ?? ''
  }

  const chosen = after.find((photo) => photo.isPrimary)
  const wasPrimary = before.find((photo) => photo.isPrimary)
  const primary =
    chosen?.imageId && chosen.imageId !== wasPrimary?.imageId ? chosen.imageId : null

  if (remove.length > 0 || Object.keys(alt).length > 0 || primary !== null) {
    try {
      await editReportPhotos(reportId, { remove, alt, primary })
    } catch (error) {
      throw new Error(`Your details were saved, but the photo changes were not: ${error.message}`, { cause: error })
    }
  }

  const fresh = after.filter((photo) => photo.file)
  if (fresh.length === 0) return

  let stored
  try {
    stored = await uploadReportPhotos(reportId, fresh)
  } catch (error) {
    throw new Error(`Your details were saved, but the new photos did not upload: ${error.message}`, { cause: error })
  }

  if (chosen?.file) {
    // The new rows are the ids the report did not have before, in upload order.
    const added = stored
      .filter((photo) => !keptIds.has(photo.image_id))
      .sort((a, b) => a.image_id - b.image_id)
    const target = added[fresh.indexOf(chosen)]
    if (target && !target.is_primary) {
      try {
        await editReportPhotos(reportId, { primary: target.image_id })
      } catch (error) {
        throw new Error(`The new photos uploaded, but the main photo was not changed: ${error.message}`, { cause: error })
      }
    }
  }
}

export async function updateReportStatus(id, status, context = {}) {
  const payload = await apiFetch(`/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note: context.note ?? null }),
  })

  return fromApi(payload.data)
}

/**
 * Recent changes across the signed-in account's reports, newest first.
 *
 * The dashboard's activity feed used to be assembled in the browser from each
 * report's history. The list endpoint does not carry history — deliberately, so
 * a page of results stays small — so the feed came out empty. This asks the
 * server for exactly the feed instead.
 */
/**
 * The figures the staff and administrator dashboards report on.
 *
 * Counted by the database, not here. `getReports()` is paginated, so totalling
 * its rows in the browser would report on one page rather than on the table.
 *
 * Coordinators and administrators only; the API refuses anyone else.
 */
export async function getReportStats() {
  const payload = await apiFetch('/reports/stats')

  return {
    totals: payload.data.totals,
    monthly: payload.data.monthly,
    bySpecies: payload.data.by_species,
  }
}

export async function getRecentActivity(limit = 6) {
  const payload = await apiFetch(`/reports/activity${queryString({ limit })}`)

  return payload.data.map((row) => ({
    id: row.log_id,
    reportId: row.report_id,
    reportLabel: row.report_label,
    reportType: row.report_type,
    previousStatus: row.previous_status,
    status: row.status,
    note: row.note ?? '',
    actorName: row.actor_name,
    createdAt: row.created_at,
  }))
}
