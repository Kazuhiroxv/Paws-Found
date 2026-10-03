/**
 * Seed lost and found pet reports.
 *
 * FICTIONAL DEMO DATA (CLAUDE.md §19). Locations are real Philippine
 * barangays/cities but the incidents, pets and reporters are invented.
 *
 * 32 reports, spread across report types, species, statuses and regions —
 * enough for the Explore page's filters to actually have something to filter.
 * When adding more, keep the spread described in docs/mock-data-guide.md.
 *
 * PHOTOS: every report carries a real photograph from `src/assets/`, generated
 * for this project and listed in docs/img-005-pet-photos.md. `report-009` is
 * the exception — the scam report was filed with no photo at all, which is part
 * of why it was flagged. Components still handle a missing photo, because a
 * report filed through the form may not have one.
 *
 * COORDINATES: `precision: 'approximate'` means the pin is the barangay centre,
 * not anyone's doorstep. Nothing here points at a real residence.
 */

import {
  LOCATION_PRECISION,
  PET_SEXES,
  PET_SIZES,
  REPORT_STATUSES,
  REPORT_TYPES,
  SPECIES,
} from '@/constants'

import photo001Milo1 from '@/assets/pet-001-milo-1.jpg'
import photo001Milo2 from '@/assets/pet-001-milo-2.jpg'
import photo002Dog from '@/assets/pet-002-dog.jpg'
import photo003Kitkat from '@/assets/pet-003-kitkat.jpg'
import photo004Cat from '@/assets/pet-004-cat.jpg'
import photo005Bantay from '@/assets/pet-005-bantay.jpg'
import photo006Bird from '@/assets/pet-006-bird.jpg'
import photo007Mochi from '@/assets/pet-007-mochi.jpg'
import photo008Coco from '@/assets/pet-008-coco.jpg'
import photo009Rex from '@/assets/pet-009-rex.png'
import photo010Cat from '@/assets/pet-010-cat.jpg'
import photo011Nala from '@/assets/pet-011-nala.jpg'
import photo012Dog from '@/assets/pet-012-dog.jpg'
import photo013Ming from '@/assets/pet-013-ming.jpg'
import photo014Brownie from '@/assets/pet-014-brownie.jpg'
import photo015Cat from '@/assets/pet-015-cat.jpg'
import photo016Bunbun from '@/assets/pet-016-bunbun.jpg'
import photo017Dog from '@/assets/pet-017-dog.jpg'
import photo018Simba from '@/assets/pet-018-simba.jpg'
import photo019Bird from '@/assets/pet-019-bird.jpg'
import photo020Miso from '@/assets/pet-020-miso.jpg'
import photo021Dog from '@/assets/pet-021-dog.jpg'
import photo022Cookie from '@/assets/pet-022-cookie.jpg'
import photo023Cat from '@/assets/pet-023-cat.jpg'
import photo024Tabby from '@/assets/pet-024-tabby.jpg'
import photo025Chico from '@/assets/pet-025-chico.png'
import photo026Dog from '@/assets/pet-026-dog.png'
import photo027Pilo from '@/assets/pet-027-pilo.png'
import photo028Cat from '@/assets/pet-028-cat.png'
import photo029Sabel from '@/assets/pet-029-sabel.png'
import photo030Rabbit from '@/assets/pet-030-rabbit.png'
import photo031Tuna from '@/assets/pet-031-tuna.png'
import photo032Dog from '@/assets/pet-032-dog.png'

