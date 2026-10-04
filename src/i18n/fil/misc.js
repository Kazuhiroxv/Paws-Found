/** Ang panimula ng mga pahina ng report, ang mga system page, at ang mga pangungusap ng API. */
export const reportPage = {
  lostBadge: 'I-report ang nawawala',
  lostTitleBefore: 'I-report ang',
  lostWord: 'nawawalang',
  foundBadge: 'I-report ang natagpuan',
  foundTitleBefore: 'I-report ang',
  foundWord: 'natagpuang',
  titleAfter: 'alaga',
  lostLead: 'Tulungan ang komunidad na malaman kung ano ang hahanapin.',
  lostBody:
    'Ikukumpara namin ang mga detalyeng ito sa mga alagang natagpuan sa malapit. Ilang minuto lang ito, at maaari mong i-edit ang kahit ano pagkatapos.',
  lostUrgent: 'Pinakamahalaga ang mga unang oras. Mag-file na ngayon at magdagdag ng detalye mamaya.',
  foundLead: 'Bigyan ang may-ari ng pinakamagandang pagkakataong makilala siya.',
  foundBody:
    'Ikukumpara namin ang mga detalyeng ito sa mga alagang iniulat na nawawala sa malapit. Ilang minuto lang ito, at maaari mong i-edit ang kahit ano pagkatapos.',
  foundSafe:
    'Panatilihing ligtas ang alaga kung nasaan ka. Pinapatunayan ng coordinator ang may-ari bago ang anumang pag-aabot.',
  noAddress: 'Hindi kailanman ipinapakita sa publiko ang eksaktong address.',
}

export const system = {
  notFound: 'Hindi makita ang pahina',
  notFoundBody: 'Hindi umiiral ang pahinang hinahanap mo, o maaaring nailipat na ito.',
  nothingHere: 'Walang laman dito',
  checkAddress: 'Suriin ang address, o magsimula sa homepage.',
  home: 'Pumunta sa homepage',
  unauthorized: 'Walang pahintulot ang account mo na buksan ang pahinang iyon.',
  otherRole: 'Para sa ibang role ang bahaging ito',
  otherRoleBody:
    'Magkakaiba ang workspace ng mga miyembro ng komunidad, ng mga Pet Coordinator at ng mga administrator, at hindi sa iyo ang isang ito. Kung nandito ka kanina lang, binago ng isang administrator ang mga puwedeng buksan ng account na ito — agad itong ipinapatupad saanman naka-sign in ang account.',
  myAccount: 'Pumunta sa account ko',
}

/** Ang mga pangungusap ng API na nakikita ng mga tao (src/i18n/apiErrors.js). */
export const api = {
  signIn: 'Kailangan mong naka-sign in para magawa iyan.',
  noAccess: 'Walang access ang account mo roon.',
  levelLacks: 'Hindi kasama iyan sa antas mo bilang administrator.',
  levelAccounts: 'Hindi kasama sa antas mo bilang administrator ang pamamahala ng mga account.',
  emailPassword: 'Ilagay ang email address at password mo.',
  suspended: 'Sinuspinde ng isang administrator ang account na ito.',
  verify: 'Tingnan ang email mo at sundan ang link ng beripikasyon bago mag-sign in.',
  locked:
    'Naka-lock ang account na ito pagkatapos ng 3 bigong pag-sign in. Kailangan itong i-unlock ng isang administrator bago ka makapag-sign in ulit.',
  checkFields: 'Pakisuri ang mga naka-highlight na field.',
  emailTaken: 'May account nang gumagamit ng email address na iyan.',
  linkInvalid: 'Hindi na valid ang link na iyan. Humingi ng bago.',
  tooMany: 'Masyadong maraming pagsubok. Subukan ulit mamaya.',
  csrf: 'Hindi mapatunayan ang kahilingang iyon. Subukan ulit.',
  captcha: 'Hindi makumpirma ang beripikasyong iyon. Subukan ulit.',
  server: 'Hindi natapos ng server ang kahilingang iyon.',
  reportMissing: 'Hindi umiiral ang report na iyon.',
  matchMissing: 'Hindi umiiral ang tugmang iyon.',
  draftMissing: 'Hindi umiiral ang draft na iyon.',
  accountMissing: 'Hindi umiiral ang account na iyon.',
  reportsChanged: 'Nagbago ang isa sa mga report na ito habang bukas ang pahina.',
  reportChanged: 'Nagbago ang report na ito habang bukas ang pahina.',
  pairingDecided: 'Napagpasyahan na ang pagtatambal na iyon.',
  pairingDecidedElsewhere: 'Ibang tao ang nagpasya sa pagtatambal na iyon habang bukas ang pahinang ito.',
  ownReview: 'Hindi mo masusuri ang report na ikaw mismo ang nag-file. Ibang Pet Coordinator ang dapat gumawa nito.',
  coordinatorOnly:
    'Pet Coordinator lang ang makapag-aapruba o makatatanggi sa isang report bago ito ilathala. Ang mga administrator ang nagmo-moderate ng mga nakalathalang report.',
  coordinatorReview: 'Pet Coordinator lang ang makasusuri ng report.',
  adminRemove: 'Administrator lang ang makapag-aalis ng nakalathalang report.',
  ownAccount: 'Hindi mo mababago ang sarili mong role, antas bilang administrator o status ng account.',
  lastSuperAdmin: 'Ito na ang huling aktibong Super Administrator. Gawin munang Super Administrator ang ibang account.',
  nothingToChange: 'Walang babaguhin.',
  resent:
    'Kung may hindi pa napapatunayang account na gumagamit ng email address na iyan, nagpadala na ng bagong link ng beripikasyon.',
  resetSent:
    'Kung may account na gumagamit ng email address na iyan, naipadala na ang mga tagubilin para i-reset ang password.',
  unreadable: 'Nagpadala ang server ng sagot na hindi mabasa.',
  failed: 'Hindi nagtagumpay ang kahilingan.',
  offline: 'Hindi maabot ang server. Suriin ang koneksyon mo at subukan ulit.',
}
