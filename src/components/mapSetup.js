import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { REPORT_STATUSES, REPORT_TYPES } from '@/constants'

/**
 * Shared Leaflet configuration.
 *
 * Markers are `divIcon`s built from HTML rather than Leaflet's default PNG
 * pins. Two reasons: the defaults break under a bundler because Leaflet
 * resolves their image paths at runtime, and building them ourselves lets the
 * colours come from the design tokens — so LOST stays amber and FOUND stays
 * teal without a second copy of the palette (docs/design-system.md).
 */

/** OpenStreetMap requires this attribution to be displayed. */
export const TILE_LAYER = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
}

/** Roughly the centre of the Philippines, for when there is nothing to show. */
export const FALLBACK_CENTER = [12.8797, 121.774]
export const FALLBACK_ZOOM = 5

/**
 * Where a pin may go: the Philippines as a box (Correction 3). South to
 * Saluag, Tawi-Tawi (4.6°), north past Y'Ami, Batanes (21.1°), east past
 * Pusan Point (126.6°), and west to 114° so Kalayaan, a municipality of
 * Palawan, is inside. The same numbers as PH_BOUNDS in api/reports.php, which
 * refuses a pin outside them whatever the browser does.
 *
 * A box, not a coastline: a click on the sea inside it is accepted. The
 * written place and the chosen city are what a report is matched and found
 * by; the pin only narrows it down.
 */
export const PH_BOUNDS = { south: 4.2, west: 114.0, north: 21.4, east: 127.0 }

/**
 * Another country's land inside that box, cut out as [south, west, north,
 * east]: Sabah's north-west and east coasts, and Miangas (Indonesia). The
 * same boxes as PH_EXCLUDED in api/reports.php, where the reasons are.
 */
export const PH_EXCLUDED = [
  [4.2, 114.0, 7.4, 117.6],
  [4.2, 117.6, 5.95, 119.0],
  [4.2, 126.0, 5.7, 127.0],
]

/**
 * What the report form's map shows before a pin is placed: Batanes to
 * Tawi-Tawi and Palawan to eastern Mindanao, fitted to the map's size, so it
 * is the whole country at 1280, 820 and 390 px alike.
 */
export const PH_VIEW = [
  [4.5, 116.8],
  [21.2, 126.7],
]

/** How far the map can be dragged: the box above, with a little room around it. */
export const PH_MAX_BOUNDS = [
  [PH_BOUNDS.south - 1.5, PH_BOUNDS.west - 1.5],
  [PH_BOUNDS.north + 1.5, PH_BOUNDS.east + 1.5],
]

/** Whether a point is inside PH_BOUNDS and outside every PH_EXCLUDED box. */
export function isInsidePhilippines(lat, lng) {
  const inBox = (south, west, north, east) => lat >= south && lat <= north && lng >= west && lng <= east
  return (
    inBox(PH_BOUNDS.south, PH_BOUNDS.west, PH_BOUNDS.north, PH_BOUNDS.east) &&
    !PH_EXCLUDED.some((box) => inBox(...box))
  )
}

/**
 * How precise a single report's pin should look. Report coordinates are
 * barangay-level (CLAUDE.md §14), so the detail page draws this circle to make
 * "approximate area" visible rather than implying a doorstep.
 */
export const APPROXIMATE_RADIUS_M = 400

/**
 * The closest a guest's map may zoom. The server already sends a guest only
 * pins snapped to a 0.004° grid (api/reports.php, public_coordinate), so this
 * is not what protects a location. It stops the map implying a precision the
 * pin does not have: 15 is the level a report is already framed at, streets
 * and neighbourhoods, and one step short of individual buildings.
 */
export const GUEST_MAX_ZOOM = 15

function pinHtml(colorToken, symbol) {
  // Rotated square with three rounded corners = a teardrop pin. The glyph is
  // counter-rotated so it sits upright inside it.
  //
  // Colour is never the only signal (docs/design-system.md): "!" marks a lost
  // report and a check marks a found one, so the two are still tellable apart
  // in greyscale or by a colour-blind reader.
  return `<span style="
    display:flex;
    align-items:center;
    justify-content:center;
    width:1.5rem;
    height:1.5rem;
    background:var(${colorToken});
    border:2px solid #fff;
    border-radius:9999px 9999px 9999px 2px;
    transform:rotate(-45deg);
    box-shadow:0 1px 4px rgba(0,0,0,0.35);
  "><span style="
    transform:rotate(45deg);
    color:#fff;
    font-size:0.75rem;
    font-weight:700;
    line-height:1;
  ">${symbol}</span></span>`
}

function makeIcon(colorToken, symbol) {
  return L.divIcon({
    html: pinHtml(colorToken, symbol),
    className: '', // Leaflet adds a white box by default; we draw our own.
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22],
  })
}

const LOST_ICON = makeIcon('--color-accent', '!')
const FOUND_ICON = makeIcon('--color-brand', '&check;')
const RETURNED_ICON = makeIcon('--color-status-returned', '&hearts;')

/**
 * Marker for a report: amber for lost, teal for found, green once reunited.
 *
 * Colour is never the only signal — every popup names the report type in words,
 * and the map is always paired with a list view.
 */
export function iconForReport(report) {
  if (report.status === REPORT_STATUSES.RETURNED) return RETURNED_ICON
  return report.reportType === REPORT_TYPES.LOST ? LOST_ICON : FOUND_ICON
}

