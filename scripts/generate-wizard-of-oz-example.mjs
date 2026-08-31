/*
  Builds the shipped example world for L. Frank Baum's *The Wonderful Wizard of
  Oz* (1900) and updates the library catalogue.

  Rules followed: docs/EXAMPLE_AUTHORING_RULES.md.

  Source (EX-001): Project Gutenberg eBook #55, the complete 1900 text. All
  twenty-four chapter titles below are Baum's own headings, transcribed from
  that edition — nothing here is an editorial signpost, so EX-008 does not
  apply. Every summary, description and status note is original structural
  writing about the book; no prose from the novel is reproduced (EX-007).

  Chronology (EX-006): the novel dates nothing. The day numbers below are an
  editorial reconstruction built only from the book's own elapsed-time markers
  ("that night", "three days and four nights", "day by day passed"), anchored to
  1 August so the ripe corn and blooming poppies sit in a plausible season. The
  Lore page "How this chronology was reconstructed" says so in the app.

  Artwork (EX-301/EX-306/EX-307): every picture is one of W. W. Denslow's
  illustrations for the first edition, in the public domain, downloaded from
  Wikimedia Commons, opened and visually checked before it was assigned, then
  downscaled and committed under public/library/the-wonderful-wizard-of-oz/art/.
  Provenance for each file is listed in that folder's SOURCES.md. The seven map
  layers are interpretive maps drawn for this example from the text's own
  geography — see maps/*.svg, which render to the shipped PNGs.
*/
import fs from 'node:fs'

const P = 'oz'
const worldId = 'wizard-of-oz-world'
const now = 1788393600000
const base = { worldId, createdAt: now, updatedAt: now }
const repo = 'library/the-wonderful-wizard-of-oz'

const id = (kind, slug) => `${P}-${kind}-${slug}`
const I = (s) => id('image', s)
const C = (s) => id('character', s)
const L = (s) => id('location', s)
const M = (s) => id('map', s)
const Ch = (n) => id('chapter', String(n).padStart(2, '0'))
const EV = (s) => id('event', s)
const Item = (s) => id('item', s)
const T = (s) => id('thread', s)
const O = (s) => id('motif', s)
const F = (s) => id('faction', s)
const K = (s) => id('fact', s)
const R = (s) => id('relationship', s)

/* Day 1 is 1 August; only the intervals are the book's, not the calendar date. */
const DAY_ONE = 213
const day = (n) => DAY_ONE + n - 1

const blobs = []
const image = (slug, path, mimeType = 'image/jpeg') => {
  blobs.push({ ...base, id: I(slug), mimeType, url: `${repo}/${path}` })
  return I(slug)
}

/* ---------------------------------------------------------------- maps --- */

const mapRows = [
  ['oz', null, 'The Land of Oz', 'A country of four coloured lands around a green city, walled in on every side by a desert nobody crosses.', 1700, 1300],
  ['kansas', null, 'The Kansas Prairie', 'The gray farm Dorothy is carried away from, and the ground she is set down on when she comes back.', 1300, 900],
  ['emerald-city', 'oz', 'The Emerald City', 'The walled city at the exact centre of Oz, entered through one gate and seen entirely through green glass.', 1400, 1000],
  ['palace', 'emerald-city', 'The Palace of Oz', 'The Wizard’s own building: a waiting hall, a domed throne room, guest rooms, and the small chamber behind the throne.', 1300, 900],
  ['yellow-castle', 'oz', 'The Yellow Castle of the West', 'The Wicked Witch’s stronghold among the Winkies, with its kitchen, its barred yard, and its cupboard.', 1250, 900],
  ['china-country', 'oz', 'The Dainty China Country', 'A brittle miniature land shut in behind two china walls, crossed only on foot and only carefully.', 1250, 850],
  ['glinda-castle', 'oz', 'Glinda’s Castle', 'The red castle at the southern rim of Oz, where the last of the four witches keeps her ruby throne.', 1150, 800],
]
const maps = mapRows.map(([slug, parent, name, description, imageWidth, imageHeight]) => ({
  ...base,
  id: M(slug),
  parentMapId: parent ? M(parent) : null,
  name,
  description,
  imageId: image(`map-${slug}`, `maps/${slug === 'oz' ? 'land-of-oz' : slug === 'palace' ? 'palace-of-oz' : slug === 'glinda-castle' ? 'glinda-castle' : slug}.png`, 'image/png'),
  imageWidth,
  imageHeight,
  /* No scale: these are interpretive maps, and a number nothing measures would
     feed the continuity checker confident nonsense (MW-9). */
  scalePixelsPerUnit: null,
  scaleUnit: null,
  levelGroupId: null,
  levelIndex: 0,
  levelLabel: '',
}))

/* ----------------------------------------------------------- locations --- */

/* [slug, map, name, description, linkedMap, x, displayY, iconType, art] */
const locRows = [
  // The Land of Oz
  ['landing-site', 'oz', 'Where the House Came Down', 'A green Munchkin meadow of fruit trees and a brook, marked by the farmhouse that fell out of the sky onto it.', null, 1460, 700, 'landmark', 'landing-site'],
  ['boq-house', 'oz', 'Boq’s House', 'The home of one of the richest Munchkins, whose lawn holds fiddlers, dancing and a loaded supper table.', null, 1330, 724, 'building', 'boq-house'],
  ['cornfield', 'oz', 'The Munchkin Cornfield', 'A fenced field of ripe corn beside the road, with a pole in it holding a stuffed figure above the stalks.', null, 1240, 706, 'landmark', 'cornfield'],
  ['forest-road', 'oz', 'The Road Through the Forest', 'Where the yellow bricks turn broken and uneven and the branches close overhead until the daylight goes.', null, 1150, 716, 'region', 'forest-road'],
  ['woodman-cottage', 'oz', 'The Woodman’s Cottage', 'A small hut of logs and branches in the trees, with a spring nearby and an oil-can on its shelf.', null, 1120, 752, 'building', 'woodman-cottage'],
  ['lion-road', 'oz', 'Where the Lion Bounded Out', 'A stretch of the road under thick branches where the growling of large animals carries out of the trees.', null, 1090, 758, 'landmark', 'lion-road'],
  ['night-camp', 'oz', 'The Camp Under the Great Tree', 'A night stop in the forest, with a fire, a pile of chopped wood and a tree full of nuts nearby.', null, 1062, 748, 'landmark', 'night-camp'],
  ['first-gulf', 'oz', 'The First Great Ditch', 'A wide, steep-sided gulf full of jagged rocks that cuts the road and the forest clean across.', null, 1036, 738, 'landmark', null],
  ['kalidah-gulf', 'oz', 'The Second Ditch', 'A gulf too broad to jump, in the part of the forest where the fiercest beasts of Oz are said to live.', null, 1010, 726, 'landmark', 'kalidah-gulf'],
  ['river-crossing', 'oz', 'The Broad River', 'A swift river between the dark forest and the bright country beyond it, crossed only by raft.', null, 990, 712, 'landmark', 'river-crossing'],
  ['poppy-field', 'oz', 'The Deadly Poppy Field', 'A great meadow of scarlet poppies whose scent puts anything made of flesh to sleep where it stands.', null, 1004, 828, 'region', 'poppy-field'],
  ['mice-field', 'oz', 'The Field-Mouse Meadow', 'Sweet grass and daisies past the poppies, thick with the burrows of a very numerous small people.', null, 950, 886, 'region', null],
  ['green-farmhouse', 'oz', 'The Green Farmhouse', 'The first farm of the green country, where fences, clothes and skins have all taken the colour of the city ahead.', null, 940, 690, 'building', 'green-farmhouse'],
  ['emerald-city', 'oz', 'The Emerald City', 'The city at the exact centre of Oz, where the road of yellow brick ends at a wall and a studded gate.', 'emerald-city', 850, 650, 'city', 'emerald-city'],
  ['west-country', 'oz', 'The Country of the West', 'Rough, hilly, untilled ground with no road across it, watched from a long way off by its one-eyed owner.', null, 620, 616, 'region', 'west-country'],
  ['yellow-castle', 'oz', 'The Yellow Castle', 'The Wicked Witch of the West’s castle, standing over the Winkie country that works for her.', 'yellow-castle', 400, 600, 'building', 'yellow-castle'],
  ['fighting-trees', 'oz', 'The Wood of the Fighting Trees', 'The first rank of a southern wood, whose front trees take hold of anything that tries to walk in under them.', null, 822, 806, 'region', 'fighting-trees'],
  ['china-country', 'oz', 'The Dainty China Country', 'A low white wall on the far side of the wood, with something very small and very brightly coloured behind it.', 'china-country', 858, 928, 'region', 'china-country'],
  ['marshes', 'oz', 'The Bogs and Marshes', 'Rank grass tall enough to hide the mud holes under it, on the way south out of the china country.', null, 962, 1002, 'region', null],
  ['great-forest', 'oz', 'The Great Forest', 'An old wood of enormous trees and deep moss, whose animals are holding a meeting about a monster.', null, 838, 1056, 'region', 'great-forest'],
  ['hammerhead-hill', 'oz', 'The Hill of the Hammer-Heads', 'A steep hillside of loose rock, with an armless people behind every boulder who will not let anyone across.', null, 698, 1082, 'landmark', 'hammerhead-hill'],
  ['quadling-farm', 'oz', 'The Quadling Farmhouse', 'A red-painted farm among ripening grain and strong little bridges, kept by a woman who feeds strangers well.', null, 770, 1128, 'building', null],
  ['glinda-castle', 'oz', 'Glinda’s Castle', 'A beautiful castle at the southern edge of the country, guarded at its gates by three girl soldiers.', 'glinda-castle', 880, 1122, 'building', null],
  // Kansas
  ['kansas-farmhouse', 'kansas', 'The Gale Farmhouse', 'One small room, four walls and a roof, weathered gray by the same sun that has flattened the country around it.', null, 430, 500, 'building', 'kansas-farmhouse'],
  ['kansas-cellar', 'kansas', 'The Cyclone Cellar', 'A dark hole dug under the floor, reached by a trap door and a ladder, for the days the wind comes.', null, 614, 556, 'landmark', null],
  ['kansas-barnyard', 'kansas', 'The Barnyard and Sheds', 'Where the cows and horses are kept, and the first place a Kansas farmer goes when the sky turns.', null, 880, 500, 'building', null],
  ['kansas-prairie', 'kansas', 'The Open Prairie', 'Gray, cracked, treeless ground running flat to the edge of the sky in every direction.', null, 1046, 740, 'region', null],
  ['kansas-new-house', 'kansas', 'The New Farmhouse', 'The house Uncle Henry builds where the old one stood, on the same bare stretch of prairie.', null, 430, 790, 'building', null],
  // The Emerald City
  ['great-gate', 'emerald-city', 'The Great Gate', 'The one way in: a gate thick with emeralds, with a bell beside it and a green man behind it.', null, 1058, 510, 'landmark', 'great-gate'],
  ['guardian-room', 'emerald-city', 'The Guardian’s Room', 'A high arched room inside the gate, holding a great green box of spectacles and the only key that unlocks them.', null, 940, 470, 'building', null],
  ['green-streets', 'emerald-city', 'The Green Streets', 'Marble pavements, green shops and green sweets, and people who pay for them with green pennies.', null, 470, 470, 'region', null],
  ['palace-of-oz', 'emerald-city', 'The Palace of Oz', 'The building in the middle of the city, guarded at its door by a soldier with a long green beard.', 'palace', 660, 510, 'building', 'palace-of-oz'],
  ['launching-ground', 'emerald-city', 'The Launching Ground', 'The open ground before the palace, where the whole city can gather to watch something rise.', null, 660, 790, 'landmark', 'launching-ground'],
  // The Palace
  ['palace-gates', 'palace', 'The Palace Gates', 'The door the green-whiskered soldier keeps, and the mat every visitor is made to wipe their feet on.', null, 250, 675, 'building', null],
  ['waiting-hall', 'palace', 'The Waiting Hall', 'A green-carpeted room where the court assembles each morning to wait on a ruler none of them has seen.', null, 525, 675, 'building', null],
  ['throne-room', 'palace', 'The Throne Room', 'A great domed chamber of close-set emeralds, with one enormous light above and one green throne below.', null, 800, 470, 'building', 'throne-room'],
  ['back-chamber', 'palace', 'The Little Back Chamber', 'A small room behind the throne room where certain large and awkward properties are kept out of sight.', null, 1105, 410, 'building', 'back-chamber'],
  ['guest-corridor', 'palace', 'The Guest Corridor', 'Seven passages and three flights of stairs up, where guests of the palace are given rooms and left.', null, 385, 298, 'building', null],
  ['dorothy-room', 'palace', 'Dorothy’s Green Room', 'A small bedroom with green silk sheets, a green fountain, a shelf of green books and a wardrobe that fits.', null, 280, 454, 'building', null],
  // The Yellow Castle
  ['castle-doorstep', 'yellow-castle', 'The Front Doorstep', 'The step outside the castle door, where anything the Winged Monkeys are carrying is set down.', null, 231, 535, 'landmark', null],
  ['great-kitchen', 'yellow-castle', 'The Great Kitchen', 'Pots, kettles, a swept floor and a wood fire, kept by whoever the Witch has most lately taken.', null, 515, 535, 'building', 'great-kitchen'],
  ['iron-yard', 'yellow-castle', 'The Iron-Fenced Yard', 'A small yard behind a high iron fence, built to hold something that will not be harnessed.', null, 515, 255, 'landmark', null],
  ['winkie-workshops', 'yellow-castle', 'The Winkie Workshops', 'Benches and tools where the yellow people of the West do the work their owner sets them.', null, 876, 250, 'building', 'winkie-workshops'],
  ['cupboard-room', 'yellow-castle', 'The Cupboard Room', 'Where the Witch keeps what is left of her power, on a shelf, behind a door she does not often open.', null, 876, 540, 'building', null],
  ['watching-door', 'yellow-castle', 'The Watching Door', 'The castle doorway the Witch sits in, where one eye does the work of a telescope over her whole country.', null, 231, 700, 'landmark', null],
  // The China Country
  ['high-wall', 'china-country', 'The High China Wall', 'A smooth white wall higher than a man, with no gate in it and nothing to climb but a made ladder.', null, 330, 170, 'landmark', null],
  ['milkmaid-farm', 'china-country', 'The Milkmaid’s Farm', 'China barns and china fences, where a china cow is milked by a china girl until something startles it.', null, 330, 340, 'building', null],
  ['princess-meadow', 'china-country', 'The Princess’s Meadow', 'Open china floor where the most beautifully dressed of the little people keeps a careful distance.', null, 700, 350, 'region', null],
  ['joker-corner', 'china-country', 'Mr Joker’s Corner', 'The pitch of the country’s clown, who has been mended so often that the cracks show all over him.', null, 986, 300, 'landmark', null],
  ['china-church', 'china-country', 'The China Church', 'A small painted church with a china steeple, standing near the low wall on the far side.', null, 430, 610, 'building', null],
  ['low-wall', 'china-country', 'The Low China Wall', 'The shorter wall on the southern side, climbable from a lion’s back and easy to knock things off.', null, 846, 750, 'landmark', null],
  // Glinda's Castle
  ['castle-gates', 'glinda-castle', 'The Castle Gates', 'Gates kept by three young soldiers in red uniforms trimmed with gold, who take a name before anyone goes in.', null, 210, 440, 'landmark', null],
  ['outer-court', 'glinda-castle', 'The Outer Court', 'The court inside the gates, where visitors wait while their names are carried to the Witch of the South.', null, 415, 440, 'building', null],
  ['tiring-room', 'glinda-castle', 'The Tiring Room', 'A room set aside for making oneself presentable: water, a comb, and space to be patted back into shape.', null, 415, 240, 'building', null],
  ['ruby-throne-room', 'glinda-castle', 'The Ruby Throne Room', 'A great room in which a throne cut from rubies stands, and the last unspent power in Oz is asked for.', null, 800, 400, 'building', null],
]

