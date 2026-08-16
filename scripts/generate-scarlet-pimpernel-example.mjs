import fs from 'node:fs'

const P = 'scarlet-pimpernel'
const worldId = `${P}-world`
const now = 1786579200000
const base = { worldId, createdAt: now, updatedAt: now }
const id = (kind, slug) => `${P}-${kind}-${slug}`
const I = slug => id('image', slug)
const C = slug => id('character', slug)
const L = slug => id('location', slug)
const M = slug => id('map', slug)
const Ch = number => id('chapter', String(number).padStart(2, '0'))
const T = slug => id('thread', slug)
const O = slug => id('motif', slug)
const F = slug => id('faction', slug)
const K = slug => id('fact', slug)
const R = slug => id('relationship', slug)
const Item = slug => id('item', slug)
const commons = (name, width = 1200) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}?width=${width}`
const stage = page => `https://gutenberg.net.au/ebooks/fr100323-images/${page}.jpg`
const image = (slug, url) => ({ id: I(slug), worldId, mimeType: 'image/jpeg', url, createdAt: now })

const blobs = [
  image('cover', commons('Thescarletpimpernel1908.jpg')),
  image('channel-map', commons('Map of the route from London to Paris (FL62896610 2586198).jpg')),
  image('london-map', commons('Plan of the Cities of London and Westminster, 1790s, R. Horwood.png')),
  image('paris-map', commons('Plan de Paris par Merian - 1615.jpg')),
  image('calais-map', commons('Carte de Comte de Kent et du Pas de Calais. (IA dr carte-de-comte-de-kent-et-du-pas-de-calais-12059025).jpg', 1920)),
  image('percy-marguerite', stage('page008')),
  image('paris-cart', stage('page018')),
  image('sally-inn', stage('page024')),
  image('lord-tony', stage('page038')),
  image('league', stage('frontispiece')),
  image('percy-rescue', stage('page058')),
  image('armand-marguerite', stage('page064')),
  image('marguerite', stage('page076')),
  image('de-tournay', stage('page112')),
  image('paper-scene', stage('page154')),
  image('chauvelin', stage('page202')),
  image('escape', stage('page250')),
  image('pimpernel-emblem', 'https://mdl.artvee.com/ft/58247pl.jpg'),
  image('sealed-letter', commons('Lettre de Louis XIII 1 et 2 - Archives Nationales - AE-II-789.jpg')),
  image('schooner-engraving', 'https://readingroo.ms/7/2/8/5/72859/72859-h/images/p069_ill.jpg'),
]

const reviewedArt = {
  'percy-marguerite': 'Percy and Marguerite in a Scarlet Pimpernel stage scene',
  'paris-cart': 'the book-specific Paris barrier and covered-cart escape scene',
  'sally-inn': 'Sally Jellyband at the Fisherman’s Rest',
  'lord-tony': 'Lord Tony Dewhurst',
  league: 'members of the English rescue circle in a Scarlet Pimpernel stage scene',
  'percy-rescue': 'Sir Percy in a rescue scene',
  'armand-marguerite': 'Armand and Marguerite',
  marguerite: 'Marguerite Blakeney',
  'de-tournay': 'the de Tournay family scene',
  'paper-scene': 'the book-specific paper and betrayal scene',
  chauvelin: 'Citizen Chauvelin in the pursuit plot',
  escape: 'the final coastal escape sequence',
  'pimpernel-emblem': 'an eighteenth-century botanical plate of the scarlet pimpernel flower',
  'sealed-letter': 'a period sealed handwritten letter',
  'schooner-engraving': 'a period engraving of a two-masted schooner under sail',
}

const maps = [
  ['channel', null, 'England, France, and the Channel', 'The novel’s route between Paris, London, Dover, Calais, and the coastal escape.', 960, 1479, 'channel-map'],
  ['london', 'channel', 'London, 1790s', 'A Georgian plan for the Blakeneys’ social world, the opera, and Lord Grenville’s ball.', 1280, 707, 'london-map'],
  ['paris', 'channel', 'Paris, September 1792', 'A historical plan for the opening rescue at the western barricade and the revolutionary centre.', 1280, 857, 'paris-map'],
  ['calais-coast', 'channel', 'Calais and the Channel Coast', 'An eighteenth-century coastal chart for the Chat Gris, the road toward Gris-Nez, Père Blanchard’s hut, and the waiting schooner.', 1920, 1223, 'calais-map'],
].map(([slug, parent, name, description, imageWidth, imageHeight, imageSlug]) => ({
  ...base,
  id: M(slug),
  parentMapId: parent ? M(parent) : null,
  name,
  description,
  imageId: I(imageSlug),
  imageWidth,
  imageHeight,
  scalePixelsPerUnit: null,
  scaleUnit: null,
  levelGroupId: null,
  levelIndex: 0,
  levelLabel: '',
}))

const locationRows = [
  ['london-gate', 'channel', 'London', 'The English capital where Percy’s fashionable public life conceals the League’s command centre.', 'london', 115, 130, 'city', 'percy-marguerite'],
  ['richmond', 'channel', 'Richmond', 'The quieter Thames-side retreat where Percy and Marguerite confront the distance in their marriage.', null, 100, 175, 'town', 'percy-marguerite'],
  ['dover', 'channel', 'Dover', 'The Channel port where refugees arrive, packets wait on weather and tide, and the pursuit races toward France.', null, 510, 345, 'city', 'sally-inn'],
  ['fishermans-rest', 'channel', 'The Fisherman’s Rest', 'Mr Jellyband’s Dover inn, a busy coaching house whose ordinary hospitality shelters refugees and secret League business.', null, 500, 330, 'building', 'sally-inn'],
  ['calais-gate', 'channel', 'Calais', 'The French port from which the road runs west toward the Chat Gris, Gris-Nez, and the League’s coastal rendezvous.', 'calais-coast', 650, 385, 'city', 'escape'],
  ['paris-gate', 'channel', 'Paris', 'The revolutionary capital where the de Tournays begin their flight through a guarded city barrier.', 'paris', 765, 1265, 'city', 'paris-cart'],
  ['blakeney-house', 'london', 'Blakeney Town House', 'Percy and Marguerite’s fashionable London home, outwardly polished while their confidence in one another has broken down.', null, 330, 250, 'building', 'percy-marguerite'],
  ['grenville-ball', 'london', 'Lord Grenville’s House', 'The diplomatic ball where Chauvelin watches the League and Marguerite searches for its hidden leader.', null, 360, 235, 'building', 'league'],
  ['opera', 'london', 'The Opera House', 'A crowded public setting where Chauvelin privately reveals his leverage over Armand.', null, 410, 300, 'building', 'chauvelin'],
  ['west-barricade', 'paris', 'West Barricade', 'A guarded Paris gate where carts are searched before the evening closure and Percy’s first shown rescue succeeds by disguise.', null, 160, 525, 'landmark', 'paris-cart'],
  ['place-greve', 'paris', 'Place de Grève', 'The public square associated with executions and the crowd’s violent revolutionary spectacle at the novel’s opening.', null, 805, 470, 'landmark', 'paris-cart'],
  ['chat-gris', 'calais-coast', 'The Chat Gris', 'A dilapidated wayside inn outside Calais on the road toward Gris-Nez, used by Percy as a meeting point and stage for misdirection.', null, 1450, 380, 'building', 'chauvelin'],
  ['gris-nez-road', 'calais-coast', 'Road toward Gris-Nez', 'The dark coastal road along which Chauvelin’s party follows a cart toward the supposed rendezvous.', null, 1370, 430, 'landmark', 'escape'],
  ['blanchard-hut', 'calais-coast', 'Père Blanchard’s Hut', 'A lonely coastal hut chosen as the fugitives’ rendezvous and surrounded by Chauvelin’s men as a trap closes.', null, 1270, 500, 'building', 'escape'],
  ['cliff-creek', 'calais-coast', 'Cliff Creek and Landing', 'A concealed creek below the cliffs where the League’s boat can reach the fugitives and carry them to the schooner.', null, 1230, 520, 'landmark', 'schooner-engraving'],
]
const locations = locationRows.map(([slug, mapSlug, name, description, linkedMap, x, displayY, iconType, art]) => {
  const layer = maps.find(map => map.id === M(mapSlug))
  return { ...base, id: L(slug), mapLayerId: M(mapSlug), linkedMapLayerId: linkedMap ? M(linkedMap) : null, name, description, x, y: layer.imageHeight - displayY, imageId: I(art), iconType, tags: [], factionId: null }
})

