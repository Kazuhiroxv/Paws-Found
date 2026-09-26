import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Container, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'

export function UnauthorizedPage() {
  return (
    <Container width="prose" className="flex flex-col gap-6">
      <PageHeader
        title="No access"
        description="Your account does not have permission to open that page."
      />

      <EmptyState
        icon={Lock}
        title="This area is for a different role"
        description="Community members, Pet Coordinators and administrators each see a different workspace, and this one is not yours. If you were in here a moment ago, an administrator has changed what this account is allowed to reach — the change applies everywhere the account is signed in, straight away."
        action={
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/dashboard" className="text-sm text-fg underline">
              Go to my account
            </Link>
            <Link to="/" className="text-sm text-fg-muted underline">
              Go to the homepage
            </Link>
          </div>
        }
      />
    </Container>
  )
}