const locations = locRows.map(([slug, mapSlug, name, description, linked, x, displayY, iconType, art]) => {
  const layer = maps.find((m) => m.id === M(mapSlug))
  return {
    ...base,
    id: L(slug),
    mapLayerId: M(mapSlug),
    linkedMapLayerId: linked ? M(linked) : null,
    name,
    description,
    x,
    /* Stored from the bottom edge: Leaflet's CRS.Simple counts y upward. */
    y: layer.imageHeight - displayY,
    imageId: art ? image(`place-${art}`, `art/places/${art}.jpg`) : null,
    iconType,
    tags: [],
    factionId: null,
  }
})

/* ---------------------------------------------------------- characters --- */

/* [slug, name, aliases, description, colour, portrait] */
const charRows = [
  ['dorothy', 'Dorothy Gale', [], 'A plain-spoken Kansas girl who wants one thing throughout and keeps asking for it until somebody can give it to her.', '#7f9cc4', 'dorothy'],
  ['toto', 'Toto', [], 'Dorothy’s small black dog, who cannot talk, is frightened of very little, and twice changes the story by running at something.', '#4a4640', 'toto'],
  ['scarecrow', 'The Scarecrow', [], 'A stuffed man two days old who believes he has no brains, and who solves most of the party’s problems anyway.', '#c2a24a', 'scarecrow'],
  ['tin-woodman', 'The Tin Woodman', [], 'A woodchopper rebuilt in tin joint by joint, who believes he cannot feel and is the gentlest of them.', '#8f9aa3', 'tin-woodman'],
  ['lion', 'The Cowardly Lion', [], 'A lion the size of a small horse who is afraid of everything and does the frightening thing regardless.', '#c69248', 'lion'],
  ['oz', 'Oz, the Great and Terrible', ['Oscar Diggs', 'The Wizard'], 'The ruler of the Emerald City, who receives each visitor alone and in a different shape.', '#4f8f66', 'oz'],
  ['witch-west', 'The Wicked Witch of the West', [], 'The one-eyed owner of the Winkie country, who commands wolves, crows and bees, and is afraid of water and the dark.', '#6f5b3e', 'witch-west'],
  ['witch-north', 'The Good Witch of the North', [], 'A small, wrinkled, cheerful witch of the northern country, whose protection travels with the person she gives it to.', '#8f7fa8', 'witch-north'],
  ['glinda', 'Glinda', [], 'The Good Witch of the South, young to look at and the most powerful of the four, who trades help for the Golden Cap.', '#c4646c', 'glinda'],
  ['witch-east', 'The Wicked Witch of the East', [], 'The owner of the Munchkin country and its people, who is under the farmhouse before the story properly begins.', '#7a6b8a', null],
  ['aunt-em', 'Aunt Em', [], 'A farmer’s wife whom the sun and wind have worn thin and gray, and who still startles at a child laughing.', '#9a9086', null],
  ['uncle-henry', 'Uncle Henry', [], 'A gray, silent Kansas farmer who works from morning to night and reads the sky before anyone else does.', '#7d7466', null],
  ['boq', 'Boq', [], 'A rich Munchkin who keeps a house large enough for a party and reads a stranger’s clothes for what she must be.', '#5f7fa8', 'boq'],
  ['guardian', 'The Guardian of the Gates', [], 'The green man who opens the city, fits every visitor with spectacles, and keeps the only key that unlocks them.', '#5aa079', 'guardian'],
  ['soldier', 'The Soldier with the Green Whiskers', [], 'The palace doorkeeper, who carries messages to a ruler he has never seen and is not allowed past the door.', '#4e8f74', 'soldier'],
  ['green-girl', 'The Green Girl', [], 'The palace maid who shows guests to their rooms, dresses Dorothy for her audience, and is kind about it.', '#6fae8b', 'green-girl'],
  ['mouse-queen', 'The Queen of the Field Mice', [], 'The ruler of thousands of field mice, who pays a debt promptly and twice knows the way when nobody else does.', '#9c8c74', null],
  ['monkey-king', 'The King of the Winged Monkeys', [], 'The leader of a band bound by an old charm to obey whoever holds the Golden Cap, three times and no more.', '#7a6250', 'monkey-king'],
  ['stork', 'The Stork', [], 'A long-necked bird with a nest of her own who stops mid-flight to pull something light out of a river.', '#b0a894', 'stork'],
  ['china-princess', 'The China Princess', [], 'A figure of painted china who can talk and move in her own country and would stiffen anywhere else.', '#c9a0b0', 'china-princess'],
  ['mr-joker', 'Mr Joker', [], 'The clown of the china country, cracked in a hundred places from standing on his head once too often.', '#c08a6a', null],
]
const characters = charRows.map(([slug, name, aliases, description, color, portrait]) => ({
  ...base,
  id: C(slug),
  name,
  aliases,
  description,
  portraitImageId: portrait ? image(`portrait-${portrait}`, `art/characters/${portrait}.jpg`) : null,
  color,
  tags: [],
  isAlive: true,
  birthDate: null,
}))

/* --------------------------------------------------------------- items --- */

/* [slug, name, description, iconType, art] */
const itemRows = [
  ['silver-shoes', 'The Silver Shoes', 'The Wicked Witch of the East’s pointed silver shoes, which fit Dorothy exactly and carry a charm nobody in the East ever understood.', 'clothing', null],
  ['golden-cap', 'The Golden Cap', 'A cap circled with diamonds and rubies whose lining holds the words that summon the Winged Monkeys — three times to an owner, and no more.', 'artifact', 'golden-cap'],
  ['green-spectacles', 'The Green Spectacles', 'Locked green glasses issued at the city gate, worn night and day by everyone inside the walls.', 'clothing', 'green-spectacles'],
  ['silk-heart', 'The Silk Heart', 'A heart of silk stuffed with sawdust, fitted into a tin chest through a square cut in it and soldered over.', 'artifact', 'silk-heart'],
  ['bran-brains', 'The Bran-New Brains', 'A measure of bran mixed with pins and needles, packed into a straw head and held in place with more straw.', 'artifact', null],
  ['courage-drink', 'The Green Bottle of Courage', 'A square green bottle poured into a carved green-gold dish, on the argument that courage is only courage once swallowed.', 'consumable', null],
  ['balloon', 'The Silk Balloon', 'Strips of light, dark and emerald green silk sewn into a bag over twenty feet long, glued airtight and hung with a clothes basket.', 'vehicle', 'balloon'],
  ['slate', 'The Witch of the North’s Slate', 'A witch’s cap that becomes a slate when it is balanced on her nose and counted over, and writes its answer in chalk.', 'artifact', 'slate'],
  ['oil-can', 'The Oil-Can', 'The can that keeps the Tin Woodman moving, carried in Dorothy’s basket after a year of rust taught him what happens without it.', 'tool', null],
  ['axe', 'The Woodman’s Axe', 'The axe that cost the Woodman his body piece by piece and that now clears trees, bridges, wildcats and wolves out of the party’s way.', 'weapon', null],
  ['basket', 'Dorothy’s Basket', 'The covered basket she leaves Kansas with, which carries bread, then nuts, then fruit, then the oil-can.', 'container', null],
  ['whistle', 'The Mouse Queen’s Whistle', 'A little whistle given in thanks, worn round the neck, and worth a thousand mice whenever it is blown.', 'tool', null],
]
const items = itemRows.map(([slug, name, description, iconType, art]) => ({
  ...base,
  id: Item(slug),
  name,
  description,
  iconType,
  imageId: art ? image(`item-${art}`, `art/items/${art}.jpg`) : null,
  tags: [],
}))

/* ------------------------------------------------------------ chapters --- */

/* Baum's own chapter headings, in his order, from the 1900 text. */
const chapterRows = [
  ['The Cyclone', 'A gray Kansas farm, a sky that turns grayer, and a house lifted whole out of the middle of a whirlwind.'],
  ['The Council with the Munchkins', 'Dorothy lands on a witch, is thanked for it by three Munchkins and a fourth witch, and is pointed down a yellow road.'],
  ['How Dorothy Saved the Scarecrow', 'A night at a rich Munchkin’s house, and a stuffed man taken down off his pole in exchange for a walk to the city.'],
  ['The Road Through the Forest', 'The bricks break up, the farms thin out, and the road runs in under trees that shut out the light.'],
  ['The Rescue of the Tin Woodman', 'A groan in the trees turns out to be a man of tin who has been standing rusted for a year, and who wants a heart.'],
  ['The Cowardly Lion', 'A lion springs into the road, is slapped on the nose for it, and joins the party to ask for courage.'],
  ['The Journey to the Great Oz', 'Two ditches cut the road, and getting over the second one costs two Kalidahs their lives.'],
  ['The Deadly Poppy Field', 'A river carries the party off course, strands the Scarecrow on a pole, and lays flesh and blood down among the poppies.'],
  ['The Queen of the Field Mice', 'A wildcat is stopped mid-chase, and the mouse whose life that saves brings thousands of her people to haul a lion out of the flowers.'],
  ['The Guardian of the Gate', 'A green farmhouse, a green wall, and a green man who locks a pair of spectacles onto every face that comes through the gate.'],
  ['The Wonderful City of Oz', 'Four visitors are admitted to the Throne Room one at a time, and each is met by a different Oz with the same price.'],
  ['The Search for the Wicked Witch', 'Wolves, crows, bees and Winkies fail; the Golden Cap does not; and a bucket of water ends the Witch of the West.'],
  ['The Rescue', 'The Winkies are freed, the Woodman is beaten back into shape, the Scarecrow is restuffed, and the Golden Cap changes hands.'],
  ['The Winged Monkeys', 'Lost in the yellow fields, Dorothy learns what the Cap is for, and the Monkey King explains why his band must obey it.'],
  ['The Discovery of Oz, the Terrible', 'The Wizard keeps the party waiting, a screen falls over, and a very ordinary little man from Omaha is standing behind it.'],
  ['The Magic Art of the Great Humbug', 'Bran, silk and a green bottle are handed out, and three of the four are entirely satisfied.'],
  ['How the Balloon Was Launched', 'Silk is sewn, hot air is caught, and the balloon goes up without the one passenger it was made for.'],
  ['Away to the South', 'The Scarecrow rules, the Winged Monkeys refuse to cross the desert, and the soldier names the only witch left to ask.'],
  ['Attacked by the Fighting Trees', 'The first trees of a southern wood object to being walked under, and an axe settles the argument.'],
  ['The Dainty China Country', 'A country where everything is china, everything is small, and everything a visitor does leaves something broken.'],
  ['The Lion Becomes the King of Beasts', 'A wood full of frightened animals offers a crown to whoever will deal with the spider that has been eating them.'],
  ['The Country of the Quadlings', 'The Hammer-Heads hold their hill, the Golden Cap is spent for the third and last time, and the red country opens.'],
  ['Glinda The Good Witch Grants Dorothy’s Wish', 'The last witch takes the Cap, sends three friends to three kingdoms, and tells Dorothy what her shoes have been able to do all along.'],
  ['Home Again', 'The prairie, a new farmhouse, and Aunt Em.'],
]
const timelineId = id('timeline', 'main')
const chapters = chapterRows.map(([title, summary], i) => ({
  ...base,
  id: Ch(i + 1),
  timelineId,
  number: i + 1,
  title,
  summary,
  status: 'final',
  targetWordCount: null,
  wordGoal: null,
}))

/* --------------------------------------------------------------- scenes --- */