const characterRows = [
  ['percy', 'Sir Percy Blakeney', [], 'A wealthy English baronet whose extravagant clothes, slow drawl, and apparently empty wit make him a fashionable curiosity; his marriage to Marguerite is visibly strained.', 'percy-rescue'],
  ['marguerite', 'Marguerite Blakeney', ['Marguerite St. Just'], 'A celebrated French actress and Percy’s wife, renowned for her intelligence but burdened by a past denunciation and a marriage without trust.', 'marguerite'],
  ['chauvelin', 'Citizen Chauvelin', [], 'An accredited agent of the French Republic who uses surveillance, coercion, and patience to identify and capture the Scarlet Pimpernel.', 'chauvelin'],
  ['armand', 'Armand St. Just', [], 'Marguerite’s devoted brother and an ally of the League whose compromising letter becomes Chauvelin’s leverage.', 'armand-marguerite'],
  ['suzanne', 'Suzanne de Tournay', [], 'The Comte’s daughter, rescued from Paris and sustained by the hope that her father will follow her to safety.', 'de-tournay'],
  ['comtesse', 'Comtesse de Tournay', [], 'Suzanne’s proud mother, rescued with her children and openly hostile to Marguerite because of the St. Cyr denunciation.', null],
  ['comte', 'Comte de Tournay', [], 'A proscribed French aristocrat waiting near Calais for the League to complete his escape.', null],
  ['vicomte', 'Vicomte de Tournay', [], 'Suzanne’s brother, rescued from Paris with his mother and sister.', null],
  ['tony', 'Lord Anthony Dewhurst', ['Lord Tony'], 'An enthusiastic member of the League who helps receive the de Tournay refugees at Dover.', 'lord-tony'],
  ['andrew', 'Sir Andrew Ffoulkes', [], 'A trusted League lieutenant who protects its secrets, aids Marguerite, and guides her to Calais.', 'league'],
  ['sally', 'Sally Jellyband', [], 'Mr Jellyband’s capable daughter, serving travellers at the Fisherman’s Rest while political danger gathers around the inn.', 'sally-inn'],
  ['jellyband', 'Mr Jellyband', [], 'The patriotic and hospitable proprietor of the Fisherman’s Rest and Sally’s father.', null],
  ['prince', 'The Prince of Wales', [], 'The Prince’s fashionable social presence helps define the world in which Percy’s foppish manner appears credible.', 'percy-marguerite'],
  ['bibot', 'Sergeant Bibot', [], 'A confident guard at the West Barricade who believes himself too vigilant to be fooled by the Pimpernel.', 'paris-cart'],
  ['desgas', 'Citizen Desgas', [], 'Chauvelin’s secretary and field subordinate during the pursuit from Calais to the hut.', null],
].map(([slug, name, aliases, description, portrait]) => ({ ...base, id: C(slug), name, aliases, description, portraitImageId: portrait ? I(portrait) : null, color: '#813b38', tags: [], isAlive: true, birthDate: null }))

const items = [
  ['flower', 'Scarlet Pimpernel Emblem', 'A small red flower drawn on the League’s notices, simultaneously a signature, a promise of rescue, and a taunt.', 'symbol', 'pimpernel-emblem'],
  ['armand-letter', 'Armand’s Letter', 'An intercepted letter that proves Armand’s sympathy with the League and gives Chauvelin power over Marguerite.', 'document', 'sealed-letter'],
  ['league-papers', 'The League’s Papers', 'Instructions and plans stolen at Dover, revealing the Calais rendezvous without naming the League’s leader.', 'document', 'paper-scene'],
  ['market-cart', 'The Covered Market Cart', 'The cart in which the de Tournays pass the Paris barrier beneath Percy’s disguise and a false threat of illness.', 'vehicle', 'paris-cart'],
  ['schooner', 'The Day Dream', 'Percy’s schooner, waiting offshore to carry the fugitives and their rescuers safely back to England.', 'vehicle', 'schooner-engraving'],
].map(([slug, name, description, iconType, art]) => ({ ...base, id: Item(slug), name, description, iconType, imageId: I(art), tags: [] }))

const plotThreads = [
  ['rescue', 'The de Tournay Rescue', '#a54a42', 'The League moves the de Tournay family from Paris and reunites them through the final Calais operation.'],
  ['identity', 'Who Is the Scarlet Pimpernel?', '#c88b3a', 'Chauvelin hunts for the hidden leader while Marguerite gradually reads the signs inside her own marriage.'],
  ['marriage', 'Percy and Marguerite', '#8a5f7d', 'Estrangement, suspicion, sacrifice, and the possibility of renewed trust shape the emotional story.'],
  ['pursuit', 'The Race to Calais', '#596c7c', 'Warnings, weather, disguise, and counter-surveillance determine who reaches the fugitives first.'],
].map(([slug, name, color, description]) => ({ ...base, id: T(slug), name, color, description }))
const motifs = [
  ['disguise', 'Masks and Disguise', '#7e6958', 'Clothing, manners, accents, and social assumptions repeatedly conceal identity and intention.'],
  ['flower', 'The Scarlet Flower', '#aa3d43', 'The pimpernel emblem turns anonymity into a recognizable moral promise.'],
  ['trust', 'Trust and Betrayal', '#6b6c88', 'Letters, secrets, bargains, and withheld truths test both political loyalty and marriage.'],
  ['channel', 'Weather, Tide, and the Channel', '#4f7485', 'The sea is a physical boundary whose wind and tide can decide whether courage arrives in time.'],
].map(([slug, name, color, description]) => ({ ...base, id: O(slug), name, color, description }))

const titles = ['Paris: September, 1792', 'Dover: “The Fisherman’s Rest”', 'The Refugees', 'The League of the Scarlet Pimpernel', 'Marguerite', 'An Exquisite of ’92', 'The Secret Orchard', 'The Accredited Agent', 'The Outrage', 'In the Opera Box', 'Lord Grenville’s Ball', 'The Scrap of Paper', 'Either—Or?', 'One O’Clock Precisely!', 'Doubt', 'Richmond', 'Farewell', 'The Mysterious Device', 'The Scarlet Pimpernel', 'The Friend', 'Suspense', 'Calais', 'Hope', 'The Death-Trap', 'The Eagle and the Fox', 'The Jew', 'On the Track', 'The Père Blanchard’s Hut', 'Trapped', 'The Schooner', 'The Escape']

