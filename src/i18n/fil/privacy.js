/**
 * Ang Abiso sa Privacy, isinalin sa Filipino. Parehong abiso ito ng nasa
 * Ingles — salin, hindi ibang patakaran.
 */
export default {
  title: 'Abiso sa Privacy',
  description:
    'Kung ano ang kinokolekta ng Paws&Found tungkol sa iyo, kung ano ang ipinapakita nito sa ibang tao, at kung ano ang itinatago nito.',
  updated:
    'Huling na-update noong {version}. Ito ang bersyong sinasang-ayunan mo kapag gumawa ka ng account.',
  short: {
    title: 'Ang maikling bersyon',
    name: '<b>Ipinapakita ang pangalan mo</b> sa bawat report na ifa-file mo, para alam ng kabilang panig kung sino ang kausap nila.',
    phone:
      '<b>Hindi kailanman ipinapakita sa report ang numero ng telepono mo</b> — nakikita ito ng Pet Coordinator kapag inaasikaso ang isang posibleng tugma. Ipinapakita lang ang email address mo kung pipiliin mong ilathala ito, report por report.',
    location:
      '<b>Tinatayang lokasyon lang ang ipinapakita.</b> Barangay ang itinuturo ng report, hindi ang mismong pintuan mo.',
    password:
      '<b>Hindi kailanman iniimbak ang password mo.</b> Isang one-way hash lang nito ang iniimbak, na hindi kayang basahin pabalik ninuman — kami man.',
    activity:
      '<b>Itinatala ang ginagawa mo habang naka-sign in</b> — ang mga pag-sign in mo, ang network address at browser na pinanggalingan nito, ang mga pahinang binubuksan mo at ang mahahalagang bagay na ginagawa mo, kasama ang oras. Para ito sa seguridad at para masagot kung ano ang nangyari sa isang account. Hindi itinatala ang pagba-browse nang hindi naka-sign in.',
  },
  collect: {
    title: 'Ang kinokolekta namin',
    account: 'Kapag gumawa ka ng account:',
    accountList: [
      'Ang pangalan mo.',
      'Ang email address mo, na siya ring ginagamit mo sa pag-sign in.',
      'Ang numero ng telepono mo, kung magbibigay ka. Hindi ito sapilitan.',
      'Isang gustong lokasyon, kung magse-set ka, para unang maipakita ang mga report na malapit sa iyo.',
      'Isang one-way hash ng password mo. Hindi kailanman isinusulat kahit saan ang mismong password.',
    ],
    report: 'Kapag nag-file ka ng report:',
    reportList: [
      'Kung anong alaga ito — uri ng hayop, lahi kung alam mo, kulay, laki, kasarian, at mga natatanging marka.',
      'Kung ano ang nangyari, sa sarili mong salita.',
      'Kung saan ito nangyari, hanggang sa antas ng barangay, at ang petsa at tinatayang oras.',
      'Anumang larawang ia-upload mo, at ang mga paglalarawang isusulat mo para sa mga ito.',
      'Kung gusto mong ipakita ang email address mo sa report na iyon, at kung puwede kang maabot ng ibang tao sa pamamagitan ng isang Pet Coordinator.',
    ],
    use: 'Habang ginagamit mo ang sistema:',
    useList: [
      'Kung aling mga update ang gusto mong maabisuhan.',
      'Isang rekord ng mga pag-sign in, mga bigong pag-sign in, at mga pagbabago sa account mo — kasama ang petsa, oras at ang network address na pinanggalingan ng kahilingan. Ito ang nagpapahintulot sa aming makilala ang account na na-lock dahil sa tatlong maling password mula sa account na pinapasok ng iba.',
      'Isang rekord ng bawat session habang naka-sign in: kung kailan ito nagsimula, kung kailan huling ginamit at kung kailan natapos (at kung bakit — nag-sign out, nag-time out, tinapos dahil sa pagpapalit ng password), ang network (IP) address na pinanggalingan nito, at ang paglalarawan ng browser mo sa sarili nito — ang "user agent" nito, na nagsasabi ng browser at operating system. Wala nang ibang kinokolekta tungkol sa device mo.',
      'Habang naka-sign in ka: ang address ng bawat pahina ng Paws&Found na binubuksan mo, at ang mahahalagang bagay na ginagawa mo — pag-save ng draft, pagpasa, pag-edit o pagsasara ng report, mga desisyon sa pagsusuri at pagtutugma, mga flag at moderasyon, mga pagbabago sa profile at account, pagbasa ng mga abiso — bawat isa ay may petsa, oras at IP address.',
    ],
    note:
      'Ang rekord ng aktibidad ay naglalaman ng address ng pahina at pangalan ng aksyon, hindi kailanman ang tinype mo: hindi ang password mo, hindi ang mga link na ini-email namin sa iyo, hindi ang paglalarawan o mga larawan ng report mo, at hindi na muli ang pangalan o numero ng telepono mo. Ang mga pahinang binuksan ng taong hindi naka-sign in ay hindi itinatala laban sa sinuman.',
  },
  why: {
    title: 'Kung bakit namin ito kinokolekta',
    intro:
      'Kinokolekta ang lahat ng nasa pahinang ito dahil sumang-ayon ka rito nang gumawa ka ng account — ang pagsang-ayong iyon ang batayang inaasahan namin, at nakatala ito laban sa bersyon ng abisong ito na nakita mo noon. May trabaho ang bawat piraso, at walang kinokolekta dahil lang baka magamit balang araw:',
    list: [
      'Ang pangalan at mga detalye ng pakikipag-ugnayan mo ang nagpapangyari sa muling pagkikita — kailangang may makaabot sa isa’t isa.',
      'Ang mga detalye ng alaga ang kinukumpara ng matching. Ang report na walang anumang nakaayos na impormasyon ay hindi maitutugma sa kahit ano.',
      'Ang lokasyon at petsa ang nagpapakatwiran sa paghahambing: ang asong nawala sa Cebu noong nakaraang Marso ay hindi ang asong natagpuan sa Makati kahapon.',
      'Ang mga rekord ng pag-sign in ay para protektahan ang account mo, at para masagot ng isang administrator kung "ano ang nangyari sa account na ito, at kailan".',
      'Ang mga rekord ng session at aktibidad ay para sa seguridad at sa pagsisiyasat ng maling paggamit — account na ginamit mula sa hindi inaasahang address, taong isa-isang binubuksan ang mga report ng iba — at para masagot ng isang administrator kung ano ang ginawa, ng aling account, mula saan at kailan.',
    ],
  },
  public: {
    title: 'Ang nakikita ng ibang tao',
    body: [
      'Pampubliko ang isang report. Sinumang bumibisita sa site, naka-sign in man o hindi, ay makakakita ng mga detalye ng alaga, ng paglalarawan mo, ng mga larawan, ng tinatayang lokasyon at petsa, at <b>ng pangalan ng taong nag-file nito</b>. Sinadya ang huli: mahirap pagkatiwalaan at mahirap aksyunan ang isang anonimong report ng nawawalang alaga.',
      '<i>Hindi kailanman</i> ipinapakita sa report ang numero ng telepono mo sa sinumang nagba-browse: hindi ito isinasama ng server sa report. Nakikita ito ng mga Pet Coordinator, dahil trabaho nilang ayusin ang ligtas na pagbabalik. Ipinapakita lang ang email address mo sa isang report kung bubuksan mo ito para sa report na iyon, at sa mga naka-sign in na miyembro lang; kapag hindi, hindi ito isinasama ng server sa sagot nito — hindi ito nakatago sa pahina na naghihintay matagpuan.',
      'Tinatayang lugar ang ipinapakita ng mapa, hindi isang tiyak na punto. Itinatala ang mga coordinate sa antas ng barangay at iginuguhit bilang bilog, kaya kitang-kita ang pagiging tinataya nito. Hindi kailanman hinihingi o iniimbak ang eksaktong address ng bahay.',
    ],
  },
  inside: {
    title: 'Ang mga nasa loob ng Paws&Found na nakakakita nito',
    list: [
      'Nakikita mo ang lahat ng nasa sarili mong account at sarili mong mga report.',
      'Nakikita ng isang Pet Coordinator ang mga report na inaasikaso niya, at maaari niyang tingnan ang mga detalye ng pakikipag-ugnayan ng mga taong sangkot sa isang kaso para maayos ang pag-aabot ng alaga.',
      'Nakikita ng isang administrator ang mga account, report at kaso ng moderasyon, at ang mga rekord ng session, aktibidad at seguridad — kasama ang mga IP address at paglalarawan ng browser. Hindi ito nakikita ng mga Pet Coordinator.',
      'Walang nakakakita ng password mo, dahil hindi ito iniimbak.',
      'Hindi kailanman ipinapakita sa publiko ang mga talang isinulat habang nagbeberipika.',
    ],
  },
  matching: {
    title: 'Paano gumagana ang matching, at ang ginagawa nito nang mag-isa',
    body: [
      'Kinukumpara ng Paws&Found ang bawat bagong report sa mga report na naka-file na, at nagmumungkahi ng mga maaaring iisang hayop. Aritmetika ang paghahambing, hindi paghuhusga: binibigyan nito ng puntos ang uri ng hayop, lahi, kulay, laki, ang layo ng dalawang lokasyon at ang agwat ng dalawang petsa, at pinagsasama-sama ang mga ito. Walang artificial intelligence dito at walang larawang sinusuri — para sa mga tao ang mga larawan, at mga tao lang ang tumitingin sa mga ito.',
      'Mungkahi lang ang isang mungkahi. <b>Walang awtomatikong napagpapasyahan tungkol sa iyo.</b> Hindi binabago ng posibleng tugma ang report mo, hindi nito inilalabas ang mga detalye ng pakikipag-ugnayan mo, at hindi nito sinasabi sa sinuman na kanila ang alaga. Kailangang may taong magbukas nito, may taong mag-claim nito, at kailangan itong beripikahin ng isang Pet Coordinator bago may mangyari.',
      'Ipinapakita ng bawat mungkahi ang mga dahilan nito at ang nakuhang puntos sa bawat isa, para makita mo kung bakit inakala ng sistema na sulit paghambingin ang dalawang report — at para makatutol ka.',
    ],
  },
  keep: {
    title: 'Gaano katagal namin ito itinatago',
    body: [
      'Sinususpinde ang mga account sa halip na burahin. Sinadya ito: kailangang manatiling nababasa ang mga report at kasaysayan ng kaso, at kapag binura ang account, mabubura rin ang rekord ng isang muling pagkikita — at ng anumang nagkaproblema.',
      'Kaya itinatago ang account mo, ang mga report mo at ang rekord ng aktibidad ng account mo hangga’t tumatakbo ang Paws&Found. Kung gusto mong alisin ang impormasyon mo, sabihan kami at mano-mano namin itong gagawin; walang sariling button para magbura, at mas gugustuhin naming sabihin iyon kaysa magkunwari.',
      'Ganoon din ang mga rekord ng session at aktibidad: wala pang awtomatikong nagbubura sa mga ito. Balak naming magtakda ng takdang panahon ng pagtatago, at sasabihin ito ng abisong ito kapag mayroon na.',
    ],
  },
  rights: {
    title: 'Ang mga karapatan mo',
    body: [
      'Sa ilalim ng Data Privacy Act of 2012 (Republic Act No. 10173), may karapatan kang malaman kung ano ang kinokolekta at bakit, tumutol dito, mabigyan ng kopya ng hawak namin tungkol sa iyo, maitama ang anumang mali, maipabura o maipaharang ang impormasyon mo kung pinapayagan ng batas, at mabayaran sa pinsalang dulot ng maling paggamit nito.',
      'Magagamit mo ang alinman sa mga ito sa pagsulat sa amin. Kung hindi ka masiyahan sa sagot namin, maaari kang magreklamo sa National Privacy Commission.',
    ],
  },
  who: {
    title: 'Kung sino kami',
    body: [
      'Ang Paws&Found ay proyekto ng mga estudyante para sa ITS122P — Web Systems and Technologies 2, seksyon AM5, Group 3. Gawain ito sa kurso, hindi komersyal na serbisyo, at pinapatakbo ito ng limang estudyante, hindi ng isang kumpanya.',
      'Kathang-isip ang lahat ng alaga, tao at pangyayari sa demo data. Ang mga tanong tungkol sa impormasyon mo, o ang kahilingang makita, maitama o maalis ito, ay ipadala sa project team:',
    ],
    contact: 'Kontak para sa privacy',
    contactValue: 'Paws&Found Project Team',
    institution: 'Institusyon',
    institutionValue: 'Mapúa University — Makati Campus',
    email: 'Email',
    after:
      'Sumulat sa address na iyon para sa kopya ng hawak namin tungkol sa iyo, para sa pagtatama, pagbubura, o anumang ibang alalahanin tungkol sa personal mong impormasyon. Kung hindi ka masiyahan sa sagot namin, maaari kang magreklamo sa National Privacy Commission sa privacy.gov.ph.',
  },
  changes: {
    title: 'Kung magbago ang abisong ito',
    body: [
      'Itinatala ang bawat pagsang-ayon laban sa bersyon ng abisong ito na nakita noon, para malaman namin kung sino ang sumang-ayon sa aling pananalita. Kung magbago ang abisong ito sa paraang nagbabago sa sinang-ayunan mo, magbabago rin ang petsa sa itaas.',
      'Kapag nangyari iyon, sasabihan ang account na sumang-ayon sa naunang bersyon sa susunod na pag-sign in nito, kasama ang link sa pahinang ito. Ang pagpindot sa "Nakita ko na" ay nagtatala — kasama ang petsa, oras at network address — na naipakita ang na-update na abiso; hindi ito hiwalay na pagpili tungkol sa mga rekord na inilarawan sa itaas, na itinatago para sa seguridad alinman ang mangyari. Walang pinipigilang gumamit ng Paws&Found habang ipinapakita ang mensahe, at walang itinatalang nakakita ng pananalitang hindi naman ipinakita sa kanila.',
    ],
  },
}
