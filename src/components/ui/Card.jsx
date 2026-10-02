import { cn } from '@/utils/cn'

/**
 * Generic surface for grouped content. Composed rather than configured, so a
 * pet card, a statistic tile and a match comparison can all be built from the
 * same primitive instead of becoming five near-identical components
 * (CLAUDE.md §17).
 *
 * `tone` picks the surface level: `panel` is the white card (the default),
 * `layer` is the quieter tinted one for a rail or a summary panel beside the
 * main content, and `plain` drops the fill so the card is only an outline on
 * whatever ground it sits on.
 *
 * @example
 * <Card>
 *   <CardHeader title="My Reports" action={<Button size="sm">New</Button>} />
 *   <CardBody>…</CardBody>
 * </Card>
 */
const TONES = {
  panel: 'bg-panel shadow-card',
  layer: 'bg-layer',
  plain: 'bg-transparent',
}

export function Card({ as: Component = 'div', tone = 'panel', className, children, ...rest }) {
  return (
    <Component
      className={cn('rounded-card border border-border', TONES[tone], className)}
      {...rest}
    >
      {children}
    </Component>
  )
}

/**
 * @param {Object} props
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.action]  Right-aligned control, e.g. a button.
 * @param {'h2'|'h3'|'h4'} [props.titleAs]  Pick the level that keeps the page's
 *   heading order correct — do not choose by visual size.
 */
export function CardHeader({ title, subtitle, action, titleAs: Heading = 'h3', className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        {/* Wraps rather than truncating: beside an action button on a phone,
            "Flags awaiting review" was cut to "Flags awaiting re…". */}
        {title && <Heading className="text-lg font-semibold text-balance text-fg">{title}</Heading>}
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Passes anything else through — `ref` included, which React 19 hands to a
// function component as an ordinary prop — so a page can focus a card body.
export function CardBody({ className, children, ...rest }) {
  return (
    <div className={cn('px-5 py-5', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children }) {
  return (
    <div className={cn('border-t border-border px-5 py-4', className)}>{children}</div>
  )
}