const scenes = [
  { key: 'barrier', chapter: 1, title: 'The Cart Passes the West Barricade', description: 'Bibot recoils from an apparent outbreak of disease and allows an old woman’s cart to leave Paris; the passengers are the de Tournays and the driver is the disguised Pimpernel.', loc: 'west-barricade', cast: { bibot: 'Abandons close inspection when the cart appears to carry contagious illness.', comtesse: 'Remains concealed in the cart while the unknown rescuer carries her out of Paris.', suzanne: 'Keeps hidden with her mother and brother until the barrier is behind them.', vicomte: 'Endures the concealed crossing without exposing the ruse.' }, items: ['market-cart', 'flower'], threads: ['rescue', 'identity'], motifs: ['disguise', 'flower'], time: 268.72, tension: 4, pov: 'bibot' },
  { key: 'inn-evening', chapter: 2, title: 'An Evening at the Fisherman’s Rest', description: 'Sally and Mr Jellyband manage the busy Dover inn while talk of France, refugees, and English safety fills the coffee-room.', loc: 'fishermans-rest', cast: { sally: 'Serves the crowded coffee-room while keeping its travellers and local regulars in order.', jellyband: 'Hosts the political conversation with patriotic confidence and practical hospitality.' }, threads: [], motifs: ['channel'], time: 269.68, tension: 1, pov: 'sally' },
  { key: 'refugees-arrive', chapter: 3, title: 'The de Tournays Reach Dover', description: 'Lord Tony and Sir Andrew escort the rescued Comtesse, Suzanne, and the Vicomte into the Fisherman’s Rest after their Channel crossing.', loc: 'fishermans-rest', cast: { tony: 'Presents the rescued family with exuberant pride in the League’s success.', andrew: 'Keeps the rescue details discreet while ensuring the refugees are safe.', comtesse: 'Arrives exhausted but fiercely grateful to the unknown rescuer.', suzanne: 'Reaches English safety and begins to trust Sir Andrew.', vicomte: 'Enters the inn safely after the escape from Paris.', sally: 'Receives the new arrivals and helps settle them after the crossing.', jellyband: 'Extends his inn’s hospitality to the French refugees.' }, threads: ['rescue'], motifs: ['channel'], time: 269.73, tension: 2, pov: 'suzanne' },
  { key: 'league-explained', chapter: 4, title: 'The League and Its Hidden Leader', description: 'Tony and Andrew explain that twenty Englishmen serve a leader whose identity is protected by oath, and whose emblem is the scarlet flower.', loc: 'fishermans-rest', cast: { tony: 'Describes the League’s work while protecting the leader’s name.', andrew: 'Speaks with devotion about the Pimpernel and his oath of secrecy.', comtesse: 'Tries to learn whom she must thank for her family’s rescue.', suzanne: 'Listens with growing admiration for both the League and Sir Andrew.', vicomte: 'Learns how the English rescue network operates.' }, items: ['flower'], threads: ['identity', 'rescue'], motifs: ['flower', 'trust'], time: 269.76, tension: 2, pov: 'andrew' },
  { key: 'papers-stolen', chapter: 4, title: 'Chauvelin Takes the League’s Papers', description: 'Chauvelin’s agents overpower the League men and seize plans for the next rescue, giving the French agent a route to the fugitives but not the leader’s name.', loc: 'fishermans-rest', cast: { chauvelin: 'Secures the League’s operational papers and gains the first concrete advantage in his pursuit.', tony: 'Is caught off guard and loses papers meant to remain secret.', andrew: 'Survives the attack but recognizes that the Calais operation is compromised.' }, items: ['league-papers'], threads: ['pursuit', 'identity', 'rescue'], motifs: ['trust'], time: 269.82, tension: 4, pov: 'chauvelin' },
  { key: 'marguerite-arrives', chapter: 5, title: 'Lady Blakeney Meets the Refugees', description: 'Marguerite and Percy arrive at the inn, where the Comtesse’s hostility recalls Marguerite’s role in the fall of the St. Cyr family.', loc: 'fishermans-rest', cast: { marguerite: 'Meets the rescued family with social brilliance while absorbing the Comtesse’s public condemnation.', percy: 'Uses languid humour to deflect the room’s tension and shield Marguerite from humiliation.', comtesse: 'Refuses to conceal her contempt for Marguerite’s past denunciation.', suzanne: 'Balances affection for Marguerite against loyalty to her mother.', prince: 'Moves within the fashionable party surrounding the Blakeneys.' }, threads: ['marriage', 'rescue'], motifs: ['trust', 'disguise'], time: 269.86, tension: 3, pov: 'marguerite' },
  { key: 'exquisite', chapter: 6, title: 'Percy Performs the Exquisite', description: 'Percy’s clothes, drawl, and apparently empty wit convince the company that he is incapable of serious political action.', loc: 'fishermans-rest', cast: { percy: 'Deepens the foppish performance that protects his secret identity.', marguerite: 'Treats Percy’s public foolishness with practiced amusement and private frustration.', prince: 'Accepts Percy as a fashionable companion rather than a political actor.' }, threads: ['identity', 'marriage'], motifs: ['disguise'], time: 269.89, tension: 1, pov: 'marguerite' },
  { key: 'orchard-farewell', chapter: 7, title: 'Marguerite and Armand Say Farewell', description: 'In the orchard, Marguerite and Armand reaffirm their devotion before he returns to France to assist the rescue of the Comte.', loc: 'fishermans-rest', cast: { marguerite: 'Lets her confident social mask fall and confides her loneliness to Armand.', armand: 'Promises loyalty to his sister while preparing to accept the risks of France.' }, threads: ['marriage', 'rescue'], motifs: ['trust'], time: 269.93, tension: 2, pov: 'marguerite' },
  { key: 'accredited-agent', chapter: 8, title: 'Chauvelin Demands Marguerite’s Help', description: 'Chauvelin invokes their revolutionary past and asks Marguerite to discover the identity of the Scarlet Pimpernel.', loc: 'fishermans-rest', cast: { marguerite: 'Rejects Chauvelin’s politics and tries to keep the conversation light.', chauvelin: 'Tests old acquaintance and patriotic language as tools for recruiting Marguerite.' }, threads: ['identity', 'pursuit'], motifs: ['trust'], time: 269.95, tension: 3, pov: 'marguerite' },
  { key: 'armand-leverage', chapter: 9, title: 'Armand’s Letter Becomes Leverage', description: 'Chauvelin reveals the intercepted letter linking Armand to the League and makes the brother’s safety conditional on Marguerite’s cooperation.', loc: 'fishermans-rest', cast: { marguerite: 'Realizes that refusing Chauvelin may condemn the brother she loves.', chauvelin: 'Turns the letter into a calculated threat and fixes the terms of the bargain.' }, items: ['armand-letter', 'league-papers'], threads: ['identity', 'pursuit', 'marriage'], motifs: ['trust'], time: 269.97, tension: 4, pov: 'marguerite' },
  { key: 'opera-box', chapter: 10, title: 'The Bargain in the Opera Box', description: 'At the opera, Chauvelin tightens his bargain: Marguerite must watch the League at Lord Grenville’s ball if Armand is to be spared.', loc: 'opera', cast: { marguerite: 'Conceals panic behind wit while searching for a way to protect Armand without betraying an innocent man.', chauvelin: 'Uses the public setting and the letter to keep Marguerite under control.' }, items: ['armand-letter'], threads: ['identity', 'pursuit'], motifs: ['trust', 'disguise'], time: 270.78, tension: 4, pov: 'marguerite' },
  { key: 'ball-gathers', chapter: 11, title: 'The League Gathers at Grenville’s Ball', description: 'Diplomats, the Prince, the Blakeneys, and League members converge while Chauvelin watches for the unknown leader.', loc: 'grenville-ball', cast: { marguerite: 'Moves through the ball alert to every League conversation and ashamed of the task imposed on her.', percy: 'Sustains his social mask in the centre of the very search meant to expose him.', chauvelin: 'Studies Tony and Andrew for any contact that might reveal their leader.', andrew: 'Keeps League business hidden despite the surveillance around him.', tony: 'Maintains outward ease while the stolen plans endanger the mission.', prince: 'Moves through the diplomatic and fashionable gathering as its highest-ranking guest.', suzanne: 'Attends with hope that the League will soon rescue her father.' }, threads: ['identity', 'pursuit', 'marriage'], motifs: ['disguise', 'trust'], time: 270.86, tension: 3, pov: 'marguerite' },
  { key: 'scrap-found', chapter: 12, title: 'Marguerite Finds the Scrap of Paper', description: 'A discarded message marked with the flower gives Marguerite the time and place of the League leader’s meeting.', loc: 'grenville-ball', cast: { marguerite: 'Recognizes that the scrap can save Armand but may deliver the Pimpernel to Chauvelin.', andrew: 'Has unknowingly left behind the clue that compromises the meeting.' }, mentioned: ['chauvelin'], items: ['flower'], threads: ['identity', 'pursuit'], motifs: ['flower', 'trust'], time: 270.9, tension: 4, pov: 'marguerite' },
  { key: 'either-or', chapter: 13, title: 'Marguerite Chooses Under Duress', description: 'Unable to find another way to save Armand, Marguerite gives Chauvelin the meeting information and accepts the cost without knowing whom she has betrayed.', loc: 'grenville-ball', cast: { marguerite: 'Passes on the clue while confronting the moral injury of choosing her brother over a stranger.', chauvelin: 'Receives the information needed to watch the one-o’clock meeting.' }, items: ['armand-letter', 'flower'], threads: ['identity', 'pursuit', 'marriage'], motifs: ['trust', 'flower'], time: 270.92, tension: 5, pov: 'marguerite' },
  { key: 'warning-andrew', chapter: 14, title: 'A Warning Before One O’Clock', description: 'Marguerite warns Sir Andrew that Chauvelin knows about the meeting, but the message cannot reach the leader in time.', loc: 'grenville-ball', cast: { marguerite: 'Risks exposing her bargain to prevent the trap from succeeding.', andrew: 'Understands the danger and tries to protect his leader without breaking the League’s oath.' }, threads: ['identity', 'pursuit'], motifs: ['trust'], time: 270.96, tension: 4, pov: 'marguerite' },
  { key: 'one-oclock-watch', chapter: 14, title: 'Chauvelin Watches the Supper Room', description: 'At one o’clock Chauvelin watches for the Pimpernel, while Percy appears to sleep through the danger in the supper room.', loc: 'grenville-ball', cast: { chauvelin: 'Watches every arrival and departure, confident that the leader must reveal himself.', percy: 'Uses apparent sleep and social insignificance to pass through the surveillance unseen.', marguerite: 'Waits in dread for the consequences of the information she supplied.' }, threads: ['identity', 'pursuit'], motifs: ['disguise'], time: 270.99, tension: 5, pov: 'marguerite' },
  { key: 'doubt', chapter: 15, title: 'The Trap Appears to Fail', description: 'The meeting yields no obvious leader, leaving Chauvelin suspicious and Marguerite uncertain whether her warning succeeded.', loc: 'grenville-ball', cast: { marguerite: 'Clings to the possibility that the unknown man escaped Chauvelin’s watch.', chauvelin: 'Reassesses the room and resolves to follow the mission toward France.' }, threads: ['identity', 'pursuit'], motifs: ['trust', 'disguise'], time: 271.02, tension: 3, pov: 'marguerite' },
  { key: 'richmond-confrontation', chapter: 16, title: 'Husband and Wife at Richmond', description: 'Marguerite appeals to Percy for help with Armand and exposes the pain beneath their polished marriage; Percy listens without revealing his secret.', loc: 'richmond', cast: { marguerite: 'Asks Percy for help and finally speaks honestly about fear, loneliness, and regret.', percy: 'Recognizes her sincerity but still protects the League by withholding his identity.' }, threads: ['marriage', 'identity'], motifs: ['trust', 'disguise'], time: 271.48, travel: 0.3, tension: 4, pov: 'marguerite', mode: 'coach' },
  { key: 'farewell', chapter: 17, title: 'Percy Leaves for France', description: 'Percy departs on the compromised rescue mission after a restrained farewell that Marguerite does not yet understand.', loc: 'richmond', cast: { percy: 'Commits to the Calais operation despite knowing Chauvelin may be following.', marguerite: 'Reads danger in Percy’s farewell but still lacks the fact that would explain it.' }, threads: ['marriage', 'rescue', 'pursuit'], motifs: ['trust', 'channel'], time: 271.56, tension: 4, pov: 'marguerite' },
  { key: 'device-decoded', chapter: 18, title: 'The Flower Device Connects the Clues', description: 'Back in London, the flower emblem and Percy’s unexplained conduct force Marguerite to reconsider everything she believes about him.', loc: 'blakeney-house', cast: { marguerite: 'Compares the emblem, the ball, and Percy’s departure until the hidden pattern becomes unavoidable.' }, items: ['flower'], threads: ['identity', 'marriage'], motifs: ['flower', 'trust'], time: 271.68, travel: 0.15, tension: 4, pov: 'marguerite', mode: 'coach' },
  { key: 'identity-revealed', chapter: 19, title: 'Marguerite Realizes Percy Is the Pimpernel', description: 'Suzanne’s news that the Pimpernel has gone to rescue the Comte completes Marguerite’s deduction: she has exposed her own husband to Chauvelin.', loc: 'blakeney-house', cast: { marguerite: 'Understands Percy’s mask and the full danger created by her bargain with Chauvelin.', suzanne: 'Shares hopeful news of the Pimpernel’s mission without knowing what it reveals to Marguerite.' }, items: ['flower'], threads: ['identity', 'marriage', 'rescue'], motifs: ['flower', 'trust', 'disguise'], time: 271.71, tension: 5, pov: 'marguerite' },
  { key: 'andrew-friend', chapter: 20, title: 'Sir Andrew Chooses to Trust Marguerite', description: 'Marguerite confesses her part in Chauvelin’s discovery and persuades Andrew to help her race to Percy rather than protect the secret from her.', loc: 'blakeney-house', cast: { marguerite: 'Admits her betrayal without excuse and asks for the chance to warn and save Percy.', andrew: 'Balances his oath against Percy’s immediate danger and chooses to guide Marguerite.' }, items: ['armand-letter'], threads: ['marriage', 'pursuit', 'identity'], motifs: ['trust'], time: 271.75, tension: 4, pov: 'marguerite' },
  { key: 'race-dover', chapter: 21, title: 'The Race from London to Dover', description: 'Marguerite and Andrew drive for Dover, measuring every delay against Chauvelin’s head start.', loc: 'dover', cast: { marguerite: 'Pushes through exhaustion and fear to reach the Channel crossing.', andrew: 'Organizes the fastest route and passage available while guarding Percy’s operational details.' }, threads: ['pursuit', 'marriage'], motifs: ['channel'], time: 272.65, travel: 0.9, tension: 4, pov: 'marguerite', mode: 'coach' },
  { key: 'storm-delay', chapter: 21, title: 'Storm and Tide Hold the Packet', description: 'At Dover, the storm and turning tide prevent an immediate crossing, leaving Marguerite and Andrew trapped in suspense.', loc: 'fishermans-rest', cast: { marguerite: 'Waits through the storm knowing Percy is already on French soil.', andrew: 'Checks the pier and vessels repeatedly but cannot force a safe departure.', sally: 'Supports the travellers during the anxious delay at the inn.', jellyband: 'Provides shelter while weather closes the Channel.' }, threads: ['pursuit', 'marriage'], motifs: ['channel'], time: 273.25, travel: 0.6, tension: 4, pov: 'marguerite' },
  { key: 'channel-crossing', chapter: 22, title: 'Across the Channel to Calais', description: 'When wind and tide permit, Marguerite and Andrew cross to France and arrive after a punishing delay.', loc: 'calais-gate', cast: { marguerite: 'Endures the crossing with her attention fixed on reaching Percy before Chauvelin’s trap closes.', andrew: 'Gets them ashore and immediately turns toward the League’s Calais contact point.' }, threads: ['pursuit', 'marriage'], motifs: ['channel'], time: 275.64, travel: 0.65, tension: 4, pov: 'marguerite', mode: 'sailing' },
  { key: 'chat-gris-arrival', chapter: 22, title: 'Marguerite Reaches the Chat Gris', description: 'Andrew leads Marguerite to the squalid wayside inn outside Calais, where Percy was expected to leave word.', loc: 'chat-gris', cast: { marguerite: 'Searches the inn for any sign that Percy has arrived safely.', andrew: 'Questions the innkeeper and prepares Marguerite for the danger of the coastal road.' }, threads: ['pursuit', 'rescue'], motifs: ['trust'], time: 275.7, travel: 0.1, tension: 3, pov: 'marguerite', mode: 'foot' },
  { key: 'hope-message', chapter: 23, title: 'A Sign That Percy Is Ahead', description: 'Clues at the Chat Gris suggest Percy has reached Calais and is still directing the rescue, renewing hope without removing the danger.', loc: 'chat-gris', cast: { marguerite: 'Takes the smallest sign of Percy’s activity as reason to continue rather than despair.', andrew: 'Interprets the League’s arrangements and helps Marguerite remain hidden.' }, threads: ['pursuit', 'rescue', 'marriage'], motifs: ['flower', 'trust'], time: 275.73, tension: 3, pov: 'marguerite' },
  { key: 'chauvelin-arrives', chapter: 24, title: 'Chauvelin Takes Control of the Chat Gris', description: 'Chauvelin and Desgas arrive with armed support, turning the inn and road into a death-trap while Marguerite and Andrew conceal themselves.', loc: 'chat-gris', cast: { chauvelin: 'Deploys Desgas and the soldiers to watch the inn, road, and coastal rendezvous.', desgas: 'Carries out Chauvelin’s orders and coordinates the waiting men.', marguerite: 'Remains hidden close enough to hear the trap being prepared.', andrew: 'Keeps Marguerite concealed and resists acting before they understand the plan.' }, items: ['league-papers'], threads: ['pursuit', 'rescue'], motifs: ['disguise', 'trust'], time: 275.76, tension: 5, pov: 'marguerite' },
  { key: 'percy-enters', chapter: 25, title: 'Percy Walks into the Chat Gris', description: 'Percy enters openly under his own name and faces Chauvelin across the inn, apparently unaware that the agent believes the net has closed.', loc: 'chat-gris', cast: { percy: 'Uses the foppish persona as an active weapon while measuring Chauvelin’s plan.', chauvelin: 'Treats Percy’s arrival as confirmation that his quarry is finally within reach.', marguerite: 'Watches from concealment, unable to warn Percy without exposing herself.', andrew: 'Recognizes Percy’s performance but cannot know the whole counter-plan.' }, threads: ['pursuit', 'identity', 'marriage'], motifs: ['disguise'], time: 275.79, tension: 5, pov: 'marguerite' },
  { key: 'pepper-ruse', chapter: 25, title: 'The Eagle and the Fox Test Each Other', description: 'Percy’s apparently foolish behaviour, including a well-timed disturbance, lets him escape the inn and keep Chauvelin focused on the wrong signs.', loc: 'chat-gris', cast: { percy: 'Turns comic manner and prepared distraction into room to escape surveillance.', chauvelin: 'Underestimates the purpose behind Percy’s absurd behaviour and momentarily loses control.', desgas: 'Tries to restore order while Percy slips beyond immediate reach.' }, threads: ['pursuit', 'identity'], motifs: ['disguise'], time: 275.81, tension: 5, pov: 'percy' },
  { key: 'road-disguise', chapter: 26, title: 'The Cart Driver Leads the Pursuit', description: 'Percy adopts another disguise and carries Chauvelin, Desgas, and the hidden Marguerite along the road toward the rendezvous he has already altered.', loc: 'gris-nez-road', cast: { percy: 'Controls the pace and direction of the pursuit from inside a disguise Chauvelin dismisses.', chauvelin: 'Accepts the driver as a useful subordinate while concentrating on the expected arrest.', desgas: 'Accompanies Chauvelin and watches the road for the Pimpernel.', marguerite: 'Follows under constraint, uncertain whether Percy knows she is near.' }, threads: ['pursuit', 'rescue', 'identity'], motifs: ['disguise'], time: 275.86, travel: 0.08, tension: 5, pov: 'marguerite', mode: 'cart' },
  { key: 'on-track', chapter: 27, title: 'The Soldiers Close on the Hut', description: 'Chauvelin’s party approaches Père Blanchard’s hut, convinced that Percy and the fugitives will enter the guarded trap.', loc: 'gris-nez-road', cast: { chauvelin: 'Positions the soldiers and waits for the fugitives to expose the Pimpernel.', desgas: 'Passes orders along the line and seals the approaches.', marguerite: 'Searches the darkness for any chance to warn Percy.', percy: 'Remains concealed within his disguise while keeping the rescue plan ahead of the soldiers.' }, threads: ['pursuit', 'rescue'], motifs: ['disguise', 'trust'], time: 275.9, tension: 5, pov: 'marguerite' },
  { key: 'hut-surrounded', chapter: 28, title: 'Père Blanchard’s Hut Is Surrounded', description: 'The soldiers wait around the hut while Armand, the Comte, and the other fugitives depend on Percy’s promised signal and instructions.', loc: 'blanchard-hut', cast: { chauvelin: 'Holds his men in readiness for the leader and fugitives to appear together.', desgas: 'Maintains the cordon around the hut.', marguerite: 'Sees the trap from inside Chauvelin’s party and struggles not to reveal herself.', armand: 'Waits inside the rendezvous point for the rescue he has been told to trust.', comte: 'Entrusts his life and the reunion with his family to the League’s plan.' }, mentioned: ['percy'], items: ['league-papers'], threads: ['pursuit', 'rescue', 'marriage'], motifs: ['trust'], time: 275.93, tension: 5, pov: 'marguerite' },
  { key: 'fugitives-slip-away', chapter: 29, title: 'The Fugitives Follow Percy’s Instructions', description: 'A concealed message sends the fugitives one by one down the cliff toward the hidden creek while Chauvelin’s men continue to watch the hut.', loc: 'blanchard-hut', cast: { percy: 'Directs the escape without presenting the target Chauvelin expects.', armand: 'Leaves the hut quietly and follows the marked route toward the creek.', comte: 'Moves with the other fugitives toward the waiting boat.', chauvelin: 'Keeps watching the wrong point as the rescue unfolds outside his assumptions.', desgas: 'Maintains the trap without detecting the cliff route.', marguerite: 'Realizes the silence may be evidence of Percy’s counter-plan rather than defeat.' }, items: ['flower'], threads: ['rescue', 'pursuit'], motifs: ['flower', 'disguise'], time: 275.96, tension: 5, pov: 'marguerite' },
  { key: 'boat-whistle', chapter: 30, title: 'The Boat Answers from the Creek', description: 'The fugitives reach the concealed landing, signal the boat, and are rowed out toward the Day Dream while the shore trap collapses.', loc: 'cliff-creek', cast: { percy: 'Keeps the final route open and ensures the boat receives the fugitives.', armand: 'Reaches the League’s boat and escapes the soldiers on shore.', comte: 'Boards the boat that will take him to the schooner and his family.', chauvelin: 'Discovers too late that the hut was never the true point of capture.', desgas: 'Tries to redirect the soldiers after the fugitives have reached the water.' }, items: ['schooner'], threads: ['rescue', 'pursuit'], motifs: ['channel', 'disguise'], time: 275.99, tension: 5, pov: 'percy' },
  { key: 'marguerite-found', chapter: 31, title: 'Percy Finds Marguerite', description: 'After outmanoeuvring the pursuit, Percy reaches Marguerite and learns that she crossed the Channel to warn him despite the danger.', loc: 'cliff-creek', cast: { percy: 'Drops the public mask and recognizes the courage behind Marguerite’s pursuit.', marguerite: 'Confesses the bargain, the warning, and her recovered love without hiding from the harm she caused.' }, threads: ['marriage', 'identity', 'pursuit'], motifs: ['trust', 'disguise'], time: 276.02, tension: 4, pov: 'marguerite' },
  { key: 'day-dream-escape', chapter: 31, title: 'The Day Dream Carries Them Home', description: 'Percy, Marguerite, Armand, the Comte, and the League leave the French coast with the rescue complete and their trust altered by what each risked.', loc: 'cliff-creek', cast: { percy: 'Completes the rescue and turns toward England with his secret intact beyond the people he trusts.', marguerite: 'Leaves France reconciled to Percy’s hidden life and ready to rebuild their marriage.', armand: 'Escapes with the knowledge that Marguerite risked everything for both him and Percy.', comte: 'Reaches safety and the prospect of reunion with his wife and children.', andrew: 'Helps bring the rescued party aboard and sees his trust in Marguerite vindicated.' }, items: ['schooner', 'flower'], threads: ['rescue', 'marriage', 'identity'], motifs: ['channel', 'flower', 'trust'], time: 276.08, tension: 3, pov: 'marguerite' },
]