const scenes = [
  // I. The Cyclone
  { ch: 1, key: 'storm-warning', title: 'The Sky Turns Grayer', loc: 'kansas-farmhouse', d: 1, tension: 3, pov: 'dorothy',
    desc: 'Uncle Henry reads the wind from the doorstep and names what is coming; the family scatters to the two things a prairie farm can do about it.',
    items: [], threads: ['home'], motifs: ['home'],
    cast: { dorothy: 'Stands in the doorway with Toto in her arms, watching grass bow in waves from two directions at once.',
      toto: 'Squirms in her arms, unsettled by a wind that is coming from the north and the south together.',
      'uncle-henry': 'Gets up off the doorstep, names the cyclone aloud and goes for the animals rather than the cellar.',
      'aunt-em': 'Drops the dishes she is washing and screams at Dorothy to run for the trap door.' } },
  { ch: 1, key: 'henry-to-the-stock', title: 'Uncle Henry Goes to the Stock', loc: 'kansas-barnyard', d: 1, tension: 3, pov: 'uncle-henry',
    desc: 'The farm’s living property is worth a run across the yard, and it takes him out of the house before the house leaves.',
    items: [], threads: ['home'], motifs: ['home'],
    cast: { 'uncle-henry': 'Reaches the sheds where the cows and horses are kept, and so is nowhere near the floor that is about to lift.' } },
  { ch: 1, key: 'into-the-cellar', title: 'Aunt Em Takes the Cellar', loc: 'kansas-cellar', d: 1, tension: 4, pov: 'aunt-em',
    desc: 'The trap door goes up and the ladder goes down, and the one adult left in the house is underground before the child can follow.',
    items: [], threads: ['home'], motifs: ['home'],
    cast: { 'aunt-em': 'Badly frightened, she throws the trap door open and climbs down without waiting to see whether Dorothy is behind her.' } },
  { ch: 1, key: 'house-in-the-air', title: 'The House Goes Up', loc: 'kansas-farmhouse', d: 1, tension: 5, pov: 'dorothy',
    desc: 'The north and south winds meet exactly where the house stands, and it is carried miles with a girl and a dog still inside it.',
    items: ['basket'], threads: ['home', 'way-home'], motifs: ['home', 'roads'],
    cast: { dorothy: 'Loses her footing halfway to the trap door, sits down hard on the floor, and rides out the hours until she falls asleep on her bed.',
      toto: 'Barks around the tipping room, falls through the open trap door, and is hauled back in by one ear.' } },

  // II. The Council with the Munchkins
  { ch: 2, key: 'house-comes-down', title: 'The House Comes Down', loc: 'landing-site', d: 2, tension: 3, pov: 'dorothy',
    desc: 'The jar of landing wakes her into sunshine, fruit trees, a brook, and birds she has no name for.',
    items: [], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Runs to the door and stops in it, looking at a country that is the exact opposite of the one she left.',
      toto: 'Puts a cold nose in her face to wake her, then keeps to her heels through the doorway.' } },
  { ch: 2, key: 'council-munchkins', title: 'The Council with the Munchkins', loc: 'landing-site', d: 2, tension: 3, pov: 'dorothy',
    desc: 'Three Munchkins and a witch of the North thank her for a killing she did not know she had done, and point out the two feet under the corner beam.',
    items: [], threads: ['way-home', 'witch'], motifs: ['gift'],
    cast: { dorothy: 'Protests that she has never killed anything, and is shown the evidence sticking out from under her own house.',
      toto: 'Keeps close and does not even growl while a real witch is standing there.',
      'witch-north': 'Bows to her as a noble sorceress, explains which of the four witches were wicked, and laughs when the dead one dries up in the sun.' } },
  { ch: 2, key: 'silver-shoes-given', title: 'The Silver Shoes', loc: 'landing-site', d: 2, tension: 2, pov: 'dorothy',
    desc: 'All that is left of the Witch of the East is a pair of silver shoes with some charm on them that none of her subjects ever worked out.',
    items: ['silver-shoes'], threads: ['way-home'], motifs: ['gift'],
    cast: { dorothy: 'Carries the shoes indoors and sets them on the table, with no idea what they are for.',
      'witch-north': 'Shakes the dust out of the dead witch’s shoes and hands them over as the new owner’s property.',
      toto: 'Barks after the empty air where the Munchkins have gone off through the trees.' } },
  { ch: 2, key: 'kiss-and-road', title: 'The Kiss and the Road', loc: 'landing-site', d: 2, tension: 2, pov: 'dorothy',
    desc: 'A cap balanced on a nose turns into a slate with an instruction chalked on it, and a kiss on the forehead becomes the only protection on offer.',
    items: ['slate'], threads: ['way-home'], motifs: ['gift', 'roads'],
    cast: { dorothy: 'Cries at being told she must live here, and is given a mark on her forehead and a road to follow instead of a way home.',
      'witch-north': 'Refuses to come along, leaves the kiss no one will dare injure, names the road of yellow brick, and spins away on her left heel.' } },

  // III. How Dorothy Saved the Scarecrow
  { ch: 3, key: 'setting-out', title: 'Setting Out on the Yellow Brick', loc: 'landing-site', d: 3, tension: 1, pov: 'dorothy',
    desc: 'Bread in a basket, a clean gingham frock, and the dead witch’s shoes tried on because her own will never last the walk.',
    items: ['basket', 'silver-shoes'], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Locks the door, pockets the key, and finds among several roads the one that is paved with yellow brick.',
      toto: 'Trots along soberly behind her, the only piece of Kansas she still has.' } },
  { ch: 3, key: 'boq-supper', title: 'Supper at Boq’s House', loc: 'boq-house', d: 3, tension: 1, pov: 'dorothy',
    desc: 'A rich Munchkin’s freedom party takes in a stranger for the night and reads her clothes as proof of what she must be.',
    items: ['silver-shoes'], threads: ['way-home'], motifs: ['gift'],
    cast: { dorothy: 'Eats a hearty supper, is waited on by her host, and cannot talk anybody out of thinking her a sorceress.',
      toto: 'Is a complete novelty to people who have never seen a dog, and lets a Munchkin baby pull his tail.',
      boq: 'Feeds her, gives her a blue-sheeted bed, and warns that the road gets rough and dangerous long before the Emerald City.' } },
  { ch: 3, key: 'scarecrow-lifted', title: 'The Scarecrow Comes Off His Pole', loc: 'cornfield', d: 4, tension: 2, pov: 'dorothy',
    desc: 'A painted face winks from a pole above the corn, and the figure under it asks to be lifted down and taken along.',
    items: ['basket'], threads: ['way-home', 'wishes'], motifs: ['gift'],
    cast: { dorothy: 'Lifts a surprisingly light man off his stake and agrees that Oz can hardly leave him worse off than he is.',
      scarecrow: 'Explains that he is two days old, knows nothing, and wants brains badly enough to walk to a city for them.',
      toto: 'Runs round the pole barking, and afterwards growls at the straw in case it is full of rats.' } },

  // IV. The Road Through the Forest
  { ch: 4, key: 'scarecrow-story', title: 'What the Scarecrow Remembers', loc: 'forest-road', d: 4, tension: 1, pov: 'dorothy',
    desc: 'The bricks turn broken and the farms give out, and the newest person in the party tells the whole of his life, which took an afternoon.',
    items: ['basket'], threads: ['wishes'], motifs: ['gift'],
    cast: { dorothy: 'Argues that gray Kansas beats a beautiful country because it is hers, and gets nowhere with a listener made of straw.',
      scarecrow: 'Recounts being painted, propped up and out-argued by a crow, and names a lighted match as the only thing he fears.',
      toto: 'Keeps out from underfoot as the walking gets worse over broken brick.' } },
  { ch: 4, key: 'forest-cottage', title: 'The Cottage in the Trees', loc: 'woodman-cottage', d: 4, tension: 2, pov: 'dorothy',
    desc: 'The branches close over the road and the daylight goes; a hut of logs turns up on the right, and one of the two travellers needs it.',
    items: ['basket'], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Feels her way along by holding an arm that cannot get tired, and sleeps on dried leaves in the corner.',
      scarecrow: 'Sees perfectly well in the dark, leads her to the cottage, and stands in the other corner until morning.',
      toto: 'Curls up beside her, able to see in the dark as well as anyone else in the room.' } },

  // V. The Rescue of the Tin Woodman
  { ch: 5, key: 'oiling-the-woodman', title: 'Oiling the Tin Woodman', loc: 'woodman-cottage', d: 5, tension: 3, pov: 'dorothy',
    desc: 'A groan in the trees turns out to be a man of tin who has held an axe in the air for a year, and the cure is on a shelf indoors.',
    items: ['oil-can', 'axe'], threads: ['wishes'], motifs: ['gift'],
    cast: { dorothy: 'Fetches the oil-can from the cottage and works along the joints in the order he asks for them.',
      scarecrow: 'Takes hold of the tin head and works it gently from side to side until the neck turns on its own.',
      'tin-woodman': 'Gets his jaw and then his arms back, lowers the axe he has been holding up for a year, and asks whether Oz could manage a heart.',
      toto: 'Snaps at the tin legs and hurts his teeth on them.' } },
  { ch: 5, key: 'woodmans-story', title: 'How the Woodman Was Made of Tin', loc: 'forest-road', d: 5, tension: 2, pov: 'tin-woodman',
    desc: 'An enchanted axe took him apart limb by limb and a tinsmith replaced each piece, until the one part nobody replaced was the one he wanted back.',
    items: ['axe', 'oil-can'], threads: ['wishes', 'witch'], motifs: ['gift'],
    cast: { 'tin-woodman': 'Tells how the Witch of the East enchanted his axe to stop a marriage, and says he would rather have the heart than the brains.',
      scarecrow: 'Holds out for brains on the grounds that a fool would not know what to do with a heart.',
      dorothy: 'Cannot decide which of them is right, and is more worried that the bread is nearly gone.',
      toto: 'Trots ahead through the trees while the argument goes on behind him.' } },

  // VI. The Cowardly Lion
  { ch: 6, key: 'lion-springs', title: 'A Lion in the Road', loc: 'lion-road', d: 5, tension: 4, pov: 'dorothy',
    desc: 'A roar, a paw, and two of the party knocked flat — and then the smallest member of it runs at the Lion and the Lion apologises.',
    items: [], threads: ['wishes'], motifs: ['small-help'],
    cast: { dorothy: 'Slaps the Lion on the nose for going at Toto and calls him a coward to his face.',
      lion: 'Admits to the charge at once, weeps about it, and asks whether Oz could let him stop being afraid.',
      scarecrow: 'Is sent spinning to the edge of the road by one blow and picked up and patted back into shape.',
      'tin-woodman': 'Blunts the Lion’s claws simply by being made of tin, and falls over in the road.',
      toto: 'Runs barking at an animal a hundred times his size, and very nearly ends there.' } },
  { ch: 6, key: 'beetle-and-jaws', title: 'The Beetle and the Rusted Jaw', loc: 'lion-road', d: 5, tension: 2, pov: 'tin-woodman',
    desc: 'A trodden beetle produces tears, the tears run into the jaw hinges, and the party learns what its gentlest member costs to maintain.',
    items: ['oil-can'], threads: ['wishes'], motifs: ['gift'],
    cast: { 'tin-woodman': 'Weeps over a beetle he stepped on, rusts his jaws shut, and afterwards walks watching the road for ants.',
      scarecrow: 'Gets the oil-can out of the basket and frees the jaw before anyone else has worked out what is wrong.',
      dorothy: 'Asks a question, gets no answer, and cannot understand the signs she is being made at.',
      lion: 'Walks at her side with stately strides and is as puzzled as she is.',
      toto: 'Has decided the Lion is acceptable company and stops keeping his distance.' } },

  // VII. The Journey to the Great Oz
  { ch: 7, key: 'night-camp', title: 'The Camp Under the Great Tree', loc: 'night-camp', d: 5, tension: 2, pov: 'dorothy',
    desc: 'The last of the bread goes; a fire is built by the one person who needs it and avoided by the one who would burn.',
    items: ['basket', 'axe'], threads: ['way-home'], motifs: ['small-help'],
    cast: { dorothy: 'Eats the last bread with Toto and sleeps warm under the leaves someone piles over her.',
      scarecrow: 'Fills the basket with nuts very slowly and very badly, and stays well back from the flames.',
      'tin-woodman': 'Chops a great pile of wood so there is a fire at all.',
      lion: 'Goes off into the forest for his own supper and never says what it was.',
      toto: 'Shares the last of the bread and is hungry again by morning.' } },
  { ch: 7, key: 'first-ditch', title: 'The First Ditch', loc: 'first-gulf', d: 6, tension: 3, pov: 'dorothy',
    desc: 'A gulf too wide to climb into and too deep to survive; the answer turns out to be the back of the animal who is afraid of falling.',
    items: [], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Rides across clinging to the mane with Toto in her arms, and is over before she has time to think about it.',
      lion: 'Says he is terribly afraid of falling and then carries all three of them over, one at a time.',
      scarecrow: 'Volunteers to go first on the grounds that he is the only one a fall would not damage.',
      'tin-woodman': 'Waits his turn and is carried last, denting nothing.',
      toto: 'Is held tight for the jump and has no say in the matter.' } },
  { ch: 7, key: 'kalidahs', title: 'The Kalidahs on the Bridge', loc: 'kalidah-gulf', d: 6, tension: 5, pov: 'dorothy',
    desc: 'A felled tree makes a bridge over the second gulf, and two beasts with tiger heads and bear bodies start across it behind them.',
    items: ['axe'], threads: ['way-home'], motifs: ['small-help'],
    cast: { dorothy: 'Goes over the trunk first with Toto in her arms and screams when the roar comes from behind her.',
      lion: 'Turns and roars at two animals he knows can tear him in half, which stops them for exactly as long as it takes to count them.',
      scarecrow: 'Works out that the bridge can be cut from their own side and tells the Woodman where to swing.',
      'tin-woodman': 'Chops the end of the tree away and drops both Kalidahs onto the rocks.',
      toto: 'Is carried across and set down safely on the far lip of the gulf.' } },

  // VIII. The Deadly Poppy Field
  { ch: 8, key: 'raft-crossing', title: 'The Raft', loc: 'river-crossing', d: 7, tension: 3, pov: 'dorothy',
    desc: 'Logs pinned together carry the party off the bank, and the current takes charge of where they are going.',
    items: ['axe'], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Sits in the middle of the raft holding Toto and watches the road of yellow brick slide away upstream.',
      'tin-woodman': 'Cuts and pins the logs, then poles from one end to keep the thing level.',
      scarecrow: 'Pushes from the other end with a long pole against a bottom that is getting further away.',
      lion: 'Tips the raft badly on stepping aboard and is told to stand still.',
      toto: 'Sits in her lap, the only passenger with nothing to do.' } },
  { ch: 8, key: 'scarecrow-stranded', title: 'The Scarecrow on the Pole', loc: 'river-crossing', d: 7, tension: 4, pov: 'scarecrow',
    desc: 'The pole sticks in the mud, the raft goes on without him, and he is left exactly where he started his life: up a stick, no use to anyone.',
    items: [], threads: ['wishes'], motifs: ['roads'],
    cast: { scarecrow: 'Clings to a pole in mid-river and works out that he is now worse off than he was in the cornfield.',
      dorothy: 'Watches him go and can do nothing from a raft that the current owns.',
      'tin-woodman': 'Begins to cry, remembers what crying does to his hinges, and dries his face on her apron.',
      lion: 'Swims for the bank with the Woodman holding his tail and drags the raft out of the current.',
      toto: 'Is held out of the water while the raft is hauled ashore.' } },
  { ch: 8, key: 'stork-rescue', title: 'The Stork', loc: 'river-crossing', d: 7, tension: 2, pov: 'dorothy',
    desc: 'A bird stops to ask who they are, is told that the missing one weighs nothing, and lifts him off the pole by the arm.',
    items: [], threads: ['wishes'], motifs: ['small-help'],
    cast: { stork: 'Weighs the risk aloud, flies out over the water anyway, and carries a stuffed man back to the bank by one arm.',
      dorothy: 'Explains that he is stuffed with straw and will be no weight at all to carry.',
      scarecrow: 'Hugs everyone including the Lion, and promises to do the Stork a kindness if he ever gets any brains.',
      'tin-woodman': 'Watches the rescue without risking any tears over it.',
      lion: 'Submits to being hugged by a very wet and very happy scarecrow.',
      toto: 'Barks at a bird large enough to carry a man.' } },
  { ch: 8, key: 'poppy-sleep', title: 'The Deadly Poppy Field', loc: 'poppy-field', d: 7, tension: 5, pov: 'dorothy',
    desc: 'A meadow of scarlet flowers that anything with lungs falls asleep in; two of the party have no lungs and carry the others as far as they can.',
    items: [], threads: ['way-home'], motifs: ['small-help'],
    cast: { dorothy: 'Cannot keep her eyes open, goes down among the flowers, and is carried out on a chair made of two pairs of hands.',
      toto: 'Is asleep in the poppies before his mistress is, and is put into her lap to be carried.',
      lion: 'Runs for the edge of the field, does not make it, and falls asleep a short distance from clean grass.',
      scarecrow: 'Is unaffected by the scent and organises the carrying.',
      'tin-woodman': 'Takes the other pair of hands and admits the Lion is far too heavy to lift.' } },

  // IX. The Queen of the Field Mice
  { ch: 9, key: 'wildcat', title: 'The Wildcat and the Mouse', loc: 'mice-field', d: 8, tension: 3, pov: 'tin-woodman',
    desc: 'An axe comes down on a wildcat in mid-chase, and the small gray thing it was chasing turns out to be a queen.',
    items: ['axe'], threads: ['way-home'], motifs: ['small-help'],
    cast: { 'tin-woodman': 'Cuts the head off a wildcat because it is wrong to kill something harmless, and says having no heart is precisely why he is careful.',
      'mouse-queen': 'Stops short, thanks him, and points out that the mouse he has saved rules all the field mice there are.',
      scarecrow: 'Stands beside the sleeping girl and thinks of the one thing the mice could be asked for.',
      dorothy: 'Lies asleep on the grass where she was set down, and misses the whole thing.',
      toto: 'Wakes, sees a crowd of mice, and jumps into the middle of them out of pure Kansas habit.' } },
  { ch: 9, key: 'mice-haul-the-lion', title: 'A Thousand Mice and a Truck', loc: 'mice-field', d: 8, tension: 3, pov: 'scarecrow',
    desc: 'Thousands of mice each bring a piece of string, a truck is built out of the riverside trees, and a lion is pulled out of the poppies on it.',
    items: ['whistle'], threads: ['way-home'], motifs: ['small-help'],
    cast: { scarecrow: 'Designs the whole rescue — string, truck, harness — while insisting he has nothing to think with.',
      'tin-woodman': 'Builds a truck with four wheels out of tree trunks before the mice have finished arriving.',
      'mouse-queen': 'Orders every mouse she has to the field and gets them out again before the poppies take them too.',
      dorothy: 'Wakes among thousands of mice, is introduced to their queen, and thanks them for her friend.',
      lion: 'Is heaved up onto the truck asleep and towed out to clean air.',
      toto: 'Is held in the Woodman’s arms until he stops trying to chase the rescue party.' } },

  // X. The Guardian of the Gate
  { ch: 10, key: 'lion-wakes', title: 'The Lion Wakes', loc: 'mice-field', d: 9, tension: 1, pov: 'lion',
    desc: 'The King of Beasts finds out he was nearly killed by flowers and saved by mice, and takes it better than expected.',
    items: ['whistle'], threads: ['way-home'], motifs: ['small-help'],
    cast: { lion: 'Rolls off the truck alive, laughs at having been undone by flowers and rescued by mice, and asks what happens next.',
      dorothy: 'Wears the little whistle round her neck and says they must find the road again.',
      scarecrow: 'Reports the rescue to the person who slept through it.',
      'tin-woodman': 'Is ready to walk the moment the Lion can.',
      toto: 'Keeps well clear of the Queen so as not to frighten her.' } },
  { ch: 10, key: 'green-farmhouse', title: 'The Green Farmhouse', loc: 'green-farmhouse', d: 9, tension: 2, pov: 'dorothy',
    desc: 'Fences, houses, clothes and skins all green now, and a farming family who will feed a stranger if the lion is really tame.',
    items: ['basket'], threads: ['way-home', 'humbug'], motifs: ['green'],
    cast: { dorothy: 'Knocks, promises the Lion is a coward, and gets porridge, eggs and white bread out of it.',
      lion: 'Is described to his hosts as more frightened of them than they are of him, and does not argue.',
      scarecrow: 'Learns from the farmer that nobody living has ever seen Oz face to face.',
      'tin-woodman': 'Stands in a corner all night with the Scarecrow, neither of them able to sleep.',
      toto: 'Eats a little of everything and is glad of a proper supper.' } },
  { ch: 10, key: 'at-the-gate', title: 'The Guardian of the Gate', loc: 'great-gate', d: 10, tension: 3, pov: 'dorothy',
    desc: 'A bell, a gate studded with emeralds, and a green man with a box of spectacles that lock on and only he can unlock.',
    items: ['green-spectacles'], threads: ['humbug'], motifs: ['green'],
    cast: { dorothy: 'Rings the bell, says plainly what they have come for, and lets a stranger lock glasses onto her head.',
      guardian: 'Warns that Oz is terrible to anyone idle or dishonest, then fits five pairs of green spectacles and pockets the key.',
      scarecrow: 'Argues that the errand is neither idle nor foolish and gets the party through the gate.',
      'tin-woodman': 'Takes his spectacles without comment.',
      lion: 'Is fitted with a pair like everyone else.',
      toto: 'Has spectacles locked onto a dog who never asked for them.' } },

  // XI. The Wonderful City of Oz
  { ch: 11, key: 'green-streets', title: 'The Green Streets', loc: 'green-streets', d: 10, tension: 1, pov: 'dorothy',
    desc: 'Green marble, green glass, green sweets and green pennies, and children who hide behind their mothers when the Lion goes by.',
    items: ['green-spectacles'], threads: ['humbug'], motifs: ['green'],
    cast: { dorothy: 'Walks through a city where even the sunlight looks green and nobody speaks to her.',
      guardian: 'Leads the party up the street to the building in the middle of the city and hands them on.',
      scarecrow: 'Notes that everything here is green exactly as everything in the East was blue.',
      'tin-woodman': 'Walks the marble pavement without denting it.',
      lion: 'Empties the pavement ahead of him wherever there are children.',
      toto: 'Trots through streets with no other animal in them.' } },
  { ch: 11, key: 'shown-to-rooms', title: 'One Each Day', loc: 'guest-corridor', d: 10, tension: 2, pov: 'dorothy',
    desc: 'The soldier carries the message and brings back terms: an audience each, alone, one a day, and rooms in the palace until then.',
    items: [], threads: ['humbug'], motifs: ['green'],
    cast: { dorothy: 'Is shown up three flights to the sweetest little room in the world and told to wait for morning.',
      soldier: 'Takes the message to a screen he has never seen behind and brings back the conditions.',
      'green-girl': 'Leads each guest to a room and tells them to ring if they want anything.',
      scarecrow: 'Stands just inside his doorway all night watching a spider work.',
      'tin-woodman': 'Lies down out of habit and spends the night moving his joints to keep them free.',
      lion: 'Would rather have leaves in a forest, and curls up on the bed anyway.',
      toto: 'Is carried up in her arms and sleeps in the room with her.' } },
  { ch: 11, key: 'dorothy-and-the-head', title: 'Dorothy and the Great Head', loc: 'throne-room', d: 11, tension: 4, pov: 'dorothy',
    desc: 'An enormous head without a body sets the price of a journey home: kill the last wicked witch in the country.',
    items: ['silver-shoes'], threads: ['way-home', 'witch', 'humbug'], motifs: ['gift'],
    cast: { dorothy: 'Names herself the Small and Meek, tells the truth about the shoes and the kiss, and is sent away crying with a killing to do.',
      oz: 'Takes the shape of a vast head, asks where the shoes and the mark came from, and names his price.' } },
  { ch: 11, key: 'scarecrow-and-the-lady', title: 'The Scarecrow and the Lovely Lady', loc: 'throne-room', d: 12, tension: 3, pov: 'scarecrow',
    desc: 'The second visitor is met by a winged lady on the same throne, who does not care who kills the Witch so long as she dies.',
    items: [], threads: ['wishes', 'witch', 'humbug'], motifs: ['gift'],
    cast: { scarecrow: 'Bows as prettily as straw allows, asks to be made as much a man as any in the country, and is given the same condition Dorothy got.',
      oz: 'Appears as a winged lady in green gauze and promises the wisest brains in Oz for one death.' } },
  { ch: 11, key: 'woodman-and-the-beast', title: 'The Woodman and the Terrible Beast', loc: 'throne-room', d: 13, tension: 3, pov: 'tin-woodman',
    desc: 'A five-eyed, five-armed thing the size of an elephant makes the third offer, and is roared at rather than argued with.',
    items: [], threads: ['wishes', 'witch', 'humbug'], motifs: ['gift'],
    cast: { 'tin-woodman': 'Hopes for the lady, gets a monster, and is too tin to be frightened by it or to be given anything without earning it.',
      oz: 'Takes the shape of a woolly five-legged beast and growls out the same bargain in a different voice.' } },
  { ch: 11, key: 'lion-and-the-fire', title: 'The Lion and the Ball of Fire', loc: 'throne-room', d: 14, tension: 4, pov: 'lion',
    desc: 'The fourth audience is with a burning ball too hot to approach, which wants proof before it will part with courage.',
    items: [], threads: ['wishes', 'witch', 'humbug'], motifs: ['gift'],
    cast: { lion: 'Goes in planning to roar the Wizard into submission, has his whiskers singed, and runs out of the room.',
      oz: 'Burns on the throne as a ball of fire and asks for proof that the Witch is dead.' } },

  // XII. The Search for the Wicked Witch
  { ch: 12, key: 'out-of-the-gate', title: 'West, Where the Sun Sets', loc: 'great-gate', d: 15, tension: 3, pov: 'dorothy',
    desc: 'The spectacles come off, and the Guardian admits there is no road west because nobody has ever wanted one.',
    items: ['green-spectacles', 'basket'], threads: ['witch'], motifs: ['roads', 'green'],
    cast: { dorothy: 'Asks which road leads to the Witch and is told to keep west and let herself be found.',
      guardian: 'Unlocks four pairs of spectacles and a dog’s, and says no one has ever destroyed her before.',
      scarecrow: 'Corrects the Guardian’s assumption that they are going west to be enslaved.',
      'tin-woodman': 'Has his axe sharpened and his joints oiled for whatever is out there.',
      lion: 'Sets off toward the one thing in Oz he has most reason to avoid.',
      toto: 'Has a bell on a green ribbon round his neck, a parting present from the palace.' } },
  { ch: 12, key: 'witch-watches', title: 'The Eye Like a Telescope', loc: 'watching-door', d: 15, tension: 3, pov: 'witch-west',
    desc: 'One eye that can see the whole country picks out five sleepers a long way off, and a silver whistle is blown once.',
    items: [], threads: ['witch'], motifs: ['roads'],
    cast: { 'witch-west': 'Sees strangers asleep in her country, judges none of them fit to work, and whistles up the wolves to tear them apart.' } },
  { ch: 12, key: 'wolves', title: 'Forty Wolves', loc: 'west-country', d: 16, tension: 4, pov: 'tin-woodman',
    desc: 'The first attack comes at night against the two who do not sleep, and is met by the one with the axe.',
    items: ['axe'], threads: ['witch'], motifs: ['small-help'],
    cast: { 'tin-woodman': 'Tells the others to get behind him and takes forty wolves one at a time as they come.',
      scarecrow: 'Keeps watch beside him and calls it a good fight when it is over.',
      dorothy: 'Sleeps through it and wakes to a heap of dead wolves and an explanation.',
      lion: 'Sleeps through an attack that was aimed at him as much as anyone.',
      toto: 'Sleeps at her side while the fighting goes on a few feet away.' } },
  { ch: 12, key: 'crows', title: 'Forty Crows', loc: 'west-country', d: 16, tension: 4, pov: 'scarecrow',
    desc: 'A flock dark enough to blot the sky comes for their eyes, and the one thing crows are frightened of stands up and spreads his arms.',
    items: [], threads: ['witch'], motifs: ['small-help'],
    cast: { scarecrow: 'Stands alone with his arms out, and breaks the neck of every crow that dares come close enough to test him.',
      dorothy: 'Lies flat on the ground where she is told and is not touched.',
      'tin-woodman': 'Lies down with the others and lets the straw man have this one.',
      lion: 'Presses himself to the ground beside her.',
      toto: 'Is held down flat under the flock.' } },
  { ch: 12, key: 'bees', title: 'The Black Bees', loc: 'west-country', d: 16, tension: 4, pov: 'scarecrow',
    desc: 'A swarm sent to sting them to death finds only tin to sting, and dies of it.',
    items: [], threads: ['witch'], motifs: ['small-help'],
    cast: { scarecrow: 'Has himself emptied of straw so the others can be hidden under it, and is a heap of clothes for a while.',
      'tin-woodman': 'Stands out in the open as the only target, and every sting breaks on him.',
      dorothy: 'Lies under a covering of loose straw with the Lion and the dog.',
      lion: 'Is buried under straw beside her and keeps still.',
      toto: 'Is held close under the straw until the buzzing stops.' } },
  { ch: 12, key: 'winkies-flee', title: 'The Winkies with Spears', loc: 'west-country', d: 16, tension: 3, pov: 'lion',
    desc: 'A dozen slaves are handed spears and sent out; one roar sends them home to be beaten for it.',
    items: [], threads: ['witch'], motifs: ['small-help'],
    cast: { lion: 'Roars once and puts a dozen armed men to flight without touching any of them.',
      dorothy: 'Watches an attack collapse before it reaches her.',
      scarecrow: 'Is restuffed and back on his feet in time to see it.',
      'tin-woodman': 'Stands ready with the axe and does not need it.',
      toto: 'Stays at her heel through the charge.' } },
  { ch: 12, key: 'golden-cap-summons', title: 'The Third and Last Wish', loc: 'cupboard-room', d: 16, tension: 4, pov: 'witch-west',
    desc: 'Out of her cupboard comes the one thing she has been saving, and she spends the last of it on four travellers and a dog.',
    items: ['golden-cap'], threads: ['witch', 'cap'], motifs: ['gift'],
    cast: { 'witch-west': 'Takes the Golden Cap from the cupboard, stands on each foot in turn to say the charm, and spends her final summons.' } },
  { ch: 12, key: 'monkeys-attack', title: 'The Winged Monkeys Obey', loc: 'west-country', d: 16, tension: 5, pov: 'dorothy',
    desc: 'The band does exactly what it is told, and stops short of the one person it is not allowed to touch.',
    items: ['golden-cap'], threads: ['witch', 'cap'], motifs: ['gift'],
    cast: { 'monkey-king': 'Carries out the order to the letter, then sees the mark on the girl’s forehead and calls his band off her.',
      dorothy: 'Stands with Toto in her arms watching her friends destroyed, and is set down gently on a doorstep instead.',
      scarecrow: 'Has his straw pulled out and his clothes thrown into the top of a tall tree.',
      'tin-woodman': 'Is dropped from a great height onto sharp rocks and left too battered to move or groan.',
      lion: 'Is wound about with rope until he can neither bite nor scratch, and flown to a yard with an iron fence.',
      toto: 'Is carried in her arms and is not harmed either.' } },
  { ch: 12, key: 'dorothy-a-slave', title: 'The Kitchen', loc: 'great-kitchen', d: 17, tension: 3, pov: 'dorothy',
    desc: 'The Witch cannot kill her and dare not strike her, so she is set to scrubbing pots instead.',
    items: ['silver-shoes'], threads: ['witch'], motifs: ['gift'],
    cast: { dorothy: 'Cleans pots and keeps the fire fed, glad to be alive and with no idea why the Witch will not touch her.',
      'witch-west': 'Sets the girl to work, threatens her with an umbrella she does not dare use, and starts planning how to get the shoes.',
      toto: 'Bites the Witch’s leg when she strikes him, and draws no blood from a woman dried up years ago.' } },
  { ch: 12, key: 'lion-in-the-yard', title: 'The Lion Will Not Be Harnessed', loc: 'iron-yard', d: 18, tension: 3, pov: 'lion',
    desc: 'A lion who will not draw a chariot is starved instead, and is fed every night by the prisoner in the kitchen.',
    items: [], threads: ['witch'], motifs: ['small-help'],
    cast: { lion: 'Bounds at the gate every time it opens and answers a daily offer of harness with a daily refusal.',
      'witch-west': 'Cannot get near enough to harness him, so tries hunger and comes to the bars at noon to ask again.',
      dorothy: 'Carries food out of the cupboard to him each night and lies beside him planning ways out that come to nothing.',
      toto: 'Comes with her on the night trips across the yard.' } },
  { ch: 12, key: 'shoe-and-water', title: 'The Bar of Iron and the Bucket', loc: 'great-kitchen', d: 28, tension: 5, pov: 'dorothy',
    desc: 'An invisible bar trips her out of one silver shoe; the anger that follows reaches for the nearest bucket, and the Witch is done.',
    items: ['silver-shoes'], threads: ['witch', 'way-home'], motifs: ['gift'],
    cast: { dorothy: 'Loses a shoe to a trick she cannot see, gets angry enough to throw a bucket of water, and is frightened by what it does.',
      'witch-west': 'Wins one shoe by cunning, is wet from head to foot for it, and melts down to a brown shapeless mass on her own kitchen floor.',
      toto: 'Is at her feet when the Witch goes.' } },

  // XIII. The Rescue
  { ch: 13, key: 'winkies-freed', title: 'The Winkies Are Free', loc: 'winkie-workshops', d: 28, tension: 1, pov: 'dorothy',
    desc: 'The yellow people are told they are no longer slaves, and keep the day as a holiday from then on.',
    items: [], threads: ['witch', 'kingdoms'], motifs: ['gift'],
    cast: { dorothy: 'Calls the Winkies together, tells them they are free, and asks for help finding her friends.',
      lion: 'Is let out of the yard and says he would be quite happy if the other two were here.',
      toto: 'Runs loose in a castle that no longer has anyone to be afraid of.' } },
  { ch: 13, key: 'woodman-mended', title: 'Three Days and Four Nights', loc: 'winkie-workshops', d: 30, tension: 2, pov: 'dorothy',
    desc: 'Tinsmiths hammer, twist, solder and polish a battered friend back into shape, patches and all.',
    items: ['axe'], threads: ['kingdoms'], motifs: ['small-help'],
    cast: { 'tin-woodman': 'Is carried back off the rocks, straightened, soldered and polished, and weeps with joy at the sight of her.',
      dorothy: 'Wipes every tear off his face with her apron before it can reach a joint.',
      lion: 'Cries so much he has to go and dry his tail in the sun.',
      toto: 'Keeps out from under the tinsmiths’ feet.' } },
  { ch: 13, key: 'scarecrow-restuffed', title: 'Clean Straw', loc: 'winkie-workshops', d: 35, tension: 2, pov: 'scarecrow',
    desc: 'The tall tree comes down, the bundle of clothes comes out of the branches, and clean straw makes a man of them again.',
    items: ['axe'], threads: ['kingdoms'], motifs: ['small-help'],
    cast: { scarecrow: 'Comes out of a bundle of clothes as good as ever and cannot stop thanking the people who fetched him.',
      'tin-woodman': 'Chops down the tree nobody could climb, with a new gold handle on his axe.',
      dorothy: 'Carries his clothes back to the castle to be stuffed.',
      lion: 'Watches the tree come down and the party become four again.',
      toto: 'Is at the foot of the tree when the clothes fall out of it.' } },
  { ch: 13, key: 'golden-cap-taken', title: 'The Cap in the Cupboard', loc: 'cupboard-room', d: 38, tension: 2, pov: 'dorothy',
    desc: 'Packing food for the road, she finds a pretty cap on a shelf, tries it on, and wears it because it fits.',
    items: ['golden-cap', 'basket'], threads: ['cap'], motifs: ['gift'],
    cast: { dorothy: 'Takes the Golden Cap because it suits her, with no notion of what is written in the lining.',
      toto: 'Follows her round the Witch’s cupboards while the basket is filled.' } },

  // XIV. The Winged Monkeys
  { ch: 14, key: 'lost-in-the-fields', title: 'Lost in the Yellow Fields', loc: 'west-country', d: 39, tension: 3, pov: 'dorothy',
    desc: 'There was never a road between the castle and the city, and by noon there is no way of telling east from west.',
    items: ['basket'], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Sits down in the buttercups and admits they are walking in the wrong direction.',
      scarecrow: 'Grumbles that at this rate he will never get his brains.',
      'tin-woodman': 'Says he can scarcely wait for the heart he was promised.',
      lion: 'Whimpers that he has not the courage to keep tramping forever.',
      toto: 'Is too tired for the first time in his life to chase a butterfly.' } },
  { ch: 14, key: 'mice-whistle', title: 'The Whistle Is Blown', loc: 'west-country', d: 43, tension: 2, pov: 'dorothy',
    desc: 'The mice come when they are called, put the party right about the direction, and notice what is on Dorothy’s head.',
    items: ['whistle', 'golden-cap'], threads: ['cap', 'way-home'], motifs: ['small-help'],
    cast: { 'mouse-queen': 'Tells them the city has been at their backs all along, and points out that the Cap can save them the walk.',
      dorothy: 'Learns there is a charm written inside the cap she has been wearing for days.',
      scarecrow: 'Asks why nobody thought of calling the mice sooner.',
      'tin-woodman': 'Waits while the mice explain the way.',
      lion: 'Is the reason the mice will not stay to watch what happens next.',
      toto: 'Is held back from the mice one more time.' } },
  { ch: 14, key: 'monkeys-carry', title: 'The King Tells the Story of the Cap', loc: 'west-country', d: 43, tension: 2, pov: 'dorothy',
    desc: 'Carried through the air in under an hour, Dorothy is told how a joke at a wedding put a whole people at the service of a hat.',
    items: ['golden-cap'], threads: ['cap'], motifs: ['gift'],
    cast: { 'monkey-king': 'Explains a grandfather’s joke, a ruined silk suit, and the sentence that binds his band three times to whoever owns the Cap.',
      dorothy: 'Rides in a chair made of two monkeys’ hands and hears why they must obey her twice more.',
      scarecrow: 'Rides quite cheerfully once it is clear no harm is meant this time.',
      'tin-woodman': 'Is nervous of the monkeys until he sees they are being careful.',
      lion: 'Is flown over gardens and woods without being roped this time.',
      toto: 'Is carried by one small monkey and tries the whole way to bite him.' } },

  // XV. The Discovery of Oz, the Terrible
  { ch: 15, key: 'back-at-the-gate', title: 'Back at the Gate', loc: 'great-gate', d: 43, tension: 2, pov: 'scarecrow',
    desc: 'The Guardian cannot believe they came back, and cannot believe what they say happened to the Witch.',
    items: ['green-spectacles'], threads: ['witch'], motifs: ['green'],
    cast: { scarecrow: 'Delivers the news that the Witch is melted with considerable enjoyment.',
      guardian: 'Bows very low indeed to the girl who did it, and locks the spectacles back on.',
      dorothy: 'Is followed to the palace by a crowd that has heard what she did.',
      'tin-woodman': 'Walks back into the city he left expecting never to return.',
      lion: 'Comes back through the gate at his full size and nobody minds.',
      toto: 'Is fitted with his spectacles a second time.' } },
  { ch: 15, key: 'kept-waiting', title: 'Kept Waiting', loc: 'guest-corridor', d: 46, tension: 3, pov: 'dorothy',
    desc: 'Days pass with no word, until a threat to call the Winged Monkeys gets an appointment for four minutes past nine.',
    items: ['golden-cap'], threads: ['humbug', 'cap'], motifs: ['gift'],
    cast: { dorothy: 'Waits three days for a promise to be kept and grows as vexed as the others.',
      scarecrow: 'Sends the message that finally works: let us in, or we fetch the Monkeys.',
      'green-girl': 'Carries the party’s ultimatum in to a Wizard who is frightened by it.',
      'tin-woodman': 'Grows angry at being made to wait after being sent to do the job.',
      lion: 'Waits with the others for a door that will not open.',
      toto: 'Waits in her room with her.' } },
  { ch: 15, key: 'behind-the-screen', title: 'The Screen Goes Over', loc: 'throne-room', d: 47, tension: 5, pov: 'dorothy',
    desc: 'A voice from an empty room, a roar to frighten it, a dog against a screen — and a small bald man standing where nobody was.',
    items: [], threads: ['humbug'], motifs: ['green'],
    cast: { dorothy: 'Demands the promise be kept and finds herself looking at the whole of the Great Oz at once.',
      oz: 'Is caught in the open by a falling screen, begs not to be struck, and admits to being a humbug.',
      lion: 'Roars to frighten the Wizard and knocks over the screen by accident.',
      scarecrow: 'Calls him a humbug to his face, which he accepts with something like relief.',
      'tin-woodman': 'Comes at the little man with the axe up before anyone has explained anything.',
      toto: 'Jumps away from the roar and tips over the screen that hid everything.' } },
  { ch: 15, key: 'the-humbug-explains', title: 'A Balloonist from Omaha', loc: 'back-chamber', d: 47, tension: 3, pov: 'dorothy',
    desc: 'The paper head, the lady’s mask, the sewn skins and the cotton ball come out of a back room, along with the truth about the city.',
    items: [], threads: ['humbug'], motifs: ['green'],
    cast: { oz: 'Shows the properties one by one, explains ventriloquism, and admits the emeralds are ordinary stone behind green glass.',
      dorothy: 'Tells him he is a very bad man and is corrected: a very good man, and a very bad wizard.',
      scarecrow: 'Is told that experience is the only thing that brings knowledge, and wants brains anyway.',
      'tin-woodman': 'Is told he is lucky to have no heart, and asks for one regardless.',
      lion: 'Is told that true courage is being afraid and going on, which is no comfort at all.',
      toto: 'Pricks up his ears at a mew that has no cat behind it.' } },

  // XVI. The Magic Art of the Great Humbug
  { ch: 16, key: 'brains', title: 'Bran, Pins and Needles', loc: 'throne-room', d: 48, tension: 2, pov: 'scarecrow',
    desc: 'A head comes off, a measure of bran mixed with sharp things goes in, and the owner is satisfied.',
    items: ['bran-brains'], threads: ['wishes'], motifs: ['gift'],
    cast: { scarecrow: 'Has his head unfastened, refilled and put back on, and walks out feeling wise and bulging at the top.',
      oz: 'Mixes bran with pins and needles, packs it in, and tells him he cannot supply instructions for using it.' } },
  { ch: 16, key: 'heart', title: 'A Heart of Silk and Sawdust', loc: 'throne-room', d: 48, tension: 2, pov: 'tin-woodman',
    desc: 'A square is cut in a tin chest, a stuffed silk heart is fitted inside, and the tin is soldered back over it.',
    items: ['silk-heart'], threads: ['wishes'], motifs: ['gift'],
    cast: { 'tin-woodman': 'Feels nothing while the hole is cut, and is delighted with a heart he is assured is a kind one.',
      oz: 'Cuts the chest open with tinsmith’s shears, fits the heart, and apologises for the patch.' } },
  { ch: 16, key: 'courage', title: 'The Green Bottle', loc: 'throne-room', d: 48, tension: 2, pov: 'lion',
    desc: 'Something is poured out of a square green bottle on the argument that courage is not courage until it is swallowed.',
    items: ['courage-drink'], threads: ['wishes'], motifs: ['gift'],
    cast: { lion: 'Sniffs at the dish, dislikes it, drinks the lot, and declares himself full of courage.',
      oz: 'Serves it in a carved green-gold dish and privately admits he cannot see how he could be anything but a humbug.' } },

  // XVII. How the Balloon Was Launched
  { ch: 17, key: 'balloon-plan', title: 'Across the Desert by Air', loc: 'throne-room', d: 52, tension: 3, pov: 'dorothy',
    desc: 'Two people came to this country through the air, so the only way out of it is a bag of silk and a fire.',
    items: [], threads: ['way-home', 'humbug'], motifs: ['roads'],
    cast: { dorothy: 'Hears that he cannot find Kansas but can cross the desert, and that he means to come with her.',
      oz: 'Proposes hot air instead of gas, admits he is tired of being a humbug, and says he would rather be in a circus.' } },
  { ch: 17, key: 'sewing-the-silk', title: 'Three Days of Sewing', loc: 'throne-room', d: 54, tension: 1, pov: 'dorothy',
    desc: 'Light green, dark green and emerald green strips are cut and stitched into a bag over twenty feet long, then glued airtight.',
    items: ['balloon'], threads: ['way-home'], motifs: ['green'],
    cast: { dorothy: 'Sews strip to strip for three days while the shape of a way home grows on the floor.',
      oz: 'Cuts the silk, paints the inside with glue, and sends for a clothes basket to hang underneath.' } },
  { ch: 17, key: 'balloon-launched', title: 'The Ropes Give Way', loc: 'launching-ground', d: 55, tension: 5, pov: 'dorothy',
    desc: 'The whole city turns out, the Wizard names his successor, and the balloon goes up with one passenger short.',
    items: ['balloon'], threads: ['way-home', 'kingdoms', 'humbug'], motifs: ['home'],
    cast: { dorothy: 'Runs back for Toto, is a few steps short when the ropes part, and screams at a basket that cannot come back.',
      oz: 'Announces a visit to a brother wizard in the clouds, leaves the Scarecrow to rule, and is carried off out of everyone’s sight for good.',
      toto: 'Runs into the crowd to bark at a kitten, and costs her the balloon.',
      scarecrow: 'Is named ruler of the Emerald City in front of the entire population.',
      'tin-woodman': 'Chops the wood for the fire that fills the balloon.',
      lion: 'Watches the one certain way home leave without her.',
      soldier: 'Fetches the clothes basket that is tied under the balloon.' } },

  // XVIII. Away to the South
  { ch: 18, key: 'scarecrow-rules', title: 'A City Ruled by a Stuffed Man', loc: 'throne-room', d: 56, tension: 1, pov: 'scarecrow',
    desc: 'The morning after, the four sit in the throne room and take stock: three of them have everything they wanted.',
    items: [], threads: ['kingdoms', 'wishes'], motifs: ['gift'],
    cast: { scarecrow: 'Sits in the big throne and observes that a short while ago he was on a pole in a cornfield.',
      'tin-woodman': 'Is well pleased with his new heart and says it was the only thing he ever wanted.',
      lion: 'Is content simply knowing he is as brave as any beast alive.',
      dorothy: 'Says plainly that she does not want to live here, which spoils the arithmetic.',
      toto: 'Is the reason she is still in Oz and does not know it.' } },
  { ch: 18, key: 'monkeys-refuse', title: 'The Monkeys Refuse', loc: 'throne-room', d: 56, tension: 3, pov: 'dorothy',
    desc: 'The second summons is spent on a request the band cannot grant: they belong to this country and cannot leave it.',
    items: ['golden-cap'], threads: ['cap', 'way-home'], motifs: ['roads'],
    cast: { 'monkey-king': 'Bows, hears the request, and refuses it — his people belong to Oz and cannot cross the desert.',
      dorothy: 'Spends a wish on nothing and says so bitterly.',
      scarecrow: 'Suggested the plan and has to think again.',
      'tin-woodman': 'Calls the failure too bad and means it.',
      lion: 'Watches a second way home close.',
      toto: 'Is in the room when the Monkeys fly out through the window.' } },
  { ch: 18, key: 'soldiers-advice', title: 'The Soldier Names Glinda', loc: 'throne-room', d: 56, tension: 2, pov: 'dorothy',
    desc: 'The doorkeeper is called in and gives the one piece of information nobody else in the palace has: there is another witch, and she is south.',
    items: [], threads: ['way-home'], motifs: ['roads'],
    cast: { soldier: 'Names Glinda, says her castle stands on the edge of the desert, and warns that the road south is dangerous.',
      dorothy: 'Decides to walk to a fourth witch because staying means never going home.',
      scarecrow: 'Announces he will come, since without her he would still be on a pole.',
      'tin-woodman': 'Offers his axe for the road south.',
      lion: 'Says he is tired of the city and would rather be in the country anyway.',
      toto: 'Waits at her feet while the fourth journey is agreed.' } },
  { ch: 18, key: 'leaving-the-city', title: 'Out Through the Gate Again', loc: 'great-gate', d: 57, tension: 1, pov: 'dorothy',
    desc: 'The Guardian wonders aloud why anyone would leave the beautiful city for more trouble, and unlocks the spectacles anyway.',
    items: ['green-spectacles', 'basket'], threads: ['way-home'], motifs: ['green', 'roads'],
    cast: { dorothy: 'Thanks the Guardian for a city where everybody was good to her, and walks out of it southward.',
      guardian: 'Puts the spectacles back in the green box and asks the new ruler to come home as soon as he can.',
      scarecrow: 'Promises the city he rules that he will be back once she is safe.',
      'tin-woodman': 'Shakes hands until his arm aches.',
      lion: 'Sniffs the open air with obvious relief.',
      'green-girl': 'Is kissed goodbye at the palace door.',
      toto: 'Chases moths and butterflies the moment the gate is behind him.' } },

  // XIX. Attacked by the Fighting Trees
  { ch: 19, key: 'fighting-trees', title: 'The Trees Object', loc: 'fighting-trees', d: 58, tension: 4, pov: 'scarecrow',
    desc: 'The front rank of a wood picks up anyone who tries to walk under it, and only stops when a branch is cut in two.',
    items: ['axe'], threads: ['way-home'], motifs: ['roads'],
    cast: { scarecrow: 'Volunteers to be thrown twice, on the reasonable ground that it does not hurt him.',
      'tin-woodman': 'Cuts a grasping branch in half and walks under a tree that is too busy shaking to stop him.',
      dorothy: 'Runs through the gap the moment it opens.',
      lion: 'Works out that only the first row of trees are policing the wood.',
      toto: 'Is caught by a small branch, shaken until he howls, and cut free.' } },
  { ch: 19, key: 'china-wall', title: 'A Wall of White China', loc: 'china-country', d: 58, tension: 2, pov: 'dorothy',
    desc: 'The far edge of the wood ends at a smooth white wall higher than their heads, with nothing to do but build a ladder.',
    items: ['axe'], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Sleeps while the ladder is built, tired out from the walk.',
      'tin-woodman': 'Makes a clumsy but strong ladder out of wood from the forest.',
      scarecrow: 'Wonders aloud what the wall is made of and is told to save his brains for later.',
      lion: 'Curls up and sleeps until the ladder is finished.',
      toto: 'Sleeps beside the Lion in the shade of the wall.' } },

  // XX. The Dainty China Country
  { ch: 20, key: 'over-the-wall', title: 'Over the Wall', loc: 'high-wall', d: 59, tension: 3, pov: 'dorothy',
    desc: 'Five heads come over the top one after another, and every one of them says the same thing at what is on the other side.',
    items: [], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Looks down on a floor like the bottom of a platter, covered in houses no higher than her waist.',
      scarecrow: 'Goes up first, is too awkward to be trusted on a ladder, and is jumped on as a landing mat.',
      'tin-woodman': 'Comes up last and says what everyone else has said.',
      lion: 'Climbs the ladder after the others and takes in the drop.',
      toto: 'Starts barking at the little country and is hushed.' } },
  { ch: 20, key: 'milkmaid', title: 'The Cow and the Milkmaid', loc: 'milkmaid-farm', d: 59, tension: 2, pov: 'dorothy',
    desc: 'The first thing they come to is a china cow, which kicks over stool, pail and milkmaid and breaks a leg doing it.',
    items: [], threads: ['way-home'], motifs: ['small-help'],
    cast: { dorothy: 'Apologises to a woman whose cow and elbow are both now damaged, and gets no answer worth having.',
      'tin-woodman': 'Warns the others that these people can be hurt in ways they will never get over.',
      scarecrow: 'Keeps well back from anything breakable.',
      lion: 'Moves carefully in a country where his weight is a hazard.',
      toto: 'Is barked at by a small purple china dog with an extra-large head.' } },
  { ch: 20, key: 'china-princess', title: 'The Princess Who Will Not Be Chased', loc: 'princess-meadow', d: 59, tension: 2, pov: 'dorothy',
    desc: 'A beautifully dressed figure explains why running is dangerous, why mending spoils you, and why she will not be taken to Kansas.',
    items: ['basket'], threads: ['way-home'], motifs: ['home'],
    cast: { 'china-princess': 'Keeps a safe distance, explains that a fall means being mended and looking wrong ever after, and refuses to be carried away.',
      dorothy: 'Offers to stand her on Aunt Em’s mantel and withdraws the offer the moment she hears what it would cost.',
      scarecrow: 'Listens to a country explaining its own rules.',
      'tin-woodman': 'Stands by without touching anything.',
      lion: 'Is kept at a distance by everything in the country.',
      toto: 'Is held back from a china princess who would not survive him.' } },
  { ch: 20, key: 'mr-joker', title: 'Mr Joker', loc: 'joker-corner', d: 59, tension: 1, pov: 'dorothy',
    desc: 'The country’s clown, mended in a hundred places, comes over to be rude in verse and stand on his head.',
    items: [], threads: ['way-home'], motifs: ['home'],
    cast: { 'mr-joker': 'Puffs out his cracked cheeks, makes a rhyme at the visitors, and stands on his head to prove the Princess’s point.',
      'china-princess': 'Tells him to be quiet and explains that he is considerably cracked in the head.',
      dorothy: 'Says she does not mind him at all.',
      scarecrow: 'Watches a fellow made thing behave worse than he does.',
      toto: 'Is kept still while the clown performs.' } },
  { ch: 20, key: 'lions-tail-church', title: 'The Church and the Lion’s Tail', loc: 'china-church', d: 59, tension: 3, pov: 'dorothy',
    desc: 'They get out over the low wall, and the last thing they do in the china country is smash a church with a tail.',
    items: [], threads: ['way-home'], motifs: ['small-help'],
    cast: { lion: 'Lets the others up on his back, jumps the wall, and takes a china church out with his tail on the way over.',
      dorothy: 'Counts the damage — a cow’s leg and a church — and calls the party lucky.',
      scarecrow: 'Is thankful to be made of straw in a country where everyone else shatters.',
      'tin-woodman': 'Climbs the low wall last, having broken nothing.',
      toto: 'Goes over the wall with the rest of them.' } },

  // XXI. The Lion Becomes the King of Beasts
  { ch: 21, key: 'marshes', title: 'Bogs and Rank Grass', loc: 'marshes', d: 60, tension: 2, pov: 'dorothy',
    desc: 'Country nobody keeps: mud holes hidden under grass, picked across a step at a time.',
    items: [], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Picks her way over ground that hides its holes until she is standing in them.',
      lion: 'Finds the going disagreeable and the forest beyond it delightful.',
      scarecrow: 'Thinks the wood ahead looks gloomy and is outvoted.',
      'tin-woodman': 'Tests the footing ahead of the others.',
      toto: 'Keeps to the firm ground the others find.' } },
  { ch: 21, key: 'beasts-assembly', title: 'The Beasts Hold a Meeting', loc: 'great-forest', d: 60, tension: 3, pov: 'lion',
    desc: 'Hundreds of animals are gathered in a clearing about a monster that has been eating them, and the biggest tiger asks the newcomer for help.',
    items: [], threads: ['kingdoms'], motifs: ['gift'],
    cast: { lion: 'Is welcomed as King of Beasts, asks what the trouble is, and offers a straight trade: the monster for the crown.',
      dorothy: 'Is frightened by hundreds of animals until it is explained they are holding a meeting.',
      scarecrow: 'Stands among tigers and bears without being anything they want to eat.',
      'tin-woodman': 'Waits with the others while the terms are agreed.',
      toto: 'Whimpers once at the noise of the assembly and then keeps quiet.' } },
  { ch: 21, key: 'spider-killed', title: 'The Great Spider', loc: 'great-forest', d: 60, tension: 5, pov: 'lion',
    desc: 'A body like an elephant on legs like tree trunks, joined by a neck as thin as a wasp’s — which is the whole of the plan.',
    items: [], threads: ['kingdoms'], motifs: ['gift'],
    cast: { lion: 'Finds the monster asleep, sees that the head is held on by a thin neck, and takes it off with one blow of his paw.' } },

  // XXII. The Country of the Quadlings
  { ch: 22, key: 'hammerheads', title: 'The Hill of the Hammer-Heads', loc: 'hammerhead-hill', d: 61, tension: 4, pov: 'dorothy',
    desc: 'A hillside of armless men whose heads shoot out on their necks, and who knock down everything that tries to climb.',
    items: [], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Runs down to pick the Scarecrow up and hears the whole hillside laughing at them.',
      scarecrow: 'Walks up boldly at a creature with no arms and is sent rolling to the bottom.',
      lion: 'Charges the hill roaring and comes down it like a cannon ball.',
      'tin-woodman': 'Sees that there is nothing an axe can do here and suggests the Cap.',
      toto: 'Stays at the foot of the hill with the others.' } },
  { ch: 22, key: 'monkeys-third-time', title: 'The Third Summons', loc: 'hammerhead-hill', d: 61, tension: 3, pov: 'dorothy',
    desc: 'The last wish in the Golden Cap is spent lifting five travellers over a hill they cannot climb.',
    items: ['golden-cap'], threads: ['cap', 'way-home'], motifs: ['gift'],
    cast: { 'monkey-king': 'Carries them over the hill, tells Dorothy this is the last time she can call, and says goodbye.',
      dorothy: 'Spends her third and final summons on a single hillside and is set down in the red country.',
      scarecrow: 'Is flown over the heads that knocked him down.',
      'tin-woodman': 'Is carried across without a dent this time.',
      lion: 'Is lifted over the hill that beat him.',
      toto: 'Is caught up with the rest and flown over the Hammer-Heads’ shouting.' } },
  { ch: 22, key: 'quadling-farm', title: 'The Quadling Farmhouse', loc: 'quadling-farm', d: 61, tension: 1, pov: 'dorothy',
    desc: 'Everything painted red, everyone short and good-natured, and a farmer’s wife who feeds five strangers without being asked twice.',
    items: [], threads: ['way-home'], motifs: ['home'],
    cast: { dorothy: 'Asks for something to eat and is given dinner, three kinds of cake and four kinds of cookies.',
      scarecrow: 'Notes a third country keeping to a third colour.',
      'tin-woodman': 'Walks the well-paved roads and strong little bridges of a country that looks after itself.',
      lion: 'Is given room by a people who are chubby and good-natured and still not fond of lions.',
      toto: 'Gets a bowl of milk to himself.' } },
  { ch: 22, key: 'castle-gates', title: 'Three Girl Soldiers', loc: 'castle-gates', d: 61, tension: 2, pov: 'dorothy',
    desc: 'The road south ends at a beautiful castle whose gates are kept by three young soldiers in red and gold.',
    items: [], threads: ['way-home'], motifs: ['roads'],
    cast: { dorothy: 'Gives her name to be carried in, and is admitted at once.',
      scarecrow: 'Waits at the gate for a witch who might send him home to his own city.',
      'tin-woodman': 'Waits beside him, hoping for the same for the Winkies.',
      lion: 'Waits at the gate of the last house in the country.',
      toto: 'Sits at her feet while the message goes in.' } },

  // XXIII. Glinda The Good Witch Grants Dorothy's Wish
  { ch: 23, key: 'tiring-room', title: 'Made Presentable', loc: 'tiring-room', d: 62, tension: 1, pov: 'dorothy',
    desc: 'Nobody meets the Good Witch of the South dusty; there is a room set aside for repairing four very different kinds of traveller.',
    items: [], threads: ['way-home'], motifs: ['home'],
    cast: { dorothy: 'Washes her face and combs her hair before going in to ask for the last thing she needs.',
      lion: 'Shakes the dust out of his mane.',
      scarecrow: 'Pats himself into his best shape.',
      'tin-woodman': 'Polishes his tin and oils his joints.',
      toto: 'Waits while everyone is put right.' } },
  { ch: 23, key: 'glinda-audience', title: 'The Ruby Throne', loc: 'ruby-throne-room', d: 62, tension: 3, pov: 'dorothy',
    desc: 'Glinda hears the whole story, names her price — the Golden Cap — and asks each of the four what they will do next.',
    items: ['golden-cap'], threads: ['way-home', 'kingdoms', 'cap'], motifs: ['gift'],
    cast: { glinda: 'Kisses her, asks for the Golden Cap in payment, and spends its three wishes returning three friends to three kingdoms.',
      dorothy: 'Hands over the Cap willingly, having no further use for it, and tells the whole story to get an answer.',
      scarecrow: 'Asks to be carried back to the Emerald City, whose people like him.',
      'tin-woodman': 'Asks for the country of the Winkies, who wanted him to rule them.',
      lion: 'Asks for the old forest over the hill where the beasts have made him king.',
      toto: 'Sits by her while the bargain is made.' } },
  { ch: 23, key: 'heels-clicked', title: 'Three Steps', loc: 'ruby-throne-room', d: 62, tension: 4, pov: 'dorothy',
    desc: 'The shoes could have done it on the first day; nobody knew, and every one of them says that is exactly why they are glad.',
    items: ['silver-shoes'], threads: ['way-home', 'wishes'], motifs: ['gift', 'home'],
    cast: { glinda: 'Tells her the Silver Shoes will carry her anywhere in three steps, and that they always could have.',
      dorothy: 'Cries through four goodbyes, takes up her dog, knocks the heels together three times and asks to be taken home.',
      scarecrow: 'Says he would have stayed in a cornfield all his life if she had known sooner.',
      'tin-woodman': 'Says he would have rusted in the forest until the end of the world.',
      lion: 'Says he would have lived a coward and no beast would have had a good word for him.',
      toto: 'Is taken up solemnly in her arms for the last step of the journey.' } },
  { ch: 23, key: 'barnyard-again', title: 'Uncle Henry in the Barnyard', loc: 'kansas-barnyard', d: 62, tension: 1, pov: 'uncle-henry',
    desc: 'On the Kansas end of three steps, an ordinary morning is going on: the cows are being milked.',
    items: [], threads: ['home'], motifs: ['home'],
    cast: { 'uncle-henry': 'Is milking the cows in the barnyard of a farm he has rebuilt, and does not yet know who is on the prairie behind him.' } },
  { ch: 23, key: 'landed-on-the-prairie', title: 'Sitting on the Prairie', loc: 'kansas-prairie', d: 62, tension: 2, pov: 'dorothy',
    desc: 'She rolls over on the grass in her stocking feet: the shoes came off somewhere over the desert and are gone for good.',
    items: [], threads: ['way-home', 'home'], motifs: ['home'],
    cast: { dorothy: 'Sits up on the broad Kansas prairie, sees a new farmhouse where the old one stood, and finds the Silver Shoes gone.',
      toto: 'Jumps out of her arms and runs for the barn, barking furiously.' } },

  // XXIV. Home Again
  { ch: 24, key: 'aunt-em-again', title: 'Home Again', loc: 'kansas-new-house', d: 62, tension: 2, pov: 'dorothy',
    desc: 'Aunt Em has come out to water the cabbages, and the child she gave up for lost is running at her across the yard.',
    items: [], threads: ['home', 'way-home'], motifs: ['home'],
    cast: { 'aunt-em': 'Comes out to water the cabbages, folds the girl into her arms, and asks where in the world she has come from.',
      dorothy: 'Says the Land of Oz, presents the dog as proof, and is glad to be at home again.',
      toto: 'Is produced as the second half of the answer.' } },
]

