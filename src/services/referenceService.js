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

/** Every province, plus Metro Manila, as `{ code, name }`. */
export function getProvinces() {
  return once('/reference/provinces', (row) => ({ code: row.code, name: row.name }))
}

/** The cities and municipalities of one province, as `{ code, name, isCity }`. */
export function getCities(provinceCode) {
  if (!provinceCode) return Promise.resolve([])
  return once(`/reference/cities?province=${encodeURIComponent(provinceCode)}`, (row) => ({
    code: row.code,
    name: row.name,
    isCity: row.is_city,
  }))
}