const eventIdByKey = new Map(scenes.map((scene, index) => [scene.key, id('event', String(index + 1).padStart(3, '0'))]))
const EV = key => eventIdByKey.get(key)
const timelineId = id('timeline', 'main')
const chapters = titles.map((title, index) => {
  const chapterScenes = scenes.filter(scene => scene.chapter === index + 1)
  return { ...base, id: Ch(index + 1), timelineId, number: index + 1, title, synopsis: chapterScenes.map(scene => scene.description).join(' '), notes: '', wordGoal: null }
})
const events = scenes.map((scene, index) => ({
  ...base,
  id: EV(scene.key),
  chapterId: Ch(scene.chapter),
  timelineId,
  title: scene.title,
  description: scene.description,
  locationMarkerId: L(scene.loc),
  involvedCharacterIds: Object.keys(scene.cast).map(C),
  mentionedCharacterIds: (scene.mentioned ?? []).map(C),
  involvedItemIds: (scene.items ?? []).map(Item),
  tags: [],
  sortOrder: scenes.slice(0, index).filter(other => other.chapter === scene.chapter).length * 10,
  travelDays: scene.travel ?? 0,
  // The story occurs in leap-year 1792; scene.time values are authored on a
  // common-year ordinal and shifted once here so October 2 renders correctly.
  inWorldTime: scene.time + 1,
  tension: scene.tension,
  structureBeat: null,
  threadIds: scene.threads.map(T),
  motifIds: scene.motifs.map(O),
  status: 'final',
  povCharacterId: scene.pov ? C(scene.pov) : null,
  isFlashback: false,
}))