/* --------------------------------------------------- derived records --- */

const eventsForChapterBefore = (index, chapter) => scenes.slice(0, index).filter((s) => s.ch === chapter).length

const events = scenes.map((s, i) => {
  const prev = i ? day(scenes[i - 1].d) : day(s.d)
  return {
    ...base,
    id: EV(s.key),
    chapterId: Ch(s.ch),
    timelineId,
    title: s.title,
    description: s.desc,
    locationMarkerId: L(s.loc),
    involvedCharacterIds: Object.keys(s.cast).map(C),
    mentionedCharacterIds: [],
    involvedItemIds: s.items.map(Item),
    tags: [],
    sortOrder: eventsForChapterBefore(i, s.ch),
    travelDays: Math.max(0, day(s.d) - prev),
    inWorldTime: day(s.d),
    tension: s.tension,
    structureBeat: null,
    threadIds: s.threads.map(T),
    motifIds: s.motifs.map(O),
    status: 'final',
    povCharacterId: C(s.pov),
    isFlashback: false,
  }
})

const characterSnapshots = scenes.flatMap((s, si) =>
  Object.entries(s.cast).map(([slug, statusNotes], ci) => {
    const location = locations.find((l) => l.id === L(s.loc))
    /* The Witch of the West is alive until the bucket, and gone after it. */
    const dead = slug === 'witch-west' && s.key === 'shoe-and-water'
    return {
      ...base,
      id: id('snapshot', `${String(si + 1).padStart(3, '0')}-${slug}`),
      characterId: C(slug),
      eventId: EV(s.key),
      sortKey: (si + 1) * 10000 + ci,
      isAlive: !dead,
      currentLocationMarkerId: L(s.loc),
      currentMapLayerId: location.mapLayerId,
      inventoryItemIds: [],
      inventoryNotes: '',
      statusNotes,
      travelModeId: null,
    }
  }),
)

