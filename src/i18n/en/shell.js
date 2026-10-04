/** The frame around every page: navigation, footer, notices, the language control. */
export default {
  loading: 'Loading Paws&Found…',
  skipLink: 'Skip to main content',
  language: {
    // Both languages in the name, so a person who does not read the one
    // showing can still find the control.
    label: 'Language (Wika)',
  },
  workspace: {
    myAccount: 'My account',
    staff: 'Staff workspace',
    admin: 'Administration',
    backToPublic: 'Back to the public site',
    signOut: 'Sign out',
    item: { one: 'item', other: 'items' },
    section: '{label} section: ',
    signedInHere:
      'Signed in on this device. For security, any previous session for this account is no longer valid.',
  },
  navbar: {
    brand: 'Paws&Found',
    account: 'Account',
    accountMenu: ', account menu',
    profileSecurity: 'Profile & account security',
    profile: 'Profile',
    signOut: 'Sign out',
    signIn: 'Sign in',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    demo: 'Demo:',
  },
  footer: {
    tagline:
      'A community platform that helps lost pets and the people looking for them find each other.',
    explore: 'Explore',
    browseLost: 'Browse lost pets',
    browseFound: 'Browse found pets',
    searchAll: 'Search all reports',
    report: 'Report',
    reportLost: 'Report a lost pet',
    reportFound: 'Report a found pet',
    about: 'About',
    aboutUs: 'About Paws&Found',
    howItWorks: 'How it works',
    help: 'Help',
    helpSafety: 'Help & safety',
    safeHandovers: 'Safe handovers',
    privacy: 'Privacy Notice',
    disclaimer: 'Disclaimer',
    ctaTitle: 'Together, we can bring them home.',
    ctaBody: 'Every report helps somebody find the pet they are looking for.',
    ctaButton: 'Report or search now',
    copyright:
      '© 2026 Paws&Found. Academic project for Web Systems and Technologies 2. All pets, people and reports shown are fictional demonstration data.',
    notice:
      'An academic, non-commercial project. Paws&Found does not process payments or financial transactions and is not affiliated with any government agency or animal welfare organisation. <link>Read the disclaimer</link>.',
  },
  session: {
    logout: 'You have been signed out.',
    idle_timeout: 'Your session expired due to inactivity. Please sign in again.',
    idle_timeout_body:
      'Nothing was done on Paws&Found for a while, so the session was ended to protect the account.',
    absolute_timeout: 'Your session has ended. Please sign in again.',
    absolute_timeout_body: 'For security, a session lasts a fixed time however active it is.',
    new_privileged_login: 'Your session ended because this account was signed in on another device.',
    new_privileged_login_body:
      'A Pet Coordinator or Administrator account stays signed in on one device at a time. If that was not you, sign in again and tell the Paws&Found Administrator.',
    password_reset: 'Your session ended because the account password was changed.',
    password_reset_body:
      'Every device signed in to this account was signed out. Sign in with the new password.',
    role_promoted: "Your session ended because this account's access level changed. Please sign in again.",
    privilege_changed:
      "Your session ended because this account's administrator privileges changed. Please sign in again.",
    privilege_changed_body:
      'A Super Administrator changed what this account may do in Administration. Signing in again shows the pages it now has.',
    account_locked: 'Your account is locked.',
    account_locked_body:
      'It was locked after repeated failed sign-in attempts. An administrator must unlock it before you can sign in again.',
    account_suspended: 'Your account has been suspended.',
    account_suspended_body:
      'If you believe this was a mistake or need help restoring access, contact the Paws&Found Administrator.',
    unknown: 'You have been signed out.',
    unknown_body: 'This browser is no longer signed in to Paws&Found.',
    roleChangedTitle: 'Your access level changed',
    roleChangedBody:
      'An administrator changed this account from {from} to {to}. The pages available to you have changed to match.',
    dismiss: 'Dismiss this message',
  },
  privacyUpdate: {
    title: 'Privacy Notice updated',
    body:
      "We've updated our Privacy Notice to explain security and activity records such as sign-in history, IP address and pages visited while signed in.",
    note: 'These records are kept to protect accounts and the service; acknowledging confirms you have been shown the update.',
    review: 'Review Privacy Notice',
    acknowledge: 'Acknowledge',
    saving: 'Saving…',
    failed: 'The acknowledgement could not be saved. Please try again.',
  },
  access: {
    eyebrow: 'Administrator',
    title: 'No access',
    denied: "You don't have permission to access this page.",
    deniedBody:
      'Your administrator level does not include this part of Administration. If you need it, ask a Super Administrator.',
    back: 'Back to the Overview',
  },
}
