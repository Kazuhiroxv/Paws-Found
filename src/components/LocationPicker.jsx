import { useState } from 'react'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { KeepMapSized, WheelZoomWhenChosen } from './ReportMap'
import {
  APPROXIMATE_RADIUS_M,
  PH_MAX_BOUNDS,
  PH_VIEW,
  TILE_LAYER,
  iconForReport,
  isInsidePhilippines,
} from './mapSetup'

/**
 * Click the map to mark roughly where a pet went missing or was found.
 *
 * Optional on purpose: someone filing a report at 2am about a missing pet
 * should not be blocked by a map. The place chosen from the lists is what is
 * required — a pin only makes the report easier to find and easier to match.
 *
 * The map is the Philippines (Correction 3): it opens on the whole country,
 * cannot be dragged far beyond it, and a click outside it places nothing. A
 * pin never changes the province or city chosen above it, and nothing reads
 * an address from it: the two are separate answers, and the reporter gives
 * both.
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
  const [outside, setOutside] = useState(false)

  const pick = (nextLat, nextLng) => {
    if (!isInsidePhilippines(nextLat, nextLng)) {
      setOutside(true)
      return
    }
    setOutside(false)
    onChange(nextLat, nextLng)
  }

  return (
    <div className="flex flex-col gap-2" data-location-picker>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg">Pin the area on a map</p>
        {/* Removing the pin throws away where the pet was, so it looks like the
            destructive action it is: a pale red fill, red text and a red border,
            stronger on hover. Clearly not harmless, and clearly milder than the
            solid red of Suspend or "Not the same pet". The classes are marked
            important (!) because cn() only joins classes and the button's own
            colours otherwise won. */}
        {hasPin && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onChange(null, null)}
            className="border-danger/50 bg-danger-soft! text-danger-hover! hover:border-danger! hover:bg-danger/15!"
          >
            <X size={14} aria-hidden="true" />
            Remove pin
          </Button>
        )}
      </div>

      <p className="text-sm text-fg-muted">
        Optional. Tap or click the general area — a nearby corner or landmark is enough. Never
        pin your own front door: the pin is shown publicly. The pin does not change the
        province or city you chose.
      </p>

      <div className="h-64 overflow-hidden rounded-card border border-border sm:h-72">
        <MapContainer
          {...(hasPin ? { center: [lat, lng], zoom: 15 } : { bounds: PH_VIEW })}
          maxBounds={PH_MAX_BOUNDS}
          maxBoundsViscosity={1}
          minZoom={4}
          zoomSnap={0.5}
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
          <ClickToPlacePin onPick={pick} />

          {hasPin && (
            <Marker
              position={[lat, lng]}
              icon={iconForReport({ reportType, status: 'active' })}
            />
          )}
        </MapContainer>
      </div>

      {outside && (
        <p role="alert" className="text-sm font-medium text-danger">
          That point is outside the Philippines, so no pin was placed. Tap the area where the
          pet was.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-sm text-fg-muted">
        <MapPin size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
        {hasPin
          ? `Pinned at about ${lat.toFixed(3)}, ${lng.toFixed(3)} — shown publicly as an area of roughly ${APPROXIMATE_RADIUS_M} m.`
          : 'No pin yet. The province, city and your description are still used.'}
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