export const petReports = [
  // --- The match-demo pair -------------------------------------------------
  // report-001 and report-002 describe the same dog from both sides. They exist
  // so the Phase 7 matching workflow can be demonstrated convincingly.
  {
    id: 'report-001',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.POSSIBLE_MATCH,
    petName: 'Milo',
    species: SPECIES.DOG,
    breed: 'Shih Tzu',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Brown',
    secondaryColor: 'White',
    distinctiveMarkings:
      'White patch across the chest, slightly bent left ear, wears a red nylon collar with a small bell.',
    description:
      'Milo slipped out of the gate while we were unloading groceries. He is friendly but nervous around traffic and usually hides under parked cars. He answers to his name and to whistling.',
    incidentDate: '2026-09-01',
    incidentTime: '17:30',
    location: {
      label: 'Near Poblacion Public Market, Barangay Poblacion',
      city: 'Makati City',
      province: 'Metro Manila',
      lat: 14.5654,
      lng: 121.0296,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-001a',
        url: photo001Milo1,
        alt: 'Small brown Shih Tzu with a white chest patch, sitting on a tiled floor',
        isPrimary: true,
      },
      {
        id: 'photo-001b',
        url: photo001Milo2,
        alt: 'Close-up of the same brown Shih Tzu showing his slightly bent left ear',
        isPrimary: false,
      },
    ],
    reporterId: 'user-001',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: false,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-001a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-001',
        createdAt: '2026-09-01T10:12:00.000Z',
      },
      {
        id: 'log-001b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        note: 'A found report with similar characteristics was identified.',
        actorId: 'staff-001',
        createdAt: '2026-09-02T03:40:00.000Z',
      },
    ],
    createdAt: '2026-09-01T10:12:00.000Z',
    updatedAt: '2026-09-02T03:40:00.000Z',
  },
  {
    id: 'report-002',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.POSSIBLE_MATCH,
    petName: null,
    species: SPECIES.DOG,
    breed: 'Shih Tzu',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Brown',
    secondaryColor: 'Tan',
    distinctiveMarkings:
      'Light patch on the chest, one ear does not stand up straight. Red collar, no name tag.',
    description:
      'Found this small dog wandering along the service road early in the morning. He was calm and let me pick him up. He is safe at our house and has been fed. Looking for the owner.',
    incidentDate: '2026-09-02',
    incidentTime: '08:15',
    location: {
      label: 'Service road near Jupiter Street, Barangay Bel-Air',
      city: 'Makati City',
      province: 'Metro Manila',
      lat: 14.5606,
      lng: 121.0261,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Alert and responsive. Coat is dirty but no visible injuries.',
    hasCollar: true,
    photos: [
      {
        id: 'photo-002a',
        url: photo002Dog,
        alt: 'Small brown Shih Tzu with a red collar, photographed on a doormat',
        isPrimary: true,
      },
    ],
    reporterId: 'user-003',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: false,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-002a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-003',
        createdAt: '2026-09-02T01:02:00.000Z',
      },
      {
        id: 'log-002b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        note: 'Linked to a lost report with similar characteristics.',
        actorId: 'staff-001',
        createdAt: '2026-09-02T03:40:00.000Z',
      },
    ],
    createdAt: '2026-09-02T01:02:00.000Z',
    updatedAt: '2026-09-02T03:40:00.000Z',
  },

  // --- A weaker, more ambiguous pair ---------------------------------------
  {
    id: 'report-003',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.POSSIBLE_MATCH,
    petName: 'Kitkat',
    species: SPECIES.CAT,
    breed: 'Puspin (Philippine Domestic Shorthair)',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Orange',
    secondaryColor: 'Cream',
    distinctiveMarkings:
      'Orange tabby stripes, short tail with a slight kink at the tip. Spayed, no collar.',
    description:
      'Kitkat is an indoor cat who got out through a window that was left open overnight. She is shy with strangers and will not come when called, but she is food-motivated.',
    incidentDate: '2026-07-29',
    incidentTime: '06:00',
    location: {
      label: 'Along Holy Spirit Drive, Barangay Holy Spirit',
      city: 'Quezon City',
      province: 'Metro Manila',
      lat: 14.6829,
      lng: 121.0736,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-003a',
        url: photo003Kitkat,
        alt: 'Orange tabby cat with a short kinked tail, resting on a windowsill',
        isPrimary: true,
      },
    ],
    reporterId: 'user-002',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: true,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-003a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-002',
        createdAt: '2026-07-29T00:22:00.000Z',
      },
      {
        id: 'log-003b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        // Raised by the matching engine when match-002 was created, so no
        // person is the actor — the same entry the live system writes.
        note: 'A possible match was found.',
        actorId: null,
        createdAt: '2026-07-30T12:30:00.000Z',
      },
    ],
    createdAt: '2026-07-29T00:22:00.000Z',
    updatedAt: '2026-07-30T12:30:00.000Z',
  },
  {
    id: 'report-004',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.POSSIBLE_MATCH,
    petName: null,
    species: SPECIES.CAT,
    breed: 'Puspin (Philippine Domestic Shorthair)',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Orange',
    secondaryColor: 'White',
    distinctiveMarkings:
      'Orange and white, white socks on both front paws. Tail looks shorter than usual.',
    description:
      'A thin orange cat has been staying near our garage for two days. She lets us leave food but will not let anyone carry her yet. Posting in case someone is looking for her.',
    incidentDate: '2026-07-30',
    incidentTime: '19:40',
    location: {
      label: 'Near IBP Road, Barangay Batasan Hills',
      city: 'Quezon City',
      province: 'Metro Manila',
      lat: 14.6893,
      lng: 121.0925,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Thin but active. Eating normally. Not yet examined by a vet.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-004a',
        url: photo004Cat,
        alt: 'Thin orange and white cat sitting beside a garage door at night',
        isPrimary: true,
      },
    ],
    reporterId: 'user-006',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: false,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-004a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-006',
        createdAt: '2026-07-30T12:05:00.000Z',
      },
      {
        id: 'log-004b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        // Raised by the matching engine when match-002 was created, so no
        // person is the actor — the same entry the live system writes.
        note: 'A possible match was found.',
        actorId: null,
        createdAt: '2026-07-30T12:30:00.000Z',
      },
    ],
    createdAt: '2026-07-30T12:05:00.000Z',
    updatedAt: '2026-07-30T12:30:00.000Z',
  },

  // --- Unmatched reports, other regions and species ------------------------
  {
    id: 'report-005',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Bantay',
    species: SPECIES.DOG,
    breed: 'Aspin (Philippine Native Dog)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.LARGE,
    primaryColor: 'Black',
    secondaryColor: 'Tan',
    distinctiveMarkings:
      'Tan markings above both eyes, a healed scar on the right hind leg, thick brown leather collar.',
    description:
      'Bantay is our family guard dog. He went missing after the fireworks on the fiesta weekend and has not come home. He is protective of strangers at first but calms down quickly.',
    incidentDate: '2026-06-14',
    incidentTime: '21:00',
    location: {
      label: 'Near Guadalupe Elementary School, Barangay Guadalupe',
      city: 'Cebu City',
      province: 'Cebu',
      lat: 10.3067,
      lng: 123.8797,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-005a',
        url: photo005Bantay,
        alt: 'Large black and tan native dog standing in a yard',
        isPrimary: true,
      },
    ],
    reporterId: 'user-004',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: true,
      showEmail: true,
    },
    statusHistory: [
      {
        id: 'log-005a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-004',
        createdAt: '2026-06-14T14:30:00.000Z',
      },
    ],
    createdAt: '2026-06-14T14:30:00.000Z',
    updatedAt: '2026-06-14T14:30:00.000Z',
  },
  {
    id: 'report-006',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.BIRD,
    breed: 'Lovebird',
    sex: PET_SEXES.UNKNOWN,
    size: PET_SIZES.SMALL,
    primaryColor: 'Green',
    secondaryColor: 'Peach',
    distinctiveMarkings: 'Green body with a peach-coloured face. Has a small metal leg band.',
    description:
      'This lovebird flew into our laundry area and did not leave. It is clearly used to people and steps onto a finger. We placed it in a spare cage. The leg band suggests it belongs to a breeder or a hobbyist.',
    incidentDate: '2026-06-22',
    incidentTime: '15:20',
    location: {
      label: 'Near Talomo Public Market, Barangay Talomo',
      city: 'Davao City',
      province: 'Davao del Sur',
      lat: 7.0631,
      lng: 125.5486,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Healthy and active. Eating seeds normally. Kept in a spare cage indoors.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-006a',
        url: photo006Bird,
        alt: 'Green lovebird with a peach-coloured face perched inside a wire cage',
        isPrimary: true,
      },
    ],
    reporterId: 'user-005',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: false,
      showEmail: true,
    },
    statusHistory: [
      {
        id: 'log-006a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-005',
        createdAt: '2026-06-22T08:14:00.000Z',
      },
    ],
    createdAt: '2026-06-22T08:14:00.000Z',
    updatedAt: '2026-06-22T08:14:00.000Z',
  },

  // --- A completed case, for the "reunited" story --------------------------
  {
    id: 'report-007',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.RETURNED,
    petName: 'Mochi',
    species: SPECIES.CAT,
    breed: 'Persian',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'White',
    secondaryColor: 'Cream',
    distinctiveMarkings: 'Flat face, very long white coat, blue collar with a small silver tag.',
    description:
      'Mochi was missing for five days after the door was left open during a delivery. She was found two streets away and returned by a neighbour who saw the report here.',
    incidentDate: '2026-05-20',
    incidentTime: '11:45',
    location: {
      label: 'Along Bautista Street, Barangay San Antonio',
      city: 'Makati City',
      province: 'Metro Manila',
      lat: 14.5637,
      lng: 121.0125,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-007a',
        url: photo007Mochi,
        alt: 'Long-haired white Persian cat wearing a blue collar',
        isPrimary: true,
      },
    ],
    reporterId: 'user-003',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: false,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-007a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-003',
        createdAt: '2026-05-20T04:50:00.000Z',
      },
      {
        id: 'log-007b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        note: 'A neighbour submitted a found report with matching characteristics.',
        actorId: 'staff-002',
        createdAt: '2026-05-24T02:15:00.000Z',
      },
      {
        id: 'log-007c',
        status: REPORT_STATUSES.RETURNED,
        note: 'Ownership verified by the Pet Coordinator. Pet returned to the owner.',
        actorId: 'staff-002',
        createdAt: '2026-05-25T07:30:00.000Z',
      },
    ],
    createdAt: '2026-05-20T04:50:00.000Z',
    updatedAt: '2026-05-25T07:30:00.000Z',
  },

  // The found half of the completed case above. Kept so the reunion story is
  // internally consistent: a returned lost report always has a found report and
  // a confirmed match behind it.
  {
    id: 'report-010',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.RETURNED,
    petName: null,
    species: SPECIES.CAT,
    breed: 'Persian',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'White',
    secondaryColor: 'Cream',
    distinctiveMarkings: 'Very long white coat, flat face, blue collar with a silver tag.',
    description:
      'Found a long-haired white cat hiding under a parked van on our street. She was matted and hungry. We kept her indoors while looking for the owner.',
    incidentDate: '2026-05-24',
    incidentTime: '09:20',
    location: {
      label: 'Along Estrella Street, Barangay San Antonio',
      city: 'Makati City',
      province: 'Metro Manila',
      lat: 14.5661,
      lng: 121.0161,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Matted coat and hungry, otherwise healthy. Given food and water.',
    hasCollar: true,
    photos: [
      {
        id: 'photo-010a',
        url: photo010Cat,
        alt: 'Long-haired white cat with a matted coat sitting on a folded towel',
        isPrimary: true,
      },
    ],
    reporterId: 'user-001',
    contactPreferences: {
      allowPlatformContact: true,
      showPhone: false,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-010a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-001',
        createdAt: '2026-05-24T01:35:00.000Z',
      },
      {
        id: 'log-010b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        note: 'Linked to a lost report filed four days earlier.',
        actorId: 'staff-002',
        createdAt: '2026-05-24T02:15:00.000Z',
      },
      {
        id: 'log-010c',
        status: REPORT_STATUSES.RETURNED,
        note: 'Ownership verified by the Pet Coordinator. Pet returned to the owner.',
        actorId: 'staff-002',
        createdAt: '2026-05-25T07:30:00.000Z',
      },
    ],
    createdAt: '2026-05-24T01:35:00.000Z',
    updatedAt: '2026-05-25T07:30:00.000Z',
  },

  // --- A closed case that never resolved -----------------------------------
  {
    id: 'report-008',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.CLOSED,
    petName: 'Coco',
    species: SPECIES.DOG,
    breed: 'Beagle',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Tricolour',
    secondaryColor: 'White',
    distinctiveMarkings: 'Classic beagle tricolour, white tip on the tail, floppy ears.',
    description:
      'Coco went missing near the subdivision gate. The family has since moved provinces and asked for the report to be closed.',
    incidentDate: '2026-04-12',
    incidentTime: '07:10',
    location: {
      label: 'Near the subdivision gate, Barangay Novaliches Proper',
      city: 'Quezon City',
      province: 'Metro Manila',
      lat: 14.7167,
      lng: 121.0333,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-008a',
        url: photo008Coco,
        alt: 'Tricolour beagle with floppy ears sitting on grass',
        isPrimary: true,
      },
    ],
    reporterId: 'user-002',
    contactPreferences: {
      allowPlatformContact: false,
      showPhone: false,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-008a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-002',
        createdAt: '2026-04-12T01:40:00.000Z',
      },
      {
        id: 'log-008b',
        status: REPORT_STATUSES.CLOSED,
        note: 'Closed at the reporter’s request.',
        actorId: 'user-002',
        createdAt: '2026-05-16T09:00:00.000Z',
      },
    ],
    createdAt: '2026-04-12T01:40:00.000Z',
    updatedAt: '2026-05-16T09:00:00.000Z',
  },

  // --- An unlinked pair the Phase 7 algorithm should be able to find --------
  // report-011 and report-012 describe the same dog a day apart in the same
  // city, but no match record exists for them on purpose: they are the test
  // case for the matching algorithm, not a demonstration of its output.
  {
    id: 'report-011',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Nala',
    species: SPECIES.DOG,
    breed: 'Labrador Retriever',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.LARGE,
    primaryColor: 'Cream',
    secondaryColor: 'White',
    distinctiveMarkings:
      'Pale cream coat, faint scar above the right eye, blue collar with a bone-shaped tag.',
    description:
      'Nala pushed through a gap in the fence during a thunderstorm. She is gentle with children but panics at loud noises and will keep running.',
    incidentDate: '2026-08-03',
    incidentTime: '20:15',
    location: {
      label: 'Near Maginhawa Street, Barangay Teachers Village East',
      city: 'Quezon City',
      province: 'Metro Manila',
      lat: 14.6478,
      lng: 121.0631,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-011a',
        url: photo011Nala,
        alt: 'Large cream-coloured Labrador wearing a blue collar',
        isPrimary: true,
      },
    ],
    reporterId: 'user-002',
    contactPreferences: { allowPlatformContact: true, showPhone: true, showEmail: false },
    statusHistory: [
      {
        id: 'log-011a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-002',
        createdAt: '2026-08-03T13:40:00.000Z',
      },
    ],
    createdAt: '2026-08-03T13:40:00.000Z',
    updatedAt: '2026-08-03T13:40:00.000Z',
  },
  {
    id: 'report-012',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.DOG,
    breed: 'Labrador Retriever',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.LARGE,
    primaryColor: 'Cream',
    secondaryColor: 'White',
    distinctiveMarkings: 'Light-coloured big dog, small scar near one eye, blue collar, no tag.',
    description:
      "A large pale dog followed my kids home from the store and would not leave. Very friendly, clearly someone's pet. She is in our garage where it is dry.",
    incidentDate: '2026-08-12',
    incidentTime: '07:50',
    location: {
      label: 'Near Kalayaan Avenue, Barangay Sikatuna Village',
      city: 'Quezon City',
      province: 'Metro Manila',
      lat: 14.6402,
      lng: 121.0587,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Wet and tired but unhurt. Ate a full meal and slept.',
    hasCollar: true,
    photos: [
      {
        id: 'photo-012a',
        url: photo012Dog,
        alt: 'Cream-coloured Labrador lying on a blanket in a garage',
        isPrimary: true,
      },
    ],
    reporterId: 'user-006',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-012a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-006',
        createdAt: '2026-08-12T00:12:00.000Z',
      },
    ],
    createdAt: '2026-08-12T00:12:00.000Z',
    updatedAt: '2026-08-12T00:12:00.000Z',
  },

  // --- Spread across regions, species and statuses --------------------------
  {
    id: 'report-013',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Ming',
    species: SPECIES.CAT,
    breed: 'Puspin (Philippine Domestic Shorthair)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'White',
    secondaryColor: 'Grey',
    distinctiveMarkings: 'White with grey patches over both ears, one eye is pale blue.',
    description:
      "Ming is barely a year old and has never been outside on his own. He was last seen on the roof of the neighbour's extension.",
    incidentDate: '2026-07-05',
    incidentTime: '05:30',
    location: {
      label: 'Near Sanciangko Street, Barangay Kalubihan',
      city: 'Cebu City',
      province: 'Cebu',
      lat: 10.2965,
      lng: 123.8938,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-013a',
        url: photo013Ming,
        alt: 'Young white and grey cat with one pale blue eye',
        isPrimary: true,
      },
    ],
    reporterId: 'user-004',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-013a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-004',
        createdAt: '2026-07-05T02:10:00.000Z',
      },
    ],
    createdAt: '2026-07-05T02:10:00.000Z',
    updatedAt: '2026-07-05T02:10:00.000Z',
  },
  {
    id: 'report-014',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.CLOSED,
    petName: 'Brownie',
    species: SPECIES.DOG,
    breed: 'Aspin (Philippine Native Dog)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Brown',
    secondaryColor: 'White',
    distinctiveMarkings: 'Brown with a white blaze down the muzzle and white front paws.',
    description:
      'Brownie disappeared from the yard overnight. The family searched for three weeks and has asked for the report to be closed.',
    incidentDate: '2026-04-24',
    incidentTime: '22:00',
    location: {
      label: 'Near Burgos Street, Barangay Villamonte',
      city: 'Bacolod City',
      province: 'Negros Occidental',
      lat: 10.6714,
      lng: 122.9531,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-014a',
        url: photo014Brownie,
        alt: 'Brown native dog with a white blaze on its muzzle',
        isPrimary: true,
      },
    ],
    reporterId: 'user-005',
    contactPreferences: { allowPlatformContact: false, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-014a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-005',
        createdAt: '2026-04-24T15:05:00.000Z',
      },
      {
        id: 'log-014b',
        status: REPORT_STATUSES.CLOSED,
        note: "Closed at the reporter's request.",
        actorId: 'user-005',
        createdAt: '2026-05-17T01:20:00.000Z',
      },
    ],
    createdAt: '2026-04-24T15:05:00.000Z',
    updatedAt: '2026-05-17T01:20:00.000Z',
  },
  {
    id: 'report-015',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.CAT,
    breed: 'Persian',
    sex: PET_SEXES.UNKNOWN,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Grey',
    secondaryColor: 'White',
    distinctiveMarkings: 'Very long grey coat, flat face, badly matted. No collar.',
    description:
      'This cat has been sheltering under the stairs of our building for about a week. Someone must be missing it — it is clearly not a street cat.',
    incidentDate: '2026-08-06',
    incidentTime: '17:00',
    location: {
      label: 'Near Iznart Street, Barangay Sampaguita',
      city: 'Iloilo City',
      province: 'Iloilo',
      lat: 10.6969,
      lng: 122.5644,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Matted coat, underweight. Not yet seen by a vet.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-015a',
        url: photo015Cat,
        alt: 'Long-haired grey Persian cat with a matted coat',
        isPrimary: true,
      },
    ],
    reporterId: 'user-004',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: true },
    statusHistory: [
      {
        id: 'log-015a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-004',
        createdAt: '2026-08-06T09:30:00.000Z',
      },
    ],
    createdAt: '2026-08-06T09:30:00.000Z',
    updatedAt: '2026-08-06T09:30:00.000Z',
  },
  {
    id: 'report-016',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Bunbun',
    species: SPECIES.RABBIT,
    breed: 'Holland Lop',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'White',
    secondaryColor: 'Brown',
    distinctiveMarkings: 'White with brown patches around both eyes and floppy ears.',
    description:
      'Bunbun got out when the hutch door was left unlatched. She will not go far from cover and is most likely hiding in a garden nearby.',
    incidentDate: '2026-07-17',
    incidentTime: '16:20',
    location: {
      label: 'Near Session Road, Barangay Kayang-Hilltop',
      city: 'Baguio City',
      province: 'Benguet',
      lat: 16.4119,
      lng: 120.5931,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-016a',
        url: photo016Bunbun,
        alt: 'White lop-eared rabbit with brown patches around its eyes',
        isPrimary: true,
      },
    ],
    reporterId: 'user-003',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-016a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-003',
        createdAt: '2026-07-17T08:45:00.000Z',
      },
    ],
    createdAt: '2026-07-17T08:45:00.000Z',
    updatedAt: '2026-07-17T08:45:00.000Z',
  },
  {
    id: 'report-017',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.DOG,
    breed: 'Chihuahua',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Tan',
    secondaryColor: 'White',
    distinctiveMarkings: 'Very small, large ears, wearing a knitted red sweater.',
    description:
      'Found shivering beside the highway. Someone clearly cares for this dog — the sweater looks handmade. Keeping him warm until the owner is found.',
    incidentDate: '2026-08-09',
    incidentTime: '06:40',
    location: {
      label: 'Near Limketkai Drive, Barangay Nazareth',
      city: 'Cagayan de Oro',
      province: 'Misamis Oriental',
      lat: 8.4822,
      lng: 124.6472,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Cold and frightened at first, now settled and eating.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-017a',
        url: photo017Dog,
        alt: 'Small tan Chihuahua wearing a knitted red sweater',
        isPrimary: true,
      },
    ],
    reporterId: 'user-005',
    contactPreferences: { allowPlatformContact: true, showPhone: true, showEmail: false },
    statusHistory: [
      {
        id: 'log-017a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-005',
        createdAt: '2026-08-09T00:05:00.000Z',
      },
    ],
    createdAt: '2026-08-09T00:05:00.000Z',
    updatedAt: '2026-08-09T00:05:00.000Z',
  },
  {
    id: 'report-018',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Simba',
    species: SPECIES.DOG,
    breed: 'Golden Retriever',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.LARGE,
    primaryColor: 'Golden',
    secondaryColor: '',
    distinctiveMarkings: 'Thick golden coat, greying muzzle, walks with a slight limp.',
    description:
      'Simba is eleven years old and hard of hearing, so calling out may not reach him. He walks slowly and cannot have gone far.',
    incidentDate: '2026-07-11',
    incidentTime: '09:00',
    location: {
      label: 'Near McKinley Parkway, Barangay Fort Bonifacio',
      city: 'Taguig City',
      province: 'Metro Manila',
      lat: 14.5486,
      lng: 121.0509,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-018a',
        url: photo018Simba,
        alt: 'Elderly golden retriever with a greying muzzle',
        isPrimary: true,
      },
    ],
    reporterId: 'user-001',
    contactPreferences: { allowPlatformContact: true, showPhone: true, showEmail: true },
    statusHistory: [
      {
        id: 'log-018a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-001',
        createdAt: '2026-07-11T02:30:00.000Z',
      },
    ],
    createdAt: '2026-07-11T02:30:00.000Z',
    updatedAt: '2026-07-11T02:30:00.000Z',
  },
  {
    id: 'report-019',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.BIRD,
    breed: 'Cockatiel',
    sex: PET_SEXES.UNKNOWN,
    size: PET_SIZES.SMALL,
    primaryColor: 'Grey',
    secondaryColor: 'Yellow',
    distinctiveMarkings: 'Grey body, yellow crest, orange cheek patches. Whistles a tune.',
    description:
      'Landed on our clothesline and let my daughter pick it up straight away. It whistles the same short tune over and over, so somebody taught it.',
    incidentDate: '2026-08-15',
    incidentTime: '11:10',
    location: {
      label: 'Near Rizal Avenue, Barangay Maningning',
      city: 'Puerto Princesa',
      province: 'Palawan',
      lat: 9.7392,
      lng: 118.7353,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Healthy and tame. Kept in a borrowed cage.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-019a',
        url: photo019Bird,
        alt: 'Grey cockatiel with a yellow crest and orange cheek patches',
        isPrimary: true,
      },
    ],
    reporterId: 'user-006',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: true },
    statusHistory: [
      {
        id: 'log-019a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-006',
        createdAt: '2026-08-15T04:00:00.000Z',
      },
    ],
    createdAt: '2026-08-15T04:00:00.000Z',
    updatedAt: '2026-08-15T04:00:00.000Z',
  },
  {
    id: 'report-020',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.RETURNED,
    petName: 'Miso',
    species: SPECIES.CAT,
    breed: 'Siamese',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Cream',
    secondaryColor: 'Brown',
    distinctiveMarkings: 'Cream body with dark brown face, ears, paws and tail. Blue eyes.',
    description:
      'Miso slipped out during a delivery. A neighbour two streets away recognised him from this report and brought him home the next morning.',
    incidentDate: '2026-04-18',
    incidentTime: '14:25',
    location: {
      label: 'Near Boni Avenue, Barangay Plainview',
      city: 'Mandaluyong City',
      province: 'Metro Manila',
      lat: 14.5776,
      lng: 121.0327,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-020a',
        url: photo020Miso,
        alt: 'Siamese cat with a cream body and dark brown face',
        isPrimary: true,
      },
    ],
    reporterId: 'user-003',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-020a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-003',
        createdAt: '2026-04-18T06:40:00.000Z',
      },
      {
        id: 'log-020b',
        status: REPORT_STATUSES.RETURNED,
        note: 'Returned by a neighbour who recognised him from the report.',
        actorId: 'user-003',
        createdAt: '2026-04-19T01:15:00.000Z',
      },
    ],
    createdAt: '2026-04-18T06:40:00.000Z',
    updatedAt: '2026-04-19T01:15:00.000Z',
  },
  {
    id: 'report-021',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.DOG,
    breed: 'Aspin (Philippine Native Dog)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Black',
    secondaryColor: 'White',
    distinctiveMarkings: 'Black with a white chest and one white back foot. Very thin.',
    description:
      "Has been sleeping outside the sari-sari store for several days. Friendly with everyone, so he was somebody's dog before this.",
    incidentDate: '2026-08-18',
    incidentTime: '18:30',
    location: {
      label: 'Near Quimpo Boulevard, Barangay Matina Crossing',
      city: 'Davao City',
      province: 'Davao del Sur',
      lat: 7.0665,
      lng: 125.5932,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Thin and dusty, no visible injuries. Eating well.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-021a',
        url: photo021Dog,
        alt: 'Thin black native dog with a white chest',
        isPrimary: true,
      },
    ],
    reporterId: 'user-005',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-021a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-005',
        createdAt: '2026-08-18T11:00:00.000Z',
      },
    ],
    createdAt: '2026-08-18T11:00:00.000Z',
    updatedAt: '2026-08-18T11:00:00.000Z',
  },
  {
    id: 'report-022',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Cookie',
    species: SPECIES.DOG,
    breed: 'Pomeranian',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Orange',
    secondaryColor: 'Cream',
    distinctiveMarkings: 'Fluffy orange coat, recently trimmed short, pink collar with a bell.',
    description:
      'Cookie was groomed two days before she went missing, so she looks much smaller and fluffier than in older photos. She barks at strangers.',
    incidentDate: '2026-07-24',
    incidentTime: '15:45',
    location: {
      label: 'Near Fields Avenue, Barangay Balibago',
      city: 'Angeles City',
      province: 'Pampanga',
      lat: 15.1694,
      lng: 120.5906,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-022a',
        url: photo022Cookie,
        alt: 'Small fluffy orange Pomeranian with a pink collar',
        isPrimary: true,
      },
    ],
    reporterId: 'user-002',
    contactPreferences: { allowPlatformContact: true, showPhone: true, showEmail: false },
    statusHistory: [
      {
        id: 'log-022a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-002',
        createdAt: '2026-07-24T08:20:00.000Z',
      },
    ],
    createdAt: '2026-07-24T08:20:00.000Z',
    updatedAt: '2026-07-24T08:20:00.000Z',
  },
  {
    id: 'report-023',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.RETURNED,
    petName: null,
    species: SPECIES.CAT,
    breed: 'Puspin (Philippine Domestic Shorthair)',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Grey',
    secondaryColor: 'Black',
    distinctiveMarkings: 'Grey tabby with black stripes and a notched right ear.',
    description:
      'Found crying inside a parked jeepney. The owner saw this report the same evening and collected her, notched ear and all.',
    incidentDate: '2026-06-06',
    incidentTime: '19:15',
    location: {
      label: 'Near Sumulong Highway, Barangay Mayamot',
      city: 'Antipolo City',
      province: 'Rizal',
      lat: 14.6116,
      lng: 121.1355,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Frightened but unhurt.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-023a',
        url: photo023Cat,
        alt: 'Grey tabby cat with a notched right ear',
        isPrimary: true,
      },
    ],
    reporterId: 'user-006',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-023a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-006',
        createdAt: '2026-06-06T11:30:00.000Z',
      },
      {
        id: 'log-023b',
        status: REPORT_STATUSES.RETURNED,
        note: 'Owner recognised the notched ear and collected her the same evening.',
        actorId: 'user-006',
        createdAt: '2026-06-06T14:05:00.000Z',
      },
    ],
    createdAt: '2026-06-06T11:30:00.000Z',
    updatedAt: '2026-06-06T14:05:00.000Z',
  },
  {
    id: 'report-024',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Tabby',
    species: SPECIES.CAT,
    breed: 'Puspin (Philippine Domestic Shorthair)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Brown',
    secondaryColor: 'Black',
    distinctiveMarkings: 'Brown tabby, very large for a puspin, missing the tip of his left ear.',
    description:
      'Tabby roams the neighbourhood most days but always comes back by dinner. He has now been gone five days, which is not like him.',
    incidentDate: '2026-06-27',
    incidentTime: '17:00',
    location: {
      label: 'Near Governor Camins Avenue, Barangay Camino Nuevo',
      city: 'Zamboanga City',
      province: 'Zamboanga del Sur',
      lat: 6.9128,
      lng: 122.0761,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-024a',
        url: photo024Tabby,
        alt: 'Large brown tabby cat with a missing left ear tip',
        isPrimary: true,
      },
    ],
    reporterId: 'user-004',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: true },
    statusHistory: [
      {
        id: 'log-024a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-004',
        createdAt: '2026-06-27T10:15:00.000Z',
      },
    ],
    createdAt: '2026-06-27T10:15:00.000Z',
    updatedAt: '2026-06-27T10:15:00.000Z',
  },

  // --- A flagged report, for the moderation queue --------------------------
  {
    id: 'report-009',
    reportType: REPORT_TYPES.LOST,
    // Removed by moderation — a publication decision, not a case closure
    // (Correction 4). The case itself was never closed: it stays Active.
    status: REPORT_STATUSES.ACTIVE,
    publicationStatus: 'removed',
    publicationHistory: [
      {
        previous: 'published',
        state: 'removed',
        note: 'Removed by an administrator following a moderation review.',
        actorId: 'admin-001',
        createdAt: '2026-05-09T02:20:00.000Z',
      },
    ],
    petName: 'Rex',
    species: SPECIES.DOG,
    breed: 'German Shepherd',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.LARGE,
    primaryColor: 'Black',
    secondaryColor: 'Tan',
    distinctiveMarkings: 'None given.',
    description:
      'Reward offered for information. Contact through the number in this description only.',
    incidentDate: '2026-05-08',
    incidentTime: '12:00',
    location: {
      label: 'Barangay 659, Sampaloc',
      city: 'Manila',
      province: 'Metro Manila',
      lat: 14.6091,
      lng: 120.9938,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-009a',
        url: photo009Rex,
        alt: 'Large black and tan dog with upright ears and a long muzzle, lying on a concrete driveway beside potted plants',
        isPrimary: true,
      },
    ],
    reporterId: 'user-007',
    contactPreferences: {
      allowPlatformContact: false,
      showPhone: true,
      showEmail: false,
    },
    statusHistory: [
      {
        id: 'log-009a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-007',
        createdAt: '2026-05-08T05:00:00.000Z',
      },
    ],
    createdAt: '2026-05-08T05:00:00.000Z',
    updatedAt: '2026-05-09T02:20:00.000Z',
  },

  // ---------------------------------------------------------------------------
  // Second batch, filed 18-29 August 2026.
  //
  // Added so the demonstration does not open on a page where the newest report
  // is already a fortnight old. `report-025` and `report-026` are a deliberate
  // lost/found pair, two days and one barangay apart, which gives the matching
  // workflow a current case to run on rather than only the July ones.
  //
  // PHOTOS: pending. These carry no image yet (IMG-011 in
  // docs/image-requirements.md), so the components fall back to the neutral
  // placeholder — exactly as they do for a report filed without one.
  // ---------------------------------------------------------------------------
  {
    id: 'report-025',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.POSSIBLE_MATCH,
    petName: 'Chico',
    species: SPECIES.DOG,
    breed: 'Aspin (Philippine Native Dog)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Brown',
    secondaryColor: 'White',
    distinctiveMarkings:
      'White blaze running down the muzzle, white front socks, and a kink near the end of the tail.',
    description:
      'Chico slipped out when the gate was left open for a delivery. He is friendly but shy with strangers and will not come if called by someone he does not know. He answers to a whistle.',
    incidentDate: '2026-09-05',
    incidentTime: '16:30',
    location: {
      label: 'Near Quimpo Boulevard, Barangay Matina Crossing',
      city: 'Davao City',
      province: 'Davao del Sur',
      lat: 7.0658,
      lng: 125.5981,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-025a',
        url: photo025Chico,
        alt: 'Brown Aspin with a white blaze down the muzzle, a white chest and white front socks, standing in a concrete alley beside potted plants',
        isPrimary: true,
      },
    ],
    reporterId: 'user-002',
    contactPreferences: { allowPlatformContact: true, showPhone: true, showEmail: false },
    statusHistory: [
      {
        id: 'log-025a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-002',
        createdAt: '2026-09-05T09:40:00.000Z',
      },
      {
        id: 'log-025b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        note: 'A found report filed nearby shares the species, breed and markings.',
        actorId: 'user-008',
        createdAt: '2026-09-07T02:15:00.000Z',
      },
    ],
    createdAt: '2026-09-05T09:40:00.000Z',
    updatedAt: '2026-09-07T02:15:00.000Z',
  },
  {
    id: 'report-026',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.POSSIBLE_MATCH,
    petName: null,
    species: SPECIES.DOG,
    breed: 'Aspin (Philippine Native Dog)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Brown',
    secondaryColor: 'White',
    distinctiveMarkings:
      'White stripe on the face and white paws in front. The tail bends at the tip.',
    description:
      'This dog followed my tricycle home from the market and would not leave. He is well fed and clearly someone’s pet. He is staying in our yard until the owner turns up.',
    incidentDate: '2026-09-07',
    incidentTime: '07:15',
    location: {
      label: 'Near Ecoland Drive, Barangay Talomo',
      city: 'Davao City',
      province: 'Davao del Sur',
      lat: 7.0731,
      lng: 125.5872,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Healthy, well fed, no injuries. No collar.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-026a',
        url: photo026Dog,
        alt: 'Brown and white Aspin seen from its left side on a residential street, with a white face stripe, white paws and a curled tail',
        isPrimary: true,
      },
    ],
    reporterId: 'user-006',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: true },
    statusHistory: [
      {
        id: 'log-026a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-006',
        createdAt: '2026-09-07T01:05:00.000Z',
      },
      {
        id: 'log-026b',
        status: REPORT_STATUSES.POSSIBLE_MATCH,
        note: 'A lost report filed two days earlier describes the same markings.',
        actorId: 'user-008',
        createdAt: '2026-09-07T02:15:00.000Z',
      },
    ],
    createdAt: '2026-09-07T01:05:00.000Z',
    updatedAt: '2026-09-07T02:15:00.000Z',
  },
  {
    id: 'report-027',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Pilo',
    species: SPECIES.CAT,
    breed: 'Puspin (Philippine Domestic Shorthair)',
    sex: PET_SEXES.MALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Orange',
    secondaryColor: 'White',
    distinctiveMarkings:
      'Orange tabby with a white chest and chin. Notch in the right ear from a fight last year.',
    description:
      'Pilo has never gone further than the next house. He did not come in for his evening meal and has not been seen since. He is neutered and very vocal, so he is hard to miss.',
    incidentDate: '2026-09-04',
    incidentTime: '18:45',
    location: {
      label: 'Near Diversion Road, Barangay San Rafael',
      city: 'Iloilo City',
      province: 'Iloilo',
      lat: 10.7202,
      lng: 122.5621,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-027a',
        url: photo027Pilo,
        alt: 'Orange tabby cat with a white chin, chest and front paws, sitting on a concrete step beside a potted plant',
        isPrimary: true,
      },
    ],
    reporterId: 'user-004',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: true },
    statusHistory: [
      {
        id: 'log-027a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-004',
        createdAt: '2026-09-04T13:20:00.000Z',
      },
    ],
    createdAt: '2026-09-04T13:20:00.000Z',
    updatedAt: '2026-09-04T13:20:00.000Z',
  },
  {
    id: 'report-028',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.CAT,
    breed: '',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.SMALL,
    primaryColor: 'Grey',
    secondaryColor: 'White',
    distinctiveMarkings:
      'Grey and white, long haired, with a very bushy tail. Wearing a thin blue collar with no tag.',
    description:
      'Found sheltering under a parked jeepney during the rain. She is thin and was shivering, so we took her in and dried her off. She is eating now. The collar suggests she has an owner somewhere.',
    incidentDate: '2026-08-30',
    incidentTime: '20:10',
    location: {
      label: 'Near Leonard Wood Road, Barangay Lualhati',
      city: 'Baguio City',
      province: 'Benguet',
      lat: 16.4118,
      lng: 120.6039,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Thin and cold when found, warming up and eating well now. No injuries.',
    hasCollar: true,
    photos: [
      {
        id: 'photo-028a',
        url: photo028Cat,
        alt: 'Long-haired grey and white cat wearing a blue collar, standing on a concrete path with its bushy tail raised',
        isPrimary: true,
      },
    ],
    reporterId: 'user-007',
    contactPreferences: { allowPlatformContact: true, showPhone: true, showEmail: false },
    statusHistory: [
      {
        id: 'log-028a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-007',
        createdAt: '2026-08-30T14:55:00.000Z',
      },
    ],
    createdAt: '2026-08-30T14:55:00.000Z',
    updatedAt: '2026-08-30T14:55:00.000Z',
  },
  {
    id: 'report-029',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Sabel',
    species: SPECIES.DOG,
    breed: 'Beagle',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Tricolour',
    secondaryColor: 'White',
    distinctiveMarkings:
      'Classic beagle tricolour with a white tail tip. Wears a red collar with a small brass bell.',
    description:
      'Sabel followed a scent out of the subdivision gate during a walk and did not come back when called. She is food motivated and will approach anyone holding something to eat.',
    incidentDate: '2026-08-26',
    incidentTime: '06:00',
    location: {
      label: 'Near Lacson Street, Barangay Mandalagan',
      city: 'Bacolod City',
      province: 'Negros Occidental',
      lat: 10.6785,
      lng: 122.9553,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: true,
    photos: [
      {
        id: 'photo-029a',
        url: photo029Sabel,
        alt: 'Tricolour beagle with a white-tipped tail, wearing a red collar with a small brass bell, standing on grass',
        isPrimary: true,
      },
    ],
    reporterId: 'user-003',
    contactPreferences: { allowPlatformContact: true, showPhone: true, showEmail: true },
    statusHistory: [
      {
        id: 'log-029a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-003',
        createdAt: '2026-08-26T01:30:00.000Z',
      },
    ],
    createdAt: '2026-08-26T01:30:00.000Z',
    updatedAt: '2026-08-26T01:30:00.000Z',
  },
  {
    id: 'report-030',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.RABBIT,
    breed: '',
    sex: PET_SEXES.UNKNOWN,
    size: PET_SIZES.SMALL,
    primaryColor: 'White',
    secondaryColor: 'Grey',
    distinctiveMarkings: 'White with grey ears and a grey patch over one eye. Lop eared.',
    description:
      'A rabbit was hopping around the covered court in the middle of the afternoon. Someone caught it before a dog did. It is in a borrowed cage at the barangay hall with food and water.',
    incidentDate: '2026-09-06',
    incidentTime: '15:00',
    location: {
      label: 'Near Kalayaan Avenue, Barangay Diliman',
      city: 'Quezon City',
      province: 'Metro Manila',
      lat: 14.6488,
      lng: 121.0509,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: 'Alert and eating. No visible injuries.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-030a',
        url: photo030Rabbit,
        alt: 'White lop-eared rabbit with grey ears and a grey patch over one eye, sitting inside a wire cage',
        isPrimary: true,
      },
    ],
    reporterId: 'user-005',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: false },
    statusHistory: [
      {
        id: 'log-030a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-005',
        createdAt: '2026-09-06T08:05:00.000Z',
      },
    ],
    createdAt: '2026-09-06T08:05:00.000Z',
    updatedAt: '2026-09-06T08:05:00.000Z',
  },
  {
    id: 'report-031',
    reportType: REPORT_TYPES.LOST,
    status: REPORT_STATUSES.ACTIVE,
    petName: 'Tuna',
    species: SPECIES.CAT,
    breed: 'Persian',
    sex: PET_SEXES.FEMALE,
    size: PET_SIZES.MEDIUM,
    primaryColor: 'Cream',
    secondaryColor: '',
    distinctiveMarkings:
      'Flat face, very thick cream coat, and one eye that waters constantly. Recently shaved along her back for a skin treatment.',
    description:
      'Tuna is an indoor cat and got out through a window screen that had come loose. She is not used to the outside and will most likely be hiding somewhere close rather than roaming far.',
    incidentDate: '2026-08-22',
    incidentTime: '11:20',
    location: {
      label: 'Near Salinas Drive, Barangay Lahug',
      city: 'Cebu City',
      province: 'Cebu',
      lat: 10.3324,
      lng: 123.8987,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition: '',
    hasCollar: null,
    photos: [
      {
        id: 'photo-031a',
        url: photo031Tuna,
        alt: 'Cream Persian cat with a flat face and a thick ruff, its body coat clipped short, sitting on a concrete floor',
        isPrimary: true,
      },
    ],
    reporterId: 'user-001',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: true },
    statusHistory: [
      {
        id: 'log-031a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-001',
        createdAt: '2026-08-22T05:45:00.000Z',
      },
    ],
    createdAt: '2026-08-22T05:45:00.000Z',
    updatedAt: '2026-08-22T05:45:00.000Z',
  },
  {
    id: 'report-032',
    reportType: REPORT_TYPES.FOUND,
    status: REPORT_STATUSES.ACTIVE,
    petName: null,
    species: SPECIES.DOG,
    breed: 'Shih Tzu',
    sex: PET_SEXES.UNKNOWN,
    size: PET_SIZES.SMALL,
    primaryColor: 'White',
    secondaryColor: 'Grey',
    distinctiveMarkings:
      'Small white and grey shih tzu, badly matted coat, nails long enough that it has been loose a while.',
    description:
      'Wandering along the service road near the market, going up to people for food. The coat is matted and the nails are long, so it has probably been out for some time rather than lost today.',
    incidentDate: '2026-09-08',
    incidentTime: '09:30',
    location: {
      label: 'Near General Luna Avenue, Barangay Ususan',
      city: 'Taguig City',
      province: 'Metro Manila',
      lat: 14.5241,
      lng: 121.0703,
      precision: LOCATION_PRECISION.APPROXIMATE,
    },
    condition:
      'Underweight with a matted coat. Nervous but not aggressive. Needs a groomer and a vet check.',
    hasCollar: false,
    photos: [
      {
        id: 'photo-032a',
        url: photo032Dog,
        alt: 'Small white and grey shih tzu with a badly matted coat, standing on a damp concrete path',
        isPrimary: true,
      },
    ],
    reporterId: 'user-002',
    contactPreferences: { allowPlatformContact: true, showPhone: false, showEmail: true },
    statusHistory: [
      {
        id: 'log-032a',
        status: REPORT_STATUSES.ACTIVE,
        note: 'Report created.',
        actorId: 'user-002',
        createdAt: '2026-09-08T03:10:00.000Z',
      },
    ],
    createdAt: '2026-09-08T03:10:00.000Z',
    updatedAt: '2026-09-08T03:10:00.000Z',
  },
]
