/** Ang balangkas ng bawat pahina: navigation, footer, mga abiso, at pagpili ng wika. */
export default {
  loading: 'Nilo-load ang Paws&Found…',
  skipLink: 'Lumaktaw sa pangunahing nilalaman',
  language: {
    label: 'Wika (Language)',
  },
  workspace: {
    myAccount: 'Aking account',
    staff: 'Staff workspace',
    admin: 'Administrasyon',
    backToPublic: 'Bumalik sa pampublikong site',
    signOut: 'Mag-sign out',
    item: { one: 'item', other: 'item' },
    section: 'Seksyon ng {label}: ',
    signedInHere:
      'Naka-sign in ka sa device na ito. Para sa seguridad, hindi na valid ang anumang naunang session ng account na ito.',
  },
  navbar: {
    brand: 'Paws&Found',
    account: 'Account',
    accountMenu: ', menu ng account',
    profileSecurity: 'Profile at seguridad ng account',
    profile: 'Profile',
    signOut: 'Mag-sign out',
    signIn: 'Mag-sign in',
    openMenu: 'Buksan ang menu',
    closeMenu: 'Isara ang menu',
    demo: 'Demo:',
  },
  footer: {
    tagline:
      'Isang plataporma ng komunidad na tumutulong magkita muli ang mga nawawalang alaga at ang mga naghahanap sa kanila.',
    explore: 'Maghanap',
    browseLost: 'Tingnan ang mga nawawalang alaga',
    browseFound: 'Tingnan ang mga natagpuang alaga',
    searchAll: 'Hanapin sa lahat ng report',
    report: 'Mag-report',
    reportLost: 'I-report ang nawawalang alaga',
    reportFound: 'I-report ang natagpuang alaga',
    about: 'Tungkol sa Amin',
    aboutUs: 'Tungkol sa Paws&Found',
    howItWorks: 'Paano ito gumagana',
    help: 'Tulong',
    helpSafety: 'Tulong at kaligtasan',
    safeHandovers: 'Ligtas na pag-aabot ng alaga',
    privacy: 'Abiso sa Privacy',
    disclaimer: 'Disclaimer',
    ctaTitle: 'Sama-sama, maiuuwi natin sila.',
    ctaBody: 'Bawat report ay nakatutulong sa isang taong naghahanap ng kanyang alaga.',
    ctaButton: 'Mag-report o maghanap ngayon',
    copyright:
      '© 2026 Paws&Found. Akademikong proyekto para sa Web Systems and Technologies 2. Kathang-isip na demo data ang lahat ng alaga, tao at report na ipinapakita.',
    notice:
      'Isang akademiko at hindi pangkomersyal na proyekto. Hindi nagpoproseso ang Paws&Found ng anumang bayad o transaksyong pinansyal, at wala itong kaugnayan sa anumang ahensya ng gobyerno o organisasyon para sa kapakanan ng hayop. <link>Basahin ang disclaimer</link>.',
  },
  session: {
    logout: 'Naka-sign out ka na.',
    idle_timeout: 'Nag-expire ang session mo dahil walang aktibidad. Mag-sign in ulit.',
    idle_timeout_body:
      'Matagal na walang ginawa sa Paws&Found, kaya tinapos ang session para protektahan ang account.',
    absolute_timeout: 'Natapos na ang session mo. Mag-sign in ulit.',
    absolute_timeout_body:
      'Para sa seguridad, may takdang haba ang bawat session gaano man ito kaaktibo.',
    new_privileged_login: 'Natapos ang session mo dahil nag-sign in ang account na ito sa ibang device.',
    new_privileged_login_body:
      'Isang device lang sa isang pagkakataon ang puwedeng naka-sign in para sa account ng Pet Coordinator o Administrator. Kung hindi ikaw iyon, mag-sign in ulit at sabihan ang Administrator ng Paws&Found.',
    password_reset: 'Natapos ang session mo dahil binago ang password ng account.',
    password_reset_body:
      'Na-sign out ang lahat ng device na naka-sign in sa account na ito. Mag-sign in gamit ang bagong password.',
    role_promoted: 'Natapos ang session mo dahil nagbago ang antas ng access ng account na ito. Mag-sign in ulit.',
    privilege_changed:
      'Natapos ang session mo dahil nagbago ang mga pribilehiyo ng account na ito bilang administrator. Mag-sign in ulit.',
    privilege_changed_body:
      'Binago ng isang Super Administrator ang mga puwedeng gawin ng account na ito sa Administrasyon. Makikita mo ang mga pahinang para sa iyo pagka-sign in mo ulit.',
    account_locked: 'Naka-lock ang account mo.',
    account_locked_body:
      'Na-lock ito dahil sa paulit-ulit na maling pag-sign in. Kailangan muna itong i-unlock ng isang administrator bago ka makapag-sign in ulit.',
    account_suspended: 'Sinuspinde ang account mo.',
    account_suspended_body:
      'Kung sa tingin mo ay nagkamali ito o kailangan mo ng tulong para maibalik ang access, makipag-ugnayan sa Administrator ng Paws&Found.',
    unknown: 'Naka-sign out ka na.',
    unknown_body: 'Hindi na naka-sign in sa Paws&Found ang browser na ito.',
    roleChangedTitle: 'Nagbago ang antas ng access mo',
    roleChangedBody:
      'Binago ng isang administrator ang account na ito mula {from} patungong {to}. Binago rin ang mga pahinang puwede mong buksan.',
    dismiss: 'Isara ang mensaheng ito',
  },
  privacyUpdate: {
    title: 'Na-update ang Abiso sa Privacy',
    body:
      'In-update namin ang aming Abiso sa Privacy para ipaliwanag ang mga rekord ng seguridad at aktibidad, gaya ng kasaysayan ng pag-sign in, IP address, at mga pahinang binuksan habang naka-sign in.',
    note: 'Itinatago ang mga rekord na ito para protektahan ang mga account at ang serbisyo; ang pagpindot sa "Nakita ko na" ay nagpapatunay lang na naipakita na sa iyo ang update.',
    review: 'Basahin ang Abiso sa Privacy',
    acknowledge: 'Nakita ko na',
    saving: 'Sine-save…',
    failed: 'Hindi ito na-save. Subukan ulit.',
  },
  access: {
    eyebrow: 'Administrator',
    title: 'Walang access',
    denied: 'Wala kang pahintulot na buksan ang pahinang ito.',
    deniedBody:
      'Hindi kasama sa antas mo bilang administrator ang bahaging ito ng Administrasyon. Kung kailangan mo ito, magtanong sa isang Super Administrator.',
    back: 'Bumalik sa Buod',
  },
}
