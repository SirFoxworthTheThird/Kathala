import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = [
  path.join(root, 'example', "The Wise Man's Fear.pwk"),
  path.join(root, 'public', 'library', 'the-wise-man-s-fear.pwk'),
]

const simonetti = 'https://marc-simonetti-shop.myshopify.com/cdn/shop/products'
const dan = 'https://images.squarespace-cdn.com/content/v1/5b9c3f5f9f8770f26af0107f'
const images = {
  wmf01: `${simonetti}/wisemanfear01_1200x1200.jpg?v=1574360210`,
  wmf02: `${simonetti}/wisemanfear02_1200x1200.jpg?v=1574360275`,
  lateVisit: `${simonetti}/late_visit_1200x1200.jpg?v=1574360308`,
  auriScene: `${simonetti}/auri_1200x1200.jpg?v=1574359938`,
  archives: `${simonetti}/chandelle_1200x1200.jpg?v=1574360355`,
  wind: `${simonetti}/elodin_court_1200x1200.jpg?v=1574360435`,
  calling: `${simonetti}/calling_wind_1200x1200.jpg?v=1584034696`,
  university: `${simonetti}/University_1200x1200.jpg?v=1580493504`,
  underthing: `${simonetti}/undergrounds_1200x1200.jpg?v=1574360523`,
  road: `${simonetti}/nameofthewind_1200x1200.jpg?v=1574358352`,
  tarbean: `${simonetti}/streetsoftarbean_1200x1200.jpg?v=1574360467`,
  draccus: `${simonetti}/dragon_1200x1200.jpg?v=1574360378`,
  eolian: `${simonetti}/solo_1200x1200.jpg?v=1584034631`,
  waystone: `${dan}/1537035149718-31739W39Z9EH4F69HEU9/dandossantos_tnotw_cropped_1.jpg`,
  troupe: `${dan}/1537035153722-WEV6GW7J1ASU8WW4PRHZ/dandossantos_tnotw_cropped_2.jpg`,
  trebon: `${dan}/1537035161940-XMOFXVE5AYUKMR5SKALD/dandossantos_tnotw_cropped_18.jpg`,
  cthaeh: 'https://mir-s3-cdn-cf.behance.net/project_modules/1400/42b4b267328247.5b35730e07be9.jpg',
  abenthy: 'https://static.wikia.nocookie.net/nameofthewind/images/6/61/Abenthy_and_child_kvothe_by_tintaratitornin-d7uj2if.jpg/revision/latest?cb=20150403003128',
  ambrose: 'https://static.wikia.nocookie.net/nameofthewind/images/a/a8/Playing_Cards_poster_Ambrose.jpg/revision/latest?cb=20150330095718',
  arliden: 'https://static.wikia.nocookie.net/nameofthewind/images/b/b2/Playing_Cards_poster_Arliden.jpg/revision/latest?cb=20150330081119',
  auri: 'https://static.wikia.nocookie.net/nameofthewind/images/8/81/Aurimanzana.jpg/revision/latest?cb=20190223003429',
  bast: 'https://static.wikia.nocookie.net/nameofthewind/images/d/d9/Pairs_Faen_Bastas.jpg/revision/latest?cb=20230906074242',
  cinder: 'https://static.wikia.nocookie.net/nameofthewind/images/b/b2/Cinder_by_jameszapata-d8e2eub.jpg/revision/latest?cb=20150517103552',
  denna: 'https://static.wikia.nocookie.net/nameofthewind/images/c/c8/Denna.jpg/revision/latest?cb=20170816215021',
  deoch: 'https://static.wikia.nocookie.net/nameofthewind/images/1/10/Playing_Cards_poster_Deoch_and_Stanchion.jpg/revision/latest?cb=20150330120425',
  devi: 'https://static.wikia.nocookie.net/nameofthewind/images/5/5d/Playing_Cards_poster_Devi.png/revision/latest?cb=20150430120847',
  fela: 'https://static.wikia.nocookie.net/nameofthewind/images/c/cc/Playing_Cards_card_Queen_of_Hearts.jpg/revision/latest?cb=20150330114933',
  haliax: 'https://static.wikia.nocookie.net/nameofthewind/images/f/f9/Haliax_by_faolgarg-d4n6z6k.jpg/revision/latest?cb=20150517124537',
  kvothe: 'https://static.wikia.nocookie.net/nameofthewind/images/6/68/The_kingkiller_chronicle_kvothe_by_shilesque-d8m6yzz.jpg/revision/latest?cb=20190916153424',
  laurian: 'https://static.wikia.nocookie.net/nameofthewind/images/e/e8/Playing_Cards_poster_Laurian.jpg/revision/latest?cb=20150330082832',
  mola: 'https://static.wikia.nocookie.net/nameofthewind/images/f/f1/Mola.jpg/revision/latest?cb=20170227173457',
  simmon: 'https://static.wikia.nocookie.net/nameofthewind/images/b/b7/Playing_Cards_poster_Simmon.png/revision/latest?cb=20150430103614',
  skarpi: 'https://static.wikia.nocookie.net/nameofthewind/images/3/39/Rumormongers.jpg/revision/latest?cb=20121123233726',
  stanchion: 'https://static.wikia.nocookie.net/nameofthewind/images/e/ef/Stanchion.jpg/revision/latest?cb=20140530182416',
  tehlu: 'https://static.wikia.nocookie.net/nameofthewind/images/c/c9/Wheel_Leather_1_grande.jpeg/revision/latest?cb=20141217183445',
  wilem: 'https://static.wikia.nocookie.net/nameofthewind/images/4/4f/Wilem.png/revision/latest?cb=20141108000233',
  meluan: 'https://static.wikia.nocookie.net/nameofthewind/images/4/4d/Meluan_lackless.jpg/revision/latest?cb=20170316052916',
}

