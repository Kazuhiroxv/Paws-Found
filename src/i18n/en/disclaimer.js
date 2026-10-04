/**
 * The Disclaimer (Correction 7). Measured wording for an academic system:
 * what Paws&Found is, what it is not, and what it cannot promise. Not a
 * liability waiver, and it says so. The Filipino version says the same
 * things section by section (`npm run test:disclaimer` checks both).
 */
export default {
  title: 'Disclaimer',
  description: 'What Paws&Found is, what it is not, and what it cannot promise.',
  updated: 'Last updated 4 October 2026.',
  intro:
    'Paws&Found is an academic project. Please read this before you rely on anything you find here.',
  sections: {
    academic: {
      title: 'An academic, non-commercial project',
      body: [
        'Paws&Found was built by Computer Science students — Group 3 of ITS122P, Web Systems and Technologies 2, at Mapúa University — as coursework. It is a non-commercial project: nobody pays to use it, and it is not run for profit.',
      ],
    },
    payments: {
      title: 'No money is involved',
      body: [
        'Paws&Found does not process payments or financial transactions. It has no reward, fee or donation feature.',
        'If a report’s description mentions a reward, that is between the people involved: Paws&Found does not hold, pay or guarantee it. Never send money to somebody in order to see or get back a pet. A report that asks for money can be flagged for review.',
      ],
    },
    affiliation: {
      title: 'Not affiliated with any organisation',
      body: [
        'Paws&Found is not affiliated with, endorsed by, or operated by any government agency or local government unit, animal welfare or rescue organisation, veterinary clinic, or commercial pet service. When a report mentions one of these, those are the reporter’s own words.',
      ],
    },
    accuracy: {
      title: 'Information comes from the people who use it',
      body: [
        'Reports, photographs and descriptions are written by the people who file them. A Pet Coordinator reviews each new report before it is published, but cannot check every detail, so information may be incomplete, inaccurate or out of date.',
      ],
    },
    guarantee: {
      title: 'What Paws&Found cannot guarantee',
      body: [
        'Paws&Found helps people report, find and compare lost and found pets, and coordinate a return. It cannot guarantee anyone’s identity, that a person owns a pet, where a pet is, the condition it is in, that a report or photograph is genuine, or that a pet will be recovered.',
        'A possible match is a suggestion worked out from the information given — never a confirmation that two reports are the same animal.',
      ],
    },
    safety: {
      title: 'Check before you act',
      body: ['Verify information independently, and take care when you arrange to meet:'],
      list: [
        'Ask for proof of ownership — photographs, veterinary or vaccination records, or a marking only the owner would know.',
        'Meet in a public, well-lit place, and bring somebody with you.',
        'Share no more personal information than the handover needs.',
        'Never pay to get a pet back.',
        'Flag a report that looks suspicious.',
      ],
      after: [
        'If a pet is injured or a situation is unsafe, contact a veterinarian or the proper local authorities directly.',
      ],
    },
    use: {
      title: 'About this page',
      body: [
        'This page explains the limits of an academic system. It is not a legal contract, and it does not take away any rights you have under Philippine law. Questions are welcome at {email}.',
      ],
    },
  },
  // The short forms, where they matter.
  short: {
    submit:
      'By submitting, you confirm that the information is given in good faith, to the best of your knowledge. Paws&Found cannot independently verify every detail. <link>Read the disclaimer</link>',
    handover:
      'Before a handover: meet in a public place, check that the pet is the one described, and never pay to get a pet back. Paws&Found cannot guarantee anyone’s identity or ownership. <link>Read the safety guidance</link>',
    print:
      'Paws&Found is an academic, non-commercial project. User-submitted information should be independently verified.',
  },
}
