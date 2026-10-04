import { useRef, useState } from 'react'
import { ImagePlus, Star, Trash2 } from 'lucide-react'
import photoPlaceholder from '@/assets/pet-photo-placeholder.png'
import { Button, Input } from '@/components/ui'
import { createId } from '@/utils/id'
import { cn } from '@/utils/cn'
import { LIMITS, PHOTO_RULES } from './reportFormModel'
import { t } from '@/i18n'

/**
 * Step 3 — photographs.
 *
 * Files are held in memory and previewed with `URL.createObjectURL` until the
 * report is filed; ReportForm then uploads them (POST /reports/:id/photos),
 * where the server checks the same rules again. Object URLs are revoked when
 * a photo is removed so the tab does not leak memory.
 *
 * The rules are stated before anything is chosen (Correction 3 — "how many
 * photos?" had no answer on screen): optional, up to five, which types, how
 * large, and which one is the main photo.
 *
 * Photos are optional on purpose: a finder often has no chance to take one, and
 * refusing the report would lose the sighting entirely.
 */
export function PhotosStep({ values, onChange }) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [fileErrors, setFileErrors] = useState([])
  const inputRef = useRef(null)

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList)
    const problems = []
    const accepted = []

    for (const file of incoming) {
      if (values.photos.length + accepted.length >= PHOTO_RULES.maxCount) {
        // Keys, not sentences, so a message showing when the language
        // changes is shown again in the new one.
        problems.push(['reportForm.photos.tooMany', { max: PHOTO_RULES.maxCount }])
        break
      }
      if (!PHOTO_RULES.acceptedTypes.includes(file.type)) {
        problems.push(['reportForm.photos.wrongType', { name: file.name }])
        continue
      }
      if (file.size > PHOTO_RULES.maxBytes) {
        problems.push(['reportForm.photos.tooLarge', { name: file.name }])
        continue
      }

      accepted.push({
        id: createId('photo'),
        // The file itself is kept, not only its preview: it is what gets
        // uploaded once the report has an id to attach it to.
        file,
        url: URL.createObjectURL(file),
        alt: '',
        // The first photo added becomes the primary one by default.
        isPrimary: values.photos.length + accepted.length === 0,
      })
    }

    setFileErrors(problems)
    if (accepted.length > 0) onChange('photos', [...values.photos, ...accepted])

    // Clear the input so choosing the same file again still fires a change.
    if (inputRef.current) inputRef.current.value = ''
  }

  const removePhoto = (id) => {
    const photo = values.photos.find((item) => item.id === id)
    // Only object URLs need revoking; a seeded photo has no url at all.
    if (photo?.url?.startsWith('blob:')) URL.revokeObjectURL(photo.url)

    const remaining = values.photos.filter((item) => item.id !== id)
    // Never leave a set of photos without a primary one.
    if (remaining.length > 0 && !remaining.some((item) => item.isPrimary)) {
      remaining[0] = { ...remaining[0], isPrimary: true }
    }

    onChange('photos', remaining)
  }

  const setPrimary = (id) => {
    onChange(
      'photos',
      values.photos.map((photo) => ({ ...photo, isPrimary: photo.id === id })),
    )
  }

  const updateAlt = (id, alt) => {
    onChange(
      'photos',
      values.photos.map((photo) => (photo.id === id ? { ...photo, alt } : photo)),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* A drop target as well as a button. The same `addFiles` validates
          either way, so a dropped file gets the same size and type checks as
          a chosen one. The button stays: dropping is not possible on a phone,
          and not everyone can drag. */}
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDraggingOver(true)
        }}
        onDragLeave={(event) => {
          // Only when the pointer actually leaves the target, not when it
          // crosses one of the children inside it.
          if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDraggingOver(false)
          addFiles(event.dataTransfer.files)
        }}
        className={cn(
          'rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors',
          isDraggingOver
            ? 'border-brand bg-brand-soft'
            : 'border-border-strong bg-surface-alt',
        )}
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-panel text-brand shadow-card">
          <ImagePlus size={26} aria-hidden="true" />
        </span>
        <p className="mt-4 text-lg font-semibold text-fg">{t('reportForm.photos.title')}</p>
        <p className="mx-auto mt-1.5 max-w-prose text-fg-muted">{t('reportForm.photos.intro')}</p>
        <ul className="mx-auto mt-3 flex max-w-prose flex-col gap-1 text-left text-sm text-fg-muted">
          <li>{t('reportForm.photos.rule1')}</li>
          <li>{t('reportForm.photos.rule2', { max: PHOTO_RULES.maxCount })}</li>
          <li>{t('reportForm.photos.rule3')}</li>
        </ul>
        <p className="mt-1 hidden text-sm text-fg-muted sm:block">
          {isDraggingOver ? t('reportForm.photos.dropHere') : t('reportForm.photos.dragHere')}
        </p>

        <input
          ref={inputRef}
          id="report-photos"
          type="file"
          multiple
          accept={PHOTO_RULES.accept}
          onChange={(event) => addFiles(event.target.files)}
          className="sr-only"
        />
        <Button as="label" htmlFor="report-photos" className="mt-5 cursor-pointer">
          {t('reportForm.photos.choose')}
        </Button>
      </div>

      {/* Said in words and announced, so "how many more can I add?" never
          needs counting thumbnails. */}
      <p className="text-sm font-medium text-fg" aria-live="polite" data-photo-count>
        {t(values.photos.length >= PHOTO_RULES.maxCount ? 'reportForm.photos.countFull' : 'reportForm.photos.count', {
          count: values.photos.length,
          max: PHOTO_RULES.maxCount,
        })}
      </p>

      {fileErrors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-danger">
          {fileErrors.map(([key, vars]) => (
            <li key={key + JSON.stringify(vars)}>{t(key, vars)}</li>
          ))}
        </ul>
      )}

      {values.photos.length === 0 ? (
        <p className="text-fg-muted">
          {t('reportForm.photos.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {values.photos.map((photo, index) => (
            <li
              key={photo.id}
              className="flex flex-col gap-4 rounded-card border border-border bg-panel p-4 shadow-card sm:flex-row"
            >
              {/* Seeded reports have no image file, so an edited report can
                  carry a photo entry with a null url. */}
              <div className="relative shrink-0 sm:w-52">
                <img
                  src={photo.url ?? photoPlaceholder}
                  alt={photo.alt || t('reportForm.photos.undescribed', { number: index + 1 })}
                  className="aspect-4/3 w-full rounded-control bg-surface-muted object-cover"
                />
                {photo.isPrimary && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-pill bg-panel/90 px-2.5 py-1 text-xs font-medium text-brand-hover shadow-card backdrop-blur-sm">
                    <Star size={12} aria-hidden="true" />
                    {t('reportForm.photos.main')}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Input
                  label={t('reportForm.photos.describe', { number: index + 1 })}
                  value={photo.alt}
                  onChange={(event) => updateAlt(photo.id, event.target.value)}
                  maxLength={LIMITS.photoAlt}
                  placeholder={t('reportForm.photos.describePlaceholder')}
                  hint={t('reportForm.photos.describeHint')}
                />

                <div className="flex flex-wrap items-center gap-2">
                  {!photo.isPrimary && (
                    <Button size="sm" variant="secondary" onClick={() => setPrimary(photo.id)}>
                      {t('reportForm.photos.makeMain')}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removePhoto(photo.id)}
                    className="text-danger"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t('common.remove')}
                    <span className="sr-only"> {t('reportForm.photos.photoNumber', { number: index + 1 })}</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