const characterSnapshots = scenes.flatMap((scene, sceneIndex) => Object.entries(scene.cast).map(([character, statusNotes], castIndex) => {
  const location = locations.find(marker => marker.id === L(scene.loc))
  const inventoryItemIds = Object.entries(scene.inventory ?? {}).filter(([, holder]) => holder === character).map(([item]) => Item(item))
  return { ...base, id: id('snapshot', `${String(sceneIndex + 1).padStart(3, '0')}-${character}`), characterId: C(character), eventId: EV(scene.key), sortKey: scene.chapter * 10000 + (events[sceneIndex].sortOrder ?? 0) + castIndex, isAlive: true, currentLocationMarkerId: L(scene.loc), currentMapLayerId: location.mapLayerId, inventoryItemIds, inventoryNotes: '', statusNotes, travelModeId: scene.mode ? id('travel-mode', scene.mode) : null }
}))

const travelModes = [
  ['coach', 'Post Coach', 80],
  ['sailing', 'Channel Packet or Schooner', 140],
  ['foot', 'On Foot', 25],
  ['cart', 'Horse Cart', 35],
].map(([slug, name, speedPerDay]) => ({ ...base, id: id('travel-mode', slug), name, speedPerDay }))

const characterMovements = []
for (const character of characterRows) {
  let previous = null
  for (const scene of scenes.filter(candidate => Object.hasOwn(candidate.cast, character.id.replace(`${P}-character-`, '')))) {
    if (previous && previous.loc !== scene.loc) {
      characterMovements.push({ ...base, id: id('movement', `${character.id.replace(`${P}-character-`, '')}-${scene.key}`), characterId: character.id, eventId: EV(scene.key), waypoints: [L(previous.loc), L(scene.loc)], travelModeId: scene.mode ? id('travel-mode', scene.mode) : null, sortKey: scene.chapter * 10000, notes: `${character.name} moves from ${locations.find(location => location.id === L(previous.loc)).name} to ${locations.find(location => location.id === L(scene.loc)).name}.` })
    }
    previous = scene
  }
}