const characterKeys = {
  '01b3dFXZurXPI-6PyO1Pp': 'waystone', '0TgGMnFarTs_E87bcFfR5': 'university',
  '2a3SVJ3h10s2rb_oKW2Ff': 'auri', '3pBSREFQfdNtVgoqY1SxY': 'trebon',
  '42tQHvckoAxa60ULlXGNn': 'troupe', '8BnAzt1AV8Faa_6MDPAIo': 'wind',
  '8ijuRcy0EGba068TUaURa': 'university', 'BB38OLJ_B0q2XvKG-Eb3w': 'university',
  'BU95xWX6Po-1YylWWelOy': 'tarbean', 'BqLVvReppmXwOghGTGDAa': 'university',
  'Cx94mPa0244AIMOWOwIYK': 'cthaeh', 'CzLQyXolTW_pD6OKysunb': 'trebon',
  'GLUDGDsOfjgYJvBK3Ouec': 'skarpi', 'GSPnJryztsAgwRg21DDvA': 'simmon',
  'HB8mqVLKAh1sO20-7EgOY': 'bast', 'HrvGf57EMaWVtHvJSOmHc': 'troupe',
  'IU6HiOQ064bhEA7pcV3BT': 'waystone', 'J-QTOC1Gb-eKUv43uphZ5': 'wilem',
  'JJj7MF31DtzhAjStXHdOt': 'lateVisit', 'LA8r5BEq8Kfd1Zoq8xmNv': 'fela',
  'LVBlzwbRZtdI-U2EYEZhn': 'devi', 'LlBk_NuABx6U-0O6CjVIy': 'university',
  'NyqJUvnqtT0WusVs3q_Hx': 'road', 'Oea8Ha4FmbFvEd6BxUEHO': 'underthing',
  'PIZ6sGoSuxi9GJP4M7-iT': 'road', 'QcOaqzVW-_QWxzX2U8VuZ': 'laurian',
  'SO9kEqPkr3PonRjE7OUXC': 'eolian', 'StXGN_HbKL85ofKxyi5Ce': 'draccus',
  'Ti8eZfF6NjTt6Aby_lekt': 'cinder', 'XkzG_roCiPb0nyStkR0kk': 'lateVisit',
  'ZK7MERPQFoFVamZJH3cbs': 'calling', '_MY2EkOxJEJDjojyFLbej': 'ambrose',
  'a90JBG5sun3EnqhtuXEXD': 'mola', 'aHrwvr8QBKKt8VNxPMiuL': 'waystone',
  'alEaZVvdhN6iutHsd1Ufm': 'stanchion', 'b1TMSesi1uP3AUkGZwa2F': 'tarbean',
  'bhgLQeVbp-52575W_zGe4': 'calling', 'cLpegk0cFvisuzQY_gpwh': 'troupe',
  'fDEKPf6Zvlppey3ytaE3W': 'eolian', 'fKtrjwCL2Kunk9moEqBpS': 'denna',
  'gZftMdk_MISFrGvMnEOF1': 'wmf01', 'h4xIfUZXVhUhsjTztZpq0': 'waystone',
  'mmtHGqI7kmK7vmej2wWQ2': 'university', 'nA42N4TuL-h6whBGDo7bQ': 'waystone',
  'pMJ9qMqPS2zS93cMvEq8d': 'calling', 'pf5zN58bYd-dZ-ZoIMlue': 'road',
  'r13vNOL6Bt1PEiCcvjiRc': 'waystone', 'sW96USkf3kklEc3noztba': 'arliden',
  'tj73cP39jfQgbNuMuRKdG': 'deoch', 'tnpXp69IvFqRnR7ws9_hx': 'archives',
  'vO8ZnaXTIFsZNtjADfA9S': 'tehlu', 'xAbQpyK_aLRBM2neEKtAY': 'abenthy',
  'xXGHlZjaYH3Vpz_9N2EvO': 'haliax', 'yESmakRTZSWXPm8qKw-Ru': 'kvothe',
  'ziSXbsI3_vqEC8P3XPzPR': 'road', 'zpICl3P10qYwNQ8r5LbMv': 'tarbean',
  'wmf-char-chancellor': 'university', 'wmf-char-maer': 'wmf01',
  'wmf-char-stapes': 'wmf01', 'wmf-char-bredon': 'wmf01',
  'wmf-char-meluan': 'meluan', 'wmf-char-caudicus': 'wmf01',
  'wmf-char-dagon': 'lateVisit', 'wmf-char-tempi': 'wmf02',
  'wmf-char-dedan': 'lateVisit', 'wmf-char-hespe': 'lateVisit',
  'wmf-char-marten': 'lateVisit', 'wmf-char-felurian': 'cthaeh',
  'wmf-char-cthaeh': 'cthaeh', 'wmf-char-vashet': 'wmf02',
  'wmf-char-shehyn': 'wmf02', 'wmf-char-penthe': 'wmf02',
  'wmf-char-carceret': 'wmf02', 'wmf-char-magwyn': 'wmf02',
  'wmf-char-celean': 'wmf02', 'wmf-char-alleg': 'lateVisit',
  'wmf-char-krin': 'lateVisit', 'wmf-char-ellie': 'lateVisit',
  'wmf-char-losi': 'road', 'wmf-char-jake': 'road',
}

