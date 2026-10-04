/**
 * Display words for stored values. The values themselves (`pending_review`,
 * `lost`, `dog`) never change with the language; these are what they are
 * shown as.
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
    lost: 'Lost',
    found: 'Found',
  },
  caseStatus: {
    active: 'Active',
    possible_match: 'Possible Match',
    returned: 'Returned',
    closed: 'Closed',
  },
  publication: {
    draft: 'Draft',
    pending_review: 'Pending review',
    published: 'Published',
    rejected: 'Not approved',
    removed: 'Removed',
  },
  matchStatus: {
    suggested: 'Possible Match',
    verification_requested: 'Verification Requested',
    under_review: 'Under Staff Review',
    confirmed: 'Confirmed Match',
    rejected: 'Rejected',
    dismissed: 'Dismissed by User',
  },
  species: {
    dog: 'Dog',
    cat: 'Cat',
    bird: 'Bird',
    rabbit: 'Rabbit',
    other: 'Other',
  },
  size: {
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    xl: 'Extra Large (XL)',
  },
  sex: {
    male: 'Male',
    female: 'Female',
    unknown: 'Unknown',
  },
  moderationReason: {
    false_report: 'False report',
    spam: 'Spam',
    scam: 'Scam',
    harassment: 'Harassment',
    inappropriate: 'Inappropriate content',
    duplicate: 'Duplicate report',
    other: 'Other',
  },
  colour: {
    black: 'Black',
    white: 'White',
    brown: 'Brown',
    grey: 'Grey',
    cream: 'Cream',
    tan: 'Tan',
    golden: 'Golden',
    orange: 'Orange',
    red: 'Red',
    yellow: 'Yellow',
    green: 'Green',
    blue: 'Blue',
    peach: 'Peach',
    brindle: 'Brindle',
    calico: 'Calico',
    tricolour: 'Tricolour',
    other: 'Other',
  },
  area: 'Province or Metro Manila',
  areaHint:
    'Metro Manila has no provinces, so it is listed as one area; so is BARMM’s Special Geographic Area.',
  city: 'City or municipality',
}
