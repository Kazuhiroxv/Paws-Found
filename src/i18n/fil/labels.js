/**
 * Ang mga salitang ipinapakita para sa mga nakaimbak na value. Hindi
 * nagbabago ang mismong value (`pending_review`, `lost`, `dog`).
 *
 * Ang mga pangalan ng role at antas ng Administrator ay nananatiling Ingles:
 * mga opisyal na pangalan ito sa sistema, at mas malinaw kaysa sa salin
 * (docs/localization.md).
 */
export default {
  role: {
    user: 'Customer/User',
    staff: 'Staff / Pet Coordinator',
    admin: 'Administrator',
  },
  adminLevel: {
    moderator: 'Administrator — Moderator',
    manager: 'Administrator — Manager',
    super_admin: 'Super Administrator',
  },
  reportType: {
    lost: 'Nawawala',
    found: 'Natagpuan',
  },
  caseStatus: {
    active: 'Aktibo',
    possible_match: 'Posibleng Tugma',
    returned: 'Naibalik na',
    closed: 'Sarado',
  },
  publication: {
    draft: 'Draft',
    pending_review: 'Hinihintay ang pagsusuri',
    published: 'Nakalathala',
    rejected: 'Hindi inaprubahan',
    removed: 'Inalis',
  },
  matchStatus: {
    suggested: 'Posibleng Tugma',
    verification_requested: 'Hiniling ang beripikasyon',
    under_review: 'Sinusuri ng Staff',
    confirmed: 'Kumpirmadong Tugma',
    rejected: 'Tinanggihan',
    dismissed: 'Ibinasura ng User',
  },
  species: {
    dog: 'Aso',
    cat: 'Pusa',
    bird: 'Ibon',
    rabbit: 'Kuneho',
    other: 'Iba pa',
  },
  size: {
    small: 'Maliit',
    medium: 'Katamtaman',
    large: 'Malaki',
    xl: 'Napakalaki (XL)',
  },
  sex: {
    male: 'Lalaki',
    female: 'Babae',
    unknown: 'Hindi alam',
  },
  moderationReason: {
    false_report: 'Maling report',
    spam: 'Spam',
    scam: 'Scam',
    harassment: 'Panliligalig',
    inappropriate: 'Hindi angkop na nilalaman',
    duplicate: 'Dobleng report',
    other: 'Iba pa',
  },
  colour: {
    black: 'Itim',
    white: 'Puti',
    brown: 'Kayumanggi',
    grey: 'Abuhin',
    cream: 'Krema',
    tan: 'Tan',
    golden: 'Ginintuan',
    orange: 'Kahel',
    red: 'Pula',
    yellow: 'Dilaw',
    green: 'Berde',
    blue: 'Asul',
    peach: 'Peach',
    brindle: 'Brindle (may guhit)',
    calico: 'Calico',
    tricolour: 'Tatlong kulay',
    other: 'Iba pa',
  },
  area: 'Probinsya o Metro Manila',
  areaHint:
    'Walang probinsya ang Metro Manila, kaya isang area ito sa listahan; ganoon din ang Special Geographic Area ng BARMM.',
  city: 'Lungsod o bayan',
}
