import { Eye, EyeOff, Lock, MapPin, ScrollText } from 'lucide-react'
import { Container } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ProseList, ProseSection } from '@/components/ProseSection'
import { PROJECT_CONTACT_EMAIL } from '@/constants'
import { t, tList } from '@/i18n'
import { Rich } from '@/i18n/Rich'

/**
 * The date this notice last changed in a way that alters what somebody is
 * agreeing to.
 *
 * Must match PRIVACY_NOTICE_VERSION in api/config.php, which is what gets
 * written into `privacy_consents` when a person registers. Change both
 * together, or the record will say people agreed to a version that never
 * existed.
 *
 * Correction 7 did not change it: it translated the notice and described
 * the acknowledgement message, neither of which changes what is collected,
 * shown or kept (docs/DECISIONS.md).
 */
export const PRIVACY_NOTICE_VERSION = '2026-10-03'

/** Bold and italic inside a sentence, as the dictionary marks them. */
const EMPHASIS = {
  b: (text) => <strong className="font-medium text-fg">{text}</strong>,
  i: (text) => <em>{text}</em>,
}

const SHORT_VERSION = [
  ['name', Eye],
  ['phone', EyeOff],
  ['location', MapPin],
  ['password', Lock],
  ['activity', ScrollText],
]

/**
 * The Privacy Notice.
 *
 * Written to be read by the person it is about, which is the point of it —
 * the Data Privacy Act expects somebody to be told what is collected and why
 * BEFORE it is collected, not to find a policy afterwards if they go looking.
 *
 * Every claim on this page is checked against what the system actually does.
 * If the code changes so that one of them stops being true, this page is wrong
 * and has to change with it. A privacy notice that describes a system other
 * than the real one is worse than no notice at all.
 *
 * The words are `privacy.*` in the dictionaries (Correction 7). The Filipino
 * notice is a translation of this one, not a second policy.
 */
export function PrivacyPage() {
  return (
    <Container width="prose" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <PageHeader title={t('privacy.title')} description={t('privacy.description')} />
        <p className="text-sm text-fg-muted">
          {t('privacy.updated', { version: PRIVACY_NOTICE_VERSION })}
        </p>
      </div>

      {/* The two sentences most people actually need, before the detail. */}
      <div className="flex flex-col gap-4 rounded-card border border-border bg-layer p-5 sm:p-6">
        <h2 className="font-semibold text-fg">{t('privacy.short.title')}</h2>
        <ul className="flex flex-col gap-3 text-fg-muted">
          {SHORT_VERSION.map(([key, Icon]) => (
            <li key={key} className="flex gap-3">
              <Icon size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <span>
                <Rich k={`privacy.short.${key}`} tags={EMPHASIS} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ProseSection title={t('privacy.collect.title')}>
        <p>{t('privacy.collect.account')}</p>
        <ProseList items={tList('privacy.collect.accountList')} />

        <p>{t('privacy.collect.report')}</p>
        <ProseList items={tList('privacy.collect.reportList')} />

        <p>{t('privacy.collect.use')}</p>
        <ProseList items={tList('privacy.collect.useList')} />
        <p>{t('privacy.collect.note')}</p>
      </ProseSection>

      <ProseSection title={t('privacy.why.title')}>
        <p>{t('privacy.why.intro')}</p>
        <ProseList items={tList('privacy.why.list')} />
      </ProseSection>

      <ProseSection title={t('privacy.public.title')}>
        <Paragraphs k="privacy.public.body" />
      </ProseSection>

      <ProseSection title={t('privacy.inside.title')}>
        <ProseList items={tList('privacy.inside.list')} />
      </ProseSection>

      <ProseSection title={t('privacy.matching.title')}>
        <Paragraphs k="privacy.matching.body" />
      </ProseSection>

      <ProseSection title={t('privacy.keep.title')}>
        <Paragraphs k="privacy.keep.body" />
      </ProseSection>

      <ProseSection title={t('privacy.rights.title')}>
        <Paragraphs k="privacy.rights.body" />
      </ProseSection>

      <ProseSection title={t('privacy.who.title')}>
        <Paragraphs k="privacy.who.body" />

        {/* A privacy notice has to name somebody reachable, or the rights it
            describes have nowhere to go.

            "Privacy contact" rather than "Data Protection Officer": a DPO is a
            role an organisation formally designates under the Data Privacy Act,
            and nobody has designated one here. Claiming the title would be the
            one false statement on a page about honesty.

            The project's own inbox and no personal mobile number. The Act asks
            for contact details that reach the people responsible, not for a
            private phone number published where anything can crawl it. */}
        <dl className="flex flex-col gap-2 rounded-card border border-border bg-layer p-4 text-sm not-italic">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-fg-muted sm:w-28">{t('privacy.who.contact')}</dt>
            <dd className="font-medium text-fg">{t('privacy.who.contactValue')}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-fg-muted sm:w-28">{t('privacy.who.institution')}</dt>
            <dd className="text-fg">{t('privacy.who.institutionValue')}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-fg-muted sm:w-28">{t('privacy.who.email')}</dt>
            <dd>
              <a
                href={`mailto:${PROJECT_CONTACT_EMAIL}`}
                className="font-medium break-all text-brand hover:underline"
              >
                {PROJECT_CONTACT_EMAIL}
              </a>
            </dd>
          </div>
        </dl>

        <p>{t('privacy.who.after')}</p>
      </ProseSection>

      <ProseSection title={t('privacy.changes.title')}>
        <Paragraphs k="privacy.changes.body" />
      </ProseSection>
    </Container>
  )
}

/** Each paragraph of a key, with its bold and italic words. */
function Paragraphs({ k }) {
  return tList(k).map((_, index) => (
    <p key={index}>
      <Rich k={`${k}.${index}`} tags={EMPHASIS} />
    </p>
  ))
}
