import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { ArrowRight, MapPinOff } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { speciesLabel } from '@/constants'
import { formatDate } from '@/utils/date'
import { cn } from '@/utils/cn'
import { hasCoordinates } from '@/utils/location'
import { ReportTypeBadge } from './ReportTypeBadge'
import { StatusBadge } from './StatusBadge'
import {
  APPROXIMATE_RADIUS_M,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  GUEST_MAX_ZOOM,
  TILE_LAYER,
  iconForReport,
} from './mapSetup'
import { t } from '@/i18n'

/**
 * Map of one or more reports.
 *
 * Every position shown is the approximate area a reporter described, never an
 * exact address (CLAUDE.md §14). With a single report the map also draws a
 * circle, so the imprecision is visible rather than implied.
 *
 * @param {Object} props
 * @param {Object[]} props.reports
 * @param {boolean} [props.showApproximateArea]  Draw the radius circle.
 * @param {string} [props.height]  Tailwind height classes.
 * @param {boolean} [props.guest]  Viewed by somebody signed out: zoom stops at
 *   GUEST_MAX_ZOOM. A flag rather than a number, so pages need not import this
 *   file's Leaflet setup just to pass a constant.
 */
export function ReportMap({ reports, showApproximateArea = false, height = 'h-96', className, guest = false }) {
  const maxZoom = guest ? GUEST_MAX_ZOOM : TILE_LAYER.maxZoom

  // Both derived in one memo so `positions` keeps a stable identity — otherwise
  // the fit-bounds effect re-runs and re-centres the map on every render.
  const { mappable, positions } = useMemo(() => {
    const withCoordinates = reports.filter(hasCoordinates)

    return {
      mappable: withCoordinates,
      positions: withCoordinates.map((report) => [report.location.lat, report.location.lng]),
    }
  }, [reports])

  if (mappable.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border px-6 text-center',
          height,
          className,
        )}
      >
        <MapPinOff size={28} className="text-fg-subtle" aria-hidden="true" />
        <p className="font-medium text-fg">{t('map.nothing')}</p>
        <p className="max-w-prose text-sm text-fg-muted">
          {reports.length === 0
            ? t('map.noResults')
            : t('map.noPins')}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-card border border-border', height, className)}>
      <MapContainer
        center={FALLBACK_CENTER}
        zoom={FALLBACK_ZOOM}
        maxZoom={maxZoom}
        scrollWheelZoom={false}
        className="size-full"
      >
        <TileLayer
          url={TILE_LAYER.url}
          attribution={TILE_LAYER.attribution}
          maxZoom={maxZoom}
        />

        <KeepMapSized />
        <WheelZoomWhenChosen />
        <FitToReports positions={positions} />

        {mappable.map((report) => (
          <Marker
            key={report.id}
            position={[report.location.lat, report.location.lng]}
            icon={iconForReport(report)}
          >
            <Popup>
              <ReportPopup report={report} />
            </Popup>
          </Marker>
        ))}

        {showApproximateArea &&
          mappable.map((report) => (
            <Circle
              key={`${report.id}-area`}
              center={[report.location.lat, report.location.lng]}
              radius={APPROXIMATE_RADIUS_M}
              pathOptions={{
                color: 'var(--color-brand)',
                fillColor: 'var(--color-brand)',
                fillOpacity: 0.12,
                weight: 1,
              }}
            />
          ))}
      </MapContainer>
    </div>
  )
}

/**
 * Tell Leaflet when its container changes size.
 *
 * Leaflet measures its container once and never checks again, so a map inside a
 * responsive layout ends up with grey gaps where tiles were never requested —
 * on a window resize, a phone rotating, or a sidebar collapsing at a
 * breakpoint. `invalidateSize()` makes it re-measure and fetch what is missing.
 */
export function KeepMapSized() {
  const map = useMap()

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  return null
}

/**
 * Mouse-wheel and trackpad zoom, once the map has been chosen.
 *
 * Always-on wheel zoom is a scroll trap: somebody scrolling down Explore lands
 * the wheel on the map and it zooms instead of the page moving. So the wheel
 * belongs to the page until the map is clicked or focused, and goes back to
 * the page when the pointer leaves or focus moves on. A wheel over a map that
 * has not been chosen yet says how to use it, briefly, instead of doing nothing.
 *
 * Unchanged: the +/− buttons, Leaflet's own keyboard controls (+, −, arrows
 * once the map has focus), and pinch-zoom on a touchscreen, which is a separate
 * handler. A trackpad pinch arrives as a wheel event and follows the same rule.
 */
export function WheelZoomWhenChosen() {
  const map = useMap()
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    const container = map.getContainer()
    let hintTimer

    const enable = () => {
      map.scrollWheelZoom.enable()
      setShowHint(false)
    }
    const disable = () => map.scrollWheelZoom.disable()
    const onWheel = () => {
      if (map.scrollWheelZoom.enabled()) return
      setShowHint(true)
      clearTimeout(hintTimer)
      hintTimer = setTimeout(() => setShowHint(false), 1600)
    }

    map.scrollWheelZoom.disable()
    map.on('mousedown focus', enable)
    map.on('mouseout blur', disable)
    container.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      clearTimeout(hintTimer)
      map.off('mousedown focus', enable)
      map.off('mouseout blur', disable)
      container.removeEventListener('wheel', onWheel)
    }
  }, [map])

  if (!showHint) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-fg/25"
    >
      <p className="rounded-pill bg-panel px-4 py-2 text-sm font-medium text-fg shadow-raised">
        {t('map.wheelHint')}
      </p>
    </div>
  )
}

/**
 * Frame the map around whatever is being shown.
 *
 * Leaflet is an external system with its own imperative API, which is exactly
 * what an effect is for.
 */
function FitToReports({ positions }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length === 0) return

    if (positions.length === 1) {
      map.setView(positions[0], 15)
      return
    }

    map.fitBounds(positions, { padding: [40, 40], maxZoom: 15 })
  }, [map, positions])

  return null
}

/**
 * Marker popup: a small preview of the report with a way into it.
 *
 * Includes the photograph — on a map full of identical pins, the picture is
 * what tells someone whether this is worth opening.
 */
function ReportPopup({ report }) {
  const heading = report.petName ?? t('common.nameUnknown', { species: speciesLabel(report.species) })
  const photo = report.photos.find((item) => item.isPrimary) ?? report.photos[0]

  return (
    <div className="flex w-56 flex-col gap-2">
      <div className="relative">
        <img
          src={photo?.url ?? photoPlaceholder}
          alt=""
          className="aspect-4/3 w-full rounded-control bg-surface-muted object-cover object-[50%_35%]"
        />
        <ReportTypeBadge
          reportType={report.reportType}
          size="sm"
          className="absolute top-2 left-2 shadow-card"
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="font-semibold text-fg">{heading}</p>
        <p className="text-fg-muted">{report.breed || speciesLabel(report.species)}</p>
        <p className="text-fg-muted">
          {report.location.city} · {formatDate(report.incidentDate)}
        </p>
        <StatusBadge status={report.status} className="mt-1" />
      </div>

      <Link
        to={`/pet/${report.id}`}
        className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
      >
        {t('map.viewReport')}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>

      <p className="text-fg-muted">{t('map.approximate')}</p>
    </div>
  )
}
