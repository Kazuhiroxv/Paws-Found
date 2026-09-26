import { cn } from '@/utils/cn'

/**
 * Oversized decoration that enters from a page edge and is clipped by it.
 *
 * Depth comes from things running off the canvas, not from decorating the
 * middle of the page — these always sit at an edge or a corner, behind a
 * heading region, and never over readable content. Drawn inline rather than
 * fetched: each one is a handful of circles.
 *
 * Both are `aria-hidden`, have no pointer events, and are hidden below `sm`,
 * where there is no spare edge to run off.
 *
 * @param {Object} props
 * @param {'teal'|'amber'} [props.tone]
 * @param {number} [props.size]  Rendered width in rem-ish pixels.
 * @param {string} [props.className]  Placement, e.g. `-top-24 -right-32`.
 */
export function RadarOrnament({ tone = 'teal', size = 520, strength = 1, className }) {
  const stroke = tone === 'amber' ? '#9a620f' : '#0e5d5b'
  // `strength` exists because one setting cannot serve both jobs. On a hero
  // the sweep is meant to be seen — it is most of what makes the page feel
  // like a place rather than a document. Behind a table it must be almost
  // nothing. The default is the quiet one, so a page opts in to being loud.
  const o = (value) => String(Math.min(1, value * strength))

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 400"
      width={size}
      height={size}
      fill="none"
      className={cn('pointer-events-none absolute -z-10 hidden sm:block', className)}
    >
      {/* A search sweep: the rings somebody's looking radiates out in. */}
      <g stroke={stroke} fill="none">
        <circle cx="200" cy="200" r="54" strokeOpacity={o(0.1)} strokeWidth="1.5" />
        <circle cx="200" cy="200" r="104" strokeOpacity={o(0.075)} strokeWidth="1.5" />
        <circle cx="200" cy="200" r="158" strokeOpacity={o(0.055)} strokeWidth="1.5" />
        <circle cx="200" cy="200" r="212" strokeOpacity={o(0.04)} strokeWidth="1.5" />
        <circle cx="200" cy="200" r="272" strokeOpacity={o(0.028)} strokeWidth="1.5" />
        <path d="M200 200 372 118" strokeOpacity={o(0.05)} strokeWidth="1.5" strokeDasharray="6 10" />
        <path d="M200 200 96 358" strokeOpacity={o(0.04)} strokeWidth="1.5" strokeDasharray="6 10" />
      </g>
      <circle cx="200" cy="200" r="4" fill={stroke} fillOpacity={o(0.09)} />
    </svg>
  )
}

/**
 * A single long route curve leaving the canvas, with a pin at one end.
 */
export function RouteOrnament({ tone = 'teal', size = 460, strength = 1, className }) {
  const stroke = tone === 'amber' ? '#9a620f' : '#0e5d5b'
  const o = (value) => String(Math.min(1, value * strength))

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 240"
      width={size}
      height={(size * 240) / 400}
      fill="none"
      className={cn('pointer-events-none absolute -z-10 hidden sm:block', className)}
    >
      <g stroke={stroke} fill="none" strokeLinecap="round">
        <path
          d="M-20 60C60 60 96 188 188 188s128-104 232-104"
          strokeOpacity={o(0.075)}
          strokeWidth="1.5"
          strokeDasharray="9 11"
        />
        <path d="M-20 128C70 128 118 232 214 232" strokeOpacity={o(0.045)} strokeWidth="1.5" />
        <g strokeOpacity={o(0.08)} strokeWidth="1.5">
          <path d="M176 168c0-9 7.2-16.2 16.2-16.2S208.4 159 208.4 168c0 12.2-16.2 26.2-16.2 26.2S176 180.2 176 168Z" />
          <circle cx="192.2" cy="168" r="5.2" />
        </g>
      </g>
    </svg>
  )
}