const itemPlacements = scenes.flatMap((scene, sceneIndex) => (scene.items ?? []).map((item, itemIndex) => ({ ...base, id: id('placement', `${scene.key}-${item}`), itemId: Item(item), eventId: EV(scene.key), locationMarkerId: L(scene.loc), sortKey: scene.chapter * 10000 + itemIndex, notes: `${items.find(entry => entry.id === Item(item)).name} is present during “${scene.title}”.` })))
const itemSnapshots = [
  ['league-papers', 'papers-stolen', 'stolen', 'Chauvelin has taken the League’s operational plans from Dover.'],
  ['armand-letter', 'armand-leverage', 'intercepted', 'The letter is intact and in Chauvelin’s possession as leverage over Marguerite.'],
  ['armand-letter', 'andrew-friend', 'returned', 'Chauvelin has fulfilled the narrow promise to return the letter while continuing the pursuit.'],
  ['schooner', 'boat-whistle', 'ready offshore', 'The Day Dream waits beyond the creek with the League’s boat moving between shore and schooner.'],
].map(([item, event, condition, notes], index) => ({ ...base, id: id('item-snapshot', `${item}-${event}`), itemId: Item(item), eventId: EV(event), sortKey: events.findIndex(entry => entry.id === EV(event)) * 100 + index, condition, notes }))

const relationshipRows = [
  ['percy-marguerite', 'percy', 'marguerite', 'estranged spouses', 'bond', 'complex', 'Their marriage carries love, secrecy, wounded pride, and the possibility of renewed trust.', 'marguerite-arrives'],
  ['marguerite-armand', 'marguerite', 'armand', 'devoted siblings', 'bond', 'positive', 'Their mutual devotion makes Armand the leverage Chauvelin needs and the first person to whom Marguerite shows vulnerability.', 'orchard-farewell'],
  ['percy-andrew', 'percy', 'andrew', 'leader and trusted lieutenant', 'strong', 'positive', 'Andrew protects Percy’s identity and carries out the League’s practical work.', 'identity-revealed'],
  ['percy-tony', 'percy', 'tony', 'League comrades', 'strong', 'positive', 'Tony follows Percy’s leadership with courage and enthusiasm.', 'identity-revealed'],
  ['andrew-tony', 'andrew', 'tony', 'League comrades', 'strong', 'positive', 'The two men share operations, risks, and the oath protecting their leader.', 'league-explained'],
  ['chauvelin-marguerite', 'chauvelin', 'marguerite', 'former allies; coercer and target', 'strong', 'negative', 'Past revolutionary acquaintance becomes coercion when Chauvelin threatens Armand.', 'accredited-agent'],
  ['chauvelin-percy', 'chauvelin', 'percy', 'hunter and hidden adversary', 'strong', 'negative', 'Chauvelin hunts the leader concealed behind Percy’s social mask.', 'identity-revealed'],
  ['suzanne-comte', 'suzanne', 'comte', 'daughter and father', 'bond', 'positive', 'Suzanne’s hope for her father’s rescue supplies the final mission’s personal stakes.', 'refugees-arrive'],
  ['comtesse-comte', 'comtesse', 'comte', 'wife and husband', 'bond', 'positive', 'The rescued Comtesse waits in England while her husband remains in mortal danger.', 'refugees-arrive'],
  ['comtesse-suzanne', 'comtesse', 'suzanne', 'mother and daughter', 'bond', 'positive', 'Their shared exile is complicated by Suzanne’s affection for people her mother distrusts.', 'refugees-arrive'],
  ['comtesse-vicomte', 'comtesse', 'vicomte', 'mother and son', 'bond', 'positive', 'They survive the Paris escape and Channel crossing together.', 'refugees-arrive'],
  ['comte-vicomte', 'comte', 'vicomte', 'father and son', 'bond', 'positive', 'The Vicomte reaches England while his father remains with the fugitives awaiting rescue.', 'refugees-arrive'],
  ['suzanne-vicomte', 'suzanne', 'vicomte', 'sister and brother', 'strong', 'positive', 'They share the concealed journey through Paris and the Channel crossing to safety.', 'barrier'],
  ['andrew-suzanne', 'andrew', 'suzanne', 'growing courtship', 'moderate', 'positive', 'Gratitude and admiration develop into personal affection.', 'refugees-arrive'],
  ['marguerite-suzanne', 'marguerite', 'suzanne', 'friends', 'strong', 'positive', 'Suzanne’s affection for Marguerite survives her mother’s hostility and ultimately helps Marguerite understand Percy’s mission.', 'marguerite-arrives'],
  ['marguerite-comtesse', 'marguerite', 'comtesse', 'old grievance', 'strong', 'negative', 'The Comtesse holds Marguerite responsible for the denunciation that destroyed the St. Cyr family.', 'marguerite-arrives'],
  ['percy-prince', 'percy', 'prince', 'fashionable friends', 'moderate', 'positive', 'The Prince accepts Percy within the highest social circle, reinforcing the credibility of Percy’s public persona.', 'marguerite-arrives'],
  ['armand-comte', 'armand', 'comte', 'allies in flight', 'strong', 'positive', 'Armand joins the Comte and the other fugitives at the coastal rendezvous.', 'hut-surrounded'],
  ['jellyband-sally', 'jellyband', 'sally', 'father and daughter', 'bond', 'positive', 'They run the Fisherman’s Rest together with affection and practical teamwork.', 'inn-evening'],
  ['chauvelin-desgas', 'chauvelin', 'desgas', 'superior and field agent', 'moderate', 'neutral', 'Desgas executes Chauvelin’s surveillance and arrest orders during the Calais pursuit.', 'chauvelin-arrives'],
].map(([slug, a, b, label, strength, sentiment, description, start]) => ({ ...base, id: R(slug), characterAId: C(a), characterBId: C(b), label, strength, sentiment, description, isBidirectional: true, startEventId: EV(start) }))