const itemKeys = {
  '1O1chlFlXu4e1-p5qvuyC': 'auriScene', '4wDM6Y64AOoBrcPvkRuVw': 'waystone',
  '7dC2Xg36oeDJ8h5otOeHM': 'calling', 'EwmFCiNYCi0-rKQiRjRMr': 'trebon',
  'IJYESD7ekjoQvNiA6DwLK': 'waystone', 'Qw0tDX4TbqPXmaqm6Eanz': 'eolian',
  'SAzUPHhM9_4Q248pFpN3q': 'eolian', 'T8j3tfWgj591-lD-lIA1X': 'waystone',
  'UZ42t97LnWO6zUx9pl-Jl': 'abenthy', 'caf2GBI9wzyvW4qr0m1dX': 'trebon',
  'e5ulCbAFymfwJt_UHZuzV': 'waystone', 'eXWQvFqdt8SGx068wLMaA': 'devi',
  'lNxbkwSAdNkTd2bo8NE1i': 'calling', 'm-LM_lnpT5mryazKLTMN5': 'calling',
  'vZFnsm42k8_BYsLYNVv5-': 'draccus', 'wmf-item-denna-ring': 'denna',
  'wmf-item-plum-bob': 'devi', 'wmf-item-bloodless': 'calling',
  'wmf-item-tak-set': 'wmf01', 'wmf-item-maer-ring': 'wmf01',
  'wmf-item-bone-ring': 'wmf01', 'wmf-item-shaed': 'cthaeh',
  'wmf-item-caesura': 'wmf02', 'wmf-item-lackless-box': 'meluan',
  'wmf-item-holly-crown': 'cthaeh', 'wmf-item-lead-guilder': 'university',
}

