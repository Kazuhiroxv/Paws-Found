import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { KeepMapSized, WheelZoomWhenChosen } from './ReportMap'
import {
  APPROXIMATE_RADIUS_M,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  TILE_LAYER,
  iconForReport,
} from './mapSetup'

/**
 * Click the map to mark roughly where a pet went missing or was found.
 *
 * Optional on purpose: someone filing a report at 2am about a missing pet
 * should not be blocked by a map. The written location is what is required —
 * a pin only makes the report easier to find and easier to match.
 *
 * Asks for the general area rather than a precise spot, because that is all
 * that is ever shown publicly (CLAUDE.md §14).
 *
 * @param {Object} props
 * @param {'lost'|'found'} props.reportType  Decides the marker colour.
 * @param {number|null} props.lat
 * @param {number|null} props.lng
 * @param {(lat: number|null, lng: number|null) => void} props.onChange
 */
export function LocationPicker({ reportType, lat, lng, onChange }) {
  const hasPin = lat != null && lng != null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg">Pin the area on a map</p>
        {/* Removing the pin throws away where the pet was, so it looks like the
            destructive action it is: the outlined danger style admin Suspend
            uses, not a grey ghost that read as a label. */}
        {hasPin && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(null, null)}
            className="border-danger/45 text-danger-hover hover:bg-danger-soft"
          >
            <X size={14} aria-hidden="true" />
            Remove pin
          </Button>
        )}
      </div>

      <p className="text-sm text-fg-muted">
        Optional. Click the general area — a nearby corner or landmark is enough. Never pin
        your own front door: the pin is shown publicly.
      </p>

      <div className="h-64 overflow-hidden rounded-card border border-border sm:h-72">
        <MapContainer
          center={hasPin ? [lat, lng] : FALLBACK_CENTER}
          zoom={hasPin ? 15 : FALLBACK_ZOOM}
          scrollWheelZoom={false}
          className="size-full"
        >
          <TileLayer
            url={TILE_LAYER.url}
            attribution={TILE_LAYER.attribution}
            maxZoom={TILE_LAYER.maxZoom}
          />

          <KeepMapSized />
          <WheelZoomWhenChosen />
          <ClickToPlacePin onPick={onChange} />

          {hasPin && (
            <Marker
              position={[lat, lng]}
              icon={iconForReport({ reportType, status: 'active' })}
            />
          )}
        </MapContainer>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-fg-muted">
        <MapPin size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
        {hasPin
          ? `Pinned at about ${lat.toFixed(3)}, ${lng.toFixed(3)} — shown publicly as an area of roughly ${APPROXIMATE_RADIUS_M} m.`
          : 'No pin yet. Your written description of the location is still used.'}
      </p>
    </div>
  )
}

function ClickToPlacePin({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}