const relationshipSnapshots = [
  ['percy-marguerite', 'marguerite-arrives', 'estranged spouses', 'bond', 'complex', 'Public polish conceals a marriage without confidence.', true],
  ['percy-marguerite', 'richmond-confrontation', 'spouses speaking honestly', 'bond', 'complex', 'Marguerite’s appeal opens the first honest conversation between them in months.', true],
  ['percy-marguerite', 'marguerite-found', 'reconciled spouses', 'bond', 'positive', 'Risk, confession, and mutual recognition reopen the trust their marriage lacked.', true],
  ['chauvelin-marguerite', 'armand-leverage', 'coercer and target', 'strong', 'negative', 'Chauvelin makes Armand’s life the price of Marguerite’s cooperation.', true],
  ['chauvelin-marguerite', 'road-disguise', 'captor and captive witness', 'strong', 'negative', 'Chauvelin keeps Marguerite within the pursuing party while she searches for a way to warn Percy.', true],
  ['chauvelin-percy', 'percy-enters', 'adversaries face to face', 'strong', 'negative', 'Both men know the contest is active even while Percy performs ignorance.', true],
  ['andrew-suzanne', 'ball-gathers', 'quiet courtship', 'moderate', 'positive', 'Their affection is visible beneath the urgency of the Comte’s rescue.', true],
].map(([relationship, event, label, strength, sentiment, description, isActive], index) => ({ ...base, id: id('relationship-snapshot', `${relationship}-${event}`), relationshipId: R(relationship), eventId: EV(event), sortKey: events.findIndex(entry => entry.id === EV(event)) * 100 + index, label, strength, sentiment, description, isActive }))

const factions = [
  ['league', 'The League of the Scarlet Pimpernel', 'Twenty English aristocrats bound by secrecy and obedience to rescue condemned people from revolutionary France.', '#9f3f46', 'league'],
  ['republic', 'Agents of the French Republic', 'Chauvelin, Desgas, and the guards tasked with stopping escapes and capturing the League’s leader.', '#455f72', 'chauvelin'],
  ['tournay', 'The de Tournay Family', 'A proscribed aristocratic household divided between English refuge and the final escape from France.', '#8b7552', 'de-tournay'],
].map(([slug, name, description, color, art]) => ({ ...base, id: F(slug), name, description, color, coverImageId: I(art), tags: [] }))
const factionMemberships = [
  ['league', 'percy', 'Leader', 'identity-revealed'], ['league', 'andrew', 'Lieutenant', 'league-explained'], ['league', 'tony', 'Member', 'league-explained'],
  ['republic', 'chauvelin', 'Accredited agent', 'accredited-agent'], ['republic', 'desgas', 'Secretary and field agent', 'chauvelin-arrives'], ['republic', 'bibot', 'Barrier sergeant', 'barrier'],
  ['tournay', 'comte', 'Head of family', 'barrier'], ['tournay', 'comtesse', 'Comtesse', 'barrier'], ['tournay', 'suzanne', 'Daughter', 'barrier'], ['tournay', 'vicomte', 'Son', 'barrier'],
].map(([faction, character, role, start]) => ({ ...base, id: id('membership', `${faction}-${character}`), factionId: F(faction), characterId: C(character), role, startEventId: EV(start), endEventId: null, notes: '' }))
const factionRelationships = [
  { ...base, id: id('faction-relationship', 'league-republic'), factionAId: F('league'), factionBId: F('republic'), stance: 'hostile', notes: 'The Republic seeks to stop the League’s rescues and capture its leader.' },
  { ...base, id: id('faction-relationship', 'league-tournay'), factionAId: F('league'), factionBId: F('tournay'), stance: 'allied', notes: 'The League commits itself to bringing the family to safety.' },
]

const loreCategories = [
  { id: id('lore-category', 'history'), worldId, name: 'Historical Setting', color: '#6b7079', sortOrder: 0 },
  { id: id('lore-category', 'league'), worldId, name: 'The League', color: '#9f3f46', sortOrder: 1 },
  { id: id('lore-category', 'sources'), worldId, name: 'Sources and Visual Record', color: '#786a58', sortOrder: 2 },
]
const lorePages = [
  ['terror', 'history', 'Paris and the Revolutionary Terror', 'The novel opens in September 1792 amid revolutionary executions, guarded barriers, and the persecution of aristocratic families. Orczy heightens this historical setting into the immediate danger from which the League operates.', ['paris-gate', 'republic'], 'barrier', 'paris-cart'],
  ['league-oath', 'league', 'One to Command, Nineteen to Obey', 'The League consists of twenty Englishmen. Its members protect the leader’s identity by oath and rely on preparation, disguise, speed, and disciplined trust rather than open battle.', ['league', 'andrew', 'tony'], 'league-explained', 'league'],
  ['disguises', 'league', 'Percy’s Operational Disguises', 'Percy’s disguises exploit expectation: guards dismiss the sick, political agents ignore servants, and fashionable society mistakes performed foolishness for incapacity.', ['percy', 'identity'], 'identity-revealed', 'percy-rescue'],
  ['chronology', 'history', 'Editorial Chronology', 'The novel explicitly places the coastal rendezvous on 2 October 1792 and the opening in September. Earlier dates in the calendar are an editorial reconstruction of the narrated intervals, marked as such rather than presented as exact documentary dates.', ['channel'], 'barrier', 'channel-map'],
  ['sources', 'sources', 'Text, Maps, and Illustrations', 'Structure and factual sequence follow Baroness Orczy’s public-domain novel. Linked stage images come from a circa-1903 Scarlet Pimpernel production reproduced by Project Gutenberg Australia; maps are historical editorial aids and entity art is reviewed separately from navigable maps.', [], 'barrier', 'cover'],
].map(([slug, category, title, body, links, visible, art]) => ({ ...base, id: id('lore', slug), categoryId: id('lore-category', category), title, body, tags: [], coverImageId: I(art), linkedEntityIds: links.map(link => link === 'channel' ? M('channel') : link === 'identity' ? T('identity') : ['league', 'republic', 'tournay'].includes(link) ? F(link) : C(link)), visibleFromEventId: EV(visible) }))

const knowledgeFacts = [
  ['league-exists', 'The rescue network is a twenty-man English League', 'Its members serve a hidden leader and protect his identity by oath.', 'league-explained', 'league-explained'],
  ['papers-stolen', 'Chauvelin has the League’s Calais plans', 'The stolen papers reveal the next rendezvous without exposing the leader’s name.', 'papers-stolen', 'papers-stolen'],
  ['armand-compromised', 'Armand’s letter compromises him', 'Chauvelin can use the letter to threaten Armand with punishment for aiding the League.', 'armand-leverage', 'armand-leverage'],
  ['ball-meeting', 'The Pimpernel’s leader will meet at one o’clock', 'The scrap marked with the flower gives the time and place of the League meeting.', 'scrap-found', 'scrap-found'],
  ['percy-identity', 'Sir Percy is the Scarlet Pimpernel', 'The apparently foolish baronet is the strategist directing the rescues.', 'identity-revealed', 'identity-revealed'],
  ['hut-trap', 'Chauvelin intends to trap the League at Père Blanchard’s hut', 'The soldiers surround the expected rendezvous rather than the concealed cliff route.', 'chauvelin-arrives', 'chauvelin-arrives'],
  ['creek-route', 'The true escape route descends to the creek', 'Percy’s instructions send the fugitives away from the watched hut to the League’s boat.', 'fugitives-slip-away', 'fugitives-slip-away'],
].map(([slug, title, description, reader, origin]) => ({ ...base, id: K(slug), title, description, tags: [], readerLearnsAtEventId: EV(reader), originEventId: EV(origin) }))
const knowledgeReveals = [
  ['league-exists', 'comtesse', 'league-explained', 'Tony and Andrew explain who rescued the family.'],
  ['league-exists', 'suzanne', 'league-explained', 'Suzanne learns the oath and structure of the League.'],
  ['papers-stolen', 'chauvelin', 'papers-stolen', 'Chauvelin reads the stolen plans.'],
  ['papers-stolen', 'andrew', 'papers-stolen', 'Andrew knows the operation has been compromised.'],
  ['armand-compromised', 'marguerite', 'armand-leverage', 'Chauvelin shows Marguerite the danger created by the letter.'],
  ['ball-meeting', 'marguerite', 'scrap-found', 'Marguerite decodes the flower-marked scrap.'],
  ['ball-meeting', 'chauvelin', 'either-or', 'Marguerite gives Chauvelin the meeting information.'],
  ['percy-identity', 'marguerite', 'identity-revealed', 'Suzanne’s news completes Marguerite’s deduction.'],
  ['percy-identity', 'chauvelin', 'percy-enters', 'Chauvelin acts on the conclusion that Percy is his quarry.'],
  ['hut-trap', 'marguerite', 'chauvelin-arrives', 'Marguerite overhears Chauvelin’s deployment.'],
  ['creek-route', 'armand', 'fugitives-slip-away', 'Percy’s concealed instructions reveal the route.'],
  ['creek-route', 'comte', 'fugitives-slip-away', 'The Comte follows the same instructions toward the boat.'],
].map(([fact, character, event, note]) => ({ ...base, id: id('reveal', `${fact}-${character}`), factId: K(fact), characterId: C(character), eventId: EV(event), note }))

