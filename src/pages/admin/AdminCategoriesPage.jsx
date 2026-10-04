import { useState } from 'react'
import { Check, FolderTree, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button, Card, CardBody, EmptyState, Input, LoadingSkeleton } from '@/components/ui'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { categoryService } from '@/services'
import { cn } from '@/utils/cn'
import { CategoryStatusBadge } from './AdminBadges'
import { t } from '@/i18n'
import { errorText } from '@/i18n/apiErrors'

async function loadCategories() {
  const [categories, usage] = await Promise.all([
    categoryService.getCategories(),
    categoryService.getCategoryUsage(),
  ])
  return { categories, usage }
}

/**
 * The species list reports are filed under.
 *
 * A category's id is what gets stored on a report, so renaming is always safe.
 * Deleting is only offered while nothing uses it — otherwise those reports
 * would point at a species that no longer exists. Deactivating is the safe way
 * to retire one.
 *
 * Breed management is deliberately not here: the roadmap defers it until the
 * instructor's database requirements are known.
 */
export function AdminCategoriesPage() {
  const { data, error, isLoading, reload } = useAsync(loadCategories)
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [actionError, setActionError] = useState(null)
  const [isBusy, setIsBusy] = useState(false)
  const [added, setAdded] = useState(null)
  // { category, kind: 'deactivate' | 'delete' }
  const [asking, setAsking] = useState(null)

  const header = (
    <PageHeader
      icon={FolderTree}
      eyebrow={t('shell.access.eyebrow')}
      title={t('nav.categories')}
      description={t('admin.categories.description')}
      breadcrumb={[{ label: t('shell.workspace.admin'), to: '/admin' }, { label: t('nav.categories') }]}
    />
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingSkeleton lines={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-danger">
          {t('admin.categories.failed', { message: errorText(error) })}
        </p>
      </div>
    )
  }

  const { categories, usage } = data

  const run = async (action) => {
    setIsBusy(true)
    setActionError(null)
    try {
      await action()
      reload()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsBusy(false)
    }
  }

  const add = async (event) => {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    await run(async () => {
      await categoryService.createCategory(label)
      setNewLabel('')
      setAdded(label)
    })
  }

  const confirmed = async () => {
    const { category, kind } = asking
    setAdded(null)
    await run(async () => {
      if (kind === 'delete') {
        await categoryService.deleteCategory(category.id)
      } else {
        await categoryService.setCategoryActive(category.id, false)
      }
      setAsking(null)
    })
  }

  const saveRename = async (id) => {
    await run(async () => {
      await categoryService.renameCategory(id, editLabel)
      setEditingId(null)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      <Card>
        <CardBody>
          <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label={t('admin.categories.add')}
              value={newLabel}
              onChange={(event) => {
                setNewLabel(event.target.value)
                setAdded(null)
                setActionError(null)
              }}
              maxLength={40}
              placeholder={t('admin.categories.addPlaceholder')}
              hint={t('admin.categories.addHint')}
              className="sm:flex-1"
            />
            <Button type="submit" disabled={newLabel.trim().length < 2 || isBusy}>
              <Plus size={16} aria-hidden="true" />
              {t('admin.categories.addButton')}
            </Button>
          </form>

          {/* The server rejects a duplicate name; its message belongs here,
              beside the field it is about, not at the top of the page. */}
          {actionError && !asking && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {errorText(actionError)}
            </p>
          )}
          {added && !actionError && (
            <p role="status" className="mt-3 text-sm text-success-ink">
              {t('admin.categories.added', { name: added })}
            </p>
          )}
        </CardBody>
      </Card>

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={t('admin.categories.none')}
          description={t('admin.categories.noneBody')}
        />
      ) : (
        <>
          {/* Phones: one card per category, so the actions are not squeezed
              into a fourth column. */}
          <ul className="flex flex-col gap-3 sm:hidden">
            {categories.map((category) => {
              const inUse = usage[category.id] ?? 0

              return (
                <li
                  key={category.id}
                  className="flex flex-col gap-3 rounded-card border border-border bg-panel p-4 shadow-card"
                >
                  {editingId === category.id ? (
                    <RenameForm
                      category={category}
                      value={editLabel}
                      onChange={setEditLabel}
                      onSave={() => saveRename(category.id)}
                      onCancel={() => setEditingId(null)}
                      isBusy={isBusy}
                    />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-fg">{category.label}</p>
                        <CategoryStatusBadge isActive={category.isActive} />
                      </div>
                      <p className="text-sm text-fg-muted">
                        {t('admin.categories.storedAs')} <code>{category.id}</code> ·{' '}
                        {t('chart.reports', { count: inUse })}
                      </p>
                      <CategoryActions
                        category={category}
                        inUse={inUse}
                        isBusy={isBusy}
                        onRename={() => {
                          setEditingId(category.id)
                          setEditLabel(category.label)
                        }}
                        onReactivate={() =>
                          run(() => categoryService.setCategoryActive(category.id, true))
                        }
                        onAsk={setAsking}
                      />
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="hidden rounded-card border border-border bg-panel sm:block">
            <table className="w-full text-left text-sm">
              {/* Shown from 640px, where the workspace bar (55px, sticky) is
                  above it until the desktop rail replaces the bar. */}
              <thead className="sticky top-[55px] z-10 lg:top-0 border-b border-border bg-surface-muted text-fg shadow-[0_1px_0_var(--color-border)] [&>tr>th:first-child]:rounded-tl-card [&>tr>th:last-child]:rounded-tr-card">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    {t('admin.categories.category')}
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    {t('nav.reports')}
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    {t('filters.status')}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    {t('detail.actions')}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border [&>tr:last-child>td:first-child]:rounded-bl-card [&>tr:last-child>td:last-child]:rounded-br-card">
                {categories.map((category) => {
                  const inUse = usage[category.id] ?? 0

                  if (editingId === category.id) {
                    return (
                      <tr key={category.id} className="bg-surface">
                        <td colSpan={4} className="px-4 py-3">
                          <RenameForm
                            category={category}
                            value={editLabel}
                            onChange={setEditLabel}
                            onSave={() => saveRename(category.id)}
                            onCancel={() => setEditingId(null)}
                            isBusy={isBusy}
                          />
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={category.id} className="align-middle transition-colors hover:bg-surface">
                      <td className="px-4 py-3">
                        <p className="font-medium text-fg">{category.label}</p>
                        <p className="text-fg-muted">
                          {t('admin.categories.storedAs')} <code>{category.id}</code>
                        </p>
                      </td>

                      <td className="px-2 py-3 text-fg-muted tabular-nums">{inUse}</td>

                      <td className="px-2 py-3">
                        <CategoryStatusBadge isActive={category.isActive} />
                      </td>

                      <td className="px-4 py-3">
                        <CategoryActions
                          category={category}
                          inUse={inUse}
                          isBusy={isBusy}
                          align="end"
                          onRename={() => {
                            setEditingId(category.id)
                            setEditLabel(category.label)
                          }}
                          onReactivate={() =>
                            run(() => categoryService.setCategoryActive(category.id, true))
                          }
                          onAsk={setAsking}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-sm text-fg-muted">
        {t('admin.categories.note')}
      </p>

      {asking && (
        <ConfirmDialog
          isOpen
          title={
            asking.kind === 'delete'
              ? t('admin.categories.deleteTitle', { name: asking.category.label })
              : t('admin.categories.deactivateTitle', { name: asking.category.label })
          }
          confirmLabel={asking.kind === 'delete' ? t('admin.categories.deleteButton') : t('admin.categories.deactivateButton')}
          tone={asking.kind === 'delete' ? 'danger' : 'primary'}
          isBusy={isBusy}
          error={actionError}
          onCancel={() => {
            setAsking(null)
            setActionError(null)
          }}
          onConfirm={confirmed}
        >
          {asking.kind === 'delete' ? (
            <p>
              <span className="font-medium">{asking.category.label}</span> {t('admin.categories.deleteBody')}
            </p>
          ) : (
            <p>
              <span className="font-medium">{asking.category.label}</span>{' '}
              {t('admin.categories.deactivateBody', { count: usage[asking.category.id] ?? 0 })}
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  )
}

/** Rename in place. Safe — a report stores the id, never the label. */
function RenameForm({ category, value, onChange, onSave, onCancel, isBusy }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input
        label={t('admin.categories.renameLabel', { name: category.label })}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={40}
        className="min-w-48 flex-1"
      />
      <Button size="sm" onClick={onSave} disabled={isBusy || value.trim().length < 2}>
        <Check size={14} aria-hidden="true" />
        {t('admin.categories.save')}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={isBusy}>
        <X size={14} aria-hidden="true" />
        {t('common.cancel')}
      </Button>
    </div>
  )
}

/**
 * Rename is neutral, deactivating changes what reporters are offered, and
 * deleting is destructive — so only the last one is red, and the last two ask
 * first. Delete is only offered while nothing points at the category.
 */
function CategoryActions({ category, inUse, isBusy, align, onRename, onReactivate, onAsk }) {
  return (
    <div className={cn('flex flex-wrap gap-2', align === 'end' && 'justify-end')}>
      <Button size="sm" variant="secondary" disabled={isBusy} onClick={onRename}>
        <Pencil size={14} aria-hidden="true" />
        {t('admin.categories.rename')}
        <span className="sr-only"> {category.label}</span>
      </Button>

      {category.isActive ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={() => onAsk({ category, kind: 'deactivate' })}
        >
          {t('admin.categories.deactivate')}
          <span className="sr-only"> {category.label}</span>
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={onReactivate}>
          {t('admin.categories.reactivate')}
          <span className="sr-only"> {category.label}</span>
        </Button>
      )}

      {inUse === 0 && (
        <Button
          size="sm"
          variant="danger"
          disabled={isBusy}
          onClick={() => onAsk({ category, kind: 'delete' })}
        >
          <Trash2 size={14} aria-hidden="true" />
          {t('admin.categories.delete')}
          <span className="sr-only"> {category.label}</span>
        </Button>
      )}
    </div>
  )
}
