import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Container, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { t } from '@/i18n'

export function UnauthorizedPage() {
  return (
    <Container width="prose" className="flex flex-col gap-6">
      <PageHeader
        title={t('shell.access.title')}
        description={t('system.unauthorized')}
      />

      <EmptyState
        icon={Lock}
        title={t('system.otherRole')}
        description={t('system.otherRoleBody')}
        action={
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/dashboard" className="text-sm text-fg underline">
              {t('system.myAccount')}
            </Link>
            <Link to="/" className="text-sm text-fg-muted underline">
              {t('system.home')}
            </Link>
          </div>
        }
      />
    </Container>
  )
}
