import { Eye, EyeOff, Lock, MapPin } from 'lucide-react'
import { Container } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { SectionHeading } from '@/components/SectionHeading'

/**
 * The date this notice last changed in a way that alters what somebody is
 * agreeing to.
 *
 * Must match PRIVACY_NOTICE_VERSION in api/config.php, which is what gets
 * written into `privacy_consents` when a person registers. Change both
 * together, or the record will say people agreed to a version that never
 * existed.
 */
export const PRIVACY_NOTICE_VERSION = '2026-09-25'

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
 */
export function PrivacyPage() {
  return (
    <Container width="prose" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <PageHeader
          title="Privacy Notice"
          description="What Paws&Found collects about you, what it shows other people, and what it keeps to itself."
        />
        <p className="text-sm text-fg-muted">
          Last updated {PRIVACY_NOTICE_VERSION}. This is the version you agree to when you create
          an account.
        </p>
      </div>

      {/* The two sentences most people actually need, before the detail. */}
      <div className="flex flex-col gap-4 rounded-card border border-border bg-layer p-5 sm:p-6">
        <h2 className="font-semibold text-fg">The short version</h2>
        <ul className="flex flex-col gap-3 text-fg-muted">
          <li className="flex gap-3">
            <Eye size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              <strong className="font-medium text-fg">Your name is shown</strong> on every report
              you file, so the person on the other side knows who they are dealing with.
            </span>
          </li>
          <li className="flex gap-3">
            <EyeOff size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              <strong className="font-medium text-fg">Your phone number and email are hidden</strong>{' '}
              unless you choose to publish them on a report. That choice is yours, per report.
            </span>
          </li>
          <li className="flex gap-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              <strong className="font-medium text-fg">Locations are approximate.</strong> A report
              points at a barangay, not at your front door.
            </span>
          </li>
          <li className="flex gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              <strong className="font-medium text-fg">Your password is never stored.</strong> Only
              a one-way hash of it is, which nobody — including us — can read back.
            </span>
          </li>
        </ul>
      </div>

      <Section title="What we collect">
        <p>When you create an account:</p>
        <List
          items={[
            'Your name.',
            'Your email address, which is also how you sign in.',
            'Your phone number, if you give one. It is optional.',
            'A preferred location, if you set one, so reports near you can be shown first.',
            'A one-way hash of your password. The password itself is never written down anywhere.',
          ]}
        />

        <p>When you file a report:</p>
        <List
          items={[
            'What the pet is — species, breed if you know it, colour, size, sex, distinctive markings.',
            'What happened, in your own words.',
            'Where it happened, to roughly barangay level, and the date and approximate time.',
            'Any photographs you upload, and the descriptions you write for them.',
            'Whether you want your phone number or email address shown on that report.',
          ]}
        />

        <p>While you use the system:</p>
        <List
          items={[
            'Which updates you want to be told about.',
            'A record of sign-ins, failed sign-ins, and changes made to your account — including the date, time and the network address the request came from. This is what lets us tell an account being locked after three wrong passwords from an account being broken into.',
          ]}
        />
      </Section>

      <Section title="Why we collect it">
        <p>
          Everything on this page is collected because you agreed to it when you created your
          account — that agreement is the basis we rely on, and it is recorded against the version
          of this notice that was showing at the time. Each piece is there for a job, and nothing
          is collected because it might be useful one day:
        </p>
        <List
          items={[
            'Your name and contact details let a reunion actually happen — somebody has to be able to reach somebody.',
            'The pet details are what the matching compares. A report with nothing structured in it cannot be matched against anything.',
            'The location and date are what make a comparison plausible: a dog lost in Cebu last March is not the dog found in Makati yesterday.',
            'The sign-in records are there to protect your account, and for an administrator to be able to answer "what happened to this account, and when".',
          ]}
        />
      </Section>

      <Section title="What other people can see">
        <p>
          A report is public. Anyone visiting the site, signed in or not, can see the pet details,
          your description, the photographs, the approximate location and date, and{' '}
          <strong className="font-medium text-fg">the name of the person who filed it</strong>.
          That last one is deliberate: an anonymous lost-pet report is difficult to trust and
          difficult to act on.
        </p>
        <p>
          Your phone number and email address are <em>not</em> public. They are only shown on a
          report if you switch them on for that report, and the server leaves them out of its
          answer entirely when you have not — they are not hidden in the page waiting to be found.
        </p>
        <p>
          The map shows an approximate area, not a point. Coordinates are recorded at barangay
          level and drawn as a circle, so the imprecision is visible rather than implied. An exact
          home address is never asked for and never stored.
        </p>
      </Section>

      <Section title="Who inside Paws&Found can see it">
        <List
          items={[
            'You can see everything on your own account and your own reports.',
            'A Pet Coordinator can see the reports they are working on, and can look up the contact details of the people involved in a case in order to arrange a handover.',
            'An administrator can see accounts, reports and moderation cases, and the record of account activity.',
            'Nobody can see your password, because it is not stored.',
            'Notes written during verification are never shown publicly.',
          ]}
        />
      </Section>

      <Section title="How matching works, and what it does on its own">
        <p>
          Paws&amp;Found compares every new report against the reports already filed and suggests
          the ones that might be the same animal. The comparison is arithmetic, not judgement: it
          scores species, breed, colour, size, how far apart the two locations are and how far
          apart the two dates are, and adds the parts up. There is no artificial intelligence in
          it and no photograph is analysed — the pictures are for people to look at, and only
          people look at them.
        </p>
        <p>
          A suggestion is only a suggestion.{' '}
          <strong className="font-medium text-fg">
            Nothing is decided about you automatically.
          </strong>{' '}
          A possible match does not change your report, does not release your contact details, and
          does not tell anyone the pet is theirs. A person has to open it, a person has to claim
          it, and a Pet Coordinator has to verify it before anything happens.
        </p>
        <p>
          Every suggestion shows the reasons it was made and what it scored on each, so you can see
          why the system thought two reports were worth comparing — and disagree with it.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Accounts are suspended rather than deleted. That is a deliberate choice: reports and case
          histories have to stay readable, and deleting an account would take the record of a
          reunion — and of anything that went wrong — with it.
        </p>
        <p>
          So your account, your reports and the record of your account activity are kept for as
          long as Paws&amp;Found is running. If you want your information removed, ask us and we
          will do it by hand; there is no self-service delete button, and we would rather say so
          than pretend otherwise.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under the Data Privacy Act of 2012 (Republic Act No. 10173) you have the right to be
          informed about what is collected and why, to object to it, to be given a copy of what we
          hold about you, to have anything wrong corrected, to have your information erased or
          blocked where the law allows it, and to be compensated for damage caused by misuse of it.
        </p>
        <p>
          You can exercise any of those by writing to us. If you are not satisfied with how we
          answer, you may complain to the National Privacy Commission.
        </p>
      </Section>

      <Section title="Who we are">
        <p>
          Paws&amp;Found is a student project built for ITS122P — Web Systems and Technologies 2,
          section AM5, Group 3. It is coursework, not a commercial service, and it is run by five
          students rather than by a company.
        </p>
        <p>
          All of the pets, people and incidents in the demonstration data are fictional. Questions
          about your information, or a request to see, correct or remove it, should go to the
          project team:
        </p>

        {/* A privacy notice has to name somebody reachable, or the rights it
            describes have nowhere to go.

            "Privacy contact" rather than "Data Protection Officer": a DPO is a
            role an organisation formally designates under the Data Privacy Act,
            and nobody has designated one here. Claiming the title would be the
            one false statement on a page about honesty.

            An institutional address and no personal mobile number. The Act asks
            for contact details that reach the people responsible, not for a
            private phone number published where anything can crawl it. */}
        <dl className="flex flex-col gap-2 rounded-card border border-border bg-layer p-4 text-sm not-italic">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-fg-muted sm:w-28">Privacy contact</dt>
            <dd className="font-medium text-fg">Paws&amp;Found Project Team</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-fg-muted sm:w-28">Institution</dt>
            <dd className="text-fg">Mapúa University — Makati Campus</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="text-fg-muted sm:w-28">Email</dt>
            <dd>
              <a
                href="mailto:kmvaustria@mymail.mapua.edu.ph"
                className="font-medium break-all text-brand hover:underline"
              >
                kmvaustria@mymail.mapua.edu.ph
              </a>
            </dd>
          </div>
        </dl>

        <p>
          Write to that address for a copy of what we hold about you, for a correction, for
          deletion, or for any other concern about your personal information. If you are not
          satisfied with how we answer, you may complain to the National Privacy Commission at{' '}
          <span className="whitespace-nowrap">privacy.gov.ph</span>.
        </p>
      </Section>

      <Section title="If this notice changes">
        <p>
          Each agreement is recorded against the version of this notice that was showing at the
          time, so we can tell who agreed to which wording. If this notice changes in a way that
          alters what you agreed to, the date at the top changes with it, and we ask the people
          who agreed to the older version again rather than assuming the old answer still
          stands.
        </p>
      </Section>
    </Container>
  )
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title={title} />
      <div className="flex flex-col gap-4 leading-relaxed text-fg-muted">{children}</div>
    </section>
  )
}

function List({ items }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
