/**
 * The lists the report form and Explore choose from: colours, breeds,
 * provinces and cities (Correction 3).
 *
 * All of them come from MySQL through `/api/reference`. None is typed into
 * the browser's code: the place list is the Philippine Standard Geographic
 * Code, and changing any list is a database change, not a redeploy.
 *
 * Each list is fetched once per page load and remembered, because the same
 * one is asked for by the form, the filters and the review step, and it does
 * not change while somebody is filling in a report. A failed request is
 * forgotten, so the next ask tries again.
 */

import { apiFetch } from './api'

const remembered = new Map()

function once(path, shape) {
  if (!remembered.has(path)) {
    const request = apiFetch(path)
      .then((payload) => payload.data.map(shape))
      .catch((error) => {
        remembered.delete(path)
        throw error
      })
    remembered.set(path, request)
  }
  return remembered.get(path)
}

/** `[{ code: 'black', name: 'Black' }, …]`, in display order, "Other" last. */
export function getColours() {
  return once('/reference/colours', (row) => ({ code: row.code, name: row.name }))
}

/** The suggested breeds of one species, "Mixed breed" last. */
export function getBreeds(species) {
  if (!species) return Promise.resolve([])
  return once(`/reference/breeds?species=${encodeURIComponent(species)}`, (row) => ({
    id: row.breed_id,
    name: row.name,
  }))
}

/**
 * The 84 areas the form's first list offers, as `{ code, name, type }`:
 * PSA's 82 provinces (`type: 'province'`), Metro Manila (`'ncr'` — a region,
 * not a province) and BARMM's Special Geographic Area (`'special_area'`).
 */
export function getAreas() {
  return once('/reference/areas', (row) => ({ code: row.code, name: row.name, type: row.type }))
}

/** The cities and municipalities of one area, as `{ code, name, isCity }`. */
export function getCities(areaCode) {
  if (!areaCode) return Promise.resolve([])
  return once(`/reference/cities?area=${encodeURIComponent(areaCode)}`, (row) => ({
    code: row.code,
    name: row.name,
    isCity: row.is_city,
  }))
}
