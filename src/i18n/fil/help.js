/** Tulong at kaligtasan ng komunidad. */
export default {
  eyebrow: 'Gabay at kaligtasan',
  title: 'Tulong at kaligtasan ng komunidad',
  description:
    'Paano mag-file ng report na nakatutulong, paano sinusuri ang isang tugma, at paano manatiling ligtas sa pag-aayos ng pag-aabot.',
  searchLabel: 'Maghanap sa tulong',
  placeholderLong: 'Maghanap ng paksa, hal. kwelyo, tugma o pag-aabot',
  placeholderShort: 'Maghanap ng paksa',
  topicsLabel: 'Mga paksa ng tulong',
  topicsMatch: { one: '{count} paksa ang tugma sa {query}', other: '{count} paksa ang tugma sa {query}' },
  topicsCount: { one: '{count} paksa', other: '{count} paksa' },
  safetyTitle: 'Bago ka makipagkita kaninuman',
  safetyBody:
    'Apat na bagay na dapat ayusin bago ang pag-aabot. Para ito sa kukuha man o magbabalik ng alaga.',
  rules: {
    public: 'Makipagkita sa pampublikong lugar, at magsama ng kakilala',
    publicBody:
      'Barangay hall, beterinaryong klinika, mataong kapihan. Walang dahilan para sa bahay ng sinuman gawin ang pag-aabot.',
    daylight: 'Sa liwanag ng araw lang',
    daylightBody: 'Ayusin ito sa oras na bukas ang napiling lugar at may ibang tao sa paligid.',
    holdBack: 'Magtago ng isang detalye',
    holdBackBody:
      'Kung nakatagpo ka ng alaga, itago mo ang isang palatandaan. Masasabi ito ng tunay na may-ari.',
    onPlatform: 'Panatilihin ito sa Paws&Found',
    onPlatformBody:
      'Kung may nagpupumilit na ilipat ang usapan sa pribado bago mapatunayan ang pagmamay-ari, dahilan iyon para magdahan-dahan.',
  },
  custody:
    'Hindi kumukuha ng kustodiya ng anumang hayop ang Paws&Found at hindi ito dumadalo sa pag-aabot. Tumutulong ang isang Pet Coordinator na patunayan ang pagmamay-ari bago magpalitan ng detalye ng pakikipag-ugnayan, pero kayong dalawa ang magkikita — kaya sulit basahin ang apat na ito.',
  topics: {
    'reporting-lost': {
      title: 'Pag-report ng nawawalang alaga',
      summary: 'Ang dapat isama para makilala ng ibang tao ang alaga mo.',
      faqs: [
        {
          q: 'Aling mga detalye ang talagang nakatutulong?',
          a: 'Ang mga masusuri agad ng ibang tao: kulay at mga marka, laki, kwelyo, at anumang kakaiba gaya ng peklat, baluktot na tainga o maikling buntot. Ibigay ang lugar sa halip na eksaktong address, pati ang petsa at tinatayang oras.',
        },
        {
          q: 'Kailangan ko ba ng larawan?',
          a: 'Hindi, pero ito ang pinakakapaki-pakinabang na maidadagdag mo. Ang malinaw at maliwanag na larawan ng buong hayop ang nakikilala ng mga tao, at ang kinukumpara ng coordinator sa report ng natagpuang alaga.',
        },
        {
          q: 'Kailan lalabas sa publiko ang report ko?',
          a: 'Kapag nasuri at naaprubahan na ito ng isang Pet Coordinator. Hanggang doon, ikaw at ang mga Pet Coordinator lang ang nakakakita nito, at hindi pa ito ikinukumpara sa ibang report. Kung hindi ito maaprubahan, sasabihin sa iyo kung bakit, at maaari mo itong i-edit at ipasa ulit.',
        },
        {
          q: 'Maaari ko bang i-edit ang report pagkatapos itong i-file?',
          a: 'Oo. Nakalista ang mga report mo sa Mga Report Ko, at maaari mong i-update ang mga detalye o markahang naibalik na ang alaga anumang oras.',
        },
      ],
    },
    'reporting-found': {
      title: 'Pag-report ng natagpuang alaga',
      summary: 'Pag-file ng nakita mo, kahit kaunti lang ang alam mo.',
      faqs: [
        {
          q: 'Walang kwelyo at walang pangalan ang alaga. Maaari ko pa rin ba itong i-report?',
          a: 'Oo. Hindi kailanman humihingi ng pangalan ng alaga ang report ng natagpuan — hindi inaasahang alam ito ng nakatagpo. Sapat na ang uri ng hayop, kulay, laki at kung saan mo ito natagpuan.',
        },
        {
          q: 'Dapat ko bang isama ang lahat ng napansin ko?',
          a: 'Halos. Magtago ng isang palatandaan — bagay na tunay na may-ari lang ang makaaalam — para masuri ang pagmamay-ari mamaya. Nakatutulong ang lahat ng iba pa.',
        },
      ],
    },
    'possible-matches': {
      title: 'Mga posibleng tugma',
      summary: 'Kung ano ang mungkahing tugma, at kung ano ito hindi.',
      faqs: [
        {
          q: 'Paano nakahahanap ng tugma ang sistema?',
          a: 'Kinukumpara nito ang mga nakaayos na detalye ng report ng nawawala at ng natagpuan: uri ng hayop, lahi, kulay, laki, ang lapit ng dalawang lokasyon, ang lapit ng mga petsa, at mga natatanging katangian. Walang image recognition at walang AI.',
        },
        {
          q: 'Ibig bang sabihin ng posibleng tugma ay natagpuan na ang alaga ko?',
          a: 'Hindi. Mungkahi lang ang posibleng tugma, hindi kailanman konklusyon. Ipinapakita ng bawat tugma kung aling mga detalye ang nagtugma at alin ang hindi, para ikaw mismo ang makapaghusga.',
        },
      ],
    },
    'verifying-ownership': {
      title: 'Pagpapatunay ng pagmamay-ari',
      summary: 'Paano sinusuri ang isang claim bago may ayusin.',
      faqs: [
        {
          q: 'Ano ang mangyayari pagkatapos kong sumagot sa isang tugma?',
          a: 'Mapupunta ang tugma sa isang Pet Coordinator, na magkukumpara sa dalawang report at tutulong na kumpirmahin ang pagmamay-ari bago ayusin ang pag-aabot. Kapag kinumpirma ang tugma, isinasara ang dalawang report bilang naibalik na.',
        },
        {
          q: 'Ano ang maituturing na patunay ng pagmamay-ari?',
          a: 'Mga naunang larawan, rekord ng beterinaryo, o paglalarawan ng detalyeng hindi kailanman inilathala — kaya hinihiling sa mga nakatagpo na magtago ng isa.',
        },
        {
          q: 'Sino ang nakakakita ng impormasyon sa beripikasyon?',
          a: 'Ang coordinator lang na humahawak sa kaso. Hindi ito kailanman ipinapakita sa pampublikong pahina ng report.',
        },
      ],
    },
    'safe-handovers': {
      title: 'Ligtas na pag-aabot',
      summary: 'Pakikipagkita para ibalik o kunin ang alaga.',
      faqs: [
        {
          q: 'Saan kami dapat magkita?',
          a: 'Sa pampublikong lugar, sa liwanag ng araw, at may kasama. Walang dahilan para sa bahay ng sinuman gawin ang pag-aabot.',
        },
        {
          q: 'Ano ang dapat magpaingat sa akin?',
          a: 'Sinumang nagke-claim ng alaga nang hindi ito mailarawan, hindi masagot ang tanong tungkol sa detalyeng hindi inilathala, o nagpupumilit na ilipat ang usapan sa labas ng plataporma.',
        },
      ],
    },
    privacy: {
      title: 'Privacy',
      summary: 'Ang ipinapakita ng pampublikong pahina ng report tungkol sa iyo.',
      faqs: [
        {
          q: 'Ipinapakita ba ang numero ng telepono o email ko?',
          a: 'Hindi kailanman ang numero ng telepono mo — wala sa report, sa card o sa mapa. Nakikita ito ng Pet Coordinator kapag sinusuri ang isang posibleng tugma. Ipinapakita lang ang email address mo kung pipiliin mong ibahagi ito, report por report, at sa mga naka-sign in na miyembro lang. Kung hindi, sinasabi ng report na mas gusto mong maabot sa pamamagitan ng isang Pet Coordinator. Walang pagmemensahe sa pagitan ng mga miyembro.',
        },
        {
          q: 'Ipinapakita ba ng mapa kung saan ako nakatira?',
          a: 'Hindi. Tinatayang lugar ang lokasyon ng mga report, hindi address, at gumuguhit ang pahina ng detalye ng bilog sa paligid ng pin para kitang-kita ang pagiging tinataya nito.',
        },
      ],
    },
    'reporting-abuse': {
      title: 'Pag-report ng pang-aabuso',
      summary: 'Pag-flag sa listing na hindi dapat naroon.',
      faqs: [
        {
          q: 'Paano ako magre-report ng listing?',
          a: 'May aksyong “I-report ang listing na ito” sa bawat pahina ng report. Pipili ka ng dahilan: maling report, spam, scam, panliligalig, hindi angkop na nilalaman, dobleng report, o iba pa.',
        },
        {
          q: 'Ano ang nangyayari sa isang flag?',
          a: 'Mapupunta ito sa isang administrator para masuri. Maaari niya itong ibasura, alisin ang nilalaman, bigyan ng babala ang user, o suspindihin ang account.',
        },
        {
          q: 'Naka-lock o sinuspinde ang account ko. Ano ngayon?',
          a: 'Ang naka-lock ay tatlong sunud-sunod na maling password; ang sinuspinde ay itinigil ng isang administrator ang account. Alinman dito, ang Administrator ng Paws&Found lang, si {name}, ang makapagbabalik nito, at hindi ito naibabalik ng pag-reset ng password. Makipag-ugnayan sa {email} mula sa address na ginagamit mo sa pag-sign in. Maaari ka pa ring tumingin ng mga report nang hindi naka-sign in.',
        },
      ],
    },
    'about-service': {
      title: 'Tungkol sa serbisyong ito',
      summary: 'Kung ano ang Paws&Found, at kung ano ito hindi.',
      faqs: [
        {
          q: 'Opisyal o bayad na serbisyo ba ang Paws&Found?',
          a: 'Hindi. Akademiko at hindi pangkomersyal itong proyekto na ginawa ng mga estudyante para sa Web Systems and Technologies 2. Hindi ito kaanib, inendorso o pinapatakbo ng anumang ahensya ng gobyerno, organisasyon para sa kapakanan ng hayop, beterinaryong klinika o negosyo para sa alaga.',
        },
        {
          q: 'Humahawak ba ng pera o pabuya ang Paws&Found?',
          a: 'Hindi. Hindi nagpoproseso ang Paws&Found ng anumang bayad o transaksyong pinansyal, at wala itong feature para sa pabuya. Ang pabuyang binanggit sa isang paglalarawan ay usapan ng mga taong sangkot; hindi ito hinahawakan, binabayaran o ginagarantiya ng Paws&Found. Huwag kailanman magbayad kaninuman para makita o mabawi ang alaga, at i-flag ang report na humihingi ng pera.',
        },
        {
          q: 'Mapagkakatiwalaan ko ba ang lahat ng nasa report?',
          a: 'Isinusulat ang mga report ng mga taong nag-file ng mga ito. Sinusuri ng isang Pet Coordinator ang bawat isa bago ilathala, pero hindi niya masusuri ang bawat detalye, kaya patunayan mo muna ang impormasyon bago kumilos. Buong ipinapaliwanag ng Disclaimer ang mga limitasyon.',
        },
      ],
    },
  },
}
