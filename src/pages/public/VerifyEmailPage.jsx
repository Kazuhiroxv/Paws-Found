import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, CardBody } from '@/components/ui'
import { userService } from '@/services'
import { t } from '@/i18n'

/**
 * Where the link in the verification email lands.
 *
 * Four states, and one of them is the reason this is a page rather than a
 * redirect: somebody arriving with a link that has expired, or that they
 * already used, needs to be told what to do next rather than dropped at a
 * sign-in form that refuses them for reasons it cannot explain.
 *
 * Wrong, expired and already used all arrive here as the same refusal. That is
 * the API being careful, not this page being vague: a link that says "expired"
 * has told whoever holds it that it was once real.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [state, setState] = useState(token ? 'verifying' : 'missing')
  const [email, setEmail] = useState('')
  // React runs effects twice in development. Without this the token is spent
  // by the first run and the second one reports it as already used — the page
  // would show a failure for a verification that had just succeeded.
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true

    userService
      .verifyEmail(token)
      .then((result) => {
        setEmail(result.email)
        setState('verified')
      })
      .catch(() => setState('invalid'))
  }, [token])

  return (
    <AuthShell>
      <Card>
        <CardBody className="flex flex-col gap-5">
          {state === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center" aria-busy="true">
              <LoaderCircle size={28} className="animate-spin text-brand" aria-hidden="true" />
              <p className="text-fg-muted">{t('auth.verify.checking')}</p>
            </div>
          )}

          {state === 'verified' && (
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <CircleCheck size={40} className="text-success" aria-hidden="true" />
                <PageHeader
                  title={t('auth.verify.done')}
                  description={
                    email
                      ? t('auth.verify.doneEmail', { email })
                      : t('auth.verify.doneBody')
                  }
                />
              </div>
              <Button as={Link} to="/login" className="self-center">
                {t('auth.login.title')}
              </Button>
            </>
          )}

          {(state === 'invalid' || state === 'missing') && (
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <CircleX size={40} className="text-danger" aria-hidden="true" />
                <PageHeader
                  title={t('auth.verify.failed')}
                  description={
                    state === 'missing'
                      ? t('auth.verify.missing')
                      : t('auth.verify.expired')
                  }
                />
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button as={Link} to="/login">
                  {t('auth.verify.goSignIn')}
                </Button>
                <Button as={Link} to="/" variant="ghost">
                  {t('auth.verify.home')}
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </AuthShell>
  )
}