const characterMovements = []
const lastLocation = new Map()
for (const snapshot of characterSnapshots) {
  const from = lastLocation.get(snapshot.characterId)
  if (from && from !== snapshot.currentLocationMarkerId) {
    const who = characters.find((c) => c.id === snapshot.characterId).name
    const fromName = locations.find((l) => l.id === from).name
    const toName = locations.find((l) => l.id === snapshot.currentLocationMarkerId).name
    characterMovements.push({
      ...base,
      id: id('movement', String(characterMovements.length + 1).padStart(4, '0')),
      characterId: snapshot.characterId,
      eventId: snapshot.eventId,
      waypoints: [from, snapshot.currentLocationMarkerId],
      sortKey: snapshot.sortKey,
      travelModeId: null,
      notes: `${who} moves from ${fromName} to ${toName}.`,
    })
  }
  lastLocation.set(snapshot.characterId, snapshot.currentLocationMarkerId)
}

const itemPlacements = scenes.flatMap((s, si) =>
  s.items.map((slug, ii) => ({
    ...base,
    id: id('placement', `${String(si + 1).padStart(3, '0')}-${slug}`),
    itemId: Item(slug),
    eventId: EV(s.key),
    locationMarkerId: L(s.loc),
    mapLayerId: locations.find((l) => l.id === L(s.loc)).mapLayerId,
    holderCharacterId: null,
    sortKey: (si + 1) * 100 + ii,
    notes: `${items.find((it) => it.id === Item(slug)).name} is in play in this scene.`,
  })),
)