const locationKeys = {
  '8EaviveyJAdNRJkoz4BOB': 'tarbean', '8ux4lVzmYDDQz2nTswrJG': 'university',
  'AHn4hlLR3jP_ipHQ8TBoN': 'waystone', 'CashWQKQwgIS0dkgXWT_t': 'draccus',
  'KS9MFtkRlXTp08Po9Qr17': 'troupe', 'dXRnTHBpGWk-xWztFDFKF': 'road',
  'erfwyqrrNPNboM_bzrXyP': 'road', 'hWIHmBHBQvMNagJBcwndi': 'troupe',
  'sz1bQvXqeYOSaKVPMa2nZ': 'road', 'uqlpkIgYhYu6FIOhG6oyr': 'troupe',
  'wmf-portal-severen': 'wmf01', 'wmf-portal-eld': 'lateVisit',
  'wmf-portal-fae': 'cthaeh', 'wmf-portal-ademre': 'wmf02',
  'wmf-portal-levinshir': 'road',
  '1hB6HPDaIDQiqwPcrKxBm': 'trebon', '9f_fFr_MXboysrFokA0Y7': 'trebon',
  'IZBeZ4fKmO1qmy5mtKoc8': 'trebon', 'OFutIzjR2AY8TG0EylcPj': 'draccus',
  'WOh1oH03GQY9LOAC_mZmA': 'road', 'mFcnunVYKQXI6G0kBZ0dU': 'draccus',
  'zbRMmURiN_ermy_Vf_qSr': 'trebon',
  '-_pELDk4CEASELyh9eaf2': 'tarbean', 'XhA-kt9M2qxB2GufgKUlm': 'tarbean',
  'h3VZSVTAw0TIgYC6xQcY3': 'tarbean', 'n1uSqKcW6-aa_12_e9wgG': 'skarpi',
  'nAe7OLQFjhRQY2zNo2YOq': 'underthing',
  '6SkZ-35qmi8z9SVVJrHJ3': 'university', '9P4gLcPd6l0AsUaaxP-ZN': 'university',
  'I-tD6LkxVPxZ_NU5LiGHZ': 'underthing', 'KOyluojRx15k0xX2fC-9Y': 'eolian',
  'QTXLWVTtHlxYVC_KoCoaA': 'wind', 'QgBfQshOZRB67MhBO3DgP': 'university',
  'WHl6i1Tr5R687oB53VLUX': 'devi', '_7v9IPNMP5eBLGo4pBN3t': 'university',
  'eZmrrojlWsFNuMuaqVjJc': 'calling', 'l0GVRPxqzmoJDWksW5keG': 'university',
  'mZVtKxQL4kIVmBLY2eTTo': 'university', 's5fhnNAf1-OEPoJIqhLNn': 'university',
  'u1qVavY60d6NpnelWjUVJ': 'wind', 'usRx4DPi14WntbSqIsrqI': 'underthing',
  'wFPpk1jXB7IIap9Enx-Re': 'eolian', 'zPWhlfcrzYQUtjGWYFq1U': 'archives',
  'wmf-loc-grey-man': 'denna',
  '47NMv8qzSWVDVPyfKXo2y': 'road', 'NM2uL1PjbpPUD4Ws2eV2n': 'waystone',
  'WCrhxlkG2ouMogCbwFINm': 'waystone', 'i4DiG-YzX03p18hEJV18g': 'lateVisit',
  'wmf-loc-severen': 'wmf01', 'wmf-loc-severen-high': 'wmf01',
  'wmf-loc-severen-low': 'wmf01', 'wmf-loc-the-sheer': 'wmf01',
  'wmf-portal-maer-estate': 'wmf01',
  'wmf-loc-maer-estate': 'wmf01', 'wmf-loc-caudicus': 'wmf01',
  'wmf-loc-bredon': 'wmf01', 'wmf-loc-kvothe-maer-rooms': 'wmf01',
  'wmf-loc-eld': 'lateVisit', 'wmf-loc-bandit-camp': 'lateVisit',
  'wmf-loc-eld-camp': 'lateVisit',
  'wmf-loc-fae': 'cthaeh', 'wmf-loc-cthaeh': 'cthaeh',
  'wmf-loc-felurian-pavilion': 'cthaeh',
  'wmf-loc-stormwal': 'wmf02', 'wmf-loc-haert': 'wmf02',
  'wmf-loc-sword-tree': 'wmf02', 'wmf-loc-adem-training': 'wmf02',
  'wmf-loc-pennysworth': 'road', 'wmf-loc-false-ruh': 'lateVisit',
  'wmf-loc-levinshir': 'road', 'wmf-loc-anwater-farm': 'road',
}

const createdAt = 1786060800000
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const usedKeys = new Set([...Object.values(characterKeys), ...Object.values(itemKeys), ...Object.values(locationKeys)])
  data.blobs = (data.blobs ?? []).filter(({ id }) => !id.startsWith('wmf-illustration-'))
  data.blobs.push(...[...usedKeys].map((key) => ({
    id: `wmf-illustration-${key}`,
    worldId: data.world.id,
    mimeType: images[key].includes('.png') ? 'image/png' : 'image/jpeg',
    url: images[key],
    createdAt,
  })))

  for (const character of data.characters) {
    character.portraitImageId = `wmf-illustration-${characterKeys[character.id]}`
    delete character.imageId
  }
  for (const item of data.items) item.imageId = `wmf-illustration-${itemKeys[item.id]}`
  for (const location of data.locationMarkers) location.imageId = `wmf-illustration-${locationKeys[location.id]}`

  const blobIds = new Set(data.blobs.map(({ id }) => id))
  const badCharacters = data.characters.filter(({ portraitImageId }) => !portraitImageId || !blobIds.has(portraitImageId))
  const badItems = data.items.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  const badLocations = data.locationMarkers.filter(({ imageId }) => !imageId || !blobIds.has(imageId))
  if (badCharacters.length || badItems.length || badLocations.length) {
    throw new Error(`Unresolved artwork in ${file}: characters=${badCharacters.map(({ name }) => name)} items=${badItems.map(({ name }) => name)} locations=${badLocations.map(({ name }) => name)}`)
  }

  fs.writeFileSync(file, JSON.stringify(data))
  console.log(`${path.relative(root, file)}: ${data.characters.length} characters, ${data.items.length} items, and ${data.locationMarkers.length} locations illustrated with ${usedKeys.size} linked images`)
}
