/**
 * The Privacy Notice. Every claim here is checked against what the system
 * actually does (see src/pages/public/PrivacyPage.jsx). The Filipino version
 * is a translation of the same notice, not a different policy.
 */
export default {
  title: 'Privacy Notice',
  description:
    'What Paws&Found collects about you, what it shows other people, and what it keeps to itself.',
  updated: 'Last updated {version}. This is the version you agree to when you create an account.',
  short: {
    title: 'The short version',
    name: '<b>Your name is shown</b> on every report you file, so the person on the other side knows who they are dealing with.',
    phone:
      '<b>Your phone number is never shown on a report</b> — a Pet Coordinator sees it when handling a possible match. Your email address is shown only if you choose to publish it, report by report.',
    location: '<b>Locations are approximate.</b> A report points at a barangay, not at your front door.',
    password:
      '<b>Your password is never stored.</b> Only a one-way hash of it is, which nobody — including us — can read back.',
    activity:
      '<b>What you do while signed in is recorded</b> — your sign-ins, the network address and browser they came from, the pages you open and the important things you do, with the time. It is for security and for answering what happened to an account. Browsing without signing in is not recorded.',
  },
  collect: {
    title: 'What we collect',
    account: 'When you create an account:',
    accountList: [
      'Your name.',
      'Your email address, which is also how you sign in.',
      'Your phone number, if you give one. It is optional.',
      'A preferred location, if you set one, so reports near you can be shown first.',
      'A one-way hash of your password. The password itself is never written down anywhere.',
    ],
    report: 'When you file a report:',
    reportList: [
      'What the pet is — species, breed if you know it, colour, size, sex, distinctive markings.',
      'What happened, in your own words.',
      'Where it happened, to roughly barangay level, and the date and approximate time.',
      'Any photographs you upload, and the descriptions you write for them.',
      'Whether you want your email address shown on that report, and whether people may reach you through a Pet Coordinator.',
    ],
    use: 'While you use the system:',
    useList: [
      'Which updates you want to be told about.',
      'A record of sign-ins, failed sign-ins, and changes made to your account — including the date, time and the network address the request came from. This is what lets us tell an account being locked after three wrong passwords from an account being broken into.',
      'A record of each signed-in session: when it started, when it was last used and when it ended (and why — signed out, timed out, ended by a password change), the network (IP) address it came from, and the description your browser gives of itself — its "user agent", which names the browser and operating system. Nothing else about your device is collected.',
      'While you are signed in: the address of each Paws&Found page you open, and the important things you do — saving a draft, submitting, editing or closing a report, review and matching decisions, flags and moderation, profile and account changes, reading notifications — each with the date, time and IP address.',
    ],
    note:
      'The activity record holds the page address and the name of the action, never what you typed: not your password, not the links we email you, not your report’s description or photographs, and not your name or phone number again. Pages opened by somebody who is not signed in are not recorded against anybody.',
  },
  why: {
    title: 'Why we collect it',
    intro:
      'Everything on this page is collected because you agreed to it when you created your account — that agreement is the basis we rely on, and it is recorded against the version of this notice that was showing at the time. Each piece is there for a job, and nothing is collected because it might be useful one day:',
    list: [
      'Your name and contact details let a reunion actually happen — somebody has to be able to reach somebody.',
      'The pet details are what the matching compares. A report with nothing structured in it cannot be matched against anything.',
      'The location and date are what make a comparison plausible: a dog lost in Cebu last March is not the dog found in Makati yesterday.',
      'The sign-in records are there to protect your account, and for an administrator to be able to answer "what happened to this account, and when".',
      'The session and activity records are for security and for investigating misuse — an account used from an unexpected address, somebody working through other people’s reports — and so that an administrator can answer what was done, by which account, from where and when.',
    ],
  },
  public: {
    title: 'What other people can see',
    body: [
      'A report is public. Anyone visiting the site, signed in or not, can see the pet details, your description, the photographs, the approximate location and date, and <b>the name of the person who filed it</b>. That last one is deliberate: an anonymous lost-pet report is difficult to trust and difficult to act on.',
      'Your phone number is <i>never</i> shown on a report, to anybody browsing: the server does not include it in a report at all. Pet Coordinators can see it, because arranging a safe return is their job. Your email address is shown on a report only if you switch it on for that report, and only to signed-in members; when you have not, the server leaves it out of its answer entirely — it is not hidden in the page waiting to be found.',
      'The map shows an approximate area, not a point. Coordinates are recorded at barangay level and drawn as a circle, so the imprecision is visible rather than implied. An exact home address is never asked for and never stored.',
    ],
  },
  inside: {
    title: 'Who inside Paws&Found can see it',
    list: [
      'You can see everything on your own account and your own reports.',
      'A Pet Coordinator can see the reports they are working on, and can look up the contact details of the people involved in a case in order to arrange a handover.',
      'An administrator can see accounts, reports and moderation cases, and the session, activity and security records — including IP addresses and browser descriptions. Pet Coordinators cannot.',
      'Nobody can see your password, because it is not stored.',
      'Notes written during verification are never shown publicly.',
    ],
  },
  matching: {
    title: 'How matching works, and what it does on its own',
    body: [
      'Paws&Found compares every new report against the reports already filed and suggests the ones that might be the same animal. The comparison is arithmetic, not judgement: it scores species, breed, colour, size, how far apart the two locations are and how far apart the two dates are, and adds the parts up. There is no artificial intelligence in it and no photograph is analysed — the pictures are for people to look at, and only people look at them.',
      'A suggestion is only a suggestion. <b>Nothing is decided about you automatically.</b> A possible match does not change your report, does not release your contact details, and does not tell anyone the pet is theirs. A person has to open it, a person has to claim it, and a Pet Coordinator has to verify it before anything happens.',
      'Every suggestion shows the reasons it was made and what it scored on each, so you can see why the system thought two reports were worth comparing — and disagree with it.',
    ],
  },
  keep: {
    title: 'How long we keep it',
    body: [
      'Accounts are suspended rather than deleted. That is a deliberate choice: reports and case histories have to stay readable, and deleting an account would take the record of a reunion — and of anything that went wrong — with it.',
      'So your account, your reports and the record of your account activity are kept for as long as Paws&Found is running. If you want your information removed, ask us and we will do it by hand; there is no self-service delete button, and we would rather say so than pretend otherwise.',
      'The same is true of the session and activity records: nothing deletes them automatically yet. A fixed retention period is something we intend to set, and this notice will say so when it exists.',
    ],
  },
  rights: {
    title: 'Your rights',
    body: [
      'Under the Data Privacy Act of 2012 (Republic Act No. 10173) you have the right to be informed about what is collected and why, to object to it, to be given a copy of what we hold about you, to have anything wrong corrected, to have your information erased or blocked where the law allows it, and to be compensated for damage caused by misuse of it.',
      'You can exercise any of those by writing to us. If you are not satisfied with how we answer, you may complain to the National Privacy Commission.',
    ],
  },
  who: {
    title: 'Who we are',
    body: [
      'Paws&Found is a student project built for ITS122P — Web Systems and Technologies 2, section AM5, Group 3. It is coursework, not a commercial service, and it is run by five students rather than by a company.',
      'All of the pets, people and incidents in the demonstration data are fictional. Questions about your information, or a request to see, correct or remove it, should go to the project team:',
    ],
    contact: 'Privacy contact',
    contactValue: 'Paws&Found Project Team',
    institution: 'Institution',
    institutionValue: 'Mapúa University — Makati Campus',
    email: 'Email',
    after:
      'Write to that address for a copy of what we hold about you, for a correction, for deletion, or for any other concern about your personal information. If you are not satisfied with how we answer, you may complain to the National Privacy Commission at privacy.gov.ph.',
  },
  changes: {
    title: 'If this notice changes',
    body: [
      'Each agreement is recorded against the version of this notice that was showing at the time, so we can tell who agreed to which wording. If this notice changes in a way that alters what you agreed to, the date at the top changes with it.',
      'When it does, an account that agreed to an earlier version is told so the next time it is signed in, with a link to this page. Pressing "Acknowledge" records — with the date, time and network address — that the updated notice was shown; it is not a separate choice about the records described above, which are kept for security either way. Nobody is stopped from using Paws&Found while the message is showing, and nobody is recorded as having seen wording they were not shown.',
    ],
  },
}
