import { Container } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { ProseList, ProseSection } from '@/components/ProseSection'
import { PROJECT_CONTACT_EMAIL } from '@/constants'
import { t, tList } from '@/i18n'

/**
 * The order the sections are read in. Each is `disclaimer.sections.<id>` in
 * both dictionaries, so the English and Filipino pages cannot drift into
 * different shapes.
 */
const SECTIONS = ['academic', 'payments', 'affiliation', 'accuracy', 'guarantee', 'safety', 'use']

/**
 * The Disclaimer (Correction 7): the instructor's "no money involved, not
 * affiliated, not responsible for false information", said plainly.
 *
 * Measured on purpose. It explains the limits of an academic system and how
 * to stay safe; it does not claim immunity or ask anybody to give up a right,
 * and it says that it is not a contract. Short forms of it sit where they
 * matter — the footer, the report form's Review step, a confirmed match —
 * and link here rather than repeating it.
 */
export function DisclaimerPage() {
  return (
    <Container width="prose" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <PageHeader title={t('disclaimer.title')} description={t('disclaimer.description')} />
        <p className="text-sm text-fg-muted">{t('disclaimer.updated')}</p>
        <p className="leading-relaxed text-fg">{t('disclaimer.intro')}</p>
      </div>

      {SECTIONS.map((id) => {
        const base = `disclaimer.sections.${id}`
        return (
          <ProseSection key={id} id={`disclaimer-${id}`} title={t(`${base}.title`)}>
            {tList(`${base}.body`).map((paragraph) => (
              <p key={paragraph}>{paragraph.replace('{email}', PROJECT_CONTACT_EMAIL)}</p>
            ))}
            {tList(`${base}.list`).length > 0 && <ProseList items={tList(`${base}.list`)} />}
            {tList(`${base}.after`).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </ProseSection>
        )
      })}
    </Container>
  )
}
