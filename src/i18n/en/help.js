/** Help & community safety. */
export default {
  eyebrow: 'Guidance & safety',
  title: 'Help & community safety',
  description: 'How to file a report that helps, how a match is checked, and how to stay safe arranging a handover.',
  searchLabel: 'Search help',
  placeholderLong: 'Search help topics, e.g. collar, match or handover',
  placeholderShort: 'Search help topics',
  topicsLabel: 'Help topics',
  topicsMatch: { one: '{count} topic match {query}', other: '{count} topics match {query}' },
  topicsCount: { one: '{count} topic', other: '{count} topics' },
  safetyTitle: 'Before you meet anyone',
  safetyBody:
    'Four things worth settling before a handover is arranged. They apply whether you are collecting a pet or returning one.',
  rules: {
    public: 'Meet in public, and bring someone',
    publicBody: 'A barangay hall, a vet clinic, a busy café. There is no reason a handover has to happen at anybody’s home.',
    daylight: 'Daylight only',
    daylightBody: 'Arrange it for a time when the place you have chosen is open and there are other people around.',
    holdBack: 'Hold one detail back',
    holdBackBody: 'If you found a pet, keep one identifying mark to yourself. The real owner will be able to name it.',
    onPlatform: 'Keep it on Paws&Found',
    onPlatformBody:
      'Anyone pushing to move the conversation somewhere private before ownership is settled is a reason to slow down.',
  },
  custody:
    'Paws&Found does not take custody of any animal and does not attend handovers. A Pet Coordinator helps confirm ownership before contact details are exchanged, but the meeting itself is between the two of you — which is why these four are worth reading.',
  topics: {
    'reporting-lost': {
      title: 'Reporting a lost pet',
      summary: 'What to include so a stranger can recognise your pet.',
      faqs: [
        {
          q: 'What details actually help?',
          a: 'The ones a stranger could check on the spot: colour and markings, size, collar, and anything unusual such as a scar, a bent ear or a short tail. Give the area rather than an exact address, plus the date and approximate time.',
        },
        {
          q: 'Do I need a photo?',
          a: 'No, but it is the single most useful thing you can add. A clear, well-lit picture of the whole animal is what people recognise, and what a coordinator compares against a found report.',
        },
        {
          q: 'When does my report appear publicly?',
          a: 'After a Pet Coordinator has reviewed and approved it. Until then only you and the Pet Coordinators can see it, and it is not compared with other reports. If it is not approved you are told why, and you can edit it and submit it again.',
        },
        {
          q: 'Can I edit a report after filing it?',
          a: 'Yes. Your reports are listed in My Reports, and you can update the details or mark the pet returned at any time.',
        },
      ],
    },
    'reporting-found': {
      title: 'Reporting a found pet',
      summary: 'Filing a sighting, even with nothing to go on.',
      faqs: [
        {
          q: 'The pet has no collar and no name. Can I still report it?',
          a: 'Yes. A found report never asks for a pet name — the finder is not expected to know it. Species, colour, size and where you found it are enough to be useful.',
        },
        {
          q: 'Should I include everything I noticed?',
          a: 'Almost. Keep one identifying detail to yourself — something only the real owner would know — so ownership can be checked later. Everything else helps.',
        },
      ],
    },
    'possible-matches': {
      title: 'Possible matches',
      summary: 'What a match suggestion is, and what it is not.',
      faqs: [
        {
          q: 'How does the system find a match?',
          a: 'It compares structured details between a lost and a found report: species, breed, colour, size, how close the two locations are, how close the dates are, and distinctive characteristics. There is no image recognition and no AI involved.',
        },
        {
          q: 'Does a possible match mean you found my pet?',
          a: 'No. A possible match is a suggestion, never a conclusion. Every match shows exactly which details lined up and which did not, so you can judge it yourself.',
        },
      ],
    },
    'verifying-ownership': {
      title: 'Verifying ownership',
      summary: 'How a claim is checked before anything is arranged.',
      faqs: [
        {
          q: 'What happens after I respond to a match?',
          a: 'The match goes to a Pet Coordinator, who compares both reports and helps confirm ownership before a handover is coordinated. Confirming a match closes both reports as returned.',
        },
        {
          q: 'What counts as proof of ownership?',
          a: 'Earlier photographs, veterinary records, or a description of a detail that was never published — which is why finders are asked to hold one back.',
        },
        {
          q: 'Who can see verification information?',
          a: 'Only the coordinator handling the case. It is never shown on a public report page.',
        },
      ],
    },
    'safe-handovers': {
      title: 'Safe handovers',
      summary: 'Meeting someone to return or collect a pet.',
      faqs: [
        {
          q: 'Where should we meet?',
          a: 'A public place, during daylight, with someone else along. There is no reason a handover needs to happen at anybody’s home.',
        },
        {
          q: 'What should make me cautious?',
          a: 'Anyone who claims a pet without being able to describe it, who cannot answer a question about a detail that was never published, or who pushes to move the conversation off the platform.',
        },
      ],
    },
    privacy: {
      title: 'Privacy',
      summary: 'What a public report page shows about you.',
      faqs: [
        {
          q: 'Is my phone number or email shown?',
          a: 'Your phone number never is — not on a report, a card or the map. A Pet Coordinator can see it when checking a possible match. Your email address is shown only if you choose to share it, report by report, and only to signed-in members. Otherwise the report says you prefer to be reached through a Pet Coordinator. There is no messaging between members.',
        },
        {
          q: 'Does the map show where I live?',
          a: 'No. Report locations are approximate areas, not addresses, and the detail page draws a circle around the pin so the imprecision is visible rather than implied.',
        },
      ],
    },
    'reporting-abuse': {
      title: 'Reporting abuse',
      summary: 'Flagging a listing that should not be there.',
      faqs: [
        {
          q: 'How do I report a listing?',
          a: 'Every report page has a “Report this listing” action. You will be asked to pick a reason: false report, spam, scam, harassment, inappropriate content, duplicate report, or other.',
        },
        {
          q: 'What happens to a flag?',
          a: 'It goes to an administrator for review. They can dismiss it, remove the content, warn the user, or suspend the account.',
        },
        {
          q: 'My account is locked or suspended. What now?',
          a: 'Locked means three wrong passwords in a row; suspended means an administrator stopped the account. Either way only the Paws&Found Administrator, {name}, can restore it, and a password reset does not. Contact them at {email} from the address you sign in with. You can still browse reports without signing in.',
        },
      ],
    },
    'about-service': {
      title: 'About this service',
      summary: 'What Paws&Found is, and what it is not.',
      faqs: [
        {
          q: 'Is Paws&Found an official or a paid service?',
          a: 'No. It is an academic, non-commercial project built by students for Web Systems and Technologies 2. It is not affiliated with, endorsed by or run by any government agency, animal welfare organisation, veterinary clinic or pet business.',
        },
        {
          q: 'Does Paws&Found handle money or rewards?',
          a: 'No. Paws&Found does not process payments or financial transactions, and it has no reward feature. A reward mentioned in a description is between the people involved; Paws&Found does not hold, pay or guarantee it. Never pay anybody to see or get back a pet, and flag a report that asks for money.',
        },
        {
          q: 'Can I trust everything in a report?',
          a: 'Reports are written by the people who file them. A Pet Coordinator reviews each one before it is published, but cannot check every detail, so verify information yourself before you act on it. The Disclaimer explains the limits in full.',
        },
      ],
    },
  },
}
