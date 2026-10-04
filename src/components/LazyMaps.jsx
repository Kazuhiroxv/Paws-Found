import { Suspense, lazy } from 'react'
import { LoadingSkeleton } from '@/components/ui'
import { cn } from '@/utils/cn'
import { t } from '@/i18n'

/**
 * Lazy-loaded map components.
 *
 * Leaflet is about 40% of the JavaScript bundle and only three routes ever show
 * a map, so it is split into its own chunk and fetched the first time a map is
 * actually rendered. Everyone else — the homepage, dashboards, forms — never
 * downloads it.
 *
 * **Import maps from this file, not from ReportMap.jsx or LocationPicker.jsx
 * directly**, or the split is undone and Leaflet lands back in the main bundle.
 * The same goes for anything in `mapSetup.js`; the Leaflet-free helpers live in
 * `@/utils/location`.
 */

const ReportMapImpl = lazy(() =>
  import('./ReportMap').then((module) => ({ default: module.ReportMap })),
)

const LocationPickerImpl = lazy(() =>
  import('./LocationPicker').then((module) => ({ default: module.LocationPicker })),
)

/** Placeholder of the same height, so nothing jumps when the map arrives. */
function MapFallback({ height }) {
  return (
    <div className={cn('overflow-hidden rounded-card border border-border', height)}>
      <LoadingSkeleton className="size-full" />
      <span className="sr-only">{t('map.loading')}</span>
    </div>
  )
}

export function ReportMap({ height = 'h-96', ...props }) {
  return (
    <Suspense fallback={<MapFallback height={height} />}>
      <ReportMapImpl height={height} {...props} />
    </Suspense>
  )
}

export function LocationPicker(props) {
  return (
    <Suspense fallback={<MapFallback height="h-64 sm:h-72" />}>
      <LocationPickerImpl {...props} />
    </Suspense>
  )
}