/* ------------------------------------------------- threads and motifs --- */

const plotThreads = [
  ['way-home', 'Getting Dorothy Home', '#6f88b4', 'One request, repeated to a witch, a wizard, a band of monkeys and a second witch, until somebody finally answers it.'],
  ['wishes', 'Brains, Heart, Courage', '#b08a3e', 'Three companions who each believe they are missing something, and who demonstrate the opposite the whole way to the city.'],
  ['witch', 'The Wicked Witch of the West', '#7a6244', 'A one-eyed owner of a country spends wolves, crows, bees, slaves and the last of her charm, and is undone by a bucket.'],
  ['humbug', 'What Is Behind the Screen', '#4f8f66', 'A ruler nobody has seen, four different faces on one throne, and a screen that falls over at the wrong moment.'],
  ['cap', 'The Charm of the Golden Cap', '#c2a34a', 'Three summonses pass from a witch to a girl to a witch, and are spent on an attack, a rescue, a refusal and a hillside.'],
  ['kingdoms', 'Three Kingdoms', '#7f9a63', 'A city, a yellow country and an old forest each end up ruled by somebody who arrived there with nothing.'],
  ['home', 'The Farm on the Prairie', '#9a8a72', 'Kansas is gray, flat and dry, and is still the only place the person at the centre of this wants to be.'],
].map(([slug, name, color, description]) => ({ ...base, id: T(slug), name, color, description }))

