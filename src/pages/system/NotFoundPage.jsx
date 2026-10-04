import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { Container, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { t } from '@/i18n'

export function NotFoundPage() {
  return (
    <Container width="prose" className="flex flex-col gap-6">
      <PageHeader
        title={t('system.notFound')}
        description={t('system.notFoundBody')}
      />

      <EmptyState
        icon={SearchX}
        title={t('system.nothingHere')}
        description={t('system.checkAddress')}
        action={
          <Link to="/" className="text-sm text-fg underline">
            {t('system.home')}
          </Link>
        }
      />
    </Container>
  )
}