const characterGoals = [
  ['percy-rescue', 'percy', 'want', 'Rescue the de Tournay family without sacrificing the League or its secret.', 'barrier', 'day-dream-escape'],
  ['percy-mask', 'percy', 'need', 'Keep public performance subordinate to genuine trust with Marguerite.', 'marguerite-arrives', 'marguerite-found'],
  ['marguerite-armand', 'marguerite', 'want', 'Protect Armand from the consequences of his intercepted letter.', 'armand-leverage', 'day-dream-escape'],
  ['marguerite-percy', 'marguerite', 'want', 'Reach Percy in time to warn him and repair the betrayal.', 'identity-revealed', 'marguerite-found'],
  ['marguerite-trust', 'marguerite', 'need', 'Replace pride and secrecy with honest trust in her marriage.', 'richmond-confrontation', 'marguerite-found'],
  ['chauvelin-capture', 'chauvelin', 'want', 'Identify and capture the Scarlet Pimpernel with the fugitives he intends to rescue.', 'accredited-agent', 'boat-whistle'],
  ['andrew-duty', 'andrew', 'want', 'Protect the League’s leader while carrying out the rescue operation.', 'league-explained', 'day-dream-escape'],
  ['suzanne-father', 'suzanne', 'want', 'See her father brought safely from France.', 'refugees-arrive', 'day-dream-escape'],
].map(([slug, character, type, text, start, end]) => ({ ...base, id: id('goal', slug), characterId: C(character), type, text, startEventId: EV(start), endEventId: EV(end) }))

const locationSnapshots = [
  { ...base, id: id('location-snapshot', 'chat-gris-watched'), locationMarkerId: L('chat-gris'), eventId: EV('chauvelin-arrives'), sortKey: 240000, status: 'under surveillance', notes: 'Chauvelin’s men control the inn and its approaches.' },
  { ...base, id: id('location-snapshot', 'hut-surrounded'), locationMarkerId: L('blanchard-hut'), eventId: EV('hut-surrounded'), sortKey: 280000, status: 'surrounded', notes: 'Soldiers wait outside for the fugitives and the Pimpernel.' },
  { ...base, id: id('location-snapshot', 'hut-empty'), locationMarkerId: L('blanchard-hut'), eventId: EV('fugitives-slip-away'), sortKey: 290000, status: 'abandoned', notes: 'The fugitives leave by the hidden cliff route before the trap closes.' },
]

const mapRoutes = [
  { ...base, id: id('route', 'england'), mapLayerId: M('channel'), name: 'London to Dover', routeType: 'road', waypoints: [L('london-gate'), L('richmond'), L('dover')], color: '#8e6d4f', notes: 'Marguerite and Andrew’s urgent road journey to the coast.' },
  { ...base, id: id('route', 'channel'), mapLayerId: M('channel'), name: 'Dover to Calais', routeType: 'sea_route', waypoints: [L('dover'), L('calais-gate')], color: '#557b8d', notes: 'The storm-delayed Channel crossing.' },
  { ...base, id: id('route', 'calais-pursuit'), mapLayerId: M('calais-coast'), name: 'Chat Gris to the Creek', routeType: 'road', waypoints: [L('chat-gris'), L('gris-nez-road'), L('blanchard-hut'), L('cliff-creek')], color: '#9f3f46', notes: 'The pursuit route and the final concealed descent to the boat.' },
]

const data = {
  version: 16,
  type: 'worldbreaker-export',
  exportedAt: now,
  world: { id: worldId, name: 'The Scarlet Pimpernel', description: 'Baroness Orczy’s historical adventure follows a hidden English rescue league across revolutionary France and the Channel, while Marguerite Blakeney races to undo Chauvelin’s leverage and recover the trust lost inside her marriage.', coverImageId: I('cover'), theme: 'theme-action', readingMode: true, createdAt: now, updatedAt: now, continuityStaleThreshold: 5, calendar: { startYear: 1792, yearSuffix: ' (editorial chronology)', months: [['January', 31], ['February', 29], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]].map(([name, days]) => ({ name, days })) }, wordTarget: null },
  mapLayers: maps,
  locationMarkers: locations,
  characters: characterRows,
  items,
  characterSnapshots,
  characterMovements,
  itemPlacements,
  locationSnapshots,
  itemSnapshots,
  relationships: relationshipRows,
  relationshipSnapshots,
  timelines: [{ id: timelineId, worldId, name: 'England and France, September–October 1792', description: 'One continuous chronology from the Paris rescue to the Calais escape.', color: '#813b38', dayOffset: 0, createdAt: now }],
  chapters,
  events,
  blobs,
  travelModes,
  timelineRelationships: [],
  crossTimelineArtifacts: [],
  mapRoutes,
  mapRegions: [],
  mapRegionSnapshots: [],
  mapAnnotations: [],
  loreCategories,
  lorePages,
  factions,
  factionMemberships,
  factionRelationships,
  knowledgeFacts,
  knowledgeReveals,
  characterGoals,
  sceneTexts: [],
  plotThreads,
  motifs,
  continuitySuppressions: [],
  writingLogs: [],
  sceneRevisions: [],
}

for (const child of maps.filter(map => map.parentMapId)) {
  if (locations.filter(location => location.linkedMapLayerId === child.id).length !== 1) throw new Error(`Expected exactly one gateway for ${child.name}`)
}
if (new Set(events.map(event => event.chapterId)).size !== titles.length) throw new Error('Every chapter needs an event')
if (characterSnapshots.length !== events.reduce((sum, event) => sum + event.involvedCharacterIds.length, 0)) throw new Error('Snapshot coverage mismatch')
if (new Set(characterSnapshots.map(snapshot => `${snapshot.eventId}:${snapshot.characterId}`)).size !== characterSnapshots.length) throw new Error('Duplicate character snapshot')
const portraitIds = characterRows.map(character => character.portraitImageId).filter(Boolean)
if (new Set(portraitIds).size !== portraitIds.length) throw new Error('Character art must be distinct when assigned')
if (new Set(items.map(item => item.imageId)).size !== items.length) throw new Error('Item art must be distinct')
const mapImageIds = new Set(maps.map(map => map.imageId))
for (const entity of [...characterRows, ...items, ...locations]) {
  const imageId = entity.portraitImageId ?? entity.imageId
  if (!imageId) continue
  if (mapImageIds.has(imageId)) throw new Error(`${entity.name} uses a map as an illustration`)
  const slug = imageId.replace(`${P}-image-`, '')
  if (!reviewedArt[slug]) throw new Error(`${entity.name} has no reviewed image rationale`)
}
const references = {
  characters: new Set(characterRows.map(character => character.id)),
  locations: new Set(locations.map(location => location.id)),
  items: new Set(items.map(item => item.id)),
  threads: new Set(plotThreads.map(thread => thread.id)),
  motifs: new Set(motifs.map(motif => motif.id)),
}
for (const event of events) {
  if (!references.locations.has(event.locationMarkerId)) throw new Error(`${event.title} has an invalid location`)
  if (event.involvedCharacterIds.some(character => !references.characters.has(character))) throw new Error(`${event.title} has an invalid character`)
  if (event.involvedItemIds.some(item => !references.items.has(item))) throw new Error(`${event.title} has an invalid item`)
  if (event.threadIds.some(thread => !references.threads.has(thread))) throw new Error(`${event.title} has an invalid thread`)
  if (event.motifIds.some(motif => !references.motifs.has(motif))) throw new Error(`${event.title} has an invalid motif`)
  if (!Number.isFinite(event.inWorldTime)) throw new Error(`${event.title} has no calendar time`)
}

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync('example/The Scarlet Pimpernel.pwk', text)
fs.writeFileSync('public/library/the-scarlet-pimpernel.pwk', text)
console.log(JSON.stringify({ chapters: chapters.length, events: events.length, characters: characterRows.length, relationships: relationshipRows.length, locations: locations.length, maps: maps.length, items: items.length, threads: plotThreads.length, lore: lorePages.length, factions: factions.length, facts: knowledgeFacts.length, goals: characterGoals.length, bytes: Buffer.byteLength(text) }, null, 2))