const motifs = [
  ['green', 'Seeing Green', '#4f9a6a', 'Spectacles locked onto every face at the gate, and a city that is only the colour of the glass in front of it.'],
  ['gift', 'The Gift Already Held', '#b8894a', 'Brains, heart, courage and a way home are all handed over as objects by people who had them all along.'],
  ['roads', 'Roads, Rivers and Walls', '#7d7a9a', 'A road of yellow brick, two ditches, a river, two china walls and a hill — every stage is a thing to be got across.'],
  ['small-help', 'The Help of Small Creatures', '#8a9a63', 'A dog, a stork, a queen of field mice and a thousand of her subjects each do what the large and powerful cannot.'],
  ['home', 'Home', '#a58a6a', 'Named as the reason for everything, defended against a country that is objectively more beautiful, and reached in three steps.'],
].map(([slug, name, color, description]) => ({ ...base, id: O(slug), name, color, description }))

/* ------------------------------------------------------ relationships --- */

const relRows = [
  ['dorothy-toto', 'dorothy', 'toto', 'girl and dog', 'bond', 'positive', 'The one piece of Kansas she has with her, and twice the reason she loses her way out of Oz.', 'storm-warning'],
  ['dorothy-scarecrow', 'dorothy', 'scarecrow', 'rescuer and companion', 'bond', 'positive', 'She lifts him off a pole; he does the thinking for the party from then on and refuses to leave her until she is gone.', 'scarecrow-lifted'],
  ['dorothy-woodman', 'dorothy', 'tin-woodman', 'oiler and companion', 'bond', 'positive', 'She frees his joints, and he wipes his own tears carefully ever after so that she never has to do it twice.', 'oiling-the-woodman'],
  ['dorothy-lion', 'dorothy', 'lion', 'girl and lion', 'bond', 'positive', 'Begins with a slap on the nose and becomes the friendship she is gladdest of when the mice haul him out of the poppies.', 'lion-springs'],
  ['scarecrow-woodman', 'scarecrow', 'tin-woodman', 'brains and heart', 'strong', 'positive', 'They argue about which is worth more from the day they meet and never once fail to save each other.', 'oiling-the-woodman'],
  ['dorothy-em', 'dorothy', 'aunt-em', 'niece and aunt', 'bond', 'positive', 'A gray, unlaughing woman and the orphan whose laughter frightened her, reunited over a cabbage patch.', 'storm-warning'],
  ['em-henry', 'aunt-em', 'uncle-henry', 'husband and wife', 'strong', 'neutral', 'Two people worn the same colour as their farm, who each go to a different piece of it when the wind comes.', 'storm-warning'],
  ['dorothy-witch-north', 'dorothy', 'witch-north', 'protected and protector', 'moderate', 'positive', 'A kiss on the forehead that no one in Oz will touch, given by a witch who cannot come any further than that.', 'kiss-and-road'],
  ['dorothy-oz', 'dorothy', 'oz', 'petitioner and humbug', 'strong', 'complex', 'He sets her an impossible price, cannot pay his own side of it, and is forgiven on the grounds that he did try.', 'dorothy-and-the-head'],
  ['dorothy-witch-west', 'dorothy', 'witch-west', 'slave and owner', 'strong', 'negative', 'A captor who dare not strike her and a captive who does not know why, until a bucket settles it.', 'dorothy-a-slave'],
  ['woodman-mouse-queen', 'tin-woodman', 'mouse-queen', 'rescuer and debtor', 'moderate', 'positive', 'An axe swung at a wildcat buys a friendship that saves a lion and later finds a lost road.', 'wildcat'],
  ['dorothy-monkey-king', 'dorothy', 'monkey-king', 'owner of the Cap and bound servant', 'moderate', 'complex', 'He destroys her friends on one order and carries her twice on others, all under the same charm.', 'monkeys-attack'],
  ['dorothy-glinda', 'dorothy', 'glinda', 'petitioner and Good Witch', 'moderate', 'positive', 'The fourth witch asked and the first who can actually answer, for the price of a hat.', 'glinda-audience'],
  ['scarecrow-oz', 'scarecrow', 'oz', 'ruler and successor', 'moderate', 'complex', 'A humbug hands a city to a man he stuffed with bran, and the city is pleased with the arrangement.', 'balloon-launched'],
].map(([slug, a, b, label, strength, sentiment, description, start]) => ({
  ...base, id: R(slug), characterAId: C(a), characterBId: C(b), label, strength, sentiment, description, isBidirectional: true, startEventId: EV(start),
}))

const relationshipSnapshots = [
  ['dorothy-lion', 'lion-springs', 'girl and the coward who frightened her dog', 'weak', 'negative', 'It starts with a slap on the nose and a name he does not deny.'],
  ['dorothy-lion', 'mice-haul-the-lion', 'friends worth a thousand mice', 'bond', 'positive', 'She has grown fond enough of him to be glad the field mice bothered.'],
  ['dorothy-oz', 'dorothy-and-the-head', 'small petitioner and Great Head', 'strong', 'negative', 'He sends her out of the room with a killing to do and no way to refuse.'],
  ['dorothy-oz', 'the-humbug-explains', 'girl and a very bad wizard', 'strong', 'complex', 'Called a bad man, he settles for being a good man and a bad wizard, and she lets him.'],
  ['dorothy-witch-west', 'shoe-and-water', 'the captive and what is left of the Witch', 'weak', 'negative', 'One bucket ends the ownership, and the girl is sorry about it.'],
  ['scarecrow-oz', 'balloon-launched', 'departing humbug and appointed ruler', 'moderate', 'positive', 'The city is told to obey the Scarecrow as it would obey Oz, and does.'],
].map(([rel, event, label, strength, sentiment, description], i) => ({
  ...base, id: id('relationship-snapshot', `${rel}-${event}`), relationshipId: R(rel), eventId: EV(event), sortKey: i, label, strength, sentiment, description, isActive: true,
}))

/* ----------------------------------------------------------- factions --- */

const factionRows = [
  ['munchkins', 'The Munchkins', 'The blue people of the East, freed from the Wicked Witch of the East by a falling farmhouse.', '#5f7fa8', 'munchkins'],
  ['winkies', 'The Winkies', 'The yellow people of the West, enslaved by the Witch through the Golden Cap and freed by a bucket of water.', '#c9a94a', 'winkies'],
  ['quadlings', 'The Quadlings', 'The red people of the South, short, chubby and good-natured, who keep their roads paved and their bridges strong.', '#c4646c', 'quadlings'],
  ['winged-monkeys', 'The Winged Monkeys', 'A free forest people bound by an old sentence to obey the owner of the Golden Cap three times over.', '#7a6250', 'winged-monkeys'],
  ['field-mice', 'The Field Mice', 'Thousands of mice under one queen, who pay a debt with string, a truck and directions.', '#9c8c74', 'field-mice'],
  ['hammer-heads', 'The Hammer-Heads', 'An armless people who own a hill and defend it with their heads, and let nobody over it on foot.', '#a99274', null],
  ['china-people', 'The China People', 'Milkmaids, princesses, clowns and livestock, all of painted china, all breakable, all content where they are.', '#c9a0b0', null],
  ['forest-beasts', 'The Beasts of the Great Forest', 'Tigers, elephants, bears and wolves who hold meetings, and who will crown anyone who removes their monster.', '#8a9a63', 'forest-beasts'],
]
const factions = factionRows.map(([slug, name, description, color, art]) => ({
  ...base,
  id: F(slug),
  name,
  description,
  color,
  coverImageId: art ? image(`faction-${art}`, `art/factions/${art}.jpg`) : null,
  tags: [],
}))

const factionMemberships = [
  ['munchkins', 'boq', 'Host', 'boq-supper', null],
  ['munchkins', 'witch-east', 'Owner of the country', 'council-munchkins', 'council-munchkins'],
  ['winkies', 'witch-west', 'Owner of the country', 'witch-watches', 'shoe-and-water'],
  ['winkies', 'tin-woodman', 'Ruler, at Glinda’s third command', 'glinda-audience', null],
  ['winged-monkeys', 'monkey-king', 'King', 'monkeys-attack', null],
  ['field-mice', 'mouse-queen', 'Queen', 'wildcat', null],
  ['china-people', 'china-princess', 'Princess', 'china-princess', null],
  ['china-people', 'mr-joker', 'Clown', 'mr-joker', null],
  ['forest-beasts', 'lion', 'King of Beasts', 'spider-killed', null],
].map(([faction, character, role, start, end]) => ({
  ...base, id: id('membership', `${faction}-${character}`), factionId: F(faction), characterId: C(character), role, startEventId: EV(start), endEventId: end ? EV(end) : null, notes: '',
}))

const factionRelationships = [
  { ...base, id: id('faction-relationship', 'winkies-witch'), factionAId: F('winkies'), factionBId: F('winged-monkeys'), stance: 'hostile', notes: 'The Winkies were made slaves by the Winged Monkeys acting under the Golden Cap.' },
  { ...base, id: id('faction-relationship', 'munchkins-quadlings'), factionAId: F('munchkins'), factionBId: F('quadlings'), stance: 'neutral', notes: 'Two of the four countries of Oz, each keeping to its own colour and its own end of the land.' },
  { ...base, id: id('faction-relationship', 'hammer-heads-quadlings'), factionAId: F('hammer-heads'), factionBId: F('quadlings'), stance: 'hostile', notes: 'The Hammer-Heads hold the hill on the road into the Quadling country and let nobody cross it.' },
]

/* --------------------------------------------------------------- lore --- */

const loreCategories = [
  { id: id('lore-category', 'country'), worldId, name: 'The Country of Oz', color: '#5f8f6a', sortOrder: 0 },
  { id: id('lore-category', 'magic'), worldId, name: 'Magic and Its Rules', color: '#8a6fa8', sortOrder: 1 },
  { id: id('lore-category', 'sources'), worldId, name: 'Sources and Editorial Notes', color: '#7d7466', sortOrder: 2 },
]

const loreRows = [
  ['four-countries', 'country', 'The Four Countries and Their Colours',
    'Oz is divided into four countries around a green city at the exact centre. The East belongs to the Munchkins and is blue; the West to the Winkies and is yellow; the South to the Quadlings and is red; the North is the home of the good witch who meets Dorothy. Each country keeps its colour in its fences, houses, clothes and crops, so a traveller always knows which quarter they are standing in.',
    'council-munchkins', null],
  ['desert', 'country', 'The Deadly Desert',
    'A desert surrounds Oz on all four sides and nobody crosses it. It is the reason a girl who wants to go home cannot simply walk, the reason the Winged Monkeys refuse a direct order, and the reason the only two people known to have arrived here came through the air.',
    'council-munchkins', null],
  ['witches', 'magic', 'Four Witches and One Wizard',
    'There were four witches in Oz: the North and South good, the East and West wicked. Their power is uneven — the Witch of the North says plainly that she was not strong enough to free the Munchkins herself. The Wizard in the Emerald City is spoken of as more powerful than all of them together, though nobody consulted has ever seen him.',
    'council-munchkins', null],
  ['golden-cap', 'magic', 'The Charm of the Golden Cap',
    'Whoever owns the Golden Cap may command the Winged Monkeys three times, and no more. The charm is written inside the lining and worked by standing on the left foot, then the right, then both, saying the words in order. Ownership passes with the Cap itself, and the count belongs to the owner, not to the Cap.',
    'monkeys-carry', 'golden-cap'],
  ['spectacles', 'magic', 'The Green Spectacles',
    'Every visitor to the Emerald City is fitted at the gate with green spectacles, locked on with golden bands. The Guardian of the Gates keeps the only key and the rule is said to date from the building of the city.',
    'at-the-gate', 'green-spectacles'],
  ['silver-shoes', 'magic', 'The Silver Shoes',
    'The Wicked Witch of the East was proud of these shoes and the Munchkins knew there was a charm on them without ever learning what it was. They fit Dorothy exactly, cannot be worn out by walking, and are feared by at least one witch who understands what they can do.',
    'silver-shoes-given', null],
  ['chronology', 'sources', 'How This Chronology Was Reconstructed',
    'The novel dates nothing and names no season, so the calendar in this world is editorial. Day one is fixed at 1 August only so that ripe corn and blooming poppies sit in a plausible month; the year is arbitrary. Every interval between scenes, however, is the book’s own: the nights on the road, the three days and four nights the tinsmiths work, the three days of waiting after the Witch dies, the three days of sewing silk, and the several days lost in the yellow fields are all counted from the text. Read the day numbers as elapsed time, not as dates.',
    'storm-warning', null],
  ['text-source', 'sources', 'The Text Behind This World',
    'Chapters, chapter titles, characters, places and events follow the complete 1900 first edition, read from Project Gutenberg eBook #55. All twenty-four chapter titles are Baum’s own headings. Every summary, description and status note in this world is original writing about the book — none of the novel’s prose is reproduced here.',
    'storm-warning', null],
  ['pictures', 'sources', 'The Pictures in This World',
    'Every portrait, item and place picture is one of W. W. Denslow’s illustrations for the 1900 first edition, which are in the public domain. The files come from Wikimedia Commons, were checked one by one against the entity they are attached to, and are shipped with the book rather than linked to another site. A few entities are deliberately left without a picture where no illustration of them exists: the Wicked Witch of the East, who is dead before the story opens, is one.',
    'storm-warning', null],
  ['maps', 'sources', 'The Maps in This World',
    'Baum published no map of Oz with the 1900 edition. The seven map layers here were drawn for this example from the geography the text itself gives: four countries around a central city, a desert on every side, the road of yellow brick running in from the East, and the southern road out past the china country and the Hammer-Heads’ hill. They are interpretive and are not to scale — which is why no scale is recorded on any layer.',
    'house-comes-down', null],
]
const lorePages = loreRows.map(([slug, cat, title, body, visible, art]) => ({
  ...base,
  id: id('lore', slug),
  categoryId: id('lore-category', cat),
  title,
  body,
  tags: [],
  coverImageId: art ? I(`item-${art}`) : null,
  linkedEntityIds: [],
  visibleFromEventId: EV(visible),
}))

/* ---------------------------------------------------------- knowledge --- */

const factRows = [
  ['witch-east-dead', 'The Wicked Witch of the East is dead under the farmhouse', 'The cyclone drops a Kansas house on the owner of the Munchkin country, which frees them and starts everything else.', 'council-munchkins'],
  ['shoes-charm', 'The Silver Shoes carry a charm', 'The Munchkins know there is something in the shoes and admit they never learned what.', 'silver-shoes-given'],
  ['kiss-protects', 'The Witch of the North’s kiss protects Dorothy', 'A mark on the forehead that nothing in Oz will dare injure, including the Winged Monkeys and the Witch of the West.', 'kiss-and-road'],
  ['oz-price', 'Oz will not help anyone until the Wicked Witch of the West is dead', 'The same price is set for all four petitioners, in four different shapes, on four consecutive days.', 'dorothy-and-the-head'],
  ['cap-charm', 'The Golden Cap commands the Winged Monkeys three times', 'The words are written in the lining; the Witch of the West spends her last summons before Dorothy ever sees it.', 'golden-cap-summons'],
  ['witch-water', 'Water destroys the Wicked Witch of the West', 'She never touches water and never lets it touch her, and one thrown bucket ends her.', 'shoe-and-water'],
  ['oz-humbug', 'Oz is a humbug', 'A ventriloquist and balloonist from Omaha, with no magic at all, behind a paper head and a screen.', 'behind-the-screen'],
  ['city-not-green', 'The Emerald City is no greener than anywhere else', 'The spectacles do the work; the city is beautiful, but the colour belongs to the glass.', 'the-humbug-explains'],
  ['monkeys-cannot-leave', 'The Winged Monkeys cannot cross the desert', 'They belong to Oz alone, which spends a wish and closes the second way home.', 'monkeys-refuse'],
  ['shoes-could-always', 'The Silver Shoes could have taken her home on the first day', 'Three steps to anywhere in the world, and nobody who knew it met her until the last chapter.', 'heels-clicked'],
]
const knowledgeFacts = factRows.map(([slug, title, description, event]) => ({
  ...base, id: K(slug), title, description, tags: [], readerLearnsAtEventId: EV(event), originEventId: EV(event),
}))

const revealRows = [
  ['witch-east-dead', 'dorothy', 'council-munchkins'], ['witch-east-dead', 'witch-north', 'council-munchkins'],
  ['shoes-charm', 'dorothy', 'silver-shoes-given'], ['shoes-charm', 'boq', 'boq-supper'],
  ['kiss-protects', 'dorothy', 'kiss-and-road'], ['kiss-protects', 'monkey-king', 'monkeys-attack'],
  ['kiss-protects', 'witch-west', 'monkeys-attack'],
  ['oz-price', 'dorothy', 'dorothy-and-the-head'], ['oz-price', 'scarecrow', 'scarecrow-and-the-lady'],
  ['oz-price', 'tin-woodman', 'woodman-and-the-beast'], ['oz-price', 'lion', 'lion-and-the-fire'],
  ['cap-charm', 'witch-west', 'golden-cap-summons'], ['cap-charm', 'dorothy', 'mice-whistle'],
  ['cap-charm', 'mouse-queen', 'mice-whistle'],
  ['witch-water', 'dorothy', 'shoe-and-water'],
  ['oz-humbug', 'dorothy', 'behind-the-screen'], ['oz-humbug', 'scarecrow', 'behind-the-screen'],
  ['oz-humbug', 'tin-woodman', 'behind-the-screen'], ['oz-humbug', 'lion', 'behind-the-screen'],
  ['city-not-green', 'dorothy', 'the-humbug-explains'],
  ['monkeys-cannot-leave', 'dorothy', 'monkeys-refuse'], ['monkeys-cannot-leave', 'monkey-king', 'monkeys-refuse'],
  ['shoes-could-always', 'dorothy', 'heels-clicked'], ['shoes-could-always', 'glinda', 'heels-clicked'],
]
const knowledgeReveals = revealRows.map(([fact, character, event]) => ({
  ...base,
  id: id('reveal', `${fact}-${character}`),
  factId: K(fact),
  characterId: C(character),
  eventId: EV(event),
  note: `${characters.find((c) => c.id === C(character)).name} learns: ${knowledgeFacts.find((f) => f.id === K(fact)).title}.`,
}))

/* -------------------------------------------------------------- goals --- */

const goalRows = [
  ['dorothy-home', 'dorothy', 'want', 'Get back to Aunt Em and Uncle Henry in Kansas.', 'house-comes-down', 'aunt-em-again'],
  ['dorothy-no-killing', 'dorothy', 'flaw', 'She is asked to kill a witch and does not want to kill anything, even to see Aunt Em again.', 'dorothy-and-the-head', 'shoe-and-water'],
  ['scarecrow-brains', 'scarecrow', 'want', 'Get brains from Oz so that nobody can call him a fool.', 'scarecrow-lifted', 'brains'],
  ['scarecrow-use', 'scarecrow', 'need', 'Notice that he has been solving the party’s problems since the day he came off the pole.', 'kalidahs', 'scarecrow-rules'],
  ['woodman-heart', 'tin-woodman', 'want', 'Get a heart from Oz so that he can love the Munchkin girl again.', 'oiling-the-woodman', 'heart'],
  ['woodman-care', 'tin-woodman', 'need', 'Accept that being careful of every living thing is already what a heart is for.', 'beetle-and-jaws', 'glinda-audience'],
  ['lion-courage', 'lion', 'want', 'Get courage from Oz so that he can be King of Beasts in fact as well as name.', 'lion-springs', 'courage'],
  ['lion-fear', 'lion', 'fear', 'He is afraid of everything and goes at it anyway, which is the only kind of courage there is.', 'kalidahs', 'spider-killed'],
  ['oz-secret', 'oz', 'fear', 'Being found out as a very ordinary man in a city that believes he is a great wizard.', 'dorothy-and-the-head', 'behind-the-screen'],
  ['witch-shoes', 'witch-west', 'want', 'Get the Silver Shoes off the girl she is not allowed to touch.', 'dorothy-a-slave', 'shoe-and-water'],
].map(([slug, character, type, text, start, end]) => ({
  ...base, id: id('goal', slug), characterId: C(character), type, text, startEventId: EV(start), endEventId: end ? EV(end) : null,
}))

/* ------------------------------------------- travel, routes, snapshots --- */

/*
  No travel modes (EX-403, recorded rather than padded). A TravelMode is a
  `speedPerDay` in the map layer's `scaleUnit`, and none of these seven layers
  carries a scale — they are interpretive maps of a country the book never
  measures. A speed here would be a number nothing backs, so the feature is
  left genuinely empty instead of filled with invented distances.
*/
const travelModes = []

const mapRoutes = [
  {
    ...base, id: id('route', 'yellow-brick'), mapLayerId: M('oz'), name: 'The Road of Yellow Brick', routeType: 'road',
    waypoints: ['landing-site', 'boq-house', 'cornfield', 'forest-road', 'woodman-cottage', 'lion-road', 'night-camp', 'first-gulf', 'kalidah-gulf', 'river-crossing', 'green-farmhouse', 'emerald-city'].map(L),
    color: '#d9b23c', notes: 'The road the Witch of the North names, followed from the Munchkin country to the gate of the Emerald City.',
  },
  {
    ...base, id: id('route', 'south-road'), mapLayerId: M('oz'), name: 'The Road South to Glinda', routeType: 'trail',
    waypoints: ['emerald-city', 'fighting-trees', 'china-country', 'marshes', 'great-forest', 'hammerhead-hill', 'quadling-farm', 'glinda-castle'].map(L),
    color: '#a2576a', notes: 'The way to the fourth witch: a wood that fights back, a china country, bogs, a forest and a hill nobody walks over.',
  },
  {
    ...base, id: id('route', 'west-track'), mapLayerId: M('oz'), name: 'West, Where the Sun Sets', routeType: 'trail',
    waypoints: ['emerald-city', 'west-country', 'yellow-castle'].map(L),
    color: '#7d6a4f', notes: 'There is no road to the Winkie country; the Guardian’s instruction is simply to keep west until the Witch finds you.',
  },
]

const locationSnapshots = [
  ['munchkins-freed', 'landing-site', 'council-munchkins', 'Freed of the Witch of the East', 'The house has come down on the owner of the country, and the Munchkins are no longer anybody’s property.'],
  ['witch-melted', 'great-kitchen', 'shoe-and-water', 'The Witch is gone', 'What is left of the owner of the castle has been swept out of the kitchen door.'],
  ['castle-freed', 'winkie-workshops', 'winkies-freed', 'Kept as a holiday', 'The Winkies have their workshops back and keep the day of the melting as a holiday from then on.'],
  ['city-new-ruler', 'throne-room', 'balloon-launched', 'Ruled by the Scarecrow', 'The Wizard is somewhere over the desert and a stuffed man is sitting on the throne.'],
  ['church-broken', 'china-church', 'lions-tail-church', 'Smashed by a lion’s tail', 'The church is in pieces — one of only two things the party breaks in the whole china country.'],
].map(([slug, loc, event, status, notes], i) => ({
  ...base, id: id('location-snapshot', slug), locationMarkerId: L(loc), eventId: EV(event), sortKey: i, status, notes,
}))

/* --------------------------------------------------------------- data --- */

const data = {
  version: 16,
  type: 'worldbreaker-export',
  exportedAt: now,
  world: {
    id: worldId,
    name: 'The Wonderful Wizard of Oz',
    description: 'A Kansas cyclone sets Dorothy Gale down in a country of four coloured lands ringed by a desert nobody crosses. Walking a road of yellow brick to ask a wizard for a way home, she collects a scarecrow who wants brains, a tin man who wants a heart and a lion who wants courage — and finds that the wizard is a humbug, that the witch he sends her to kill is undone by a bucket of water, and that the shoes on her own feet could have taken her home on the first day.',
    coverImageId: image('cover', 'art/cover.jpg'),
    theme: 'theme-fantasy',
    readingMode: true,
    createdAt: now,
    updatedAt: now,
    continuityStaleThreshold: 5,
    calendar: {
      startYear: 1900,
      yearSuffix: ' (editorial chronology)',
      months: [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]].map(([name, days]) => ({ name, days })),
    },
    wordTarget: null,
  },
  mapLayers: maps,
  locationMarkers: locations,
  characters,
  items,
  characterSnapshots,
  characterMovements,
  itemPlacements,
  itemSnapshots: [],
  locationSnapshots,
  relationships: relRows,
  relationshipSnapshots,
  timelines: [{ id: timelineId, worldId, name: 'Dorothy’s Journey', description: 'One chronology from the Kansas cyclone to the Kansas prairie, in the order the book tells it.', color: '#6f88b4', dayOffset: 0, createdAt: now }],
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
  characterGoals: goalRows,
  sceneTexts: [],
  plotThreads,
  motifs,
  continuitySuppressions: [],
  writingLogs: [],
  sceneRevisions: [],
}

/* ---------------------------------------------------------- self-check --- */

const fail = (message) => { throw new Error(message) }

if (chapters.length !== 24) fail('the book has twenty-four chapters')
for (const chapter of chapters) {
  if (!events.some((e) => e.chapterId === chapter.id)) fail(`${chapter.title} has no events (EX-002)`)
}
for (const event of events) {
  if (!Number.isInteger(event.tension) || event.tension < 1 || event.tension > 5) fail(`${event.title}: tension out of range (EX-005)`)
  if (!Number.isFinite(event.travelDays) || event.travelDays < 0) fail(`${event.title}: negative elapsed time (EX-005)`)
  if (!Number.isInteger(event.inWorldTime)) fail(`${event.title}: no in-world date (EX-006)`)
  if (!locations.some((l) => l.id === event.locationMarkerId)) fail(`${event.title}: unknown location (EX-404)`)
  if (!characters.some((c) => c.id === event.povCharacterId)) fail(`${event.title}: unknown POV character (EX-404)`)
  if (!event.involvedCharacterIds.includes(event.povCharacterId)) fail(`${event.title}: POV character is not present (EX-102)`)
  for (const characterId of event.involvedCharacterIds) {
    if (!characters.some((c) => c.id === characterId)) fail(`${event.title}: unknown character (EX-404)`)
  }
  for (const itemId of event.involvedItemIds) {
    if (!items.some((it) => it.id === itemId)) fail(`${event.title}: unknown item (EX-404)`)
  }
}
/* EX-102: exactly one snapshot per present character, and none for anyone else. */
const expectedSnapshots = events.reduce((n, e) => n + e.involvedCharacterIds.length, 0)
if (characterSnapshots.length !== expectedSnapshots) fail('snapshot coverage does not match the cast lists (EX-102)')
if (new Set(characterSnapshots.map((s) => `${s.eventId}:${s.characterId}`)).size !== characterSnapshots.length) fail('duplicate snapshot (EX-102)')
/* EX-103/EX-104: event-specific status, never repeated within an event, never
   the character's own biography read back. */
const notesByEvent = new Map()
for (const snapshot of characterSnapshots) {
  const notes = snapshot.statusNotes.trim()
  if (!notes) fail(`${snapshot.id}: empty status (EX-103)`)
  const bio = characters.find((c) => c.id === snapshot.characterId).description.trim()
  if (notes.startsWith(bio)) fail(`${snapshot.id}: status repeats the character description (EX-103)`)
  const seen = notesByEvent.get(snapshot.eventId) ?? new Set()
  if (seen.has(notes.toLocaleLowerCase())) fail(`${snapshot.eventId}: two characters share a status (EX-104)`)
  seen.add(notes.toLocaleLowerCase())
  notesByEvent.set(snapshot.eventId, seen)
}
/* EX-203: exactly one gateway per submap, and it sits on the parent map. */
for (const child of maps.filter((m) => m.parentMapId)) {
  const gateways = locations.filter((l) => l.linkedMapLayerId === child.id)
  if (gateways.length !== 1) fail(`${child.name} has ${gateways.length} gateways (EX-203)`)
  if (gateways[0].mapLayerId !== child.parentMapId) fail(`${child.name}'s gateway is not on its parent map (EX-203)`)
}
/* EX-204: no empty maps. */
for (const layer of maps) {
  if (!locations.some((l) => l.mapLayerId === layer.id)) fail(`${layer.name} has no locations (EX-204)`)
}
/* EX-303/EX-304: entity art is unique, and never a map. */
const entityImages = [
  ...characters.map((c) => c.portraitImageId),
  ...items.map((it) => it.imageId),
  ...locations.map((l) => l.imageId),
  ...factions.map((f) => f.coverImageId),
  data.world.coverImageId,
].filter(Boolean)
if (new Set(entityImages).size !== entityImages.length) fail('two entities share an illustration (EX-304)')
const mapImages = new Set(maps.map((m) => m.imageId))
for (const imageId of entityImages) {
  if (mapImages.has(imageId)) fail(`${imageId} is a map used as entity art (EX-303)`)
}
/* EX-404: every blob a record names is really declared, and every file it names
   is really in the repository. */
const blobIds = new Set(blobs.map((b) => b.id))
for (const imageId of [...entityImages, ...maps.map((m) => m.imageId)]) {
  if (!blobIds.has(imageId)) fail(`${imageId} is referenced but not declared (EX-404)`)
}
for (const blob of blobs) {
  if (!fs.existsSync(`public/${blob.url}`)) fail(`${blob.url} is named but not shipped (EX-306)`)
}
/* Lore must wait for a scene, and name one this world has (R4a). */
for (const page of lorePages) {
  if (!page.visibleFromEventId) fail(`${page.title} has no reveal point`)
  if (!events.some((e) => e.id === page.visibleFromEventId)) fail(`${page.title} names a scene this world does not have (EX-404)`)
}
for (const record of [...knowledgeFacts.map((f) => f.readerLearnsAtEventId), ...knowledgeReveals.map((r) => r.eventId), ...goalRows.flatMap((g) => [g.startEventId, g.endEventId])]) {
  if (record && !events.some((e) => e.id === record)) fail(`${record} is not an event in this world (EX-404)`)
}
/* Chronology must not run backwards. */
for (let i = 1; i < events.length; i++) {
  if (events[i].inWorldTime < events[i - 1].inWorldTime) fail(`${events[i].title} happens before the scene it follows (EX-106)`)
}

/* -------------------------------------------------------------- write --- */

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync('example/The Wonderful Wizard of Oz.pwk', text)
fs.writeFileSync('public/library/the-wonderful-wizard-of-oz.pwk', text)

const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = {
  id: 'the-wonderful-wizard-of-oz',
  title: 'The Wonderful Wizard of Oz',
  author: 'L. Frank Baum',
  blurb: 'A cyclone, a road of yellow brick, and four travellers asking a wizard for the four things they already have.',
  data: 'the-wonderful-wizard-of-oz.pwk',
  dataBytes: Buffer.byteLength(text),
  counts: { characters: characters.length, chapters: chapters.length, events: events.length, locations: locations.length },
  notice: 'Unofficial reference for a public-domain novel. This example contains original structural summaries and an editorial calendar, not the novel’s prose. W. W. Denslow’s 1900 illustrations are public domain and ship with the book.',
  worldId,
  cover: `${repo}/art/cover.jpg`,
}
const at = index.entries.findIndex((e) => e.id === entry.id)
if (at >= 0) index.entries[at] = entry
else index.entries.push(entry)
fs.writeFileSync('public/library/index.json', `${JSON.stringify(index, null, 2)}\n`)

console.log(JSON.stringify({
  chapters: chapters.length,
  events: events.length,
  characters: characters.length,
  locations: locations.length,
  maps: maps.length,
  items: items.length,
  snapshots: characterSnapshots.length,
  movements: characterMovements.length,
  relationships: relRows.length,
  factions: factions.length,
  lore: lorePages.length,
  facts: knowledgeFacts.length,
  goals: goalRows.length,
  images: blobs.length,
  bytes: Buffer.byteLength(text),
}, null, 2))
