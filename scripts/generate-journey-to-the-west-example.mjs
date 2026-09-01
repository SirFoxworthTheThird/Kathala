/*
  Builds the shipped example world for Wu Cheng'en's *Journey to the West*
  (西遊記, c. 1592) and updates the library catalogue.

  Rules followed: docs/EXAMPLE_AUTHORING_RULES.md.

  Source (EX-001): the complete hundred-chapter Chinese text at zh.wikisource
  (西遊記), read chapter by chapter. The reading record is kept beside this file
  in scripts/journey-to-the-west/scene-ledger.md, and the hundred chapter
  titles in chapters.json are the novel's own couplets, transcribed from that
  edition — nothing here is an editorial signpost, so EX-008 does not apply.
  Every summary, description and status note is original structural writing
  about the book; none of the novel's prose is reproduced (EX-007).

  Chronology (EX-006): unusually for a book this size, the novel dates itself.
  The travel rescript is issued in the thirteenth year of Zhenguan and handed
  back in the twenty-seventh, and the road is stated over and over to have
  taken fourteen years. The calendar below therefore starts at Zhenguan 1
  (627 CE) and the pilgrimage runs 639–653 CE, which is the book's own count
  rather than the historical one — the real Zhenguan era ended in its
  twenty-third year, and a Lore page says so.

  The frame chapters run on a second timeline and on negative day numbers,
  reconstructed from the book's own arithmetic: the underworld register gives
  the monkey's age as 342, Heaven is repeatedly said to run one day to the
  world's year, and five hundred years pass under the mountain. Followed
  through, that puts his birth somewhere around 400 BCE. The Lore shows the
  working and says plainly that it is a reconstruction.

  Artwork (EX-301/EX-306/EX-307): the maps and every character, place and item
  plate are AI-generated pictures supplied by this repository's owner, who
  states they are their own work. None is public domain, and SOURCES.md and
  the Lore say so. Each was opened and checked against the entity it is
  attached to before it was assigned; where a picture is captioned wrongly or
  draws something the book does not, the Lore says which and why.
*/
import fs from 'node:fs'

const P = 'jw'
const worldId = 'journey-to-the-west-world'
const now = 1788393600000
const base = { worldId, createdAt: now, updatedAt: now }
const repo = 'library/journey-to-the-west'

const id = (kind, slug) => `${P}-${kind}-${slug}`
const I = (s) => id('image', s)
const C = (s) => id('character', s)
const L = (s) => id('location', s)
const M = (s) => id('map', s)
const Ch = (n) => id('chapter', String(n).padStart(3, '0'))
const EV = (s) => id('event', s)
const Item = (s) => id('item', s)
const T = (s) => id('thread', s)
const O = (s) => id('motif', s)
const F = (s) => id('faction', s)
const K = (s) => id('fact', s)
const R = (s) => id('relationship', s)

/*
  Day 0 is 1 January of Zhenguan 1 (627 CE). The two timelines share this one
  absolute axis, so a chronological merge of them is honest; the frame runs on
  negative days, which the calendar handles.
*/
const YEAR = 365
const ce = (year, dayInYear = 0) => (year - 627) * YEAR + dayInYear

const blobs = []
const image = (slug, path, mimeType = 'image/jpeg') => {
  blobs.push({ ...base, id: I(slug), mimeType, url: `${repo}/${path}` })
  return I(slug)
}

/* ---------------------------------------------------------------- maps --- */

/* [slug, parent, name, description, width, height, file] */
const mapRows = [
  ['route', null, 'The Road West', 'The whole pilgrimage on one sheet: the Tang border, the mountain the monkey was pinned under, the rivers, the Women’s Kingdom, the Flaming Mountains and, at the far western end, Vulture Peak.', 1024, 572, 'pilgrimage-route.jpg'],
  ['changan', 'route', 'Chang’an', 'The Tang capital the journey is commissioned in and returns to: the walled wards, the two markets, the palace, and the temple where the assembly picks its pilgrim.', 1024, 572, 'changan.jpg'],
  ['vulture-peak', 'route', 'Vulture Peak', 'The end of the road — the mountain, the ferry below it, and the Thunderclap Monastery with the scripture hall at the top of the stairs.', 1024, 572, 'vulture-peak.jpg'],
  ['ffm', null, 'Flower-Fruit Mountain', 'The monkey’s island in the Eastern Continent, with the waterfall, the iron bridge, the encampment below it, and a cut-away of the cave behind the water.', 1024, 572, 'flower-fruit-mountain.jpg'],
  ['heaven', null, 'The Celestial Court', 'Heaven as an estate: the Southern Gate, the Hall of Miraculous Mist, the Queen Mother’s lake, the stables, and the furnace room the elixir is cooked in.', 1024, 559, 'celestial-court.jpg'],
  ['dragon-palace', null, 'The Dragon Palace of the Eastern Sea', 'The undersea halls the cudgel is taken from: the crystal palace, the throne, the armoury, and the pillar that gauges the depth of the sea.', 1024, 559, 'dragon-palace.jpg'],
  ['underworld', null, 'The Underworld Courts', 'The bureaucracy below: the Gate of Ghosts, the bridge, the river, the Hall of Judgment, the register — and the hells drawn along the bottom of the sheet.', 1024, 572, 'underworld.jpg'],
]
const maps = mapRows.map(([slug, parent, name, description, imageWidth, imageHeight, file]) => ({
  ...base,
  id: M(slug),
  parentMapId: parent ? M(parent) : null,
  name,
  description,
  imageId: image(`map-${slug}`, `maps/${file}`),
  imageWidth,
  imageHeight,
  /* No scale. The road map is a pictorial strip, not a survey, and the book's
     own distances are religious numbers (108,000 li) rather than measurements.
     A scale here would feed the continuity checker confident nonsense. */
  scalePixelsPerUnit: null,
  scaleUnit: null,
  levelGroupId: null,
  levelIndex: 0,
  levelLabel: '',
}))

/* ----------------------------------------------------------- locations --- */

/*
  [slug, map, name, description, linkedMap, x, displayY, iconType, art]

  On the road map the pins follow the painting: where it names a feature, the
  marker sits on that name, even where the book's own order would put it
  somewhere else. That is why the road doubles back east once, between the
  Guanyin Monastery and Gao Village — the painting puts the village inside the
  Tang border, and the book puts it a long way past it. Everything the painting
  does not name is placed along the drawn road between the features that
  bracket it in the text. The Lore says all of this in the app.
*/
const locRows = [
  // ---- The road west, in the order the book walks it -------------------
  ['changan', 'route', 'Chang’an', 'The Tang capital: the city the commission is given in, and the city the scriptures are carried back to fourteen years later.', 'changan', 925, 285, 'city', null],
  ['famen-temple', 'route', 'Famen Temple', 'The monastery outside the walls where the pilgrim spends his first night and is asked how long he will be, and answers three years.', null, 972, 380, 'building', null],
  ['shuangcha-ridge', 'route', 'Twin Forks Ridge', 'The first mountain past the frontier, where a pit takes the whole party and two of three travellers are eaten before breakfast.', null, 790, 245, 'landmark', null],
  ['liu-farm', 'route', 'The Hunter’s Farm', 'Liu Boqin’s house under the Mountain of Two Frontiers, where a widow’s memorial meal is said over a man who was killed the year before.', null, 748, 332, 'building', null],
  ['five-phases-mountain', 'route', 'The Mountain of Five Phases', 'The border between Tang land and everywhere else, and the mountain a monkey has been pinned under for five hundred years with a paper seal on the summit.', null, 612, 310, 'landmark', null],
  ['eagle-grief-stream', 'route', 'Eagle Grief Stream', 'A gorge of fast dark water at the foot of Coiled Snake Mountain, where something in the river eats a horse whole.', null, 562, 292, 'landmark', 'eagle-grief-stream'],
  ['guanyin-monastery', 'route', 'The Guanyin Monastery', 'A rich house of two hundred and seventy monks whose abbot is two hundred and seventy years old and has seven hundred cassocks in his chests.', null, 534, 302, 'building', 'guanyin-monastery'],
  ['black-wind-mountain', 'route', 'Black Wind Mountain', 'The hill behind the burnt monastery, and the cave of a black bear who reads scripture, keeps a garden, and steals.', null, 514, 320, 'landmark', null],
  ['gao-village', 'route', 'Gao Village', 'A prosperous farm settlement whose youngest daughter has been married for three years to a son-in-law the family would pay to be rid of.', null, 879, 365, 'building', null],
  ['cloud-ladder-cave', 'route', 'Cloud Ladder Cave', 'The cave on Fuling Mountain that the son-in-law goes home to, and comes out of with a rake.', null, 498, 288, 'landmark', 'cloud-ladder-cave'],
  ['pagoda-mountain', 'route', 'Pagoda Mountain', 'A hill with a nest of woven grass in a fragrant juniper, where a Chan master lives above the ground and gives away the Heart Sutra.', null, 486, 266, 'landmark', null],
  ['yellow-wind-ridge', 'route', 'Yellow Wind Ridge', 'A ridge whose owner raises a wind out of the earth that blinds anything with eyes, including eyes that have been through a furnace.', null, 470, 296, 'landmark', null],
  ['flowing-sands-river', 'route', 'The Flowing-Sands River', 'Eight hundred li across and three thousand deep, where a goose feather sinks — and a monster with nine skulls on a string has eaten every traveller before this one.', null, 458, 380, 'landmark', null],
  ['four-saints-house', 'route', 'The House of the Four Beauties', 'A rich widow’s house that appears on an empty road, offers three daughters and a fortune, and is a bare wood again by morning.', null, 446, 348, 'building', null],
  ['wuzhuang-temple', 'route', 'Wuzhuang Temple', 'The Daoist house of the Great Immortal of Zhenyuan, built around one tree that fruits thirty times in ten thousand years.', null, 436, 324, 'building', 'wuzhuang-temple'],
  ['white-tiger-ridge', 'route', 'White Tiger Ridge', 'A bare stone ridge with nothing on it but a corpse-spirit who comes three times in three shapes, and the letter of dismissal written on a rock.', null, 428, 300, 'landmark', null],
  ['bowyue-cave', 'route', 'Bowyue Cave', 'A cave on Wanzi Mountain lit up like a temple, where a princess carried off thirteen years ago is tied to the soul-fixing post.', null, 418, 274, 'landmark', null],
  ['precious-elephant-kingdom', 'route', 'The Precious Elephant Kingdom', 'A court that has punished half its household for losing a daughter, and which welcomes the demon who took her as a handsome son-in-law.', null, 406, 252, 'city', null],
  ['pingding-mountain', 'route', 'Pingding Mountain', 'Six hundred li of mountain held by two kings with five treasures between them and a standing order to catch monks.', null, 396, 258, 'landmark', null],
  ['lotus-cave', 'route', 'The Lotus Cave', 'The stronghold of Gold Horn and Silver Horn: gourd, vase, sword, fan and belt, and two furnace-boys wearing them.', null, 388, 272, 'landmark', 'lotus-cave'],
  ['baolin-monastery', 'route', 'Baolin Monastery', 'A monastery that puts a travelling monk in the corridor to sleep, and is knelt to by five hundred of its own after a stone lion is broken.', null, 380, 300, 'building', null],
  ['wuji-kingdom', 'route', 'The Wuji Kingdom', 'A kingdom ruled for three years by the man who drowned its king in the palace well and put on his face.', null, 372, 318, 'city', null],
  ['roaring-mountain', 'route', 'Roaring Mountain', 'Six hundred li of mountain with a red cloud over it, and a child tied in a pine at the roadside crying about robbers.', null, 364, 336, 'landmark', null],
  ['fire-cloud-cave', 'route', 'Fire Cloud Cave', 'Red Boy’s house on Withered Pine Stream, where five carts stand by the five phases and the fire that comes out of them is not fire rain can touch.', null, 357, 350, 'landmark', 'fire-cloud-cave'],
  ['black-water-river', 'route', 'The Black Water River', 'A river of ink-dark water with a dugout on it that holds two, and a water palace underneath belonging to somebody else.', null, 348, 364, 'landmark', null],
  ['cart-slow-kingdom', 'route', 'The Cart-Slow Kingdom', 'A kingdom where five hundred monks haul brick up a cliff road for three Daoists who once brought the rain.', null, 340, 378, 'city', 'cart-slow-kingdom'],
  ['tongtian-river', 'route', 'The Heaven-Reaching River', 'Eight hundred li across, with a stone on the bank saying so, and a thing in it that takes a boy and a girl from the village every year.', null, 330, 396, 'landmark', 'river-that-reaches-heaven'],
  ['chen-village', 'route', 'Chen Village', 'A hundred households whose turn it is, and two brothers with one son and one daughter between them at sixty-three and fifty-eight.', null, 320, 410, 'building', null],
  ['jindou-mountain', 'route', 'Jindou Mountain', 'A mountain with towers in the valley that are not there, and a cave under them whose owner has a bracelet that swallows weapons.', null, 310, 424, 'landmark', null],
  ['mother-child-river', 'route', 'The Motherhood River', 'Clear water with a ferry on it rowed by a woman, which is drunk by two of the party before anyone asks what it does.', null, 333, 376, 'landmark', null],
  ['west-liang', 'route', 'The Women’s Kingdom of West Liang', 'A whole country with no men in it, a Male-Welcoming Post-house, and a queen who offers the realm in good faith.', null, 255, 399, 'city', null],
  ['jieyang-mountain', 'route', 'Jieyang Mountain', 'The hill above the Abortion Spring, held by an immortal who wants revenge for a nephew who is not dead.', null, 278, 437, 'landmark', null],
  ['pipa-cave', 'route', 'Pipa Cave', 'A cave in Poison Enemy Mountain with two trays of buns in it, and a sting that once went into the Buddha’s thumb.', null, 296, 424, 'landmark', null],
  ['seven-hundred-li-slope', 'route', 'The Long Slope', 'A stretch of road with thirty men across it, a tree to hang a monk from, and two graves by the end of the chapter.', null, 302, 410, 'landmark', null],
  ['yang-farm', 'route', 'The Yang Farm', 'An old man of seventy-four, his wife, his grandson, and the one son who is out on the road with the gang.', null, 308, 398, 'building', null],
  ['flaming-mountains', 'route', 'The Flaming Mountains', 'Eight hundred li of fire with no grass on it, sixty li from farms of red brick that can only sow when somebody borrows a fan.', null, 374, 281, 'landmark', null],
  ['plantain-cave', 'route', 'The Plantain Cave', 'Raksasi’s house on Emerald Cloud Mountain, and the only place in the world the fan that puts the fire out is kept.', null, 350, 264, 'landmark', null],
  ['thunder-heap-mountain', 'route', 'Thunder Heap Mountain', 'Where the Bull Demon King has been living for two years with a fox king’s daughter and a million in property.', null, 480, 230, 'landmark', null],
  ['jisai-kingdom', 'route', 'The Jisai Kingdom', 'A kingdom that four countries used to bring tribute to, until it rained blood on the pagoda and the light went out.', null, 330, 300, 'city', null],
  ['golden-light-monastery', 'route', 'The Golden Light Monastery', 'Thirteen storeys of pagoda, two generations of monks beaten to death for a theft they did not commit, and a third generation in cangues.', null, 322, 312, 'building', null],
  ['biboton-lake', 'route', 'Green Wave Pool', 'A pool in Random Rock Mountain with a dragon palace at the bottom of it and a nine-headed son-in-law living there.', null, 314, 326, 'landmark', null],
  ['thorn-ridge', 'route', 'Thorn Ridge', 'Eight hundred li of bramble with a path under it, a stele that says so, and a stone hut where four old trees write poetry.', null, 306, 340, 'region', null],
  ['little-thunderclap', 'route', 'The Little Thunderclap Monastery', 'A monastery that looks exactly like the end of the road and is signed with one extra character over the gate.', null, 180, 276, 'building', 'little-thunderclap-monastery'],
  ['tuoluo-village', 'route', 'Tuoluo Village', 'Five hundred households that have hired a monk and a Daoist to kill the thing on the road, and buried both of them.', null, 298, 354, 'building', null],
  ['seven-extremes-mountain', 'route', 'Seven Extremes Mountain', 'Eight hundred li of persimmon with seven virtues, and a lane under it filled with what the fruit turns into.', null, 290, 368, 'region', null],
  ['zhuzi-kingdom', 'route', 'The Purple Cinnabar Kingdom', 'A capital whose king has been ill for three years, with a proclamation under the drum tower asking for anyone who can cure him.', null, 282, 344, 'city', 'purple-cloud-kingdom'],
  ['qilin-mountain', 'route', 'Qilin Mountain', 'The mountain the Golden Queen was carried to, and the cave where three bells are kept on a cord at somebody’s belt.', null, 274, 330, 'landmark', null],
  ['pansi-cave', 'route', 'Pansi Cave', 'A farmstead with a kickball game in the yard, stone benches instead of rooms, and seven women who spin from the navel.', null, 266, 316, 'landmark', 'spider-web-cave'],
  ['yellow-flower-temple', 'route', 'The Yellow Flower Temple', 'A Daoist house with a couplet on the gate about elixirs, twelve dates on a tray, and a thousand eyes under the owner’s arms.', null, 258, 302, 'building', null],
  ['lion-camel-ridge', 'route', 'Lion Camel Ridge', 'Eight hundred li of mountain with forty-eight thousand demons on it under three kings, and a patroller with a flag and a bell.', null, 355, 306, 'landmark', null],
  ['lion-camel-city', 'route', 'Lion Camel City', 'A walled capital whose king and people were eaten five hundred years ago, and whose walls have carried black air ever since.', null, 346, 318, 'city', null],
  ['bhiksu-kingdom', 'route', 'The Bhiksu Kingdom', 'A capital the people have renamed Boy City, with a goose coop at every door and a child inside each one.', null, 248, 288, 'city', 'bhiksu-kingdom'],
  ['willow-slope', 'route', 'Willow Slope', 'A grove of willows with no farm in it, and a cave under the ninth-forked tree that opens when it is asked three times.', null, 240, 302, 'landmark', null],
  ['zhenhai-monastery', 'route', 'Zhenhai Monastery', 'Half a ruin and half new building, with the bandits’ half given away and a bell in the courtyard half sunk in moss.', null, 232, 316, 'building', null],
  ['black-pine-forest', 'route', 'The Black Pine Forest', 'A wood off the road with a woman roped to a tree in it, tied above the waist and buried below.', null, 224, 330, 'region', null],
  ['bottomless-cave', 'route', 'The Bottomless Cave', 'A boulder on Empty-Trap Mountain with a jar-mouth hole worn smooth in it, and three hundred li of country underneath.', null, 216, 336, 'landmark', null],
  ['dharma-kingdom', 'route', 'The Dharma-Respecting Kingdom', 'A kingdom four monks short of a vow to kill ten thousand of them, whose court all woke up bald on the same morning.', null, 208, 322, 'city', null],
  ['hidden-mist-mountain', 'route', 'Hidden Mist Mountain', 'A mountain with a wind and a fog on it and three ambushes in it, one for each disciple.', null, 200, 308, 'landmark', null],
  ['linked-ring-cave', 'route', 'The Linked Ring Cave', 'A cave in Broken Ridge with a flaying pavilion, a back garden with two men tied to trees, and a drain out to the stream.', null, 192, 294, 'landmark', null],
  ['fengxian', 'route', 'Fengxian Prefecture', 'A prefecture three years without rain, whose proclamation is being hung under the eaves as the party walks past.', null, 184, 308, 'city', null],
  ['yuhua', 'route', 'Yuhua County', 'A county of the Indian realm ruled by a prince of the blood, whose three sons all like fighting and want teachers.', null, 176, 322, 'city', null],
  ['leopard-head-mountain', 'route', 'Leopard Head Mountain', 'Seventy li from the county seat, with a cave in it whose owner saw three weapons glowing in a foundry yard.', null, 168, 334, 'landmark', null],
  ['bamboo-node-mountain', 'route', 'Bamboo Node Mountain', 'The grandsire’s mountain, with a nine-fold winding cave in it and six lions living there who call him grandfather.', null, 160, 320, 'landmark', null],
  ['jinping', 'route', 'Jinping Prefecture', 'A prefecture that burns forty-eight thousand taels of scented oil in three lamps on one night of the year.', null, 152, 306, 'city', null],
  ['green-dragon-mountain', 'route', 'Green Dragon Mountain', 'The mountain the lamp oil goes to, with the Mysterious Yin Cave in it and three rhinoceroses at the bottom.', null, 144, 292, 'landmark', null],
  ['jetavana-monastery', 'route', 'The Gold-Spread Monastery', 'The Jetavana: ground once bought by covering it in gold bricks, which still washes up gold and silver beads after heavy rain.', null, 136, 306, 'building', null],
  ['tianzhu-capital', 'route', 'The Capital of India', 'A city with a tower in the crossroads and a princess on top of it choosing a husband by throwing a ball into the crowd.', null, 128, 320, 'city', null],
  ['tongtai', 'route', 'Tongtai Prefecture', 'A prefecture with a tiger-seated gate in it, and a board over the gate saying no monk is ever turned away.', null, 120, 332, 'city', null],
  ['huaguang-shrine', 'route', 'The Huaguang Shrine', 'A collapsed archway fifty li past the city, with no caretaker, no roof worth the name, and rain all night.', null, 112, 320, 'building', null],
  ['jade-truth-temple', 'route', 'The Jade Truth Temple', 'The Daoist house at the foot of the mountain, whose immortal was told to expect them ten years ago and has watched the road since.', null, 110, 292, 'building', null],
  ['cloud-reaching-ford', 'route', 'The Cloud-Reaching Ford', 'Eight or nine li of fast water with one round log laid across it, and a ferryman poling a boat that has no bottom.', null, 126, 282, 'landmark', null],
  ['vulture-peak-gate', 'route', 'Vulture Peak', 'The end of the road: the mountain of the Buddha, with the Thunderclap Monastery on the top of it.', 'vulture-peak', 102, 310, 'landmark', null],

  // ---- Places off the painted road --------------------------------------
  /*
    The route painting does not label these. Each is pinned to the drawn road
    between the two features that bracket it in the text, or — for the four
    that are nowhere near it — to plausible unlabelled terrain, and SOURCES.md
    lists every one of them as an approximation rather than a reading of the
    artwork.
  */
  ['subhuti-cave', 'route', 'The Cave of the Slanting Moon and Three Stars', 'Subhuti’s house on the Mountain of Mind and Heart, somewhere in the Western Continent, where a monkey spends twenty years learning the two things that make the rest of the book possible.', null, 48, 215, 'landmark', null],
  ['jing-river', 'route', 'The Jing River', 'The water outside the capital whose dragon king wagers on tomorrow’s rainfall, alters the edict by an hour and two inches, and loses his head over a chessboard.', null, 720, 285, 'landmark', null],
  ['hong-river-ford', 'route', 'The Hong River Ford', 'The crossing on the road to Jiangzhou where two boatmen take a new prefect’s clothes, his commission and his wife, and where they are cut down eighteen years later.', null, 700, 305, 'landmark', null],
  ['jinshan-temple', 'route', 'The Jinshan Temple', 'The monastery downstream that takes in a plank with a child on it, keeps the blood letter, and raises him without telling him.', null, 686, 322, 'building', null],
  ['six-brigands-road', 'route', 'Where the Six Thieves Stopped Them', 'A stretch of road past the frontier where six robbers give their own names as Sight, Hearing, Smell, Taste, Mind and Body.', null, 590, 344, 'landmark', null],
  ['sanqing-abbey', 'route', 'The Abbey of the Three Pure Ones', 'The Daoists’ own house in the capital, with three statues on the high altar and offerings laid out in front of them overnight.', null, 336, 388, 'building', null],
  ['tongtian-river-palace', 'route', 'The Water Palace Under the River', 'The hall at the bottom of the Heaven-Reaching River, with a stone chest behind it that is the size and shape of a coffin.', null, 325, 404, 'landmark', null],
  ['wooden-immortal-hermitage', 'route', 'The Wooden Immortals’ Hermitage', 'A stone hut past the brambles where four old gentlemen keep a brazier, a pot of tea and a night of linked verse ready for anyone who can answer them.', null, 300, 332, 'building', null],
  ['zhuogou-spring', 'route', 'The Cleansing Spring', 'A natural hot spring in a stone basin with a three-room pavilion built over it, taken from the seven immortal maidens who used to bathe there.', null, 262, 322, 'landmark', null],
  ['lion-camel-cave', 'route', 'The Lion Camel Cave', 'The three kings’ own house: a steaming pit, a back pond for loosening bristles, and a two-foot vase that takes thirty-six demons to carry.', null, 350, 312, 'landmark', null],
  ['tiger-mouth-cave', 'route', 'Tiger Mouth Cave', 'The cave under Leopard Head Mountain where a stolen rake is set up on the middle table like an altar-piece and the guests are told they may look at it.', null, 162, 340, 'landmark', null],
  ['nine-fold-cave', 'route', 'The Nine-Fold Winding Cave', 'The grandsire’s hall inside Bamboo Node Mountain, where prisoners are beaten with willow switches until the switches break.', null, 154, 328, 'landmark', null],
  ['mysterious-yin-cave', 'route', 'The Mysterious Yin Cave', 'A cave in Green Dragon Mountain hung with three banners — Cold-Avoiding, Heat-Avoiding, Dust-Avoiding — and stacked with stolen lamp oil.', null, 148, 284, 'landmark', null],
  ['golden-lamp-bridge', 'route', 'The Golden Lamp Bridge', 'The bridge the three great lamp-vats stand on, where the whole prefecture waits on the fifteenth night for the Buddhas to come down and drink the oil.', null, 156, 298, 'landmark', null],
  ['kou-mansion', 'route', 'The Kou Mansion', 'A rich house with a board on the gate saying no monk is turned away, a ledger of nine thousand nine hundred and ninety-six of them, and a send-off that tells the whole city which house to rob.', null, 114, 306, 'building', null],

  ['sun-drying-rock', 'route', 'The Scripture-Drying Rock', 'The boulder on the eastern bank the wet canon is laid out on, and where the last scroll of one sutra sticks and tears.', null, 336, 402, 'landmark', null],

  // ---- Chang'an ---------------------------------------------------------
  ['changan-assembly-temple', 'changan', 'The Assembly Temple', 'Where the Grand Mass for the Dead is held and the pilgrim is chosen out of twelve hundred monks.', null, 662, 380, 'building', null],
  ['changan-daming-palace', 'changan', 'The Daming Palace', 'The Tang court: where the rescript is written, where the emperor comes back from the dead, and where the scriptures are handed over.', null, 736, 122, 'building', null],
  ['changan-east-market', 'changan', 'The East Market', 'The market where a fortune-teller who never misses keeps a stall, and where a fisherman is told exactly where to cast.', null, 432, 246, 'landmark', null],
  ['changan-west-market', 'changan', 'The West Market', 'The other market, and the ward the assembly’s two shabby travelling monks walk their cassock and staff through.', null, 470, 378, 'landmark', null],
  ['changan-west-gate', 'changan', 'The West Gate', 'The gate the party leaves by, and the point the whole city rides out to when they come back.', null, 250, 452, 'landmark', null],
  ['changan-departure-point', 'changan', 'The Pilgrims’ Departure Point', 'The stretch of road outside the west wall where an emperor pours a cup of wine and drops a pinch of dust into it.', null, 130, 380, 'landmark', null],
  ['changan-hongfu', 'changan', 'Hongfu Temple', 'The pilgrim’s own house, whose pines were told to turn their heads east on the day he was coming back.', null, 560, 300, 'building', null],
  ['changan-wild-goose-pagoda', 'changan', 'The Wild Goose Pagoda', 'The clean temple chosen for the reading, where a high platform is built and the first scroll is opened.', null, 830, 300, 'building', null],

  // ---- Vulture Peak -----------------------------------------------------
  ['lingjiu-mountain', 'vulture-peak', 'Lingjiu Mountain', 'The mountain itself, shaped like the bird it is named for, with the stairs cut up the side of it.', null, 470, 180, 'landmark', null],
  ['thunderclap-monastery', 'vulture-peak', 'The Thunderclap Monastery', 'The Buddha’s own house, with four vajras on the gate and three ranks of doorkeepers behind them.', null, 640, 190, 'building', null],
  ['scripture-hall', 'vulture-peak', 'The Scripture Hall', 'The treasure loft where the canon is kept in labelled cases, and where two servants ask what present has been brought.', null, 748, 148, 'building', null],
  ['great-hall', 'vulture-peak', 'The Great Hall', 'Where the Buddha sits on the nine-grade lotus and weighs what the eastern continent can be trusted with.', null, 618, 234, 'building', null],
  ['cloud-ferry', 'vulture-peak', 'The Cloud-Reaching Ferry', 'The water below the stairs, the single log across it, and the bottomless boat that is poled up to the bank.', null, 460, 372, 'landmark', null],

  // ---- Flower-Fruit Mountain -------------------------------------------
  ['ffm-main-peak', 'ffm', 'The Main Peak', 'The highest point of the island, where an immortal stone stood long enough to be worked on by heaven and earth.', null, 726, 60, 'landmark', null],
  ['ffm-waterfall', 'ffm', 'The Great Waterfall', 'The fall the troop follows the stream up to, and the curtain of water anybody who wants to be king has to go through.', null, 425, 200, 'landmark', null],
  ['ffm-iron-bridge', 'ffm', 'The Iron Bridge', 'The plank bridge behind the water, which is what the first monkey through finds instead of a drop.', null, 556, 380, 'landmark', null],
  ['ffm-water-curtain-cave', 'ffm', 'The Water-Curtain Cave', 'The stone house behind the fall, with its tablet, its furniture, and room for a whole nation of monkeys.', null, 740, 388, 'building', null],
  ['ffm-dining-hall', 'ffm', 'The Cave’s Dining Hall', 'The stone tables the feasts are held at, including the one where a king of three hundred years starts crying.', null, 820, 425, 'building', null],
  ['ffm-meeting-hall', 'ffm', 'The Cave’s Meeting Hall', 'Where the troop is counted, the plans are made, and forty-seven thousand of them are drilled into an army.', null, 820, 518, 'building', null],
  ['ffm-training-ground', 'ffm', 'The Cave’s Training Floor', 'The stone yard the stolen armoury is issued from, and where the cudgel is first swung indoors.', null, 930, 520, 'building', null],
  ['ffm-encampment', 'ffm', 'The Monkey Encampment', 'The huts, the drill ground and the banner pole below the fall — burnt out once, rebuilt, and burnt out again.', null, 300, 375, 'region', null],
  ['water-belly-cave', 'ffm', 'The Water-Belly Cave', 'The Demon King of Havoc’s hole north of the island, where the troop’s young are kept and the stolen gear is stacked against the wall.', null, 120, 176, 'landmark', null],
  ['ffm-beach', 'ffm', 'The Beach of Arrival', 'The shore the raft is built on and pushed off from, and the sand it is dragged back onto years later.', null, 175, 440, 'landmark', null],

  // ---- The Celestial Court ---------------------------------------------
  ['heaven-south-gate', 'heaven', 'The Southern Gate', 'The way in, held by four great generals, where a new appointment is stopped and asked for his warrant.', null, 512, 130, 'landmark', null],
  ['celestial-hall', 'heaven', 'The Hall of Miraculous Mist', 'The throne hall of the Jade Emperor, where petitions are read, titles are invented, and one guest will not be put out of the doorway.', null, 668, 200, 'building', null],
  ['celestial-stables', 'heaven', 'The Heavenly Stables', 'The office of the Bimawen: a thousand horses of heaven, kept fat for half a month by somebody nobody told the rank of.', null, 335, 400, 'building', null],
  ['celestial-pastures', 'heaven', 'The Heavenly Pastures', 'The grazing the horses are taken out to, and the ground a table gets overturned on when the truth about the post comes out.', null, 220, 340, 'region', null],
  ['peach-garden', 'heaven', 'The Peach Garden', 'Three thousand six hundred trees in three ranks, ripening at three thousand, six thousand and nine thousand years.', null, 430, 300, 'region', null],
  ['yaochi-palace', 'heaven', 'The Palace of the Jasper Pool', 'The Queen Mother’s hall, laid for the Peach Banquet, and drunk dry before a single invited guest arrives.', null, 900, 190, 'building', null],
  ['jasper-pool', 'heaven', 'The Jasper Pool', 'The lake the palace stands over, and the water the maidens are sent to pick fruit beside.', null, 905, 320, 'landmark', null],
  ['tushita-palace', 'heaven', 'Tushita Palace', 'Laozi’s house at the top of the thirty-third heaven, with the elixir gourds on a shelf and an ox in the stall outside.', null, 640, 430, 'building', null],
  ['tushita-furnace', 'heaven', 'The Eight-Trigram Furnace', 'The crucible the elixir is cooked in, which has a wind corner in it and no fire, and which is kicked over on the forty-ninth day.', null, 662, 470, 'landmark', null],
  ['heaven-potalaka-annexe', 'heaven', 'The Potalaka Annexe', 'Guanyin’s quarter of the heavenly estate, and where she is coming from when she finds the banquet spoiled.', null, 120, 460, 'building', null],
  ['cloud-tower-palace', 'heaven', 'The Cloud Tower Palace', 'Li Jing’s residence in the heavens, where a lawsuit is answered by tying up the plaintiff, and where a father keeps a pagoda he is afraid to put down.', null, 922, 220, 'building', null],
  ['celestial-execution-ground', 'heaven', 'The Execution Ground', 'The demon-subduing pillar and everything tried against it: sword, axe, spear, fire, thunder, and no mark on him.', null, 330, 200, 'landmark', null],

  // ---- The Dragon Palace ------------------------------------------------
  ['dragon-palace-crystal', 'dragon-palace', 'The Crystal Palace', 'The hall the sea road comes up into, where a visitor is served tea before anyone finds out what he wants.', null, 200, 210, 'building', null],
  ['dragon-palace-throne', 'dragon-palace', 'The Throne of the Dragon King', 'Where Ao Guang sits, and where he sends for his three brothers rather than argue about a suit of armour.', null, 300, 150, 'building', null],
  ['dragon-palace-armoury', 'dragon-palace', 'The Armoury', 'The weapon store: a nine-pronged fork of three thousand six hundred catties, a halberd of seven thousand two hundred, and nothing heavy enough.', null, 630, 130, 'building', null],
  ['dragon-palace-pillar', 'dragon-palace', 'The Sea-Gauging Pillar', 'The iron measuring rod that sets the depth of the seas, which lights up when the right person walks past it.', null, 900, 430, 'landmark', null],
  ['dragon-palace-ocean-court', 'dragon-palace', 'The Ocean Court', 'The open floor between the halls, and the width of it needed to swing thirteen thousand five hundred catties for the first time.', null, 440, 340, 'region', null],

  // ---- The Underworld ---------------------------------------------------
  ['underworld-gate', 'underworld', 'The Gate of Ghosts', 'The entrance, where two summoners with a rope discover that the soul on the end of it has a bar of iron.', null, 218, 160, 'landmark', null],
  ['underworld-bridge', 'underworld', 'The Bridge of No Alternative', 'The crossing over the River of Despair, which an emperor is walked over and shown what is under it.', null, 352, 240, 'landmark', null],
  ['underworld-river', 'underworld', 'The River of Despair', 'The water below the bridge, and what is in it, which is the part of the tour nobody is spared.', null, 500, 190, 'landmark', null],
  ['underworld-hall-of-judgment', 'underworld', 'The Hall of Judgment', 'Where the Ten Kings sit together, and where two visitors in one lifetime each get a different answer.', null, 520, 336, 'building', null],
  ['underworld-register', 'underworld', 'The Register of Life and Death', 'The book with everything alive written in it, kept where a judge can reach it and a brush is left lying beside it.', null, 848, 130, 'landmark', null],
  ['underworld-city-of-the-wronged', 'underworld', 'The City of the Wrongly Dead', 'The place the tour does not skip: everyone who died before their time and is owed something by somebody upstairs.', null, 367, 292, 'region', null],
  ['underworld-hells', 'underworld', 'The Eighteen Hells', 'The mountain of knives, the sea of fire and the ice, drawn along the bottom of the sheet as a row of doors.', null, 300, 470, 'region', null],
  ['cuiyun-palace', 'underworld', 'The Halls of Ksitigarbha', 'Where the ledger of good deeds is kept, and where a man who fed ten thousand monks is given a desk rather than a punishment.', null, 118, 120, 'building', null],
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
  // The four, and the horse
  ['wukong', 'Sun Wukong', ['The Handsome Monkey King', 'Great Sage Equal to Heaven', 'Pilgrim Sun'], 'A stone monkey who learned immortality, fought Heaven to a standstill, and spends the rest of the book being right about people his master will not suspect.', '#c9803a', 'sun-wukong'],
  ['tripitaka', 'Tripitaka', ['Chen Xuanzang', 'The Tang Monk', 'River Float'], 'The pilgrim: a monk of enormous constancy and no discernment at all, who cannot be frightened out of the road and cannot be taught to distrust a woman crying by it.', '#b8912f', 'tripitaka'],
  ['zhu-bajie', 'Zhu Bajie', ['Zhu Wuneng', 'The Marshal of the Heavenly Reeds'], 'A former marshal of Heaven born into a sow, who carries the luggage, eats everything, proposes selling the horse whenever things go badly, and is braver than he admits.', '#8f5a4a', 'zhu-bajie'],
  ['sha-wujing', 'Sha Wujing', ['Sha Monk', 'The Curtain-Raising General'], 'The third disciple: a river demon who wore a string of skulls, and who from the day he joins says the sensible thing and is the last one anybody listens to.', '#5a6e78', 'sha-wujing'],
  ['white-dragon-horse', 'The White Dragon Horse', ['Third Prince of the West Sea'], 'A dragon prince under sentence of death, made into a horse — who carries the monk west and the scriptures east, and gets off the road exactly once.', '#c8c3ba', 'white-dragon-horse'],
  // Heaven and the Buddhist orders
  ['buddha', 'The Buddha', ['Tathagata', 'Sakyamuni'], 'The one power in the book that is never beaten, whose interventions are all arguments rather than fights, and who declines to be thanked for any of them.', '#c2a14e', 'buddha'],
  ['guanyin', 'Guanyin', ['The Bodhisattva of Compassion'], 'The organiser of the whole journey, who recruits every member of the party, is called on more than anyone, and keeps the fillet spell in reserve.', '#6f9ab0', 'guanyin'],
  ['jade-emperor', 'The Jade Emperor', [], 'The sovereign of Heaven, whose instinct in a crisis is to offer a title, and who sends for the Buddha when that stops working.', '#9a8452', 'jade-emperor'],
  ['laozi', 'Laozi', ['The Supreme Patriarch'], 'The maker of the elixir and of half the objects that beat the monkey, most of which turn out to have been stolen from his own shelves by his own staff.', '#8a8f7a', 'laozi'],
  ['taibai', 'Taibai Jinxing', ['The Gold Star of Venus'], 'Heaven’s diplomat, who twice argues for a title instead of an army, and who later comes down the road in disguise to warn the party about a mountain.', '#b5ac8e', 'taibai-jinxing'],
  ['moksa', 'Moksa', ['Hui’an', 'The Second Prince'], 'Guanyin’s disciple and Li Jing’s second son, sent ahead on most of her errands and beaten by the monkey on one of them.', '#7e8a6a', 'moksa'],
  ['maitreya', 'Maitreya', ['The Laughing Buddha'], 'The Buddha of the age to come, who turns up in a melon field to collect a boy who stole his bag and his bell-hammer.', '#c19a5a', 'maitreya'],
  ['lingji', 'Lingji', [], 'A bodhisattva of Little Sumeru who keeps two things the Buddha left with him, and gives away both of them to the same monkey.', '#7f7fa0', 'lingji-bodhisattva'],
  ['subhuti', 'Subhuti', ['The Patriarch'], 'The master on the Mountain of Mind and Heart who gives the monkey a name, the transformations and the cloud — and forbids him ever to say who taught him.', '#7a7060', null],
  ['nezha', 'Nezha', ['The Third Prince'], 'A boy general with six arms and six weapons, who fights the monkey, loses, and turns up on the same side for the rest of the book.', '#b4585e', null],
  ['li-jing', 'Li Jing', ['The Pagoda-Bearing Heavenly King'], 'Commander of the heavenly host and Nezha’s father, who carries a pagoda because he is afraid of his own son.', '#7d6a52', null],
  ['erlang', 'Erlang', ['The True Lord of Guanjiangkou'], 'The Jade Emperor’s nephew, who answers summonses and not orders, and the only being who ever beats the monkey in a fair contest.', '#5f8a6f', null],
  ['queen-mother', 'The Queen Mother of the West', [], 'The owner of the peach garden and the host of the banquet, whose invitation list is the reason Heaven is wrecked.', '#a06f8a', null],
  ['manjusri', 'Manjusri', [], 'A bodhisattva whose blue lion causes two separate disasters, and who once spent three days at the bottom of a palace moat.', '#6a7fa8', null],
  ['samantabhadra', 'Samantabhadra', [], 'A bodhisattva whose white elephant is the second of the three kings of Lion Camel Ridge.', '#8a9a7a', null],
  ['dizang', 'Ksitigarbha', [], 'The bodhisattva of the underworld, who keeps a beast that hears through every realm and a ledger of good deeds.', '#6b6458', null],
  ['pilanpo', 'Vairambha', [], 'An old woman who has not left her cave in three hundred years, whose only weapon is a needle forged in her son’s eye.', '#9a8f6a', null],
  ['shouxing', 'The Old Man of the South Pole', [], 'A star lord whose white deer goes missing during a game of chess and turns up ruling a kingdom by way of its medicine.', '#b0a37e', null],
  ['taiyin', 'The Star Lord of the Moon', [], 'The keeper of the Broad Cold Palace, who comes down to stop a cudgel falling on a hare that pounds elixir.', '#8f9ab5', null],
  ['star-lord-mao', 'The Star Lord of the Pleiades', [], 'One of the twenty-eight lodges, whose true shape is a double-combed cock, and whose crowing kills scorpions.', '#c2a06a', null],
  ['taiyi-jiuku', 'The Heavenly Honoured One Who Relieves Suffering', [], 'The lord of the Wonderful Cliff Palace, whose nine-headed lion is stolen from under a keeper who drank the wrong bottle.', '#7a86a0', null],
  ['zhenwu', 'Zhenwu', ['The Demon-Quelling Heavenly Honoured One'], 'The lord of Wudang, who will not move without an edict and lends the turtle, the snake and five dragons instead.', '#5f6a78', null],
  ['guoshiwang', 'The King-Preceptor Bodhisattva', [], 'The holder of Sizhou, who cannot leave the Huai in flood and sends a prince and four generals in his place.', '#7f8a72', null],
  ['lishan-laomu', 'The Old Dame of Mount Li', [], 'One of the four who tested the party with a house and three daughters, and who later comes down the road as a widow to name a demon.', '#9a7f8a', null],
  ['zhang-boduan', 'Zhang Boduan', [], 'An immortal who protects a queen with an old raincoat and comes back three years later to take it off again.', '#7a8a8f', null],
  ['ananda', 'Ananda', [], 'One of the two servants at the scripture loft, who asks what present has been brought and hands over blank paper when the answer is none.', '#a8996a', null],
  ['kasyapa', 'Kasyapa', [], 'The other, who checks the scrolls out one at a time and takes the alms bowl on the second visit.', '#9e9270', null],
  ['jieyin', 'The Buddha Who Leads Across', [], 'The ferryman at the last crossing, whose boat has no bottom and does not need one.', '#b7ac86', null],
  ['golden-topped-immortal', 'The Great Immortal of the Golden Head', [], 'The keeper of the Jade Truth Temple, who was told ten years ago to expect them within three, and has watched the road ever since.', '#8a8462', null],
  // The Tang court
  ['taizong', 'Emperor Taizong', [], 'The Tang emperor who promises to save a dragon, fails, dies for three days, comes back with a debt, and sends a monk west to pay it.', '#9c6a4a', 'emperor-taizong'],
  ['wei-zheng', 'Wei Zheng', [], 'The minister who beheads a dragon in his sleep in the middle of a game of chess with the man who was guarding him.', '#7a6f5a', null],
  ['cui-jue', 'Judge Cui', [], 'The underworld clerk who owes his post to a dead minister, and who adds two strokes to a number in the Register of Life and Death.', '#6f6858', null],
  ['jing-dragon', 'The Dragon King of the Jing River', [], 'A dragon who cheats a rainfall by a few drops to win a bet with a fortune-teller, and loses his head over it.', '#5a7a86', null],
  ['chen-guangrui', 'Chen Guangrui', [], 'A scholar who takes first place, buys a fish and puts it back, and is murdered at a river crossing on the way to his post.', '#8a7a62', null],
  ['yin-wenjiao', 'Lady Yin', [], 'The chief minister’s daughter who throws the ball, loses her husband at a ford, and keeps a child alive by putting it in the river.', '#a8808a', null],
  ['liu-hong', 'Liu Hong', [], 'A boatman who takes a murdered man’s clothes, his commission, his post and his wife, and holds all four for eighteen years.', '#6a5f52', null],
  // Along the road
  ['liu-boqin', 'Liu Boqin', ['The Guardian of the Mountain'], 'A hunter on the Tang border who can carry a tiger home over his shoulder, and who cannot walk one step past the mountain.', '#8f7a5a', null],
  ['squire-gao', 'Squire Gao', [], 'A farmer with three daughters and one son-in-law he would pay to be rid of, who is startled to be offered a straight swap.', '#a08a62', 'squire-gao'],
  ['crow-nest', 'The Crow’s Nest Chan Master', [], 'A master who lives in a woven nest in a juniper, gives away the Heart Sutra, and will not answer a direct question about the road.', '#7f8a6f', null],
  ['black-bear', 'The Black Bear Spirit', [], 'A bear who reads scripture, keeps a garden, holds literary parties, and steals a cassock out of a fire that is not his.', '#4f4a44', null],
  ['guanyin-abbot', 'The Abbot of the Guanyin Monastery', [], 'Two hundred and seventy years old, with seven hundred cassocks in his chests and nothing in them he cannot bear to lose.', '#8a8272', null],
  ['yellow-wind-demon', 'The Yellow Wind Great King', [], 'A rat that heard sermons at Vulture Peak, stole the lamp oil and came down here, bringing a wind that blinds anything with eyes.', '#b39a52', 'yellow-wind-demon'],
  ['zhenyuan', 'The Great Immortal of Zhenyuan', [], 'The oldest Daoist in the book, who owns the one tree the world grew, and who ends a four-day argument by swearing brotherhood with the man who wrecked it.', '#7a8a6a', 'zhenyuan'],
  ['qingfeng', 'Clear Wind and Bright Moon', [], 'The two boys left in charge of the orchard, who count the fruit, hand out two, and are still counting when the tree comes down.', '#8f9a7a', null],
  ['white-bone-demon', 'The White Bone Lady', [], 'A corpse-spirit who comes three times in three shapes, is killed three times, and gets the party broken up on her third try.', '#b0aca0', null],
  ['yellow-robe-monster', 'The Yellow Robe Monster', ['Kui Wood Wolf'], 'A lodge of Heaven absent four roll-calls, living as a demon lord with a princess he carried off from a moon-viewing.', '#a58a4a', null],
  ['baihuaxiu', 'Princess Baihuaxiu', [], 'A king’s third daughter, carried off thirteen years ago, who buys her way out with a letter and is nearly executed for it.', '#b08a9a', null],
  ['gold-and-silver-horn', 'Gold Horn and Silver Horn', [], 'Two furnace-boys from Tushita with five of Laozi’s treasures between them, lent out three times over to see whether the party means it.', '#c2a45a', 'gold-and-silver-horn'],
  ['wuji-king', 'The King of Wuji', [], 'A king pushed down his own well by a guest he had entertained for two years, and left there for three more.', '#8a7a6a', null],
  ['wuji-prince', 'The Prince of Wuji', [], 'A boy who rides out to hunt, shoots at a white hare, and is asked to go home and put one question to his mother.', '#9a8a6a', null],
  ['wuji-queen', 'The Queen of Wuji', [], 'A woman who has known for three years that the man in her bed is not her husband, and has had nobody to tell.', '#a08a92', null],
  ['blue-lion-impostor', 'The Full-Truth Daoist', [], 'The rainmaker who took a king’s face and his throne, and who turns out to have been sent, and to have been gelded first.', '#6f7a8f', null],
  ['red-boy', 'Red Boy', ['The Sagely Boy King', 'Sudhana'], 'The Bull Demon King’s son, three hundred years in the Fiery Mountains learning a fire that rain does not touch, and a bodhisattva’s attendant by the end of it.', '#c2564a', 'red-boy'],
  ['bull-demon-king', 'The Bull Demon King', [], 'The monkey’s sworn elder brother from five hundred years ago, now a father, a husband, a second husband, and the last thing standing between the road and the fire.', '#5f4f42', 'bull-demon-king'],
  ['raksasi', 'Raksasi', ['Princess Iron Fan'], 'Red Boy’s mother and the owner of the only fan that puts out the Flaming Mountains, who blames the monkey for a son who is not dead.', '#b0566a', 'princess-iron-fan'],
  ['jade-face-princess', 'The Jade-Face Princess', [], 'A fox king’s daughter with a million in property, who bought a husband two years ago and has kept him since.', '#c08a9a', null],
  ['ruyi-immortal', 'The As-You-Will Immortal', [], 'The Bull Demon King’s brother, who holds the only spring that undoes the Motherhood River and wants revenge instead of an offering.', '#7a8a72', null],
  ['tuolong', 'The Alligator Dragon', [], 'The ninth son of the beheaded Jing River dragon, given a river to grow up in and using it to steam a monk for his uncle’s birthday.', '#4f6a72', null],
  ['aoguang', 'Ao Guang', ['Dragon King of the Eastern Sea'], 'The owner of the pillar that gauges the sea, who loses it, and who is called on for rain and errands for the rest of the book.', '#4f7a8a', null],
  ['aoshun', 'Ao Shun', ['Dragon King of the Western Sea'], 'The uncle who took in his sister’s ninth son, and who sends his own heir to arrest him.', '#5a7f8f', null],
  ['moang', 'Prince Moang', [], 'Ao Shun’s heir, who takes five hundred troops to bring in his own cousin and does it without killing him.', '#6a8a96', null],
  ['three-daoist-immortals', 'Tiger Power, Deer Power and Goat Power', [], 'Three court preceptors who brought the rain twenty years ago and have owned the kingdom’s monks ever since.', '#8a7a5f', null],
  ['great-king-of-miraculous-response', 'The Great King of Miraculous Response', [], 'A goldfish from a lotus pond that grew on sermons, and which takes a boy and a girl from the village every year for the rain.', '#b58a4a', null],
  ['mandarin-fish-crone', 'The Mandarin-Fish Crone', [], 'The one in the water palace who works out that the river can be frozen, and who is right about everything except the monkey.', '#7f8a7a', null],
  ['chen-cheng', 'Chen Cheng', [], 'The elder Chen brother, sixty-three, with one daughter got at fifty and weighed at thirty catties of gold.', '#8f7f62', null],
  ['chen-qing', 'Chen Qing', [], 'The younger, fifty-eight, with one son got at the shrine of Lord Guan and named for the debt.', '#89795e', null],
  ['old-turtle', 'The Old Turtle', [], 'A soft-shelled turtle who lost his house to a fish, got it back, and asks one question in payment that nobody remembers to put.', '#6f7a6a', null],
  ['single-horn-rhinoceros-king', 'The Single-Horned Rhinoceros King', [], 'Laozi’s green ox in a stolen bracelet, who takes every weapon in Heaven off everyone who brings one.', '#5f6a5a', null],
  ['scorpion-demon', 'The Scorpion Spirit', [], 'A scorpion of Pipa Cave with a sting that once went into the Buddha’s own thumb, and who wants a husband rather than a meal.', '#a06a72', null],
  ['west-liang-queen', 'The Queen of West Liang', [], 'The sovereign of a country with no men in it, who offers a kingdom in good faith to a man who cannot take it.', '#b57f8a', null],
  ['six-eared-macaque', 'The Six-Eared Macaque', [], 'One of four monkeys outside the ten kinds, who hears every word spoken within a thousand li — and who is, in every other way, indistinguishable.', '#c9803a', null],
  ['sai-tai-sui', 'Sai Tai Sui', [], 'Guanyin’s golden-haired hou, off its chain, holding a queen it has not touched and three bells it should not have.', '#c2a052', null],
  ['golden-queen', 'The Golden Queen', [], 'The senior consort of Purple Cinnabar, carried off at the Double Fifth and kept three years inside a coat of needles.', '#b58a9a', null],
  ['zhuzi-king', 'The King of Purple Cinnabar', [], 'A king who swallowed a rice dumpling in terror three years ago and has not been well since, and who kept the reason to himself.', '#9a7a5a', null],
  ['you-lai-you-qu', 'Come-and-Go', [], 'A courier with a gong, a flag and a declaration of war, who says out loud on an empty road that Heaven will not stand for what his king is doing.', '#7f7a62', null],
  ['seven-spider-women', 'The Seven Spider Women', [], 'Seven sisters who own a hot spring, spin silk from the navel, and adopted the insects they caught in it.', '#8a6f8f', 'seven-spider-spirits'],
  ['hundred-eyed-demon', 'The Hundred-Eyed Lord', [], 'A centipede in a Daoist’s robes with a thousand eyes down both sides of him, and a poison that takes three days to finish.', '#6a6a52', null],
  ['blue-lion-demon', 'The Blue-Haired Lion King', [], 'The first king of Lion Camel Ridge, who once swallowed a hundred thousand heavenly troops in a mouthful, and cannot swallow one monkey.', '#5f6f8a', null],
  ['yellow-tusk-elephant', 'The Yellow-Tusked White Elephant', [], 'The second king, whose trunk takes a man round the middle — and, once, everything but his hands.', '#9a9a92', null],
  ['roc-demon', 'The Great Roc of Ten Thousand Li', [], 'The third king: gold-winged, faster than a somersault cloud, and the Buddha’s own kin, which is the only reason he is still alive.', '#8a7a52', null],
  ['xiao-zuanfeng', 'Little Drill-Wind', [], 'A patroller with a clapper and a bell, chanting a warning about a monkey who can turn into a fly, to a monkey who has.', '#7a7062', null],
  ['bhiksu-king', 'The King of Bhiksu', [], 'A king three years into a marriage he cannot survive, who has been told what will cure him and has ordered it.', '#8a7462', null],
  ['national-preceptor', 'The State Preceptor', [], 'The old Daoist who supplied the girl and the prescription, and who is the Old Man of the South Pole’s white deer.', '#9a8a72', null],
  ['fox-beauty', 'The Beauty of Bhiksu', [], 'Sixteen years old, given to a king three years ago by the man who calls himself her father, and a white-faced fox under it.', '#b08a92', null],
  ['gold-nosed-mouse', 'Lady Earth-Gusher', ['The Gold-Nosed White-Haired Mouse Spirit', 'Half-Guanyin'], 'A mouse who stole the Buddha’s incense three hundred years ago, was spared, and set up tablets to the two who spared her.', '#a89a8a', null],
  ['dharma-destroying-king', 'The King of Dharma-Respecting', [], 'A king four monks short of a vow to kill ten thousand, who wakes one morning with no hair and changes his mind about everything.', '#8a7a6a', null],
  ['south-mountain-great-king', 'The Great King of the Southern Mountain', [], 'A leopard with a plan borrowed from a refugee of Lion Camel Ridge, who divides the party three ways and takes the man in the middle.', '#9a8262', null],
  ['woodcutter', 'The Woodcutter of Hidden Mist', [], 'A man tied to the tree opposite, three days without food, whose whole objection to dying is his mother.', '#7f7258', null],
  ['shangguan-prefect', 'Prefect Shangguan', [], 'The governor of a prefecture three years without rain, who has known the whole time that it was his own doing.', '#8a7f6a', null],
  ['yuhua-king', 'The Prince of Yuhua', [], 'A prince of the Indian blood who keeps his county quiet, and whose three sons want to learn to fight.', '#8f7a5f', null],
  ['yuhua-princes', 'The Three Princes of Yuhua', [], 'Three boys who cannot lift the weapons they admire, and who are given the strength for it by having it breathed into them.', '#a08f6a', null],
  ['yellow-lion-demon', 'The Yellow Lion Spirit', [], 'A lion who saw three weapons glowing in a foundry yard seventy li away, and carried all three home in one armful.', '#c2a05a', null],
  ['nine-headed-lion', 'The Nine-Spirit Primal Sage', [], 'A nine-headed lion who can take six people in six mouths at once, and who is somebody’s mount and knows it.', '#8a7f5f', 'nine-headed-lion-b'],
  ['three-rhinoceros-demons', 'The Three Rhinoceros Kings', ['Cold-Avoiding, Heat-Avoiding and Dust-Avoiding'], 'Three rhinoceroses a thousand years old who have loved scented oil since they were young, and who take it dressed as Buddhas.', '#6f7a72', null],
  ['jade-hare', 'The Jade Hare', [], 'The hare that pounds the elixir of dark frost in the moon, down here a year on an eighteen-year-old grudge about a slap.', '#b5b0a4', 'jade-rabbit'],
  ['real-princess', 'The Princess of India', ['Su’e'], 'A moon maiden born into a queen’s belly, blown out of a garden by a wind, and kept alive in a walled-up room for a year by a monk who told everyone she was a demon.', '#a89ab0', null],
  ['tianzhu-king', 'The King of India', [], 'A king who has never once been outside his own city walls, and who rides sixty li when he finds out where his daughter is.', '#8f7a62', null],
  ['hundred-year-abbot', 'The Abbot of the Gold-Spread Monastery', [], 'A hundred and five years old, who found a girl on the old foundation and walled her in to keep his own monks off her.', '#8a8272', null],
  ['kou-hong', 'Squire Kou', [], 'A man of sixty-four who vowed at forty to feed ten thousand monks, reached the number, and was killed the same night for the send-off he threw.', '#9a8a6a', null],
  ['kou-wife', 'Mistress Kou', [], 'The only one in the house who looked out from under the bed, and who named the four men she had fed for a fortnight.', '#a89098', null],
  ['tongtai-prefect', 'The Prefect of Tongtai', [], 'A magistrate who sends a hundred and fifty men after four monks on one accusation, and is talked out of it by his own dead uncle.', '#7f7462', null],
  // Added because the scene list needs them; no portrait for any of these yet.
  ['demon-king-of-havoc', 'The Demon King of Havoc', ['The Monster of Havoc'], 'The first thing that ever takes anything from Flower-Fruit Mountain: a bully with a scimitar who raids an unarmed troop while its king is away learning.', '#6b5344', null],
  ['liu-quan', 'Liu Quan', [], 'A man of Junzhou who volunteers to carry pumpkins to the Ten Kings because his wife killed herself over a gold pin, and who gets her back in someone else’s body.', '#8a7a5e', null],
  ['yuan-shoucheng', 'Yuan Shoucheng', ['The Diviner of the West Market'], 'A fortune-teller whose castings never miss, who takes a dragon’s wager without knowing it is one and then names the man who will do the beheading.', '#7d6a86', null],
  ['apricot-fairy', 'The Apricot Fairy', ['Miss Apricot'], 'The one guest at the wooden immortals’ hermitage who is not there for the poetry, and the reason a night of perfect courtesy turns out to have been a trap.', '#c78a92', null],
  ['wooden-immortals', 'The Four Wooden Immortals', ['Firm-Node', 'Lonely-Straight', 'Cloud-Piercer', 'Cloud-Brusher'], 'A pine, a cypress, a juniper and a bamboo who have been discussing Chan and matching rhymes for centuries, and who want a real poet for one night.', '#5f7a56', null],
  ['yellow-brow', 'The Yellow-Browed Elder', ['The Buddha of the Little Western Heaven'], 'A boy who took his master’s bag and cymbals, set up a monastery one character short of the real one, and had it bowed to by people who could not read.', '#b0973f', null],
  ['kang-jin-long', 'The Gullet Dragon', ['Kang Jin Long'], 'One of the twenty-eight lodges, and the only one whose horn is thin enough to go through a seam that will not open.', '#4d6f8a', null],
  ['nine-headed-insect', 'The Nine-Headed Insect', ['The Nine-Headed Consort'], 'The Myriad-Sage Dragon King’s son-in-law: nine heads that watch every direction at once, and a tenth that comes out of the waist to bite.', '#5a5f4a', null],
  ['wan-sheng-dragon-king', 'The Myriad-Sage Dragon King', [], 'The owner of Green Wave Pool, who married his daughter to a bird and kept a stolen relic in a casket at the bottom of his own hall.', '#3f6a7d', null],
  ['dragon-widow', 'The Myriad-Sage Princess', ['The Dragon Widow'], 'The dragon king’s daughter, who stole the Queen Mother’s nine-leaved fungus to keep a stolen relic warm, and is left alive chained to the pagoda she helped rob.', '#7a6d8f', null],
  ['red-scaled-python', 'The Red-Scaled Python', [], 'Eight hundred li of stink and a pair of lights in the dark that the fat one takes for a demon carrying lanterns politely.', '#8a4a44', null],
  ['four-wood-stars', 'The Four Wood Beasts', ['Horn Wood Dragon', 'Dipper Wood Beetle', 'Strider Wood Wolf', 'Well Wood Rooster'], 'Four lodges of the twenty-eight whose element is wood, and whose owners are the only beings three rhinoceroses will kneel to on sight.', '#6d8a5f', null],
  ['eight-vajras', 'The Eight Golden Vajras', [], 'The Buddha’s couriers, who carry four men, a horse and a canon east and back inside eight days because the arithmetic of the ordeals requires it.', '#c0a25a', null],
  ['bandits', 'The Road Bandits', ['The Thirty on the Slope'], 'The book’s one purely human enemy: men with spears across a road who want a toll, and the only creatures in it the monkey is punished for killing.', '#6a5a4a', null],
  ['old-yang', 'Old Yang', [], 'A farmer of seventy-four with one son out on the road robbing, who walks four guests out of his own back gate rather than let the gang find them.', '#8c8070', null],
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
  ['cudgel', 'The Gold-Banded Cudgel', 'The iron rod that set the depth of the seas, thirteen thousand five hundred catties, which grows and shrinks to order and lives in an ear when it is not wanted.', 'weapon', null],
  ['rake', 'The Nine-Toothed Rake', 'Five thousand and forty-eight catties of divine ice-iron, made in Heaven for a marshal of the reeds and used ever since on doors, demons and, once, eight hundred li of rotten fruit.', 'weapon', null],
  ['staff', 'The Demon-Quelling Staff', 'A moon-laurel branch banded with gold, the same weight as the rake, carried by the quietest of the three.', 'weapon', null],
  ['pilgrim-staff', 'The Nine-Ring Pilgrim Staff', 'One of the two things Guanyin sends ahead for the pilgrim: a ringed staff that is not a weapon and is never used as one.', 'tool', null],
  ['cassock', 'The Brocade Cassock', 'The other: a robe that keeps its wearer out of the three calamities, and which is coveted, stolen, burnt for and returned inside two chapters of its first outing.', 'clothing', 'brocade-cassock'],
  ['fillet', 'The Gold Fillet', 'One of three bands the Buddha gave Guanyin. It goes on under a lie about a nice hat, tightens on a spell, and is the only thing on the road the monkey cannot get off.', 'artifact', 'golden-fillet'],
  ['rescript', 'The Travel Rescript', 'The passport the emperor stamps, carried the whole way, sealed by every kingdom that lets them through, and read back at the end as the record of where they went.', 'document', 'travel-rescript'],
  ['scriptures', 'The Scriptures', 'Five thousand and forty-eight scrolls, one canon exactly, handed over twice — once blank, and once after the alms bowl.', 'artifact', 'scripture-scrolls'],
  ['alms-bowl', 'The Purple-Gold Alms Bowl', 'Put into the pilgrim’s hands by the emperor at the gate of Chang’an, carried for fourteen years, and given up at the last loft as the price of a canon with words in it.', 'container', null],
  ['heart-sutra', 'The Heart Sutra', 'Fifty-four lines given away in a nest in a juniper, recited the whole way, and quoted back at the man who learned it whenever he is afraid of a noise.', 'document', null],
  ['ginseng-fruit', 'The Ginseng Fruit', 'Thirty fruit in ten thousand years from one tree, shaped like a newborn child, which dissolves in earth and cannot be caught in anything but a gold bowl.', 'consumable', 'ginseng-fruit'],
  ['plantain-fan', 'The Plantain Fan', 'A leaf of pure yin from behind Kunlun that puts the Flaming Mountains out — one wave for the fire, two for wind, three for rain, and forty-nine to end it.', 'artifact', 'banana-leaf-fan'],
  ['purple-gold-bells', 'The Three Purple-Gold Bells', 'Three hundred fathoms of fire, three hundred of smoke and three hundred of sand, stopped with cotton and carried on a cord at a demon’s belt.', 'artifact', 'purple-gold-bells'],
  ['diamond-bracelet', 'The Diamond Jade Bracelet', 'Made at the Han Pass and never lost an argument: it swallows any weapon thrown at it, including every weapon in Heaven, and ends up through an ox’s nose.', 'artifact', null],
  ['gourd-and-vase', 'The Gourd and the Jade Vase', 'Two of Laozi’s five: they take anyone who answers to their own name, and turn them to liquid in an hour and three quarters.', 'artifact', null],
  ['yin-yang-vase', 'The Yin-Yang Vase', 'Two feet four inches high and thirty-six bearers to carry it, with fire, snakes and three fire-dragons inside — and, after one visit, a hole in the bottom.', 'artifact', null],
  ['golden-cymbals', 'The Golden Cymbals', 'A pair that seal over a man with no seam, grow when he grows and shrink when he shrinks, and are opened only by a horn driven through the join.', 'artifact', null],
  ['human-seed-bag', 'The Human-Seed Bag', 'An old white cloth wallet that holds however many people are thrown at it, including twenty-eight lodges of Heaven and five dragons.', 'container', null],
  ['wind-pill', 'The Wind-Securing Pill', 'The Buddha left it with Lingji and Lingji sewed it into a collar, and it is why the second fanning does not move him.', 'consumable', null],
  ['sleep-insects', 'The Sleep-Insects', 'Won off a heavenly king at a guessing game five hundred years ago and kept in a belt since, spent one nostril at a time.', 'consumable', null],
  ['gold-bracelets', 'The Golden Queen’s Bracelets', 'A pair taken off at the Double Fifth to tie the five-coloured threads, left in a dressing case, and worn up a monkey’s arm as proof.', 'clothing', null],
  ['register', 'The Register of Life and Death', 'The book with everything alive written in it, from which one entry — stone monkey, three hundred and forty-two years — is struck out with a borrowed brush.', 'document', null],
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

const ageTimelineId = id('timeline', 'age')
const roadTimelineId = id('timeline', 'road')

/*
  The novel's own hundred headings are two-line couplets in Chinese. They are
  transcribed verbatim in scripts/journey-to-the-west/chapters.json; the titles
  below render both halves of each couplet in English, joined with a middle
  dot, so that a hundred-chapter list is readable. A Lore page says so.

  [title, summary, timeline] — timeline defaults to the road.
*/
const chapterRows = [
  ['The Divine Root Conceives · The Mind Is Cultivated and the Way Is Born', 'A stone on a mountain top splits, a monkey comes out of it, and three or five hundred years later he is weeping at his own feast because Yama still governs him.', 'age'],
  ['Enlightened to Bodhi’s Wonderful Truth · Cutting Off the Demon, Returning to the Root', 'Seven years of chores, a riddle answered at the third watch, seventy-two transformations, a cloud that crosses a hundred and eight thousand li — and an expulsion for showing off.', 'age'],
  ['The Four Seas and Thousand Mountains Submit · The Tenth Class of the Nine Dark Regions Is Struck Out', 'An armoury is emptied, a dragon king is robbed of the pillar that gauges his sea, and a sleeping soul walks into the underworld and edits the register.', 'age'],
  ['Appointed Keeper of Horses, His Heart Is Not Content · Named Equal to Heaven, His Mind Is Not Still', 'Heaven offers a job with no rank, gets a wrecked stable and a banner in reply, and then offers a title with no duties.', 'age'],
  ['Disorder at the Peach Feast · The Great Sage Steals the Elixir', 'Given a garden to keep him busy, he eats the oldest fruit in it, drinks a banquet dry before its guests arrive, and finishes with five gourds of Laozi’s pills.', 'age'],
  ['Guanyin Comes to the Feast and Asks the Reason · The Little Sage Displays His Power', 'A hundred thousand troops cannot hold him; the Jade Emperor’s own nephew can, through sparrow, fish, snake and a shrine that forgets its flagpole.', 'age'],
  ['Escaping from the Eight-Trigram Furnace · Pinned Under the Mountain of Five Phases', 'Forty-nine days in the crucible leave him with fiery eyes and nothing else changed — until a wager on the palm of a hand ends it.', 'age'],
  ['Our Buddha Makes Scriptures for the Western Paradise · Guanyin Goes to Chang’an by Decree', 'Three baskets are prepared for the east, and the bodhisattva walks the road backwards recruiting everyone who will be on it.', 'age'],
  ['Chen Guangrui Meets Disaster on the Way to His Post · The River-Float Monk Avenges His Parents', 'A scholar buys a fish and puts it back, is murdered at a ford, and eighteen years later the child his wife pushed into the river comes back with a name.'],
  ['The Old Dragon King’s Foolish Scheme Breaks Heaven’s Law · Minister Wei Sends a Letter to an Underworld Clerk', 'A dragon shorts a rainfall by a few drops to win a bet, and finds that the man appointed to behead him plays chess with the emperor.'],
  ['Touring the Underworld, Taizong Returns to Life · Offering Melons, Liu Quan Continues His Marriage', 'An emperor is taken below, has twenty years added to a number by a grateful clerk, and comes back owing a debt to everyone he saw down there.'],
  ['The Tang King Sincerely Convenes a Great Mass · Guanyin Reveals Herself and Transforms the Golden Cicada', 'A Grand Mass for the Dead is interrupted by two shabby monks with a cassock to sell, and the man conducting it is given a road to walk instead.'],
  ['Falling Into the Tiger’s Den, the Gold Star Delivers Him · At Twin Forks Ridge, Boqin Keeps the Monk', 'Three travellers go into a pit and one comes out, and a hunter carries him as far as a mountain he cannot walk past.'],
  ['The Mind-Monkey Returns to the Right · The Six Thieves Vanish', 'A paper seal comes off a summit, a monkey comes out from under the mountain, six robbers named for the senses are killed on the road, and a hat is put on under a lie.'],
  ['At Coiled Snake Mountain the Gods Give Secret Aid · At Eagle Grief Stream the Horse of the Will Is Reined', 'The horse the emperor gave them is eaten whole, and what ate it is enrolled as the replacement.'],
  ['The Monks of the Guanyin Monastery Plot for the Treasure · The Monster of Black Wind Mountain Steals the Cassock', 'A two-hundred-and-seventy-year-old abbot sees a better cassock than his seven hundred, and sets fire to the room his guests are sleeping in.'],
  ['Pilgrim Sun Makes Havoc at Black Wind Mountain · Guanyin Subdues the Bear Monster', 'The thief is a bear who reads scripture and keeps a garden, and the way to catch him is for a bodhisattva to take the shape of one of his friends.'],
  ['At the Guanyin Monastery the Tang Monk Escapes Trouble · At Gao Village the Great Sage Removes the Demon', 'A farm with a son-in-law it would pay to be rid of, and a straight offer to take him away.'],
  ['At Cloud Ladder Cave Wukong Wins Bajie · At Pagoda Mountain Xuanzang Receives the Heart Sutra', 'The second disciple is beaten back to his own front door, and a master in a nest in a tree gives away fifty-four lines.'],
  ['At Yellow Wind Ridge the Tang Monk Meets Trouble · Halfway Up the Mountain, Bajie Goes First', 'A wind out of the earth that blinds anything with eyes, including eyes that came through a furnace.'],
  ['The Guardians Set Up a Farm to Keep the Great Sage · Lingji of Sumeru Settles the Wind Demon', 'The cure for the wind is borrowed from a bodhisattva who has been keeping the thing that stops it for exactly this.'],
  ['Bajie Fights Hard at the Flowing-Sands River · Moksa Receives Wujing by the Law', 'Eight hundred li of water a goose feather sinks in, and a monster with nine skulls on a string who turns out to have been waiting for them.'],
  ['Tripitaka Does Not Forget the Root · The Four Saints Test the Chan Mind', 'A widow’s house with three daughters and a fortune in it, which is a bare wood again by morning, with one of them hanging in a tree.'],
  ['At Longevity Mountain the Great Immortal Keeps an Old Friend · At Wuzhuang Temple the Pilgrim Steals the Ginseng Fruit', 'Two boys are left in charge of a tree that fruits thirty times in ten thousand years, and are still counting when it is knocked down.'],
  ['The Immortal Zhenyuan Pursues the Scripture Pilgrims · Pilgrim Sun Makes Havoc at Wuzhuang Temple', 'The sleeves that hold everyone at once, the vats of oil, and four days of being caught and running and being caught again.'],
  ['Wukong Seeks a Cure Among the Three Islands · Guanyin Brings the Tree Back with Sweet Dew', 'Nobody in three islands can raise a tree from the dead, and the one who can does it out of the vase she carries everywhere.'],
  ['The Corpse Demon Deceives Tripitaka Three Times · The Holy Monk Angrily Dismisses the Handsome Monkey King', 'A girl with a rice pot, an old woman and an old man, and a letter of dismissal written on a rock beside a stream.'],
  ['At Flower-Fruit Mountain the Demons Gather · In the Black Pine Forest Tripitaka Meets a Demon', 'Of forty-seven thousand there are a thousand left, and the master walks the wrong way towards a golden glitter.'],
  ['Escaping Trouble, the River-Float Reaches a Kingdom · Receiving Grace, Bajie Turns Back to the Mountain Woods', 'A princess thirteen years missing unties a monk in exchange for carrying a letter, and a court hears it read aloud.'],
  ['The Demon Assaults the True Law · The Horse of the Will Recalls the Mind-Monkey', 'A monk is turned into a tiger in open court, and a horse turns back into a dragon and puts on a serving-girl’s clothes.'],
  ['Zhu Bajie Provokes the Monkey King into Action · Pilgrim Sun Cleverly Subdues the Demon', 'Pleading fails; an invented insult does not; and Heaven counts twenty-eight lodges and finds twenty-seven.'],
  ['At Pingding Mountain the Duty God Brings Word · At the Lotus Cave the Wood Mother Meets Disaster', 'A warning delivered by a vanishing woodcutter, and a scouting report rehearsed to three boulders that have heard every word.'],
  ['The Outer Way Deludes the True Nature · The Original Spirit Assists the Original Mind', 'Sumeru, Emei and Tai dropped on one back one at a time, and a gourd traded for a hair with the sky blacked out for half an hour.'],
  ['The Demon King’s Cunning Traps the Mind-Monkey · The Great Sage Shifts and Steals the Treasures', 'A nine-tailed fox is killed on a mountain path, her face is worn into her own sons’ hall, and a hanging pig gives the game away.'],
  ['The Outer Way Uses Its Power to Oppress the True Nature · The Mind-Monkey Gets the Treasure and Subdues the Demon', 'The gourd does not care whether a name is real, only that something answers to it.'],
  ['The Mind-Monkey, Rightly Placed, Subdues All Conditions · Breaking Through Side Doors, He Sees the Bright Moon', 'A stone lion broken to powder in a courtyard, and a homesick poem about the moon answered with a lesson the master takes.'],
  ['The Ghost King Visits Tripitaka by Night · Wukong Transforms and Draws In the Child', 'A dripping figure at the meditation-hall door with a jade tablet and a story about a well, and a prince who shoots at a white hare.'],
  ['The Child Questions His Mother and Learns True from False · Metal and Wood Probe the Mystery and See the Real and the Sham', 'A question about the last three years, and a stone lid under a plantain in a sealed garden.'],
  ['One Grain of Cinnabar Is Got from Heaven · After Three Years the Old Lord Lives Again', 'One pill out of Tushita, a king breathed back to life, and a Buddha’s lion collected by the bodhisattva who lost it.'],
  ['The Child Plays and Confuses the Chan Mind · Ape, Horse, Blade and Wood Mother Are Undone', 'A boy of seven roped in a pine, dashed on a rock, and gone by sleight, with the master out of the saddle behind him.'],
  ['The Mind-Monkey Is Defeated by Fire · The Wood Mother Is Taken by the Demon', 'Two punches on his own nose, and a fire the four dragon kings’ rain only makes worse.'],
  ['The Great Sage Reverently Visits the South Sea · Guanyin Kindly Binds Red Boy', 'A vase too heavy to lift, a hair given as security, and Nezha’s heaven-net sabres turned into a seat.'],
  ['The Demon of the Black River Carries the Monk Off · The Dragon Prince of the Western Ocean Catches the Alligator', 'A dugout that holds two, an invitation taken off a fish, and a family arrest.'],
  ['The Dharma-Body Meets the Cart-Power in Its Cycle · The Upright Mind Passes the Spine Ridge', 'Five hundred monks hauling brick up a cliff for three Daoists who once brought the rain, and two carts broken to splinters.'],
  ['At the Three Pure Ones Abbey the Great Sage Leaves His Name · In the Cart-Slow Kingdom the Monkey King Shows His Power', 'Three statues carried to the privy, three cups of holy water, and a rain wager decided by a monk sitting silent.'],
  ['The Outer Way Flaunts Its Strength and Oppresses the True Law · The Mind-Monkey Reveals His Sanctity and Destroys the Evil', 'A bedbug, a centipede, three guesses at a locked box, and a head, a belly and a cauldron of oil.'],
  ['The Holy Monk Is Stopped at Night by the Heaven-Reaching Water · Metal and Wood Compassionately Save the Children', 'A stone on the bank that says eight hundred li, and a funeral mass said over two children who are still alive.'],
  ['The Demon Raises a Cold Wind and Sends Down Great Snow · The Monk, Thinking of the Buddha, Treads the Layered Ice', 'A mandarin-fish crone works out that a river can be frozen, and the ice holds until the second morning.'],
  ['Tripitaka Meets Disaster and Sinks in the Water Palace · Guanyin Saves Him and Appears with the Fish Basket', 'A stone chest six feet long, a door packed with rammed earth, and a bodhisattva who comes out of the bamboo grove unpainted.'],
  ['Feeling Runs Wild and Nature Follows Desire · The Spirit Is Confused and the Mind Meets a Demon', 'A ring drawn on the ground and stronger than iron walls, three brocade waistcoats on a table, and a bracelet that takes the cudgel.'],
  ['The Mind-Monkey Uses a Thousand Schemes in Vain · Water and Fire Are of No Use Against the Demon', 'Heaven’s roll-call comes back complete, and everything Heaven sends — six weapons, a fire department, a river in a bowl — goes into the ring.'],
  ['Wukong Makes Havoc at the Jindou Cave · The Tathagata Hints at the Owner', 'The Buddha knows and will not say; eighteen arhats and eighteen grains of golden sand go the same way; and two of them are told where to send him.'],
  ['The Chan Master Swallows a Meal and Conceives a Ghost Pregnancy · The Yellow Dame Carries Water and Undoes the Evil Foetus', 'A ferry rowed by a woman, half a bowl of clear water, and a spring held by a man who wants revenge for a nephew who is not dead.'],
  ['The Dharma-Nature Comes West and Meets the Women’s Country · The Mind-Monkey Makes a Plan to Escape the Snare', 'A whole kingdom offered in good faith, a wedding agreed to in order to get a passport stamped, and a whirlwind at the gate.'],
  ['Lust and Evil Toy with Tripitaka · Right Nature, Cultivated, Keeps the Body Unbroken', 'Two trays of buns, a sting that once went into the Buddha’s thumb, and a cock six or seven feet high.'],
  ['The Spirit Runs Wild and Kills the Brigands · The Way Goes Astray and Releases the Mind-Monkey', 'An embroidery needle offered as a toll, two graves, a prayer that names one culprit, and a severed head carried up to the saddle.'],
  ['The True Pilgrim Lays His Grievance at Potalaka · The False Monkey King Copies the Rescript', 'Nowhere left to go back to, a cup of water refused, and a second party of four on Flower-Fruit Mountain reading the passport aloud.'],
  ['Two Minds Throw the Great Cosmos into Confusion · One Body Cannot Cultivate True Stillness', 'Every test fails — the spell, the mirror, the underworld register — until a beast that hears through every realm gets it right and refuses to say it.'],
  ['Tripitaka’s Road Is Blocked at the Flaming Mountains · Pilgrim Sun Seeks the Plantain Fan the First Time', 'A cake too hot to hold, a fan a hundred and eighty thousand li of wind long, and a gnat riding down a mouthful of tea.'],
  ['The Bull Demon King Leaves the Fight for a Banquet · Pilgrim Sun Seeks the Plantain Fan the Second Time', 'A thirty-six-catty crab at a dragon’s table, a stolen mount, and a husband’s face worn to the end of the evening.'],
  ['Zhu Bajie Helps to Defeat the Demon King · Pilgrim Sun Seeks the Plantain Fan the Third Time', 'Swan, gyrfalcon, crane, tiger, leopard, elephant and a white ox a thousand fathoms long, and forty-nine strokes at the end of it.'],
  ['Washing Off Dirt and Cleansing the Heart Is Only Sweeping a Pagoda · Binding the Demon and Returning It to Its Owner Is Cultivation', 'Two generations of monks beaten to death for a theft, thirteen storeys swept in one night, and dice heard at the top of the stairs.'],
  ['Two Monks Clear Out the Demons and Make Havoc at the Dragon Palace · The Company of Saints Destroys the Evil and Wins the Treasure', 'A nine-headed son-in-law with a tenth head at his waist, a hunting party of old acquaintances, and a small dog.'],
  ['At Thorn Ridge Wuneng Exerts Himself · At the Wooden Immortal Hermitage Tripitaka Talks Poetry', 'Eight hundred li of bramble opened by a rake, and one night in which the pilgrim is treated as a poet by four trees.'],
  ['The Demon Sets Up a False Little Thunderclap · All Four Meet a Great Ordeal', 'Three characters or four over a gate, a pair of cymbals with no seam, and an old white wallet that holds everyone who is thrown at it.'],
  ['The Gods Suffer Evil Hands · Maitreya Binds the Demon King', 'Wudang and Sizhou both send help and both lose it, and the answer is a melon patch with one ripe melon in it.'],
  ['Rescuing Tuoluo, the Chan Nature Is Secure · Escaping the Filth, the Way-Mind Is Clean', 'The seven virtues of the persimmon, a snake propped into a bridge and a boat from the inside, and a lane rooted open by a hog.'],
  ['In the Purple Cinnabar Kingdom the Tang Monk Discourses on Former Lives · Pilgrim Sun Practises the Physician’s Art', 'A proclamation under a drum tower, a notice tucked into a sleeping pig’s robe, and a pulse taken through three golden threads.'],
  ['The Lord of the Mind Prepares Medicine by Night · The King at the Banquet Discusses the Demon', 'Rhubarb, croton, soot and half a cup the horse argues about, washed down with rootless water sneezed out of a dragon.'],
  ['The Demon Treasure Emits Smoke, Sand and Fire · Wukong Plots to Steal the Purple-Gold Bells', 'A courier who says out loud on an empty road that Heaven will not stand for it, a gown of needles, and the cotton pulled out of all three bells at once.'],
  ['Pilgrim Sun Takes a False Name and Subdues the Demon Hou · Guanyin Appears and Tames the Demon King', 'Lice in a shirt, a grandfather nobody can find in the Hundred Surnames, and a beast that came down to serve out somebody else’s sentence.'],
  ['At Pansi Cave the Seven Passions Confuse the Root · At the Cleansing Spring Bajie Forgets Himself', 'Seven sets of clothes carried off by a hawk, a catfish in a bathing pool, and seven kinds of hawk for seven kinds of insect.'],
  ['Old Grudges Breed Poison and Disaster · The Lord of the Mind Meets Evil and Is Saved by Breaking the Light', 'Twelve dates on a tray with two of them black, seventy monkeys with forked staves, and a thousand eyes under a Daoist’s arms.'],
  ['The Gold Star Reports a Fierce Demon · The Pilgrim Displays His Power of Transformation', 'Forty-eight thousand demons counted out by an old man on a slope, and an army sent home by a story about a whetstone.'],
  ['The Mind-Monkey Bores Through the Yin-Yang Body · The Demon Lord Returns to the True Way', 'Three cuts of a sabre, a vase with a hole bored in the bottom of it, and a winter spent inside a lion.'],
  ['The Spirit Dwells in Its House and the Demon Returns to Its Nature · The Wood Mother Helps to Subdue the True Demon', 'A hair tied to a heart in a slipknot, a lifeline paid out too late, and an elephant led down a slope by the nose.'],
  ['The Host of Demons Insults the True Nature · The One Body Bows to the True Thus-Come', 'A steamer basket, a rumour that he was eaten raw, and an audience at Vulture Peak in which the Buddha explains whose kin the third demon is.'],
  ['In Bhiksu, Pitying the Children, He Sends Out Spirits · In the Golden Hall, Recognising the Demon, He Discourses on the Way', 'A goose coop at every door with a boy in it, eleven hundred and eleven hearts prescribed, and a cold wind down every street.'],
  ['Searching the Cave to Catch the Demon, He Meets the Old Star of Longevity · The True Lord of the Court Saves the Infants', 'A heap of hearts with no black one in it, three turns each way at a ninth-forked willow, and eleven hundred coops set down in the road.'],
  ['The Beautiful Woman Seeks the Male to Mate With · The Mind-Monkey Guards His Master and Knows the Demon', 'A woman tied to a tree, one sentence sent downwind that only one man hears, and a monastery half in ruins.'],
  ['At Zhenhai Monastery the Mind-Monkey Knows the Demon · In the Black Pine Forest the Three Search for Their Master', 'Six bell-ringers gone in three nights, a shoe left fighting in her shape, and a mountain god beaten out of the ground.'],
  ['The Beautiful Woman Seeks the Male · The Original Spirit Guards the Way', 'Poplar and sandalwood, a jar-mouth hole in a boulder, and a red peach swallowed without being bitten.'],
  ['The Mind-Monkey Recognises the Elixir Head · The Beautiful Woman Returns to Her True Nature', 'Two tablets on an altar, a lawsuit in Heaven that the plaintiff loses first, and a small cave in the black southeast corner.'],
  ['The Hard-to-Destroy Protection Completes the Great Enlightenment · The Dharma King Becomes Upright and Natural', 'Nine thousand nine hundred and ninety-six monks killed and four with names still wanted, and a night in which a whole court is shaved.'],
  ['The Mind-Monkey Envies the Wood Mother · The Demon Lord Plots to Swallow Chan', 'A lie about a village that feeds monks, a plan borrowed from a survivor of Lion Camel Ridge, and a woodcutter tied to the opposite tree.'],
  ['The Wood Mother Lends His Strength to Conquer the Monster · Metal Lord Uses His Power to Destroy the Evil', 'A head that rings like a woodblock, a grave with willow twigs for pines, and a way in through the drain.'],
  ['In Fengxian Prefecture, Offending Heaven, the Rain Is Withheld · The Great Sage Urges Goodness and Bestows Rain', 'A hill of rice, a hill of flour and a gold lock with a lamp under it, and three years of drought that began with an overturned table.'],
  ['Chan Reaches Yuhua and a Dharma Assembly Is Held · The Mind-Monkey and the Wood Mother Take Pupils', 'Three princes who cannot lift the weapons they admire, strength breathed into them, and three copies left out overnight in a foundry yard.'],
  ['The Yellow Lion Spirit Holds a Vain Rake Banquet · Metal, Wood and Earth Make Havoc at Leopard Head Mountain', 'Two couriers frozen on a road, a banquet held in honour of a stolen rake, and its owner walking up to the table to take it back.'],
  ['Master and Lions Are Taught and Return to One · Robbing the Way Entangles Chan and Stills the Nine Spirits', 'Nine mouths and six bites, a beating with willow switches, and a keeper who slept through the theft on a bottle of the wrong liquor.'],
  ['At Jinping Prefecture They Watch the Lanterns on the Fifteenth · At the Mysterious Yin Cave the Tang Monk Gives His Deposition', 'Three lamps that burn forty-eight thousand taels of oil, three Buddhas who come down on the wind, and the one man in the crowd who runs towards them.'],
  ['Three Monks Fight a Great Battle at Green Dragon Mountain · Four Star Lords Seize the Rhinoceros Demons', 'Horns that part water, a chase into the Western Sea, and a lamp-oil levy lifted by proclamation.'],
  ['At the Jetavana They Ask About the Past and Discuss Causes · In India They Attend Court and Meet a Match', 'Ground once bought by covering it in gold, a girl walled up in a back room for a year, and a ball thrown from a tower onto a monk’s head.'],
  ['Four Monks Feast in the Imperial Garden · One Demon Vainly Cherishes Her Desire', 'Four screens of seasonal verse matched rhyme for rhyme, and a bride who asks that the three ugly disciples be sent out of the city.'],
  ['False and True Are Joined and the Jade Hare Is Caught · The True Yin Returns to the Right and Meets the Primal Spirit', 'A pestle for a weapon, a moon lord who comes down to save a life, and an iron lock struck off a door in a monastery sixty li away.'],
  ['Squire Kou Gladly Receives the Eminent Monk · The Tang Elder Does Not Covet Riches', 'Nine thousand nine hundred and ninety-six monks fed and four arriving, and a send-off with two hundred invitations that the whole prefecture watches.'],
  ['Gold Repays the Outside Protector and He Meets Demonic Harm · The Sage Manifests a Ghost Soul to Save the Original', 'The robbery the send-off advertised, four names read off in the dark from under a bed, and three hauntings before dawn.'],
  ['The Ape Is Tamed and the Horse Broken, the Shell Is Cast Off · The Work Is Done and the Practice Complete, They See the True Thus-Come', 'A single log over the last water, a boat with no bottom, a corpse floating past it, and a canon handed over blank.'],
  ['The Nine Times Nine Is Complete and the Demons Are Swept Away · The Three Times Three Is Fulfilled and the Way Returns to the Root', 'Eighty ordeals counted in a ledger and one more ordered, a turtle who never got his answer, and a canon dried on a rock.'],
  ['They Return Straight to the Eastern Land · The Five Sages Attain the True', 'Pines turned east, a passport with twelve seals on it read back, a preface composed in the night, and a reading interrupted after one page.'],
]
const chapters = chapterRows.map(([title, summary, timeline], i) => ({
  ...base,
  id: Ch(i + 1),
  timelineId: timeline === 'age' ? ageTimelineId : roadTimelineId,
  number: i + 1,
  title,
  summary,
  status: 'final',
  targetWordCount: null,
  wordGoal: null,
}))

/* --------------------------------------------------------------- scenes --- */

/*
  [ch, key, title, loc, d, tension, pov, desc, items, threads, motifs, cast]

  `d` is an absolute day on the shared axis (day 0 = 1 January of Zhenguan 1,
  627 CE). Chapters 1-8 run on the frame timeline and therefore on negative
  days; chapters 9-100 run on the road timeline from 620 CE to 653 CE.

  The ledger beside this file records 479 beats over the hundred chapters.
  What ships is the structural spine of those: roughly one scene per beat in
  the frame, where the book is at its densest, and one or two per chapter on
  the road, where a great many chapters are the same shape — a demon takes the
  master, and something that owns the demon is fetched.
*/
const scenes = [
  /* ---- Chapter 1 ---- */
  { ch: 1, key: 'stone-monkey-born', title: 'The Stone Egg Splits', loc: 'ffm-main-peak', d: ce(-234, 60), tension: 2, pov: 'wukong',
    desc: 'An immortal stone on the peak, worked on by heaven and earth for as long as there have been either, splits open and lets out a monkey made of rock. The light of his first look reaches the throne hall of Heaven, which sends two officers to see what it was and then decides it was nothing.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { wukong: 'Comes out of the stone able to walk, bow to the four quarters and eat, and does all three within the hour.',
      'jade-emperor': 'Sends Thousand-Mile Eye and Fair-Wind Ear to the Southern Gate, hears that the light came from a stone, and calls the matter closed.' } },
  { ch: 1, key: 'waterfall-and-crown', title: 'Through the Waterfall', loc: 'ffm-waterfall', d: ce(-229, 150), tension: 2, pov: 'wukong',
    desc: 'The troop follows the stream to its head and finds a fall nobody will go into. Whoever passes through it unhurt is to be king. He shuts his eyes, jumps, and comes out on an iron bridge in front of a stone house with a tablet over the door.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names', 'water'],
    cast: { wukong: 'Goes through the water on a dare, brings the whole troop in after him, and drops the word “stone” from his title on the spot.' } },
  { ch: 1, key: 'fear-of-death', title: 'The Feast and the Fear', loc: 'ffm-dining-hall', d: ce(86, 100), tension: 3, pov: 'wukong',
    desc: 'Three hundred years of feasting, and in the middle of one of them the king starts crying. Nothing has hurt him and nothing is likely to; but Yama has his name written down somewhere, and one day the name will be read out. An old gibbon names the three kinds of being the register does not cover.',
    items: [], threads: ['heaven-vs-monkey'], motifs: [],
    cast: { wukong: 'Puts down the cup in the middle of the party and says out loud that being king of this is no use if it ends.' } },
  { ch: 1, key: 'raft-east', title: 'The Raft and the Nine Years', loc: 'ffm-beach', d: ce(86, 140), tension: 2, pov: 'wukong',
    desc: 'A pine raft, a bamboo pole and a following wind take him off the island. He spends eight or nine years walking the Southern Continent in stolen clothes, learning to speak and bow like a man, and finds nobody in it who is looking for anything but rank and money.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['water'],
    cast: { wukong: 'Builds the raft himself, leaves the troop behind without much ceremony, and crosses two oceans over nine years without finding a teacher.' } },
  { ch: 1, key: 'subhuti-names-him', title: 'Subhuti Gives Him a Name', loc: 'subhuti-cave', d: ce(95, 60), tension: 2, pov: 'wukong',
    desc: 'A woodcutter singing a verse he did not write points up the mountain. The door is opened by a boy who was told to expect somebody, and the master inside asks where he is from, hears an answer with no parents in it, and builds him a surname out of the character for monkey.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { wukong: 'Kowtows before he is asked to, gives an account of himself with no family in it, and is given the name Wukong — Awakened to Emptiness.',
      subhuti: 'Tests the visitor’s origins, derives the surname Sun from the shape of the word for a monkey, and hands him the tenth generation-name in his own line.' } },

  /* ---- Chapter 2 ---- */
  { ch: 2, key: 'doors-refused', title: 'Every Door Refused', loc: 'subhuti-cave', d: ce(102, 60), tension: 2, pov: 'wukong',
    desc: 'Seven years of sweeping, watering and carrying, and then the master offers him the gates: Method, Schools, Stillness, Action. He asks the same question at each one — will it make me live forever — and turns all four down when the answer is no. He is struck three times on the head and left alone.',
    items: [], threads: ['heaven-vs-monkey'], motifs: [],
    cast: { wukong: 'Refuses four whole disciplines to their teacher’s face because none of them answers the thing he came for.',
      subhuti: 'Offers everything he teaches, is refused four times, and hits the boy three times on the head before walking out through the middle door.' } },
  { ch: 2, key: 'third-watch', title: 'The Third Watch', loc: 'subhuti-cave', d: ce(102, 80), tension: 3, pov: 'wukong',
    desc: 'The other disciples take the beating for an insult. He takes it for an appointment, comes to the back door at the third watch, and gets the formula in verse, alone, with nobody else in the house awake.',
    items: [], threads: ['heaven-vs-monkey'], motifs: [],
    cast: { wukong: 'Is the only one in the school who reads three blows and a hand behind the back as a time and a door.',
      subhuti: 'Finds the boy already kneeling by the bed and gives him the whole method for long life in one sitting.' } },
  { ch: 2, key: 'seventy-two-changes', title: 'Three Calamities and Seventy-Two Changes', loc: 'subhuti-cave', d: ce(105, 90), tension: 3, pov: 'wukong',
    desc: 'Three years on, the master warns him what long life costs: thunder, fire and wind come for anyone who has cheated the count, once every five hundred years. He takes the seventy-two Earthly transformations to hide from them, and then a cloud-somersault that crosses a hundred and eight thousand li because his own cloud only crawls.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['transformation'],
    cast: { wukong: 'Learns the seventy-two changes to dodge three calamities, and the somersault cloud because his first attempt at flying is laughed at.',
      subhuti: 'Names the three calamities without softening them, and teaches the transformations as a way of not being found by them.' } },
  { ch: 2, key: 'pine-tree-expelled', title: 'The Pine Tree and the Expulsion', loc: 'subhuti-cave', d: ce(107, 110), tension: 3, pov: 'wukong',
    desc: 'The others ask him to show them something, so he becomes a pine tree in the courtyard and they clap. The master comes out at the noise and sends him home the same day, with one condition: never say who taught him.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['transformation'],
    cast: { wukong: 'Shows off once, is expelled for it, and gives his word never to name the man who taught him — and keeps it for the whole book.',
      subhuti: 'Expels his best student for performing, and forbids him to use his teacher’s name even to save himself.' } },
  { ch: 2, key: 'demon-king-killed', title: 'The Demon King of Havoc', loc: 'water-belly-cave', d: ce(107, 180), tension: 3, pov: 'wukong',
    desc: 'He comes home to a burnt camp and a story: something came down from the north while he was away, took the gear and carried off the young ones. He finds the cave, splits a fistful of hair into three hundred small monkeys, kills the owner with the owner’s own blade, and brings the children home over the water.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['transformation'],
    cast: { wukong: 'Fights the first real fight of his life and wins it by turning his own hair into a crowd, which becomes his standard method.',
      'demon-king-of-havoc': 'Has been raiding an unarmed troop for years, laughs at the small unarmed thing in front of him, and is cut down with his own scimitar.' } },

  /* ---- Chapter 3 ---- */
  { ch: 3, key: 'armoury-raid', title: 'An Armoury Carried Off in a Wind', loc: 'ffm-training-ground', d: ce(108, 10), tension: 2, pov: 'wukong',
    desc: 'Weapons for forty-seven thousand monkeys, and the nearest kingdom has a full arsenal. He raises a wind that empties the streets, splits his hair into hundreds of carriers, and has the whole store home before the city has finished being frightened.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['transformation'],
    cast: { wukong: 'Arms an entire island in one night by stealing a kingdom’s armoury without hurting anybody in it.' } },
  { ch: 3, key: 'cudgel-won', title: 'The Sea-Settling Iron', loc: 'dragon-palace-pillar', d: ce(108, 20), tension: 3, pov: 'wukong',
    desc: 'None of the dragon palace’s weapons is heavy enough — not the fork at three thousand six hundred catties, not the halberd at seven thousand two hundred. The Dragon Mother mentions the iron pillar that gauges the depth of the sea, and it lights up when he walks over to it, and shrinks to a size a hand can hold.',
    items: ['cudgel'], threads: ['heaven-vs-monkey'], motifs: ['borrowed-treasure'],
    cast: { wukong: 'Turns down every weapon in the armoury as too light and takes the thing that was holding the ocean at its proper depth.',
      aoguang: 'Offers his best pieces one after another, watches them all dismissed, and points at the pillar mostly to be rid of him.' } },
  { ch: 3, key: 'armour-extorted', title: 'Four Dragons, One Suit', loc: 'dragon-palace-throne', d: ce(108, 21), tension: 3, pov: 'aoguang',
    desc: 'A weapon is not a wardrobe. He sits down in the hall and refuses to leave without armour to match, so the bell and the drum bring the other three seas, and the phoenix cap, the gold chain-mail and the cloud-stepping shoes are found between them. Then he takes six demon kings as sworn brothers on the way home.',
    items: ['cudgel'], threads: ['heaven-vs-monkey', 'bull-family'], motifs: ['borrowed-treasure'],
    cast: { aoguang: 'Cannot get an armed guest out of his own throne room, and calls his three brothers in to be robbed alongside him.',
      wukong: 'Extracts a full suit out of four kings by simply staying where he is, and leaves with a weapon, a wardrobe and six new brothers.',
      'bull-demon-king': 'Is first of the six demon kings who swear brotherhood with him, and the eldest of the seven by agreement.' } },
  { ch: 3, key: 'register-struck', title: 'The Register of Life and Death', loc: 'underworld-register', d: ce(108, 60), tension: 4, pov: 'wukong',
    desc: 'Two summoners rope his sleeping soul and walk it to the Gate of Ghosts. He beats them flat, walks into the Hall of Judgment armed, has the book fetched, finds his own line — soul 1350, stone monkey, three hundred and forty-two years — and strikes out every monkey name on the page with the brush he was handed.',
    items: ['cudgel', 'register'], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { wukong: 'Cancels his own death and his whole people’s in ink, in front of the Ten Kings, and walks back out through the gate he was dragged in at.' } },
  { ch: 3, key: 'two-petitions', title: 'Two Petitions Against Him', loc: 'celestial-hall', d: ce(108, 70), tension: 3, pov: 'jade-emperor',
    desc: 'The Eastern Sea petitions about a weapon and the first of the Ten Kings about a book, and both arrive on the same morning. An army is proposed. The Gold Star argues instead for the cheapest possible answer: give the creature a title, bring it up here, and it will stop.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { 'jade-emperor': 'Reads two complaints about the same creature in one sitting and is talked out of sending troops.',
      taibai: 'Proposes the policy the whole first act runs on — appoint him to something, and the problem manages itself.',
      aoguang: 'Comes up in person to say that a guest took the pillar that sets the depth of his sea and will not give it back.' } },

  /* ---- Chapter 4 ---- */
  { ch: 4, key: 'bimawen', title: 'Keeper of the Heavenly Horses', loc: 'celestial-stables', d: ce(108, 100), tension: 2, pov: 'wukong',
    desc: 'The Southern Gate stops him until the Gold Star vouches for him, and then there is a post waiting: the stables, a thousand horses of heaven, and nobody to answer to. For half a heavenly month he does it properly, and the horses have never been fatter.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { wukong: 'Takes the only job he is ever given honestly and is good at it, because nobody has told him what it is worth.',
      taibai: 'Walks him past the gate guards on his own authority and presents him at court as a new appointment rather than a prisoner.',
      'jade-emperor': 'Finds a vacancy nobody wants and fills it, on the theory that an occupied nuisance is not a nuisance.' } },
  { ch: 4, key: 'rank-discovered', title: 'An Office With No Rank', loc: 'celestial-pastures', d: ce(123, 100), tension: 4, pov: 'wukong',
    desc: 'At a party thrown in his own honour he asks what grade a Bimawen is, and is told cheerfully that it has no grade at all — it is the bottom, the word is a joke, and everyone but him knew. The table goes over, the gate guards are knocked aside, and by nightfall there is a banner on the mountain with a new title on it.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { wukong: 'Learns what his own office is worth from people congratulating him on it, and leaves Heaven the same hour.' } },
  { ch: 4, key: 'nezha-beaten', title: 'Li Jing and Nezha', loc: 'ffm-encampment', d: ce(123, 140), tension: 4, pov: 'nezha',
    desc: 'Heaven sends an expedition to the mountain. Mighty Magic Spirit’s axe breaks at the first block. Nezha takes three heads and six arms and is matched arm for arm, and then something hits him on the shoulder that he never saw, because it was a hair with a monkey on the end of it.',
    items: ['cudgel'], threads: ['heaven-vs-monkey'], motifs: ['transformation'],
    cast: { nezha: 'Fights the best fight anyone has given him and is beaten by a duplicate he did not know was in the field.',
      'li-jing': 'Commands the first punitive expedition, loses his vanguard and his son inside an afternoon, and sends up for reinforcements.',
      wukong: 'Wins by the trick that will define him — being in two places while the enemy is watching one.' } },
  { ch: 4, key: 'great-sage-titled', title: 'An Office With No Duties', loc: 'celestial-hall', d: ce(124, 20), tension: 2, pov: 'taibai',
    desc: 'A second expedition is being argued for when the Gold Star repeats his advice with one amendment: give him the title he has written on his own banner. It is four characters and no salary and no work, and Heaven builds him a mansion beside the Peach Garden to keep him in it.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { taibai: 'Proposes handing over the exact words the rebel invented for himself, on the grounds that they cost nothing.',
      'jade-emperor': 'Grants a rank that does not exist to a creature who has already taken it, and considers the file closed.',
      wukong: 'Accepts a title with nothing behind it and moves into a mansion next door to the only thing in Heaven he wants.' } },

  /* ---- Chapter 5 ---- */
  { ch: 5, key: 'peach-garden-given', title: 'Overseer of the Peach Garden', loc: 'peach-garden', d: ce(124, 40), tension: 2, pov: 'wukong',
    desc: 'An idle Great Sage is a problem, so he is given the garden to look after. The local god walks him round it and counts out the stock: three thousand six hundred trees in three ranks, ripening at three thousand, six thousand and nine thousand years, and what each rank does to whoever eats it.',
    items: [], threads: ['heaven-vs-monkey'], motifs: [],
    cast: { wukong: 'Is handed the keys to the one orchard in the universe he should never have been shown, and is told exactly which trees matter.',
      'jade-emperor': 'Solves the problem of an official with no duties by inventing duties, and picks the worst possible ones.' } },
  { ch: 5, key: 'peaches-eaten', title: 'He Eats the Ripe Ones', loc: 'peach-garden', d: ce(137, 120), tension: 3, pov: 'wukong',
    desc: 'He sends the attendants out of the gate, hangs his cap and robe on a branch, and works through the oldest trees. Then he does it again every few days, and takes a nap in the branches afterwards at a size small enough not to be seen from the path.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['hunger', 'transformation'],
    cast: { wukong: 'Eats his way through the nine-thousand-year rank in private and sleeps it off two inches tall in the leaves.' } },
  { ch: 5, key: 'seven-maidens', title: 'The Seven Maidens and the Guest List', loc: 'jasper-pool', d: ce(138, 60), tension: 3, pov: 'wukong',
    desc: 'Seven maidens come to pick for the Peach Banquet and find the best trees stripped. He wakes, asks who is invited, hears the whole list read out, and notices which four characters are not on it. He freezes all seven where they stand and goes to the party himself.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { wukong: 'Discovers what his title is worth a second time, and this time from a guest list rather than a salary table.',
      'queen-mother': 'Sends for peaches for the banquet and never learns from her own maidens why they did not come back.' } },
  { ch: 5, key: 'banquet-and-elixir', title: 'The Barefoot Immortal’s Face', loc: 'yaochi-palace', d: ce(138, 61), tension: 4, pov: 'wukong',
    desc: 'He meets the Barefoot Immortal on the road, sends him to the wrong hall with a courteous lie, wears his shape past the door, and drinks the banquet dry before a single guest arrives. Then, looking for somewhere to sleep it off, he blunders into Tushita, finds the house empty, and eats five gourds of the finished elixir like roasted beans.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['disguise', 'hunger'],
    cast: { wukong: 'Eats the peaches, drinks the wine and swallows the elixir in one afternoon, which between them make him unkillable.',
      laozi: 'Is out lecturing when his own furnace room is emptied, and comes home to five open gourds.' } },
  { ch: 5, key: 'hundred-thousand', title: 'A Hundred Thousand Troops', loc: 'ffm-encampment', d: ce(138, 70), tension: 4, pov: 'li-jing',
    desc: 'Sober and frightened, he runs for the mountain — then goes back for jars, because his people should taste immortality too. The thefts are traced within the day. Eighteen heavenly nets close on the island, the Nine Luminaries are driven off the field, and by evening the seventy-two cave kings have been taken and the monkeys have not.',
    items: [], threads: ['heaven-vs-monkey'], motifs: [],
    cast: { 'li-jing': 'Commands a hundred thousand troops and eighteen nets, takes every ally the mountain has, and does not take the mountain.',
      wukong: 'Holds the island alone against the heavenly host, and loses every friend he made on the way up.' } },

  /* ---- Chapter 6 ---- */
  { ch: 6, key: 'guanyin-at-the-ruin', title: 'Guanyin Finds the Hall Wrecked', loc: 'yaochi-palace', d: ce(138, 72), tension: 2, pov: 'guanyin',
    desc: 'She arrives for the banquet and finds the tables overturned, the wine gone and the guests standing about. The Jade Emperor gives her the whole account from the beginning — the stables, the title, the garden — and she sends her disciple down to see how the siege is going.',
    items: [], threads: ['heaven-vs-monkey', 'scriptures'], motifs: [],
    cast: { guanyin: 'Hears the whole file read out and is the first person in Heaven to treat the creature as a case rather than a pest.',
      moksa: 'Is sent down to the mountain to report on a siege, and volunteers to fight the moment he gets there.',
      'jade-emperor': 'Recounts fifteen years of appeasement to a bodhisattva without appearing to notice that it is a list of failures.' } },
  { ch: 6, key: 'moksa-loses', title: 'Moksa Cannot Hold Him', loc: 'ffm-encampment', d: ce(138, 75), tension: 3, pov: 'moksa',
    desc: 'Fifty or sixty rounds in front of the whole camp, and then his arms go numb and he has to break off. He goes back up the hill to his father’s tent to say so, and the tent sends to Heaven for somebody else.',
    items: ['cudgel'], threads: ['heaven-vs-monkey'], motifs: [],
    cast: { moksa: 'Fights until his arms stop working, and is honest about it in front of an army that had hoped otherwise.',
      wukong: 'Beats the bodhisattva’s own disciple in the open field and lets him leave, which is not the same as beating an army.' } },
  { ch: 6, key: 'erlang-duel', title: 'Sparrow, Fish, Snake, Shrine', loc: 'ffm-waterfall', d: ce(138, 80), tension: 5, pov: 'erlang',
    desc: 'Guanyin names the one god who answers summonses and not commands, and Erlang comes from Guanjiangkou with six sworn brothers and a hunting pack. Three hundred rounds settle nothing, so the fight goes into shapes — sparrow, cormorant, carp, water-snake, bustard — and ends with a shrine that has a flagpole behind it instead of in front.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['transformation', 'disguise'],
    cast: { erlang: 'Matches him change for change until a tail he cannot hide gives the last one away, and chases him through his own temple.',
      wukong: 'Runs out of animals, becomes a building, and is caught by the one detail of a building he did not think to move.',
      guanyin: 'Names the fighter the court had not thought of, and watches the whole duel from the wrecked banquet hall.' } },
  { ch: 6, key: 'diamond-snare', title: 'The Ring From the Sleeve', loc: 'ffm-encampment', d: ce(138, 81), tension: 5, pov: 'wukong',
    desc: 'Even beaten out of his shapes he is not being held, so Laozi leans over the Southern Gate and drops a bracelet on his head from a very long way up. The hound has him by the leg before he is up again. They bind him, and bore his collarbone through so that he cannot change into anything smaller than himself.',
    items: ['diamond-bracelet'], threads: ['heaven-vs-monkey'], motifs: ['borrowed-treasure'],
    cast: { wukong: 'Is taken not by a fighter but by a thrown object, and has his transformations closed off with an awl.',
      laozi: 'Settles a war from a doorway with one piece of hardware he made himself and mentions to nobody.',
      erlang: 'Holds the field, sets the hound on the fallen prisoner, and takes the credit at court.' } },

  /* ---- Chapter 7 ---- */
  { ch: 7, key: 'unkillable', title: 'Blade, Fire and Thunder', loc: 'celestial-execution-ground', d: ce(139, 10), tension: 4, pov: 'jade-emperor',
    desc: 'Tied to the demon-subduing pillar and worked on with everything the court has: sword, axe, spear, sabre, fire and the thunder department’s lightning. Not a mark. Laozi points out why — peaches, wine and elixir have been cooked into him — and asks to have him back for the furnace.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['fire'],
    cast: { 'jade-emperor': 'Watches every instrument of execution his court owns fail on one prisoner in one morning.',
      laozi: 'Explains the failure by listing his own missing stock, and proposes to burn the elixir back out.',
      wukong: 'Takes the whole execution without a mark and without saying anything worth recording.' } },
  { ch: 7, key: 'furnace', title: 'Forty-Nine Days in the Furnace', loc: 'tushita-furnace', d: ce(139, 60), tension: 4, pov: 'wukong',
    desc: 'He works out that the Xun trigram is the wind corner and that where there is wind there is no fire, and crouches in it for seven times seven days. The smoke does the only damage: it leaves him with eyes that see through a shape to the thing wearing it. On the forty-ninth day the lid comes off and he kicks the furnace over.',
    items: [], threads: ['heaven-vs-monkey'], motifs: ['fire'],
    cast: { wukong: 'Survives the furnace by reading a diagram, and comes out with the fiery golden eyes that make him right about people for the rest of the book.',
      laozi: 'Opens his own furnace on the appointed day and is knocked flat by what comes out of it.' } },
  { ch: 7, key: 'the-wager', title: 'The Wager on the Palm', loc: 'celestial-hall', d: ce(139, 112), tension: 5, pov: 'buddha',
    desc: 'Thirty-six thunder generals ring him at the door of the throne hall and cannot close. The Buddha comes from Vulture Peak, listens to a demand for the throne, and offers a bet: one somersault out of an open hand. He goes a hundred and eight thousand li, finds five pink pillars at the end of the world, writes his name on the middle one and makes water at its foot.',
    items: ['cudgel'], threads: ['heaven-vs-monkey'], motifs: ['names'],
    cast: { buddha: 'Ends a war by making the terms small enough to accept, and does not raise his voice at any point in it.',
      wukong: 'Bets everything on the one ability nobody has ever matched, and loses inside a hand he never left.',
      'jade-emperor': 'Sends for the only power he has not tried, having spent his own army, his execution ground and his alchemist.' } },
  { ch: 7, key: 'five-phases-mountain', title: 'The Hand Becomes a Mountain', loc: 'five-phases-mountain', d: ce(140, 0), tension: 5, pov: 'wukong',
    desc: 'The five fingers turn to five joined peaks on the way down, and the pillar he signed was one of them. A paper of six gold characters is pasted on the summit, a local god is set to feed him iron pellets and molten copper, and Heaven names the banquet that follows the Feast for Peace.',
    items: [], threads: ['heaven-vs-monkey', 'scriptures'], motifs: ['names'],
    cast: { wukong: 'Is pinned under the hand he was trying to jump out of, with his own signature on it, for five hundred years.',
      buddha: 'Seals the mountain with six characters and leaves instructions for the day somebody comes to lift them.',
      'jade-emperor': 'Throws a banquet for a peace that was made entirely by a guest.' } },

  /* ---- Chapter 8 ---- */
  { ch: 8, key: 'three-baskets', title: 'Three Baskets for the East', loc: 'great-hall', d: ce(638, 120), tension: 2, pov: 'buddha',
    desc: 'The Buddha weighs the four continents out loud and finds the eastern one full of greed, killing and lawsuits, and beyond preaching to at a distance. There are three baskets of scripture that would answer it, and they will not be carried east by anyone who has not walked. He asks who will go and find the man to walk.',
    items: ['scriptures', 'cassock', 'pilgrim-staff', 'fillet'], threads: ['scriptures'], motifs: [],
    cast: { buddha: 'Sets the whole errand in motion by refusing to send the scriptures himself, because a thing carried easily is valued cheaply.',
      guanyin: 'Volunteers for the journey east and is given a cassock, a nine-ring staff and three fillets with three different spells.' } },
  { ch: 8, key: 'sha-converted', title: 'The Curtain-Raising General', loc: 'flowing-sands-river', d: ce(639, 10), tension: 3, pov: 'guanyin',
    desc: 'Something comes out of eight hundred li of water that will not float a feather. He was the general who raised the curtain at the throne, broken for a dropped crystal cup and knifed a hundred times a week ever since. He keeps nine skulls on a string because they are the only things the river will not sink.',
    items: [], threads: ['scriptures'], motifs: ['water', 'names'],
    cast: { guanyin: 'Takes the first of the three disciples out of a river by offering him a post instead of a punishment.',
      'sha-wujing': 'Stops fighting at the word “scripture pilgrim”, is given the surname Sand and the name Wujing, and is told to wait.',
      moksa: 'Goes down to the water first and is the one who gets close enough to be recognised.' } },
  { ch: 8, key: 'zhu-converted', title: 'Marshal of the Heavenly Reeds', loc: 'cloud-ladder-cave', d: ce(639, 20), tension: 3, pov: 'guanyin',
    desc: 'A boar on Fuling Mountain with a nine-toothed rake, who was Marshal of the Heavenly Reeds until he was drunk at the wrong banquet and trifled with the moon. He was sentenced to be born a man and got the wrong womb. She gives him the surname Pig and tells him to stop eating people and wait for somebody going west.',
    items: ['rake'], threads: ['scriptures'], motifs: ['hunger', 'names'],
    cast: { guanyin: 'Recruits her second disciple by pointing out that his diet is the only thing standing between him and a way back.',
      'zhu-bajie': 'Gives up killing travellers on a promise, keeps the rake, and settles down to wait in a cave he will later burn himself.',
      moksa: 'Fights him to a standstill at the cave mouth before anyone gets a word in.' } },
  { ch: 8, key: 'dragon-horse', title: 'The Dragon Hung in the Air', loc: 'celestial-hall', d: ce(639, 30), tension: 3, pov: 'guanyin',
    desc: 'A dragon prince is hanging in the air waiting to be executed for burning a pearl his father was given by the court. She goes to the Jade Emperor and asks for him — not pardoned, but reassigned: the pilgrim will need something to ride, and no ordinary horse will get over the mountains ahead.',
    items: [], threads: ['scriptures'], motifs: ['mercy-over-death'],
    cast: { guanyin: 'Turns a death sentence into a posting, which is the same move she made in the river and will make again on the mountain.',
      'jade-emperor': 'Hands over a condemned prisoner on request without asking what the errand is.',
      'white-dragon-horse': 'Is taken down from the execution and told to wait in a gorge for a man he will have to eat a horse to meet.' } },
  { ch: 8, key: 'promise-at-the-mountain', title: 'A Promise at the Mountain', loc: 'five-phases-mountain', d: ce(639, 40), tension: 3, pov: 'wukong',
    desc: 'The mountain has a voice under it. He can speak and eat and nothing else, and has been doing both for five hundred years. She offers the road west and the discipline that comes with it, and finds when she asks his name that it already carries the generation word of the school she is recruiting for.',
    items: [], threads: ['scriptures', 'master-and-disciple'], motifs: ['names'],
    cast: { wukong: 'Agrees to five hundred years of obedience in exchange for being let out, and means it at the time.',
      guanyin: 'Finds her third disciple already named for the work, and leaves without giving him a date.' } },
  { ch: 8, key: 'chang-an-shrine', title: 'Two Scabby Monks in Chang’an', loc: 'changan-assembly-temple', d: ce(639, 50), tension: 1, pov: 'guanyin',
    desc: 'They come into the capital as two mangy travelling monks with a bundle, take a corner of a local shrine, and swear the city’s gods to say nothing. Everything after this — the drowned dragon, the emperor’s tour of the underworld, the Grand Mass — happens with two of them sitting in the city watching it.',
    items: ['cassock', 'pilgrim-staff'], threads: ['scriptures'], motifs: ['disguise'],
    cast: { guanyin: 'Arrives in the capital a year before she is needed and spends it in disguise in a back shrine.',
      moksa: 'Carries the cassock and the staff through the gate on his back like a pedlar’s bundle.' } },

  /* ---- Chapter 9 ---- */
  { ch: 9, key: 'top-of-the-list', title: 'The Embroidered Ball', loc: 'changan-east-market', d: ce(620, 60), tension: 1, pov: 'chen-guangrui',
    desc: 'A scholar from Haizhou takes first place in the palace examination and is paraded through the streets for three days. On the third he passes under a tower where the chief minister’s daughter is choosing a husband by throwing a ball into the crowd, and it hits him on the head.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { 'chen-guangrui': 'Wins the examination, is married inside a week, and is posted to Jiangzhou as prefect before the month is out.',
      'yin-wenjiao': 'Throws the ball from the tower and gets the man she aimed at.',
      taizong: 'Signs off on the appointment that sends a new prefect down a river road with his wife and no escort.' } },
  { ch: 9, key: 'murder-at-the-ford', title: 'Murder at the Ford', loc: 'hong-river-ford', d: ce(620, 130), tension: 5, pov: 'liu-hong',
    desc: 'Two boatmen at the crossing look at the wife, then at the servant, then at the commission. They kill the servant and the prefect, weight the bodies, and one of them puts on the dead man’s clothes and takes his post and his household. The river dragon king, who was a golden carp bought and released a week earlier, keeps the body.',
    items: [], threads: ['tang-emperor'], motifs: ['water', 'disguise'],
    cast: { 'liu-hong': 'Murders a man for his coat, his papers and his wife, and holds all three for eighteen years without being questioned.',
      'chen-guangrui': 'Is killed at a river crossing on his way to his first posting, and not allowed to stay dead.',
      'yin-wenjiao': 'Watches her husband go into the water and agrees to the murderer’s terms because she is already carrying a child.' } },
  { ch: 9, key: 'river-float', title: 'The Child on the Plank', loc: 'jinshan-temple', d: ce(620, 200), tension: 4, pov: 'yin-wenjiao',
    desc: 'She bites the little toe off the baby’s left foot so that he can be identified, writes the whole account in blood, ties both to a plank and pushes it into the current. It fetches up at the monastery downstream, where the abbot takes the child in, hides the letter, and calls him River Float.',
    items: [], threads: ['tang-emperor'], motifs: ['water', 'names'],
    cast: { 'yin-wenjiao': 'Sends her son down a river with a mutilation for a mark and a confession for a document.',
      tripitaka: 'Is raised in a monastery under a name that describes how he arrived, and is told nothing until he is eighteen.' } },
  { ch: 9, key: 'mother-found', title: 'Eighteen Years and a Blood Letter', loc: 'hong-river-ford', d: ce(638, 90), tension: 4, pov: 'tripitaka',
    desc: 'The abbot gives him the letter at eighteen. He walks to the Jiangzhou yamen as a begging monk, gets past the door on the pretext of alms, and his mother knows him before he says anything, because she counts the toes on his left foot.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { tripitaka: 'Reads who he is off a piece of cloth and goes to find the woman who wrote it, with no plan beyond arriving.',
      'yin-wenjiao': 'Recognises a son she has not seen since the day she pushed him into a river, by a foot.' } },
  { ch: 9, key: 'vengeance', title: 'Sixty Thousand Men and a Ford', loc: 'hong-river-ford', d: ce(638, 120), tension: 4, pov: 'tripitaka',
    desc: 'The chief minister brings troops down the river road, takes both boatmen in their beds, and has them cut open at the crossing where it happened. The dragon king sends the body back with the pearl taken out of its mouth, and a man eighteen years drowned sits up on the bank.',
    items: [], threads: ['tang-emperor'], motifs: ['mercy-over-death'],
    cast: { tripitaka: 'Gets his father back and his mother’s name cleared, and then goes straight back to the monastery.',
      'chen-guangrui': 'Stands up alive at the ford he was killed at, having spent eighteen years as a guest in a water palace.',
      'liu-hong': 'Is executed at the exact spot, in front of the widow he took, eighteen years to the day.',
      'yin-wenjiao': 'Sees the whole thing through and does not survive the shame of the years in between.' } },

  /* ---- Chapter 10 ---- */
  { ch: 10, key: 'rain-wager', title: 'A Wager on Tomorrow’s Rain', loc: 'changan-east-market', d: ce(639, 120), tension: 3, pov: 'jing-dragon',
    desc: 'A water patrol reports a fisherman being told exactly where to cast by a diviner in the market whose castings never miss. The dragon king of the Jing River goes up in a scholar’s clothes and bets the man’s shopfront that he cannot name the hour and the depth of tomorrow’s rain.',
    items: [], threads: ['tang-emperor'], motifs: ['disguise', 'water'],
    cast: { 'jing-dragon': 'Picks a fight with a fortune-teller over a fisherman, in a human shape, for no reason but pride.',
      'yuan-shoucheng': 'Names an hour and a depth for tomorrow’s rain in front of witnesses and offers to sign for it.' } },
  { ch: 10, key: 'edict-altered', title: 'Two Inches and an Hour', loc: 'jing-river', d: ce(639, 125), tension: 4, pov: 'jing-dragon',
    desc: 'The edict comes down that afternoon with the diviner’s own figures on it, to the hour and the inch. So he moves the hour and shorts the fall by two inches to win the bet — and by the time he has finished being pleased with himself he has broken the law of Heaven in writing.',
    items: [], threads: ['tang-emperor'], motifs: ['water'],
    cast: { 'jing-dragon': 'Wins a wager by falsifying an imperial edict, and is told his sentence by the man he beat.',
      'yuan-shoucheng': 'Refuses to be frightened by a dragon in his own shop, and names the hour and the officer of the execution.' } },
  { ch: 10, key: 'dream-and-chess', title: 'Beheaded Over a Chessboard', loc: 'changan-daming-palace', d: ce(639, 130), tension: 4, pov: 'taizong',
    desc: 'The dragon kneels in the emperor’s dream and is promised his life, so the emperor keeps his minister at the chessboard all morning to stop him getting to the execution. Wei Zheng nods off over the board at the third quarter of noon, and a head falls out of the clouds into the street outside.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { taizong: 'Gives a promise he has the authority to give and no power at all to keep.',
      'wei-zheng': 'Carries out an execution in Heaven without leaving his own chair, in the middle of a game he is winning.',
      'jing-dragon': 'Is beheaded on schedule despite an emperor’s personal guarantee.' } },
  { ch: 10, key: 'the-haunting', title: 'The Head at the Door', loc: 'changan-daming-palace', d: ce(639, 140), tension: 3, pov: 'taizong',
    desc: 'The ghost comes nightly with the head in its hand asking for the life it was promised. Two generals stand the door in armour and it stops; then their painted likenesses are pasted up and it stops for good; and Guanyin, still lodging in the city as a shabby monk, waves it off with a willow spray.',
    items: [], threads: ['tang-emperor', 'scriptures'], motifs: [],
    cast: { taizong: 'Is haunted into his bed by a debt he could not pay, and gets the first two door-gods out of it.',
      guanyin: 'Steps in exactly once, unannounced, and lets the emperor think the generals did it.' } },
  { ch: 10, key: 'letter-to-cui', title: 'A Letter for the Underworld', loc: 'changan-daming-palace', d: ce(639, 150), tension: 3, pov: 'wei-zheng',
    desc: 'The emperor is dying and everyone knows where he is going. His minister writes a letter to an old colleague — now a judge in the courts below — folds it, and puts it into the imperial sleeve, and tells him to hand it over at the gate.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { 'wei-zheng': 'Uses a personal connection in the underworld the way he would use one in the provinces, and it works.',
      taizong: 'Dies with a letter of introduction in his sleeve and is not told what is in it.' } },

  /* ---- Chapter 11 ---- */
  { ch: 11, key: 'gate-of-ghosts', title: 'Judge Cui at the Gate', loc: 'underworld-gate', d: ce(639, 151), tension: 3, pov: 'taizong',
    desc: 'The letter is read at the gate by a judge who bows as though the court were still sitting. Then the road out of it fills with the emperor’s own dead — the brothers he killed to take the throne — and it takes a blue-faced servant with a stick to get him through them.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { taizong: 'Arrives in the underworld with a letter and discovers he has creditors there.',
      'cui-jue': 'Reads his old colleague’s handwriting and decides, before the hearing, which way it is going to go.' } },
  { ch: 11, key: 'years-altered', title: 'Thirteen Made Thirty-Three', loc: 'underworld-hall-of-judgment', d: ce(639, 152), tension: 4, pov: 'cui-jue',
    desc: 'The Ten Kings hear the dragon’s complaint and find for the emperor, because the beheading was ordered above and not by him. Then the register is fetched to see how long he has left, and the judge puts two strokes on a thirteen while the book is in his hands.',
    items: ['register'], threads: ['tang-emperor'], motifs: [],
    cast: { 'cui-jue': 'Forges twenty years onto a living man’s entry in front of the Ten Kings and is not contradicted.',
      taizong: 'Is acquitted of a killing he did try to prevent, and given two decades he did not earn.' } },
  { ch: 11, key: 'eighteen-hells', title: 'The Eighteen Hells and the Bridge', loc: 'underworld-hells', d: ce(639, 153), tension: 4, pov: 'taizong',
    desc: 'The way back runs the long way round: Back-Shade Mountain, the eighteen courts of punishment named one after another, and the Bridge of No Alternative with the river under it. He is shown all of it, and told at each stop which of the things happening below is done to whom, and for what.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { taizong: 'Is walked through every punishment in the system by a guide who does not spare him a single court.',
      'cui-jue': 'Conducts the tour as an official escort, and answers every question about who is in which hell.' } },
  { ch: 11, key: 'borrowed-gold', title: 'A Storehouse Borrowed', loc: 'underworld-city-of-the-wronged', d: ce(639, 154), tension: 3, pov: 'taizong',
    desc: 'The wrongly dead block the road and want their lives back. There is a Kaifeng waterseller who has been burning paper money down here for years and has a storehouse of it standing to his name, so the emperor signs a bond against a poor man’s savings, pays the crowd off, and is let through.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { taizong: 'Borrows a stranger’s whole fortune to buy his way past his own casualties, and writes an IOU for it.',
      'cui-jue': 'Suggests the loan, names the creditor, and witnesses the bond.' } },
  { ch: 11, key: 'liu-quan', title: 'Liu Quan Takes Poison', loc: 'underworld-hall-of-judgment', d: ce(639, 160), tension: 3, pov: 'liu-quan',
    desc: 'Back in his coffin, the emperor frees prisoners and three thousand palace women and posts a notice for someone to carry pumpkins to the Ten Kings. A man whose wife hanged herself over a gold hairpin puts the melons on his head and swallows poison, and finds her in the hall.',
    items: [], threads: ['tang-emperor'], motifs: ['mercy-over-death'],
    cast: { 'liu-quan': 'Volunteers to die as an errand because there is nothing left at home he wants, and gets an answer he did not ask for.',
      taizong: 'Pays his underworld debts by public tender, and is taken up on the offer within the day.' } },

  /* ---- Chapter 12 ---- */
  { ch: 12, key: 'borrowed-body', title: 'A Wife in a Princess’s Body', loc: 'changan-daming-palace', d: ce(639, 165), tension: 2, pov: 'taizong',
    desc: 'The emperor’s sister drops dead in the garden and stands up again speaking as a waterseller’s wife from Junzhou, asking for her husband. And the waterseller, when he is sent for, will not take the borrowed gold back — so it is spent on a temple instead.',
    items: [], threads: ['tang-emperor'], motifs: [],
    cast: { taizong: 'Watches an underworld transaction settle itself in his own garden, and turns a refused debt into a building.',
      'liu-quan': 'Gets his wife back in a princess’s body and has to be told, twice, that this is allowed.' } },
  { ch: 12, key: 'mass-decreed', title: 'The Grand Mass of Land and Water', loc: 'changan-assembly-temple', d: ce(639, 180), tension: 2, pov: 'taizong',
    desc: 'What he saw below cannot be paid off with paper money, so a Grand Mass for the Dead is decreed. A minister petitions against the whole Buddhist establishment as a foreign import and is overruled in open court, and the empire is searched for a celebrant.',
    items: [], threads: ['tang-emperor', 'scriptures'], motifs: [],
    cast: { taizong: 'Commissions the largest religious ceremony of his reign on the strength of a tour he cannot describe to anyone.',
      'wei-zheng': 'Argues down the anti-Buddhist petition and chairs the selection of a celebrant.' } },
  { ch: 12, key: 'tripitaka-chosen', title: 'The Celebrant Chosen', loc: 'changan-assembly-temple', d: ce(639, 190), tension: 2, pov: 'tripitaka',
    desc: 'Twelve hundred monks are examined and one is picked: a monk from the womb, the murdered scholar’s son, the chief minister’s grandson, raised in a monastery on a river. The whole of the ninth chapter turns out to have been the appointment papers.',
    items: [], threads: ['scriptures', 'tang-emperor'], motifs: [],
    cast: { tripitaka: 'Is selected out of twelve hundred candidates, and the reasons given are all things that happened to him before he could speak.',
      taizong: 'Meets the man he is about to swear brotherhood with, and notices the family name.' } },
  { ch: 12, key: 'cassock-sold', title: 'Two Ragged Monks and a Price', loc: 'changan-west-market', d: ce(639, 225), tension: 2, pov: 'guanyin',
    desc: 'The two shabby monks appear in the market hawking a cassock at five thousand taels and a staff at two thousand, which is an absurd price and the point. Asked what they are worth to a man of virtue, they say nothing at all, and hand both over for free the moment they hear who the celebrant is.',
    items: ['cassock', 'pilgrim-staff'], threads: ['scriptures'], motifs: ['disguise'],
    cast: { guanyin: 'Prices two priceless objects out of reach so that the only man who can have them is the one who will not pay.',
      moksa: 'Carries the goods and does the haggling while his teacher watches the street.' } },
  { ch: 12, key: 'great-vehicle', title: 'Small Vehicle, Great Vehicle', loc: 'changan-assembly-temple', d: ce(639, 232), tension: 3, pov: 'guanyin',
    desc: 'She interrupts the reading in front of the court: what is being recited cannot raise the dead, and there are three baskets in the west that can. Then she goes up on a cloud in her own shape long enough for a court painter to get it down, and the celebrant offers to go and fetch them.',
    items: ['cassock', 'scriptures'], threads: ['scriptures'], motifs: [],
    cast: { guanyin: 'Reveals herself at the exact moment a whole court is watching, and leaves before anyone can ask a follow-up question.',
      tripitaka: 'Volunteers for a fourteen-year journey in front of an emperor, having been a celebrant for less than a month.',
      taizong: 'Swears brotherhood with a monk in open court and gives him a by-name for the three baskets he is to bring back.',
      moksa: 'Stands at the back of the hall while his teacher does the talking, and goes up with her.' } },
  { ch: 12, key: 'pinch-of-dust', title: 'A Pinch of Dust in the Wine', loc: 'changan-departure-point', d: ce(639, 240), tension: 2, pov: 'taizong',
    desc: 'A rescript stamped with the imperial seal, a purple-gold begging bowl, two attendants and a horse. At the west gate the emperor bends down, takes a pinch of dust off the road and drops it into the farewell cup: better one handful of your own country than ten thousand ounces of somewhere else.',
    items: ['rescript', 'alms-bowl'], threads: ['scriptures', 'tang-emperor'], motifs: [],
    cast: { taizong: 'Sends his sworn brother west with a document, a bowl and the best line in the chapter.',
      tripitaka: 'Rides out of the west gate with two attendants who will both be dead inside a fortnight.' } },

  /* ---- Chapter 13 ---- */
  { ch: 13, key: 'famen-temple', title: 'The Vow at Famen Temple', loc: 'famen-temple', d: ce(639, 250), tension: 2, pov: 'tripitaka',
    desc: 'His first night outside the walls, and five hundred monks sit up arguing about what is on the road ahead — the water, the tigers, the demons. He answers that where the mind makes demons the mind unmakes them, points at his own heart, and swears to burn incense at every shrine he passes and sweep every pagoda.',
    items: ['rescript'], threads: ['scriptures'], motifs: [],
    cast: { tripitaka: 'Sets the terms of his own journey on night one: no turning back, and a vow about pagodas he will be held to eighty chapters later.' } },
  { ch: 13, key: 'tiger-pit', title: 'General Yin’s Table', loc: 'shuangcha-ridge', d: ce(639, 258), tension: 5, pov: 'tripitaka',
    desc: 'They ride out before the moon has set and go into a pit. The owner is a tiger spirit entertaining a bear lord and a buffalo, and the two attendants are cut open and eaten at the table while the monk is held aside for later. At daybreak an old man cuts the ropes, names the three beasts, and leaves on a white crane.',
    items: [], threads: ['scriptures'], motifs: [],
    cast: { tripitaka: 'Loses both his attendants in one night and is kept alive because the host has eaten enough.',
      taibai: 'Comes down as an old man with a staff, cuts the ropes, breathes on the horse, and does not stay to be thanked.' } },
  { ch: 13, key: 'liu-boqin', title: 'The Guardian of the Mountain', loc: 'liu-farm', d: ce(639, 265), tension: 2, pov: 'liu-boqin',
    desc: 'A hunter kills a striped tiger with a trident on the path and takes the monk home as a countryman of the same emperor. The women scour a pan clean of grease to cook him millet. He reads the death sutras for the hunter’s father, and every person in the house dreams the same dream that night.',
    items: [], threads: ['scriptures'], motifs: [],
    cast: { 'liu-boqin': 'Feeds a monk who will not eat what his house eats, and gets his father out of the underworld for it.',
      tripitaka: 'Pays for his supper with the only currency he has, and it works.' } },

  /* ---- Chapter 14 ---- */
  { ch: 14, key: 'seal-peeled', title: 'The Six Gold Words', loc: 'five-phases-mountain', d: ce(640, 15), tension: 4, pov: 'tripitaka',
    desc: 'The hunter turns back at the border of Tang and a shout comes up out of the rock: my master is here. There is a head in a stone box with grass on it and mud in its eyes. He climbs to the summit, prays that the paper come away only if this is really his disciple, and a scented wind takes it out of his hand.',
    items: [], threads: ['scriptures', 'master-and-disciple'], motifs: ['names'],
    cast: { tripitaka: 'Peels a seal off a mountain on a conditional prayer and gets a disciple who has been waiting five hundred years for him.',
      wukong: 'Kowtows four times to a man he could kill by accident, takes the road name Pilgrim, and is out.',
      'liu-boqin': 'Walks the monk to the frontier, sees the mountain split, and goes home.' } },
  { ch: 14, key: 'six-brigands', title: 'Six Thieves on the Road', loc: 'six-brigands-road', d: ce(640, 25), tension: 4, pov: 'wukong',
    desc: 'Six robbers stop them and introduce themselves by name — Eye That Sees, Ear That Hears, Nose That Smells, Tongue That Tastes, Mind That Conceives, Body That Bears. He lets them beat on his head for a while to see how it feels, and then kills all six and strips them, and cannot understand why his master is upset.',
    items: ['cudgel'], threads: ['master-and-disciple'], motifs: [],
    cast: { wukong: 'Kills the six senses in a single paragraph, is lectured for it, and walks out east in a temper.',
      tripitaka: 'Discovers on the second day what kind of disciple he has been given, and has no way at all of controlling him.' } },
  { ch: 14, key: 'the-fillet', title: 'The Cap and the Spell', loc: 'five-phases-mountain', d: ce(640, 32), tension: 4, pov: 'tripitaka',
    desc: 'An old woman on the road gives the monk a cotton robe and a gold-flowered cap and teaches him a rhyme to go with them; then she goes up on a cloud eastward and the disciple, back from a cup of tea and a lecture at the dragon palace, works out who she was too late. The band takes root in the skin the first time the rhyme is said.',
    items: ['fillet'], threads: ['fillet', 'master-and-disciple'], motifs: ['borrowed-treasure'],
    cast: { tripitaka: 'Is handed the only piece of authority he will ever have over his own disciple, and is not told what it costs.',
      wukong: 'Puts on a hat because it is pretty and finds he cannot take it off, and spends the rest of the book being punished by a man he could kill.',
      guanyin: 'Delivers the fillet in the shape of an old woman and is on a cloud before either of them understands what has happened.' } },

  /* ---- Chapter 15 ---- */
  { ch: 15, key: 'horse-swallowed', title: 'The Stream Takes the Horse', loc: 'eagle-grief-stream', d: ce(640, 45), tension: 4, pov: 'tripitaka',
    desc: 'Something comes out of the gorge, takes the white horse whole with the saddle still on it, and goes back under. The luggage has to be carried by hand. Voices in the air name themselves — the Six Ding and Six Jia, the Guardians of the Five Quarters, the Four Sentinels — and say they have been assigned in shifts.',
    items: [], threads: ['scriptures'], motifs: ['water'],
    cast: { tripitaka: 'Loses the emperor’s horse on the third week and sits down on the bank rather than walk.',
      wukong: 'Cannot get a thing that lives in water to come out of it, and learns for the first time that he has been given help he did not ask for.' } },
  { ch: 15, key: 'dragon-made-horse', title: 'The Third Prince Becomes the Horse', loc: 'eagle-grief-stream', d: ce(640, 52), tension: 3, pov: 'guanyin',
    desc: 'She calls the dragon out by name, takes the pearl from under his throat, and blows on him until he is the exact horse he swallowed. Then, before she goes, she pulls three hairs from the back of the monkey’s head and puts them there for a day when nobody is coming.',
    items: [], threads: ['scriptures'], motifs: ['transformation'],
    cast: { guanyin: 'Turns the thing that ate the horse into the horse, and leaves an insurance policy in the back of a disciple’s scalp.',
      'white-dragon-horse': 'Stops being a prince under sentence and becomes transport, and does not speak again for fifteen chapters.',
      wukong: 'Is given three life-saving hairs and complains, at the time, that it is not enough.' } },

  /* ---- Chapter 16 ---- */
  { ch: 16, key: 'cassock-shown', title: 'Twelve Chests of Cassocks', loc: 'guanyin-monastery', d: ce(640, 70), tension: 3, pov: 'wukong',
    desc: 'The abbot is two hundred and seventy years old and has seven hundred robes in twelve chests, and has them all carried out to be admired. So the disciple opens their own bundle against explicit instructions, and the room fills with light, and an old man who has spent two and a half centuries collecting cloth stops being able to think about anything else.',
    items: ['cassock'], threads: ['scriptures'], motifs: ['borrowed-treasure'],
    cast: { wukong: 'Shows off his master’s property to a stranger for the pleasure of winning, and starts the fire that follows.',
      tripitaka: 'Tells his disciple not to open the bundle, is overruled, and hands the cassock to a man who cannot be trusted with it overnight.',
      'guanyin-abbot': 'Weeps in front of his guests over a robe he has owned for four hours, and goes to the back room to talk about knives.' } },
  { ch: 16, key: 'monastery-burnt', title: 'A Cover, and a Wind', loc: 'guanyin-monastery', d: ce(640, 76), tension: 5, pov: 'wukong',
    desc: 'The plan settled on in the back room is to stack firewood round the meditation hall and burn the guests in it. He hears the whole thing from the rafters as a bee, borrows a fire-proof cover from the Broad-Eyed Heavenly King, roofs his own master with it, and then fans the monks’ fire until it takes the monastery down to the walls. Twenty li off, a bear smells smoke and comes to help.',
    items: ['cassock'], threads: [], motifs: ['fire'],
    cast: { wukong: 'Protects one room and lets two hundred and seventy monks burn their own house down, and finds it funny.',
      'guanyin-abbot': 'Sets a fire to kill two guests and loses his monastery, his chests and eventually his own life to it.',
      'black-bear': 'Comes over the hill to help put a fire out, finds an unburnt room with a light in it, and takes the light home.' } },

  /* ---- Chapter 17 ---- */
  { ch: 17, key: 'jinchi-impersonated', title: 'Wearing the Dead Abbot’s Face', loc: 'black-wind-mountain', d: ce(640, 84), tension: 3, pov: 'wukong',
    desc: 'On the slope a bear, a Daoist and a white-robed scholar sit on the grass talking alchemy and planning a Buddha Robe Assembly for the bear’s birthday, with the stolen cassock as the centrepiece. One blow kills the scholar, who turns out to be a white snake. Then he kills the messenger, reads the invitation, and walks in wearing the burnt abbot’s shape.',
    items: ['cassock'], threads: [], motifs: ['disguise'],
    cast: { wukong: 'Gets as far as a cup of tea inside the cave wearing a dead man’s face, and is given away by a patrol that saw the corpse.',
      'black-bear': 'Plans a party around somebody else’s robe and invites the man he stole it from, not knowing he is ash.' } },
  { ch: 17, key: 'pill-and-fillet', title: 'Guanyin as the Alchemist', loc: 'black-wind-mountain', d: ce(640, 90), tension: 4, pov: 'guanyin',
    desc: 'She takes the shape of the wolf immortal whose invitation was intercepted; he becomes the larger of the two pills on the tray. The bear swallows him, and the second of the three fillets goes onto a head that cannot get it off. Rather than kill him she keeps him, and gives him a mountain of hers to guard.',
    items: ['cassock', 'fillet'], threads: ['who-owns-the-demon'], motifs: ['transformation', 'mercy-over-death'],
    cast: { guanyin: 'Wears a demon’s shape to catch a demon, and then hires him — which is what she does with almost everyone.',
      'black-bear': 'Swallows the wrong pill, takes the second fillet, and ends the chapter employed rather than dead.',
      wukong: 'Points out that the bodhisattva has just impersonated a demon, and is told that demon and bodhisattva are both only appearances.' } },

  /* ---- Chapter 18 ---- */
  { ch: 18, key: 'cassock-returned', title: 'The Cave Burnt, the Robe Back', loc: 'guanyin-monastery', d: ce(640, 92), tension: 2, pov: 'tripitaka',
    desc: 'He fires the Black Wind Cave behind him and brings the cassock back at dusk. What is left of the monastery empties its purse for a thanksgiving, and the party leaves the next morning with one robe, one horse and about two hundred fewer people in the world than when they arrived.',
    items: ['cassock'], threads: ['scriptures'], motifs: ['fire'],
    cast: { tripitaka: 'Gets his property back and does not connect the ruin around him to the disciple who handed it over.',
      wukong: 'Returns the robe, having burnt two buildings and killed a snake to do it, and expects to be thanked.' } },
  { ch: 18, key: 'pig-in-the-dark', title: 'Sitting in the Daughter’s Place', loc: 'gao-village', d: ce(640, 98), tension: 3, pov: 'wukong',
    desc: 'The squire has had a pig for a son-in-law for three years and his daughter shut in the back court for half of one. So the disciple takes her shape, sits in her room, and lets the thing that comes in at dusk talk: a rake of nine teeth, thirty-six transformations, a cave on Fuling Mountain, and a name. Then he shows his own face.',
    items: ['rake'], threads: ['scriptures'], motifs: ['disguise'],
    cast: { wukong: 'Learns everything about the next disciple by pretending to be the woman he married.',
      'squire-gao': 'Would pay any price to be rid of a son-in-law who works his fields, eats too much, and cannot be divorced.',
      'zhu-bajie': 'Talks freely to his own wife about his cave, his weapon and his history, in the dark, to the wrong person.',
      tripitaka: 'Waits in the front hall while his disciple handles it, which becomes the standard arrangement.' } },

  /* ---- Chapter 19 ---- */
  { ch: 19, key: 'rake-and-oath', title: 'The Rake and the Oath', loc: 'cloud-ladder-cave', d: ce(640, 105), tension: 4, pov: 'zhu-bajie',
    desc: 'A night of fighting at the cave door, in which the rake is named as Laozi’s own work and not a farm tool. Then one phrase — scripture pilgrim — ends what a night of fighting could not. He throws the rake down, fires his own cave so there is nothing to come back to, kneels, and is given a by-name for the five pungent roots and three forbidden meats.',
    items: ['rake'], threads: ['scriptures', 'bajie-appetite'], motifs: ['names', 'fire'],
    cast: { 'zhu-bajie': 'Burns his own house to prove he means it, keeps the name Guanyin gave him, and takes a second one about food.',
      wukong: 'Fights him all night and converts him with one word, and never lets him forget which of the two happened first.',
      tripitaka: 'Acquires a second disciple, and with him a permanent argument at every meal.' } },
  { ch: 19, key: 'heart-sutra', title: 'The Crow’s Nest and the Heart Sutra', loc: 'pagoda-mountain', d: ce(640, 112), tension: 1, pov: 'tripitaka',
    desc: 'A Chan master living in a nest of woven grass in a juniper gives him fifty-four lines against the demons of the road, which he has by heart at one hearing. Then a verse about what is ahead, which the monkey takes as a personal insult and which turns out, eighty chapters later, to have been an itinerary.',
    items: ['heart-sutra'], threads: ['scriptures'], motifs: [],
    cast: { tripitaka: 'Is given the one text he never forgets and never understands, and recites it at every frightening noise for fourteen years.',
      'crow-nest': 'Hands over the Heart Sutra and a verse of the road, and goes up into the nest when the cudgel comes out.',
      wukong: 'Takes offence at a poem, swings at a tree, and is the only one who notices the verse was about all four of them.',
      'zhu-bajie': 'Wants to know why a master in a nest could not simply fly them there, and gets no answer.' } },

  /* ---- Chapter 20 ---- */
  { ch: 20, key: 'tiger-vanguard', title: 'The Skin on the Stone', loc: 'yellow-wind-ridge', d: ce(641, 20), tension: 4, pov: 'wukong',
    desc: 'A farmer of sixty-one has already told them the scriptures are not hard to fetch, only the road is. On the ridge the wind smells wrong. A tiger stands up on the path, tears its own hide off and throws it over a rock, and while both disciples are beating an empty skin their master is lifted out of the saddle.',
    items: [], threads: ['scriptures'], motifs: ['transformation'],
    cast: { wukong: 'Smells the demon before it appears, says so, and still loses the master to the oldest trick on the road.',
      'zhu-bajie': 'Chases a skin with great enthusiasm for as long as it takes for the horse to be left standing alone.',
      tripitaka: 'Is carried off for the first of many times, from the middle of a road, in daylight.' } },
  { ch: 20, key: 'wind-stilling-post', title: 'Bound to the Wind-Stilling Post', loc: 'yellow-wind-ridge', d: ce(641, 26), tension: 3, pov: 'yellow-wind-demon',
    desc: 'The cave lord will not eat him for three or five days in case the disciples come — a caution the whole rest of the book confirms as sound. The monk is tied to a post in the back garden. Out at the gate the Tiger Vanguard, who lost his own skin winning him, dies on the rake.',
    items: ['rake'], threads: ['scriptures'], motifs: [],
    cast: { 'yellow-wind-demon': 'Postpones his own dinner on the correct assumption that someone will come for it.',
      tripitaka: 'Spends the night tied to a post in a garden, and is left alive by an act of caution rather than mercy.',
      'zhu-bajie': 'Kills the vanguard at the gate and takes it as proof that this is going to be simple.' } },

  /* ---- Chapter 21 ---- */
  { ch: 21, key: 'samadhi-wind', title: 'The Wind That Blinds', loc: 'yellow-wind-ridge', d: ce(641, 30), tension: 4, pov: 'wukong',
    desc: 'A hundred hair-doubles are spun like spindles by one breath of Samadhi Wind, and the eyes that came through the eight-trigram furnace are scoured shut. An old farmer salves them with an ointment out of an agate pot; at dawn there is no house on the slope, only trees and a verse, because the guardians assigned at the stream are keeping their word.',
    items: [], threads: [], motifs: [],
    cast: { wukong: 'Is beaten by weather, blinded, and healed overnight by people he has never bothered to thank.',
      'yellow-wind-demon': 'Wins the only fight in the book that is won by breathing.',
      'zhu-bajie': 'Leads his blind brother off the ridge and finds the farmhouse that is not there in the morning.' } },
  { ch: 21, key: 'marten-taken', title: 'A Rat From Under the Buddha’s Own Hill', loc: 'yellow-wind-ridge', d: ce(641, 36), tension: 3, pov: 'lingji',
    desc: 'Three thousand li south, Lingji takes down the Flying Dragon Staff the Buddha left with him and comes back on a cloud. The staff becomes an eight-clawed dragon and shakes the cave lord into his true shape: a yellow marten who used to steal oil from a lamp on Vulture Peak. He is taken up to be judged, and the monk is untied.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['transformation'],
    cast: { lingji: 'Comes when he is fetched, settles the fight in one throw, and takes the prisoner away to be dealt with by the Buddha.',
      'yellow-wind-demon': 'Turns out to be a rodent from the Buddha’s own mountain with a stolen habit and a stolen wind.',
      wukong: 'Discovers the pattern he will meet another twenty times: the thing he cannot beat belongs to somebody upstairs.',
      tripitaka: 'Is cut down from the post and thanks a bodhisattva he did not know had been sent for.',
      'zhu-bajie': 'Goes through the cave afterwards looking for the luggage, and finds it.' } },

  /* ---- Chapter 22 ---- */
  { ch: 22, key: 'three-fights-in-water', title: 'Three Fights Under the Water', loc: 'flowing-sands-river', d: ce(641, 60), tension: 4, pov: 'zhu-bajie',
    desc: 'A tablet on the bank gives the width and the warning that a goose feather will not float here. Something comes straight out of the current at the monk. Bajie goes down after it twice and cannot win, and twice the ambush is spoiled by a brother who comes in too early; the third time it will not be drawn out at all.',
    items: ['staff', 'rake'], threads: ['scriptures'], motifs: ['water'],
    cast: { 'zhu-bajie': 'Fights the only kind of fight he is better at than his brother, and is interrupted twice by the brother.',
      wukong: 'Cannot fight under water and cannot stop himself interfering, and costs the party two days by it.',
      'sha-wujing': 'Holds the river against both of them and goes back to the bottom whenever the odds change.' } },
  { ch: 22, key: 'gourd-and-skulls', title: 'The Gourd and the Nine Skulls', loc: 'flowing-sands-river', d: ce(641, 66), tension: 2, pov: 'sha-wujing',
    desc: 'Two days of fighting end the same way the last two conversions did: somebody finally says the words “scripture pilgrim” out loud. He is shaved on the bank, takes the name Sand Monk, and strings the nine skulls of the pilgrims he ate around Guanyin’s red gourd, which becomes the boat that carries them over water no feather will float on.',
    items: [], threads: ['scriptures', 'sha-silence'], motifs: ['water', 'names'],
    cast: { 'sha-wujing': 'Turns the evidence of nine murders into a ferry, and joins the party that the ninth of them was walking to.',
      moksa: 'Comes down with the gourd, explains who everyone is, and leaves as soon as the boat floats.',
      tripitaka: 'Crosses eight hundred li on the skulls of the nine men who tried it before him, and is not told which.',
      wukong: 'Watches a river he could not fight in solved by somebody else in an afternoon.',
      'zhu-bajie': 'Gets a third brother, and is now second from the bottom instead of last.' } },

  /* ---- Chapter 23 ---- */
  { ch: 23, key: 'four-saints-offer', title: 'The Widow and Her Three Daughters', loc: 'four-saints-house', d: ce(641, 80), tension: 2, pov: 'tripitaka',
    desc: 'A rich house on an empty road, a widow with land in every direction, three daughters, and an offer: stay, marry, and stop walking. Three of them refuse flatly — one sits like stone, one looks at the floor, one says nothing — and the fourth cannot keep still on his chair.',
    items: [], threads: ['bajie-appetite'], motifs: [],
    cast: { tripitaka: 'Is offered everything he would need never to finish the journey, and refuses without appearing to consider it.',
      'zhu-bajie': 'Excuses himself to go and see about the horse, and goes round to the back door instead.',
      wukong: 'Knows exactly what the house is within a minute of the gate and says nothing, because it is more useful to watch.',
      'sha-wujing': 'Refuses on the grounds that he was given this post to work off a sentence, and would like to finish it.' } },
  { ch: 23, key: 'bajie-bound', title: 'The Shirt of Pearls', loc: 'four-saints-house', d: ce(641, 82), tension: 3, pov: 'zhu-bajie',
    desc: 'Blindfolded and turned round, he cannot catch a single daughter, so he is offered a pearl shirt to put on to settle the matter. The sleeves become ropes. At dawn there is no house on the road at all, only a stand of pines, a verse pinned in the branches, and four names on it.',
    items: [], threads: ['bajie-appetite'], motifs: [],
    cast: { 'zhu-bajie': 'Spends a night tied to a tree in a garment that was a test, and is cut down by the brothers who watched him walk into it.',
      guanyin: 'Sets the test as the mother of the house and leaves the verse that explains it.',
      'lishan-laomu': 'Comes down as one of the three daughters and does not say a word all evening.',
      manjusri: 'Is the second daughter, and is the one who fetches the shirt.',
      samantabhadra: 'Is the third, and is the one who ties the knot.' } },

  /* ---- Chapter 24 ---- */
  { ch: 24, key: 'fruit-refused', title: 'He Will Not Eat a Baby', loc: 'wuzhuang-temple', d: ce(641, 110), tension: 2, pov: 'tripitaka',
    desc: 'The Great Immortal has gone up to a lecture leaving orders that the coming monk be given two manfruits, because they poured tea together five hundred years ago. The fruit is shaped like a child three days old, with limbs and a face. He backs three feet away from the tray and will not touch it, so the two boys eat both themselves.',
    items: ['ginseng-fruit'], threads: [], motifs: ['hunger'],
    cast: { tripitaka: 'Refuses the rarest thing in the world because it looks like an infant, and cannot be argued round.',
      zhenyuan: 'Leaves hospitality instructions for a friend from a previous life and is a hundred li away when they go wrong.',
      qingfeng: 'Follows the letter of his orders, offers the fruit twice, and eats it rather than waste it.' } },
  { ch: 24, key: 'three-stolen', title: 'The Golden Mallet', loc: 'wuzhuang-temple', d: ce(641, 116), tension: 3, pov: 'wukong',
    desc: 'Bajie hears the boys through the kitchen wall and wants one. The garden god explains the rules — gold mallet, no iron near it, and the fruit sinks into earth the moment it touches the ground — and three come off the tree, one each. Then the boys count the branches, come up four short, and go into the hall to call a monk a thief to his face.',
    items: ['ginseng-fruit'], threads: ['bajie-appetite'], motifs: ['hunger'],
    cast: { wukong: 'Steals three of the rarest fruit in the world to settle an argument in a kitchen, and shares them out fairly.',
      'zhu-bajie': 'Swallows his whole without tasting it and immediately asks for another, which is what gives the theft away.',
      'sha-wujing': 'Eats his slowly and is the only one of the three who can describe what it tasted like.',
      qingfeng: 'Counts the tree, gets a number that is short by four, and goes and says so in the rudest terms available.' } },

  /* ---- Chapter 25 ---- */
  { ch: 25, key: 'tree-toppled', title: 'The Tree Comes Down', loc: 'wuzhuang-temple', d: ce(641, 118), tension: 4, pov: 'wukong',
    desc: 'Rather than stand there being called a thief he leaves a hair-double in his place to be shouted at, goes back to the garden, and pushes the root of a tree that has fruited thirty times in ten thousand years clean out of the earth. Every fruit on it sinks into the ground on the way down.',
    items: ['ginseng-fruit', 'cudgel'], threads: [], motifs: [],
    cast: { wukong: 'Destroys something irreplaceable because he did not enjoy being spoken to, and does not think about it again until he has to.',
      qingfeng: 'Locks four guests in for the night on his own authority and finds in the morning that the tree is on the ground.' } },
  { ch: 25, key: 'sleeve-of-heaven', title: 'The Sleeve That Held Them All', loc: 'wuzhuang-temple', d: ce(641, 122), tension: 4, pov: 'zhenyuan',
    desc: 'The Great Immortal comes back as a wandering priest, hears them out, and then opens one sleeve to the wind and takes four monks, a horse and the luggage into it. What follows is a beating with a dragon-hide whip, a night of untying, four willow trunks left tied to the pillars, and a cauldron of oil with a stone lion in it.',
    items: [], threads: [], motifs: ['transformation'],
    cast: { zhenyuan: 'Catches all four of them twice with the same sleeve and never once tries to kill anybody.',
      wukong: 'Takes his master’s beating as well as his own on legs turned to iron, and swaps a stone lion for himself in the oil.',
      tripitaka: 'Is caught, tied, beaten and boiled at second hand, and is the only one who asks what the tree was worth.',
      'zhu-bajie': 'Proposes running for it and is the reason the willow trunks are noticed at all.',
      'sha-wujing': 'Points out, tied to a pillar, that they did in fact destroy the tree.' } },

  /* ---- Chapter 26 ---- */
  { ch: 26, key: 'three-islands', title: 'Three Islands, No Cure', loc: 'wuzhuang-temple', d: ce(641, 126), tension: 3, pov: 'wukong',
    desc: 'The bargain is a living tree for four freed prisoners, and three days to find the method. The Star of Longevity and his brothers on Penglai have nothing for a tree; nor has the Lord of the East at Fangzhang; nor the Nine Elders of Yingzhou. He comes back on the third day with an empty gourd and one idea left.',
    items: [], threads: [], motifs: ['borrowed-treasure'],
    cast: { wukong: 'Spends his whole address book in three days and finds that nobody he knows can raise a plant.',
      zhenyuan: 'Keeps three hostages against a promise and is scrupulous about the deadline.',
      shouxing: 'Feeds the visitor, hears the problem, and admits that longevity is not the same as resurrection.' } },
  { ch: 26, key: 'sweet-dew', title: 'The Water in the Vase', loc: 'wuzhuang-temple', d: ce(641, 130), tension: 2, pov: 'guanyin',
    desc: 'She writes a reviving character in his palm, has a spring opened under the root, and takes the dew off her willow spray. The leaves come back on the branch. The count of fruit comes to twenty-three, not twenty-two, because the one that sank into the earth has come back with the tree; and the man whose garden was wrecked swears brotherhood with the monkey who wrecked it.',
    items: ['ginseng-fruit'], threads: ['who-owns-the-demon'], motifs: ['mercy-over-death'],
    cast: { guanyin: 'Solves in one visit what three islands of immortals could not, and does not comment on that.',
      zhenyuan: 'Gets his tree back, knocks ten fruits down for a feast, and becomes sworn brother to the vandal.',
      tripitaka: 'Eats a manfruit at last, at a table, having refused it as an infant on a tray.',
      wukong: 'Is forgiven by somebody he wronged, which happens to him twice in a hundred chapters.' } },

  /* ---- Chapter 27 ---- */
  { ch: 27, key: 'three-disguises', title: 'Girl, Mother, Father', loc: 'white-tiger-ridge', d: ce(642, 20), tension: 5, pov: 'wukong',
    desc: 'A corpse-spirit comes three times on a bare ridge — a girl with a rice pot full of maggots and toads, then an old woman looking for her, then an old man looking for both — and three times the cudgel comes down. Twice she sheds the body and gets away, and twice a monk sees his disciple murder a civilian on an empty road.',
    items: ['cudgel'], threads: ['master-and-disciple', 'fillet'], motifs: ['disguise', 'transformation'],
    cast: { wukong: 'Is right three times running and is punished harder each time for being right.',
      'white-bone-demon': 'Uses the one attack that works on this party: appearing harmless in front of the man who decides things.',
      tripitaka: 'Sees three killings and no demons, and recites the spell twice before lunch.',
      'zhu-bajie': 'Suggests, each time, that the corpse is a trick of his brother’s, and is believed.',
      'sha-wujing': 'Says nothing that survives into the argument, which is his usual share of these scenes.' } },
  { ch: 27, key: 'the-dismissal', title: 'The Letter of Dismissal', loc: 'white-tiger-ridge', d: ce(642, 26), tension: 5, pov: 'tripitaka',
    desc: 'The third blow leaves a heap of bones with a name lettered along the spine, and it changes nothing, because the fat one still says it is a trick. The letter is written on a stone by the stream. He makes three doubles of himself so his master has to accept the bow from four sides at once, and then goes.',
    items: [], threads: ['master-and-disciple', 'fillet'], motifs: [],
    cast: { tripitaka: 'Writes a document dismissing the only member of the party who can keep him alive, over the correct killing of a demon.',
      wukong: 'Leaves, but only after making it physically impossible for his master not to accept the farewell.',
      'zhu-bajie': 'Gets what he has been angling for since the ridge and is carrying the luggage again within a week.',
      'sha-wujing': 'Argues against the dismissal, is overruled, and is the one who watches him go.' } },

  /* ---- Chapter 28 ---- */
  { ch: 28, key: 'the-burnt-mountain', title: 'What Erlang Left', loc: 'ffm-encampment', d: ce(642, 30), tension: 3, pov: 'wukong',
    desc: 'He goes home. Of forty-seven thousand there are about a thousand left: the rest burned in the fire the heavenly army set, or were taken by hunters afterwards for their skins and for street shows. He kills a thousand hunters with a wind full of stones, dresses his people in their clothes, and puts a new banner up.',
    items: [], threads: ['heaven-vs-monkey'], motifs: [],
    cast: { wukong: 'Comes home to the cost of chapter seven, five hundred years late, and answers it with a massacre.' } },
  { ch: 28, key: 'the-pagoda', title: 'The Light Was Not a Temple', loc: 'bowyue-cave', d: ce(642, 36), tension: 4, pov: 'tripitaka',
    desc: 'Left alone in a wood while both disciples are out looking for food, he walks toward a golden glitter that he takes for a pagoda, lifts a bamboo curtain, and finds a monster asleep on a stone bed. The stone over the door says Bowyue Cave, Wanzi Mountain. He is tied to the soul-fixing post before either of them gets back.',
    items: [], threads: ['scriptures'], motifs: ['false-buddha'],
    cast: { tripitaka: 'Walks into a demon’s bedroom because the light looked religious, which is exactly the mistake he makes again at the false monastery.',
      'yellow-robe-monster': 'Wakes up to find dinner has let itself in and tied it up before breakfast.',
      'zhu-bajie': 'Comes back with the begging bowl to an empty clearing and a horse standing on its own.',
      'sha-wujing': 'Reads the stone over the door and fights at it for the rest of the day without result.' } },

  /* ---- Chapter 29 ---- */
  { ch: 29, key: 'the-letter', title: 'Thirteen Years and a Letter', loc: 'bowyue-cave', d: ce(642, 40), tension: 3, pov: 'baihuaxiu',
    desc: 'The woman at the post is the third princess of the Precious Elephant Kingdom, carried out of a moon-viewing party thirteen years ago. She unties him on one condition — that he carry a letter home — and the condition is the only reason he leaves the cave alive.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { baihuaxiu: 'Frees a prisoner to use him as a post rider, having waited thirteen years for one who could be trusted with paper.',
      tripitaka: 'Is let out of a cave by a hostage, and does the errand.' } },
  { ch: 29, key: 'the-court', title: 'The Letter Read Aloud', loc: 'precious-elephant-kingdom', d: ce(642, 45), tension: 3, pov: 'tripitaka',
    desc: 'The rescript is stamped and the visit is nearly over when he remembers the letter, and it is read out to the whole court. A king who has punished half his household for losing a daughter puts his face in his sleeve, and then asks which of the assembled generals will go and fetch her, and gets no answer at all.',
    items: ['rescript'], threads: ['kingdoms'], motifs: [],
    cast: { tripitaka: 'Delivers a letter that turns a routine passport stamp into a commission, and volunteers his disciples for it.',
      'zhu-bajie': 'Is talked into going back to the cave in front of a court, which is the only place that ever works on him.',
      'sha-wujing': 'Goes with him and is the one who is taken, because the guardian spirits are all back at the palace with the master.' } },

  /* ---- Chapter 30 ---- */
  { ch: 30, key: 'tiger-in-the-hall', title: 'The Monk Made a Tiger', loc: 'precious-elephant-kingdom', d: ce(642, 50), tension: 5, pov: 'yellow-robe-monster',
    desc: 'The demon walks into court as a handsome son-in-law, apologises charmingly for thirteen years of silence, and explains that the monk is the tiger that carried the princess off. Then he spits a mouthful of water at him and the court watches a monk become a tiger. He is caged in iron in the palace guardroom.',
    items: [], threads: ['kingdoms', 'master-and-disciple'], motifs: ['transformation', 'disguise'],
    cast: { 'yellow-robe-monster': 'Wins the whole chapter by being better mannered than anybody else in the room.',
      tripitaka: 'Is turned into the animal he is accused of being, in front of the court that stamped his passport.' } },
  { ch: 30, key: 'horse-fights', title: 'The Horse in a Maid’s Clothes', loc: 'precious-elephant-kingdom', d: ce(642, 55), tension: 4, pov: 'white-dragon-horse',
    desc: 'With one disciple caged, one taken and one in the brambles, the horse gets off the road for the only time in the book. He comes back into the banquet as a serving girl pouring wine that does not run out, and dances with a sword until an iron candle-tree breaks his hind leg.',
    items: [], threads: ['master-and-disciple'], motifs: ['transformation', 'disguise'],
    cast: { 'white-dragon-horse': 'Stops being luggage for one night, loses, and limps back to the stable to make the only useful suggestion in the chapter.',
      'yellow-robe-monster': 'Beats a dragon at his own wedding banquet without leaving the table for long.' } },

  /* ---- Chapter 31 ---- */
  { ch: 31, key: 'the-goading', title: 'The Lie That Works', loc: 'ffm-main-peak', d: ce(642, 60), tension: 3, pov: 'zhu-bajie',
    desc: 'The horse tells him to go and say only that their master misses him. On the mountain the monkey hears the plea out politely, feeds him fruit and sends him off — and has him dragged back by the ears for what he says on the road down. So he tries the other thing: the demon swore to skin you. The cliff is empty before he has finished the sentence.',
    items: [], threads: ['master-and-disciple'], motifs: [],
    cast: { 'zhu-bajie': 'Fails with the truth, invents an insult, and gets the result — the one piece of tactics he is ever right about.',
      wukong: 'Cannot be moved by his master’s need and cannot sit still for a rumour about his own reputation.' } },
  { ch: 31, key: 'kui-wood-wolf', title: 'Four Roll-Calls Missed', loc: 'celestial-hall', d: ce(642, 65), tension: 3, pov: 'wukong',
    desc: 'He takes the demon’s two children hostage, sits in the cave in the princess’s shape weeping until the thing offers up its own inner elixir to cure her heartache, and swallows it. Then Heaven counts the twenty-eight lodges and finds twenty-seven: Kui Wood Wolf has been absent four roll-calls, which is thirteen days above and thirteen years below.',
    items: [], threads: ['who-owns-the-demon', 'kingdoms'], motifs: ['disguise'],
    cast: { wukong: 'Wins by wearing a woman’s face and asking for a present, and then finds out the demon was on the heavenly payroll.',
      'jade-emperor': 'Discovers a star has been missing from four roll-calls and that nobody reported it.',
      'yellow-robe-monster': 'Turns out to be a lodge of the twenty-eight who came down after a jade maiden, and is demoted to stoking a furnace.',
      baihuaxiu: 'Is sent home to her father with an explanation she does not entirely accept.',
      tripitaka: 'Is let out of the cage and has the tiger washed off him with a mouthful of water from the emperor’s own bowl.' } },

  /* ---- Chapter 32 ---- */
  { ch: 32, key: 'the-woodcutter', title: 'A Warning From a Woodcutter', loc: 'pingding-mountain', d: ce(642, 120), tension: 3, pov: 'wukong',
    desc: 'A woodcutter on the slope names the mountain, the cave, two demon kings, five treasures between them, and their standing order: catch monks, and eat the one called Tang. Then he is not there, because he was the Day Sentinel, and the warnings from now on come with a name attached.',
    items: [], threads: ['scriptures'], motifs: ['disguise'],
    cast: { wukong: 'Is given a complete intelligence briefing before the episode starts and still loses the master.',
      tripitaka: 'Hears the whole warning, is frightened by it, and rides on anyway, which is the best thing about him.' } },
  { ch: 32, key: 'bajie-taken', title: 'The Portrait on a Spear', loc: 'pingding-mountain', d: ce(642, 125), tension: 3, pov: 'zhu-bajie',
    desc: 'Sent to scout, he sleeps in the red grass, is woken twice by a woodpecker that is not one, and rehearses his excuse on three boulders standing in for his master and his brothers — who have heard the whole performance. Then the real patrol comes past with a painted likeness of all four of them on a spear, and hooks him out of his coat.',
    items: [], threads: ['bajie-appetite'], motifs: ['disguise'],
    cast: { 'zhu-bajie': 'Practises a lie out loud to three rocks and is captured before he can deliver it.',
      wukong: 'Follows him as a woodpecker and lets the whole rehearsal run before saying anything.',
      'gold-and-silver-horn': 'Sends out patrols with a portrait, which is why this episode works when the others do not.' } },

  /* ---- Chapter 33 ---- */
  { ch: 33, key: 'three-mountains', title: 'Sumeru, Emei, Tai', loc: 'pingding-mountain', d: ce(642, 128), tension: 5, pov: 'wukong',
    desc: 'Silver Horn plays a priest with a broken leg and gets himself carried up the slope on the monkey’s back. Then the mountains come down one at a time — Sumeru shrugged off, Emei shouldered, and Tai, which pins him. The rest of the party is walked away while he is under it.',
    items: [], threads: [], motifs: ['disguise'],
    cast: { wukong: 'Is beaten by the one demon who thinks to attack him with geography, and pinned under a mountain for the second time in the book.',
      'gold-and-silver-horn': 'Rides his enemy up the hill on his own back before dropping three mountains on him.',
      tripitaka: 'Is taken off the road within sight of the disciple who is holding a mountain up.',
      'sha-wujing': 'Is roped and carried in with the luggage, protesting the whole way.' } },
  { ch: 33, key: 'gourd-swapped', title: 'A Gourd That Holds the Sky', loc: 'pingding-mountain', d: ce(642, 131), tension: 4, pov: 'wukong',
    desc: 'The mountain gods let him out — they have been called to duty in the cave and are tired of it. He meets the two errand-imps carrying the gourd and the vase and offers them a better gourd, one that holds the sky, and then has Nezha black the heavens out with the Dark Banner for half an hour to prove it.',
    items: ['gourd-and-vase'], threads: ['who-owns-the-demon'], motifs: ['borrowed-treasure', 'disguise'],
    cast: { wukong: 'Runs a confidence trick that requires Heaven itself as a stage prop, and gets Heaven to agree to it.',
      nezha: 'Turns the sky off for half an hour on request, without asking what the trick is for.' } },

  /* ---- Chapter 34 ---- */
  { ch: 34, key: 'the-old-mother', title: 'The Nine-Tailed Fox in the Chair', loc: 'pingding-mountain', d: ce(643, 20), tension: 4, pov: 'wukong',
    desc: 'Two more treasures are at the mother’s cave with the golden rope. He kills the messengers on the road, walks in and kneels to her as her own son, gets the whole story out of her, and then breaks her skull on the mountain path — a nine-tailed fox — and takes the rope and her face.',
    items: [], threads: [], motifs: ['disguise'],
    cast: { wukong: 'Kneels to a demon as her son and murders her ten minutes later, and carries her sedan chair home himself.' } },
  { ch: 34, key: 'rope-and-file', title: 'Filed Off, and the Gourd Lifted', loc: 'lotus-cave', d: ce(643, 24), tension: 4, pov: 'wukong',
    desc: 'Carried in as the old mother and bowed to by both kings, he asks for the pig’s ears as a relish — and the pig, hanging from the rafters, gives him away. The rope has a tightening spell and a loosening one and it is theirs, not his; so he files the collar through, leaves a hair in his place, and lifts the gourd out of a sleeping hand while the brothers are toasting each other.',
    items: ['gourd-and-vase'], threads: [], motifs: ['disguise'],
    cast: { wukong: 'Is undone by a joke he could not resist making, and gets out through the collar rather than the door.',
      'gold-and-silver-horn': 'Bows to his own mother, feeds her, and loses two of his five treasures over dinner.',
      'zhu-bajie': 'Recognises his brother from the rafters by the request for his ears, and says so out loud.' } },

  /* ---- Chapter 35 ---- */
  { ch: 35, key: 'name-for-name', title: 'The Gourd Answers to Anything', loc: 'pingding-mountain', d: ce(643, 27), tension: 4, pov: 'wukong',
    desc: 'Silver Horn holds the gourd up and calls the false name he was given, and nothing happens, because there is nobody by that name to answer. Then his own name is called and he goes in. The treasure does not care whether a name is true; it only cares that something answers to it.',
    items: ['gourd-and-vase'], threads: [], motifs: ['names'],
    cast: { wukong: 'Wins the exchange by understanding the rule of the object better than the people who own it.',
      'gold-and-silver-horn': 'Loses one of the two brothers to a device his own household has used for centuries.' } },
  { ch: 35, key: 'laozi-claims-them', title: 'They Were Never Theirs', loc: 'pingding-mountain', d: ce(643, 30), tension: 3, pov: 'laozi',
    desc: 'Gold Horn fans the ground alight with a plantain fan and loses the vase, then the fan, then himself. And then a blind old man on the road turns out to be Laozi, come for a gourd, a vase, a sword, a fan and a belt, and for the two boys who tend his gold and silver furnaces — lent out, he says, three times over, at a bodhisattva’s request, to find out whether these four meant it.',
    items: ['gourd-and-vase'], threads: ['who-owns-the-demon'], motifs: ['borrowed-treasure', 'fire'],
    cast: { laozi: 'Collects his own property and admits, without embarrassment, that the whole ordeal was commissioned.',
      wukong: 'Is told to his face that the hardest fight of the last four chapters was an examination somebody set for him.',
      tripitaka: 'Is untied, and does not ask what the two furnace-boys were doing on a mountain in the first place.' } },

  /* ---- Chapter 36 ---- */
  { ch: 36, key: 'shut-out', title: 'Turned Away at Baolin Monastery', loc: 'baolin-monastery', d: ce(643, 60), tension: 2, pov: 'tripitaka',
    desc: 'The prior looks at the ugly disciples and sends the whole party to squat in the corridor for the night. So the monkey breaks a stone lion in the courtyard into powder with one hand, and five hundred monks come out and kneel in the gateway and beg him to take the abbot’s own rooms.',
    items: [], threads: [], motifs: [],
    cast: { tripitaka: 'Is refused a bed for the first time since Chang’an, and cries about it in the corridor.',
      wukong: 'Solves a hospitality problem with property damage, which works perfectly and takes four seconds.' } },
  { ch: 36, key: 'the-moon', title: 'A Poem About the Moon', loc: 'baolin-monastery', d: ce(643, 64), tension: 1, pov: 'tripitaka',
    desc: 'Homesick under a full moon in a strange courtyard, he makes a poem about how far away Chang’an is. His disciple answers it with the waxing and waning as a figure for the work — the light gathers, holds, and is spent, and so does everything else — and for once the lesson goes the other way up the ladder.',
    items: [], threads: ['master-and-disciple'], motifs: [],
    cast: { tripitaka: 'Writes the homesick poem and is answered, correctly, by the disciple he dismissed nine chapters ago.',
      wukong: 'Turns out to have understood the doctrine better than the monk carrying it, and says so gently for once.',
      'zhu-bajie': 'Wants to know why they are standing in a yard at midnight talking about the moon.',
      'sha-wujing': 'Listens to both of them and takes the point, and is the only one who says so.' } },

  /* ---- Chapter 37 ---- */
  { ch: 37, key: 'the-drowned-king', title: 'A Wet King at the Door', loc: 'baolin-monastery', d: ce(643, 68), tension: 4, pov: 'wuji-king',
    desc: 'A dripping figure at the meditation-hall door at the third watch. Three years ago a rainmaking Daoist pushed him down the octagonal glazed well in his own garden, took his face, and has been reigning ever since — over his court, his queen and his son. He leaves a gold-set white jade tablet on the desk as proof and goes to dream the same visit to his wife.',
    items: [], threads: ['kingdoms'], motifs: ['disguise'],
    cast: { 'wuji-king': 'Has been dead and impersonated for three years and cannot get anybody living to notice.',
      tripitaka: 'Wakes with a jade tablet on the desk and a story he can neither verify nor ignore.' } },
  { ch: 37, key: 'in-the-box', title: 'Two Inches Tall in a Red Box', loc: 'baolin-monastery', d: ce(643, 72), tension: 3, pov: 'wuji-prince',
    desc: 'The monkey becomes a white hare, takes the prince’s arrow in flight, and leads him to the monastery gate, where the arrow is standing in the threshold and the hare is not there. Inside he is sold a treasure in a red lacquer box that knows fifteen hundred years, and the treasure tells him whose son he is.',
    items: [], threads: ['kingdoms'], motifs: ['transformation'],
    cast: { 'wuji-prince': 'Is lured off a hunt by a rabbit and told that the man on the throne killed his father.',
      wukong: 'Delivers the news two inches tall from inside a box, because the boy would not have listened to a monkey.',
      tripitaka: 'Sits in the hall with the box on the table and lets his disciple do all of it.' } },

  /* ---- Chapter 38 ---- */
  { ch: 38, key: 'the-question', title: 'Three Years of a Cold Bed', loc: 'wuji-kingdom', d: ce(643, 75), tension: 3, pov: 'wuji-queen',
    desc: 'He will not believe it until he is sent to ask his mother one question about the last three years, and she has dreamt the same dream at the fourth watch, and she knows the jade tablet by sight. The answer is that the man in her bed has not been her husband since the year the garden was shut.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { 'wuji-queen': 'Has known something was wrong for three years and has had nobody safe to say it to.',
      'wuji-prince': 'Asks his mother a question about her marriage and gets an answer that settles the whole case.' } },
  { ch: 38, key: 'the-well', title: 'What the Well Dragon King Kept', loc: 'wuji-kingdom', d: ce(643, 78), tension: 3, pov: 'zhu-bajie',
    desc: 'Under the plantain in the sealed garden there is a stone lid, and under that a water-crystal palace. The well dragon has kept the body three years with a face-fixing pearl, unspoiled. The pig carries it up on the end of the cudgel complaining the whole way, and works out on the climb that if he presents a corpse, somebody will have to be ordered to raise it.',
    items: [], threads: ['kingdoms'], motifs: ['water'],
    cast: { 'zhu-bajie': 'Does the actual heavy work of the chapter and spends the whole of it planning how to make his brother pay for it.',
      wukong: 'Sends him down the well on the pretext of treasure and is not surprised by what comes back up.',
      'wuji-king': 'Comes up out of his own garden well after three years, preserved by a stranger who had no reason to bother.' } },

  /* ---- Chapter 39 ---- */
  { ch: 39, key: 'the-pill', title: 'One Pill Out of Tushita', loc: 'tushita-palace', d: ce(643, 81), tension: 2, pov: 'laozi',
    desc: 'The old man counts his nine-times-reverted elixir out grain by grain and hands over exactly one. The visitor palms a second on the way past the tray and swallows it, is turned upside down and shaken, and gets to the gate anyway with the pill in his cheek.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['borrowed-treasure'],
    cast: { laozi: 'Gives one pill and is robbed of a second in his own house by the same thief as last time.',
      wukong: 'Asks properly, is given what he asked for, and steals more anyway out of habit.' } },
  { ch: 39, key: 'manjusri-claims-him', title: 'The Buddha’s Own Lion', loc: 'wuji-kingdom', d: ce(643, 85), tension: 4, pov: 'manjusri',
    desc: 'The pill goes down a dead throat with a mouthful of borrowed breath and a king three years drowned sits up in the garden. Then two identical kings stand in the hall until Manjusri comes down with the demon-revealing mirror: the false one is his own blue-haired lion, sent because this king once bound him in disguise and ducked him three days in the palace moat — and gelded, so that nobody in the harem was ever touched.',
    items: [], threads: ['who-owns-the-demon', 'kingdoms'], motifs: ['mercy-over-death'],
    cast: { manjusri: 'Claims his own mount and explains that the three-year usurpation was a proportionate sentence set by the Buddha.',
      'blue-lion-impostor': 'Is exposed by a mirror after three years of ruling well enough that nobody complained.',
      'wuji-king': 'Is brought back to life and immediately has to prove which of two identical men he is.',
      wukong: 'Breathes a king back to life and is then told the whole crime was a court order.',
      'zhu-bajie': 'Is made to carry the revived king to court because he wanted the credit for the corpse.' } },

  /* ---- Chapter 40 ---- */
  { ch: 40, key: 'the-child-in-the-pine', title: 'A Child Tied in a Pine', loc: 'roaring-mountain', d: ce(643, 200), tension: 4, pov: 'tripitaka',
    desc: 'Six hundred li of mountain with a red cloud sitting on it, and a boy of seven hanging roped in a pine tree crying about robbers. The monkey says at once that it is a demon and is told to be quiet; and then he is made to carry it.',
    items: [], threads: ['master-and-disciple', 'bull-family'], motifs: ['disguise'],
    cast: { tripitaka: 'Overrules a correct identification for the second time in six chapters and orders his disciple to carry the demon.',
      'red-boy': 'Uses the only bait this party reliably takes: a child in trouble beside the road.',
      wukong: 'Is right, is disbelieved, and carries a demon up a hill on his own shoulders under orders.' } },
  { ch: 40, key: 'whose-son', title: 'The Bull Demon King’s Son', loc: 'roaring-mountain', d: ce(643, 205), tension: 3, pov: 'wukong',
    desc: 'The weight on his back grows to a thousand catties, so he throws the boy down on a stone — and the demon leaves the empty body behind, rides a whirlwind, and takes the monk out of the saddle. The mountain gods supply the name: Red Boy, Sagely Boy King, three hundred years at the Fiery Mountains learning true fire. Which makes him, by an oath sworn five hundred years ago, the monkey’s nephew.',
    items: [], threads: ['bull-family', 'who-owns-the-demon'], motifs: ['names'],
    cast: { wukong: 'Discovers that the demon holding his master is family, and expects that to be worth something.',
      'red-boy': 'Leaves a corpse behind him and takes the man out of the saddle in the same movement.',
      'zhu-bajie': 'Hears the family connection and immediately proposes that his brother go and ask nicely.',
      'sha-wujing': 'Points out that a nephew who has never met you is not a nephew, and is ignored.' } },

  /* ---- Chapter 41 ---- */
  { ch: 41, key: 'samadhi-fire', title: 'Two Fists on His Own Nose', loc: 'fire-cloud-cave', d: ce(643, 208), tension: 5, pov: 'red-boy',
    desc: 'Five carts set out by the five phases at the cave mouth. The boy punches his own nose twice, and what comes out of it is not fire that the four Dragon Kings’ rain can touch — the rain feeds it. It is the smoke that does the damage: the same smoke that made those eyes in the first place.',
    items: [], threads: ['bull-family'], motifs: ['fire'],
    cast: { 'red-boy': 'Beats the strongest thing on the road with an element it has already survived once, in a different form.',
      wukong: 'Holds a fire-charm, walks in anyway, and comes out blind and choking into a cold stream.',
      'zhu-bajie': 'Runs, and comes back only when the fire is out and there is a body to rub.' } },
  { ch: 41, key: 'false-guanyin', title: 'A Bodhisattva on the Cliff', loc: 'fire-cloud-cave', d: ce(643, 212), tension: 4, pov: 'zhu-bajie',
    desc: 'Sent to Potalaka for help, he is met halfway by a Guanyin who takes his story kindly and walks him home — into the Fire Cloud Cave and into an as-you-will leather bag, hung from the rafters beside his master. And the monkey, wearing the Bull Demon King’s face, gets a whole ceremony of filial respect out of the boy before being asked for his own birth-hour.',
    items: [], threads: ['bull-family'], motifs: ['disguise', 'false-buddha'],
    cast: { 'zhu-bajie': 'Is captured by the oldest trick in his own party’s repertoire, used on him.',
      'red-boy': 'Wears a bodhisattva’s shape to take one enemy and is fooled by a father’s shape into bowing to another.',
      wukong: 'Is bowed to four times as somebody’s father and gives himself away by not knowing a birthday.' } },

  /* ---- Chapter 42 ---- */
  { ch: 42, key: 'pledged-hair', title: 'One Hair for a Pledge', loc: 'heaven-potalaka-annexe', d: ce(643, 215), tension: 3, pov: 'guanyin',
    desc: 'Told that a demon has been wearing her face, she throws the vase into the sea, and a turtle brings it back holding a whole ocean in it — and the monkey who once shook Heaven cannot lift it off the rock. She will not lend it without security, and takes the life-saving hair from the back of his head. He offers her the fillet instead. She declines.',
    items: [], threads: ['fillet'], motifs: ['borrowed-treasure'],
    cast: { guanyin: 'Demands collateral from her own agent, and picks the one thing he was given for free.',
      wukong: 'Is shown, without a word of rebuke, exactly how much stronger she is than he is.' } },
  { ch: 42, key: 'boy-of-good-wealth', title: 'Thirty-Six Blades as a Lotus Throne', loc: 'roaring-mountain', d: ce(643, 219), tension: 4, pov: 'guanyin',
    desc: 'Three hundred li cleared of every living thing, the vase upended into a sea, and Nezha’s heaven-net sabres turned into a thousand-petalled seat. The demon takes it for a throne and sits down on the points. Shaved and renamed Sudhana, he picks the spear up again the moment the pain stops — so a gold fillet, the last of the Buddha’s three, goes on his head and his hands and his feet.',
    items: ['fillet'], threads: ['who-owns-the-demon', 'bull-family'], motifs: ['mercy-over-death'],
    cast: { guanyin: 'Spends the third fillet, and gains the attendant who stands beside her in every image afterwards.',
      'red-boy': 'Is beaten by furniture, converted, and immediately relapses, and is fitted with five rings for it.',
      wukong: 'Watches somebody else take his nephew alive after he could not take him at all.',
      tripitaka: 'Is cut out of a leather bag and told that the boy who took him is now a bodhisattva’s page.',
      'zhu-bajie': 'Comes out of the same bag and wants to know who is carrying the luggage.' } },

  /* ---- Chapter 43 ---- */
  { ch: 43, key: 'the-ferryman', title: 'A Boat That Holds Two', loc: 'black-water-river', d: ce(644, 60), tension: 4, pov: 'tripitaka',
    desc: 'Water sounds ahead and the master is afraid of them, and is told by his own disciple to read the sutra he had by heart in one hearing: no eye, ear, nose, tongue, body, mind. Then a dugout with room for two comes down the black current. The pig takes the first crossing to get out of leading the horse, and mid-river the wind gets up and boat, monk and pig all go under.',
    items: ['heart-sutra'], threads: ['scriptures'], motifs: ['water'],
    cast: { tripitaka: 'Is quoted his own scripture by a monkey and gets into the boat anyway.',
      'zhu-bajie': 'Volunteers for the first crossing to avoid a job, and is taken to the bottom of a river for it.',
      'tuolong': 'Poles a boat up to a bank and waits to be hired, which is a better ambush than any cave in the book.' } },
  { ch: 43, key: 'nine-sons', title: 'Nine Sons, Each Different', loc: 'black-water-river', d: ce(644, 65), tension: 3, pov: 'wukong',
    desc: 'The river god, dispossessed a year ago, names the demon’s uncle. The black-carp courier is intercepted on the road and the invitation read: the West Sea Dragon King’s birthday, and steamed monk to warm the table. The demon is the ninth son of the dragon whose head fell into a Chang’an street, and the other eight hold rivers, bells, roof-ridges and one of the pillars of Heaven.',
    items: [], threads: ['who-owns-the-demon', 'tang-emperor'], motifs: ['water'],
    cast: { wukong: 'Reads someone else’s post and settles the whole episode without a fight, by taking it to the family.',
      aoshun: 'Learns that his nephew has been eating travellers and sends his own son to arrest him before the monkey can.',
      moang: 'Takes five hundred troops down to arrest a cousin, and does it without argument.',
      'tuolong': 'Is a beheaded dragon’s ninth son with an uncle in the West Sea, and had counted on that being useful.' } },

  /* ---- Chapter 44 ---- */
  { ch: 44, key: 'the-cart-pullers', title: 'Five Hundred Monks on a Sand Bank', loc: 'cart-slow-kingdom', d: ce(644, 150), tension: 3, pov: 'wukong',
    desc: 'The roar on the road is five hundred monks in cangues hauling brick and timber up a cliff, chanting to a bodhisattva of Great Strength. Twenty years ago the rain stopped, the monks prayed and failed, and three Daoists called it down; since then the temples are pulled down, the ordination papers burnt, and the monks belong to the men who saved the harvest.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Finds a whole religion enslaved for losing a competition, and does not need to be asked twice.' } },
  { ch: 44, key: 'three-pure-ones', title: 'Sitting in the Seats of the Three Pure Ones', loc: 'sanqing-abbey', d: ce(644, 155), tension: 2, pov: 'zhu-bajie',
    desc: 'A wind puts out the lamps and clears the hall, and the three of them take the Three Pure Ones’ places to eat the offerings. The pig carries the statues out to the privy and makes them a short speech of apology first. Then the Daoists come back for elixir and holy water, and are given a jar, a basin and a flower vase of it.',
    items: [], threads: ['kingdoms'], motifs: ['false-buddha'],
    cast: { 'zhu-bajie': 'Eats an entire temple’s offerings and apologises to the statues on the way to the latrine, which is the funniest thing he does in the book.',
      wukong: 'Sits in a god’s chair, fills a vase with his own urine, and announces who he is while the Daoists are still tasting it.',
      'sha-wujing': 'Goes along with the whole thing and is the one who notices the dropped hand-bell.' } },

  /* ---- Chapter 45 ---- */
  { ch: 45, key: 'the-rain-wager', title: 'Five Signals of a Cudgel', loc: 'cart-slow-kingdom', d: ce(644, 158), tension: 4, pov: 'wukong',
    desc: 'Tiger Power’s five-thunder rite is genuine, which is the problem. So the monkey goes up first and tells the wind, cloud, thunder and rain departments to answer his cudgel rather than the altar. Four command-blocks bring nothing down at all; then a monk sits silent through the Heart Sutra and the city floods.',
    items: ['cudgel', 'heart-sutra'], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Wins a public rain-making contest by going over the officials’ heads before it starts.',
      tripitaka: 'Is put on a platform in front of a kingdom to do the one thing he cannot do, and does it by sitting still.',
      'three-daoist-immortals': 'Perform a rite that has worked for twenty years and watch nothing at all happen.' } },
  { ch: 45, key: 'four-dragons-shown', title: 'A King Who Has Never Seen a Dragon', loc: 'cart-slow-kingdom', d: ce(644, 161), tension: 3, pov: 'wukong',
    desc: 'The Daoists claim the rain was theirs and merely late. So the test becomes whether either side can call the dragons down where a court can look at them, and four of them come and circle the throne hall in the air until the king has had enough.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Settles a dispute about credit by producing the witnesses in person over the palace roof.',
      'three-daoist-immortals': 'Are asked to do the one thing that cannot be faked and ask for a different wager instead.',
      aoguang: 'Comes when he is called, circles a throne hall, and goes home without being thanked.' } },

  /* ---- Chapter 46 ---- */
  { ch: 46, key: 'the-bedbug', title: 'A Bedbug and a Centipede', loc: 'cart-slow-kingdom', d: ce(644, 164), tension: 3, pov: 'wukong',
    desc: 'Fifty tables stacked into a seat, no hands, no ladder, and no moving. Deer Power flicks a hair that becomes a bedbug on the monk’s scalp; the monkey picks it off in mid-air and answers with a seven-inch centipede up Tiger Power’s nose, and a contest of pure stillness is decided by two insects.',
    items: [], threads: ['kingdoms'], motifs: ['transformation'],
    cast: { wukong: 'Cheats back, immediately and in kind, and considers the ledger balanced.',
      tripitaka: 'Sits fifty tables up in the air for hours and wins on the merits, twice over.',
      'three-daoist-immortals': 'Lose a meditation contest they were cheating in, and demand three more.' } },
  { ch: 46, key: 'head-belly-oil', title: 'Head, Belly and the Oil Cauldron', loc: 'cart-slow-kingdom', d: ce(644, 167), tension: 5, pov: 'wukong',
    desc: 'He has his head cut off and calls it back, opens his own belly and puts the entrails away, and bathes in boiling oil. A dog carries off the first Daoist’s head before he can call for it; an eagle takes the second’s liver; the third goes into a cauldron with a cold dragon at the bottom of it, and the North Sea Dragon King is asked to remove the dragon. What is dragged out is a headless tiger, an antlered deer and a goat boiled to the bone.',
    items: [], threads: ['kingdoms', 'who-owns-the-demon'], motifs: ['transformation', 'fire'],
    cast: { wukong: 'Wins three impossible wagers in a row and then kills all three losers, which nobody in the court objects to.',
      'three-daoist-immortals': 'Copy every trick and die of each one, and are three animals on the flagstones by the end of it.',
      tripitaka: 'Watches his disciple’s head cut off and faints, and has to be told afterwards how it ended.',
      'sha-wujing': 'Is the one who explains to the court what they have just seen dragged out of the oil.' } },

  /* ---- Chapter 47 ---- */
  { ch: 47, key: 'pre-death-mass', title: 'A Funeral for Children Still Alive', loc: 'chen-village', d: ce(644, 320), tension: 4, pov: 'chen-cheng',
    desc: 'Drums in a rich house at night, and it is a mass for the dead said over two children who are in the next room. The Great King of Miraculous Response takes a boy and a girl a year in exchange for the rain, and this year it is the brothers’ turn: a son got at sixty-three, and a niece whose weight in gold has already been offered and refused.',
    items: [], threads: ['kingdoms'], motifs: ['water'],
    cast: { 'chen-cheng': 'Is holding a funeral for a living son because the alternative is the whole village going dry.',
      'chen-qing': 'Has offered thirty catties of gold for a substitute and been told the god knows the difference.',
      tripitaka: 'Walks into a house of mourning to beg a meal and cannot leave once he has understood the drums.' } },
  { ch: 47, key: 'two-in-the-trays', title: 'Two Monks on Red Trays', loc: 'chen-village', d: ce(644, 324), tension: 3, pov: 'zhu-bajie',
    desc: 'The monkey takes the boy’s shape in a moment. The pig takes two attempts and a dropped spell to manage the girl, and his snout will not come right. Carried out to the temple on lacquer trays with gongs and torches in front, his only question is which one the thing eats first.',
    items: [], threads: [], motifs: ['transformation'],
    cast: { 'zhu-bajie': 'Volunteers for the sacrifice on the strength of an argument he loses, and is bad at the disguise.',
      wukong: 'Takes a child’s shape perfectly on the first try and spends the ride mocking his brother for not.',
      'chen-cheng': 'Watches two strangers carried off to the river in his son’s and his niece’s clothes and cannot speak.' } },

  /* ---- Chapter 48 ---- */
  { ch: 48, key: 'polite-offering', title: 'A Sacrifice That Answers Back', loc: 'tongtian-river', d: ce(644, 350), tension: 4, pov: 'great-king-of-miraculous-response',
    desc: 'The offerings have never spoken before. Suspicious, the thing changes the order it usually eats in and reaches for the girl, and gets a rake in the scales for it. What is left behind on the temple floor is two fish-scales the size of dishes.',
    items: ['rake'], threads: [], motifs: ['water'],
    cast: { 'great-king-of-miraculous-response': 'Notices that dinner is talking to him and leaves with nothing but a broken back plate.',
      'zhu-bajie': 'Gets the first hit of the episode and loses the fish before anyone can follow it into the water.',
      wukong: 'Blows the ambush by answering a question politely, and admits it.' } },
  { ch: 48, key: 'crossing-the-ice', title: 'Straw on the Hooves, Staffs Across the Shoulders', loc: 'tongtian-river', d: ce(644, 355), tension: 5, pov: 'tripitaka',
    desc: 'A mandarin-fish crone lays out the trap: freeze eight hundred li, wait for walkers, and open the ice under the horse. Traders are already crossing to the Women’s Country for the profit, so a monk crosses for a deadline. The pig packs the hooves with straw and makes them all carry their weapons crosswise against the ice-holes, and it is not the ice-holes.',
    items: [], threads: ['scriptures', 'sha-silence'], motifs: ['water'],
    cast: { tripitaka: 'Chooses a frozen river over another week of waiting, and goes through it on the second morning.',
      'zhu-bajie': 'Invents both the straw and the crosswise staffs, which are the two most practical ideas anyone has all book.',
      'sha-wujing': 'Is the one who gets to the master first under the ice and cannot hold him.',
      'great-king-of-miraculous-response': 'Freezes eight hundred li of river on a crone’s advice and opens it under exactly the right hoof.',
      'mandarin-fish-crone': 'Designs the only successful ambush in the book and is not present when it pays off.' } },

  /* ---- Chapter 49 ---- */
  { ch: 49, key: 'louse-in-the-ear', title: 'Carried Down as a Louse', loc: 'tongtian-river-palace', d: ce(645, 5), tension: 3, pov: 'wukong',
    desc: 'He cannot fight under water, so he has to be carried, and the pig has been waiting for this since the manfruit. What is dropped halfway down is a hair; the real one is a pig-louse in the carrier’s ear, and says so out loud from inside it. A long-legged shrimp-wife points them past the hall to a thing like a stone trough, six feet long, with a man crying in it.',
    items: [], threads: [], motifs: ['water', 'transformation'],
    cast: { wukong: 'Anticipates the betrayal exactly and rides it out inside his own brother’s head.',
      'zhu-bajie': 'Drops him on purpose, is caught at it immediately, and is not even embarrassed.',
      'sha-wujing': 'Leads the way down and finds the palace, and is the only one taking it seriously.',
      tripitaka: 'Spends the chapter in a stone box behind a water palace, alive because the thing prefers its food fresh.' } },
  { ch: 49, key: 'the-fish-basket', title: 'Guanyin Unbraided, Weaving', loc: 'tongtian-river', d: ce(645, 10), tension: 2, pov: 'guanyin',
    desc: 'Once the crone names the monkey the demon simply stops coming out, and behind the broken door there is nothing but rammed earth a thousand layers deep. So Potalaka is asked, and she comes out of the bamboo grove undressed and unpainted with a basket she has just split and woven: the thing is her own goldfish from the lotus pond, and the copper mace is an unopened lotus bud. A painter in the crowd on the bank takes down her likeness, and that is where the Fish-Basket Guanyin comes from.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['water', 'mercy-over-death'],
    cast: { guanyin: 'Arrives half-dressed and in a hurry, and is painted that way for the rest of Chinese art.',
      'great-king-of-miraculous-response': 'Is lifted out of a river in a basket, having eaten a child a year for as long as anyone can remember.',
      wukong: 'Fetches her rather than dig through a thousand layers of mud, and admits that is why.',
      'old-turtle': 'Comes up when the water is clear, offers his back for the crossing, and asks one question in payment.' } },

  /* ---- Chapter 50 ---- */
  { ch: 50, key: 'the-drawn-circle', title: 'A Circle Stronger Than Iron Walls', loc: 'jindou-mountain', d: ce(645, 60), tension: 3, pov: 'wukong',
    desc: 'The towers in the valley are a mirage and he says so. Before going for food he draws a ring on the ground with the cudgel and tells them it will hold off anything on the mountain as long as nobody steps out of it. Cold feet, an argument about whether a man is being drawn a jail, and the master agrees to leave.',
    items: ['cudgel'], threads: ['master-and-disciple', 'sha-silence'], motifs: [],
    cast: { wukong: 'Leaves behind the one protection that actually works and phrases the instruction badly.',
      'zhu-bajie': 'Calls the circle a prison, which is the argument that gets them out of it.',
      tripitaka: 'Chooses to be cold outside a line rather than warm inside one, and loses everything within the hour.',
      'sha-wujing': 'Argues for staying, loses the vote two to one, and picks up the luggage.' } },
  { ch: 50, key: 'the-white-ring', title: 'A Ring That Takes the Cudgel', loc: 'jindou-mountain', d: ce(645, 64), tension: 5, pov: 'single-horn-rhinoceros-king',
    desc: 'Behind the yellow curtain is a skeleton with a skull the size of a peck-measure, and three lined waistcoats on the table that turn into ropes when they are put on. Then thirty rounds even at the cave mouth, a compliment on the staffwork, and a bright white circle that comes up out of a sleeve and comes down over the cudgel, and the Great Sage is standing there empty-handed.',
    items: ['cudgel', 'diamond-bracelet'], threads: [], motifs: ['borrowed-treasure'],
    cast: { 'single-horn-rhinoceros-king': 'Fights well enough to enjoy it and then wins with an object rather than a blow.',
      wukong: 'Loses the cudgel for the first time since he took it out of the sea, and has no idea what took it.',
      tripitaka: 'Is tied up in a cave for stepping out of a circle, and the waistcoats did the tying.',
      'zhu-bajie': 'Put the waistcoat on to warm his back, and the sleeves tied both of them chest to hand.' } },

  /* ---- Chapter 51 ---- */
  { ch: 51, key: 'no-star-is-missing', title: 'Heaven Counted, and All Present', loc: 'celestial-hall', d: ce(645, 67), tension: 3, pov: 'jade-emperor',
    desc: 'For once the roll-call comes back complete. Every lodge, every luminary, nobody down on earth without leave. Whatever has taken the cudgel is not a runaway from Heaven, which is the first time in the book that answer has come back, and the Jade Emperor lets him choose his own troops instead.',
    items: [], threads: ['who-owns-the-demon'], motifs: [],
    cast: { 'jade-emperor': 'Orders a full audit for a former rebel and hands over an expeditionary force on the strength of it.',
      wukong: 'Goes to Heaven expecting the usual answer, does not get it, and has to fight the thing on the merits.' } },
  { ch: 51, key: 'six-weapons-gone', title: 'Six Weapons and a Fire Department', loc: 'jindou-mountain', d: ce(645, 70), tension: 4, pov: 'nezha',
    desc: 'Nezha’s six arms and six weapons multiply to ten thousand and the ring takes all of them. Then fire: fire dragons, fire crows, fire rats, fire horses, and the ring takes those too. Then water — the Yellow River in a jade bowl, which runs off down the valley without ever reaching the cave door.',
    items: ['diamond-bracelet'], threads: [], motifs: ['fire', 'borrowed-treasure'],
    cast: { nezha: 'Loses every weapon he owns to one bracelet and has to go home and say so.',
      wukong: 'Watches four departments of Heaven fail on the same object in three days.',
      'single-horn-rhinoceros-king': 'Collects an armoury without ever putting his own weapon down.',
      'li-jing': 'Commands the operation, authorises the fire and the flood, and gets nothing for either.' } },

  /* ---- Chapter 52 ---- */
  { ch: 52, key: 'buddha-will-not-say', title: 'The Buddha Knows and Will Not Tell', loc: 'great-hall', d: ce(645, 73), tension: 3, pov: 'buddha',
    desc: 'He knows exactly what the thing is and declines to say so, on the ground that a name said here would bring it here, and then it would be Vulture Peak’s problem. What he sends instead is eighteen arhats with eighteen grains of golden sand — and two of them are told privately where to send the monkey when the sand is taken as well.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['names'],
    cast: { buddha: 'Withholds a name to protect his own house, and arranges for it to be discovered anyway.',
      wukong: 'Asks the highest authority in the book a direct question and is given help instead of an answer.' } },
  { ch: 52, key: 'the-nose-ring', title: 'The Ring Through the Ox’s Nose', loc: 'jindou-mountain', d: ce(645, 77), tension: 4, pov: 'laozi',
    desc: 'In Tushita the ox-boy has been asleep seven days on a dropped elixir pill, and one thing is missing from the shelf: the Diamond Jade Bracelet, made at the Han Pass, which no weapon and no element can touch. One wave of the plantain fan takes the demon’s strength, the second shows a green ox, and the ring goes through its nose, which is where nose-rings come from.',
    items: ['diamond-bracelet'], threads: ['who-owns-the-demon'], motifs: ['borrowed-treasure'],
    cast: { laozi: 'Recovers a second piece of his own hardware from a second escaped servant, and rides it home.',
      'single-horn-rhinoceros-king': 'Is an ox that got hold of its owner’s bracelet while its keeper slept off a stolen pill.',
      wukong: 'Gets the cudgel back, along with every other weapon in the cave, and delivers them to their owners.',
      tripitaka: 'Is untied, and does not connect this cave to the circle he stepped out of.' } },

  /* ---- Chapter 53 ---- */
  { ch: 53, key: 'the-ferrywoman', title: 'A Ferry Rowed by a Woman', loc: 'mother-child-river', d: ce(645, 150), tension: 2, pov: 'tripitaka',
    desc: 'She only smiles when asked where the ferryman is. On the far bank the water is clear and cold and the master drinks half a bowl and the pig finishes it, and within half an hour they are both holding their bellies. An old woman selling tea explains the arrangement: this is the Women’s Kingdom, that was the Motherhood River, and the pig would like to know which side it comes out of.',
    items: [], threads: ['bajie-appetite'], motifs: ['water'],
    cast: { tripitaka: 'Drinks from a river without asking and is pregnant by the end of the paragraph.',
      'zhu-bajie': 'Drinks twice as much and is the one who does all the complaining about it.',
      'sha-wujing': 'Rows, watches, and does not drink, and is the only reason the party has anyone standing.' } },
  { ch: 53, key: 'the-bucket', title: 'Two Men for One Bucket', loc: 'jieyang-mountain', d: ce(645, 155), tension: 3, pov: 'wukong',
    desc: 'The Abortion Spring is held by the As-You-Will Immortal, who is the Bull Demon King’s brother, wants no offering, and wants revenge for a nephew he has been told was killed. Twice the as-you-will hook takes an ankle and drops the bucket back down the well; the third time is a decoy, and the water is drawn by somebody else while the fighting is going on up the slope.',
    items: [], threads: ['bull-family'], motifs: ['water'],
    cast: { wukong: 'Cannot argue a family grievance and cannot win a fight and fetch water at once, so he stops trying to do both.',
      'ruyi-immortal': 'Refuses to believe his nephew is a bodhisattva’s page and snaps his own hook into four pieces over it.',
      'sha-wujing': 'Draws the water while the fight goes on above him, which is the whole plan and his idea of a good day.' } },

  /* ---- Chapter 54 ---- */
  { ch: 54, key: 'the-queens-proposal', title: 'A Kingdom Offered for a Husband', loc: 'west-liang', d: ce(645, 160), tension: 3, pov: 'west-liang-queen',
    desc: 'The whole street claps and calls out that seed has arrived, and the pig clears the road by shaking out his ears. Then the queen, who has dreamt of a gold screen in colour and a jade mirror in light, offers the entire realm: he reigns, she is his consort, and the three disciples get their passport and the road.',
    items: ['rescript'], threads: ['kingdoms'], motifs: [],
    cast: { 'west-liang-queen': 'Makes the single most generous offer anyone makes in the book, in complete good faith.',
      tripitaka: 'Is proposed to by a head of state and has no way to refuse that does not cost him the passport.',
      'zhu-bajie': 'Clears a street by being looked at, and is offended when it works.',
      'sha-wujing': 'Points out that a stamped passport is the only thing they came for.' } },
  { ch: 54, key: 'taken-at-the-gate', title: 'Taken at the Gate', loc: 'west-liang', d: ce(645, 165), tension: 4, pov: 'tripitaka',
    desc: 'The plan is to agree to everything: ride the phoenix carriage, take the seal, eat the wedding feast, and walk out of the gate. It works exactly as designed until a woman steps out of the crowd in the road, asks the imperial brother to come and play at wind and moonlight, and there is a whirlwind and nobody in the saddle.',
    items: ['rescript'], threads: ['kingdoms'], motifs: [],
    cast: { tripitaka: 'Escapes a marriage by consenting to it, and is carried off from the roadside forty feet past the gate.',
      'scorpion-demon': 'Waits for the one moment the whole city is looking at the queen, and takes him out of the middle of it.',
      'west-liang-queen': 'Stands in the road watching her husband of two hours go up into the air.',
      'sha-wujing': 'Has the luggage and the horse in hand and cannot get to him in time.' } },

  /* ---- Chapter 55 ---- */
  { ch: 55, key: 'two-plates-of-buns', title: 'Meat Filling and Bean Paste', loc: 'pipa-cave', d: ce(645, 170), tension: 3, pov: 'scorpion-demon',
    desc: 'She offers both trays and he takes the vegetarian one; she asks why he split neither, and turns his own week on the Motherhood River against him in a joke. He answers in a couplet and keeps his belt tied, and that is the whole fight, which he wins.',
    items: [], threads: [], motifs: [],
    cast: { 'scorpion-demon': 'Is the only antagonist in the book who tries persuasion, and is better at it than any of the others are at fighting.',
      tripitaka: 'Holds out for a night and a day with no help of any kind, which is the most he ever does alone.' } },
  { ch: 55, key: 'the-rooster', title: 'A Rooster Six or Seven Feet High', loc: 'pipa-cave', d: ce(645, 174), tension: 4, pov: 'star-lord-mao',
    desc: 'A head that has survived swords, axes, thunder, fire and forty-nine days in the furnace is felled by one jab of a horse-poison stake, and a lip by another. Guanyin comes as the Fish-Basket and names her: a scorpion who once stung the Buddha in the left thumb at a sermon. The Star Lord of the Pleiades comes down as a double-combed cock and crows twice.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['transformation'],
    cast: { 'star-lord-mao': 'Settles the fight by making a noise, which is the only weapon that works on her.',
      'scorpion-demon': 'Stung the Buddha and survived, and is killed by poultry.',
      wukong: 'Is beaten by something the size of a lute and has to be told by a bodhisattva who to ask.',
      'zhu-bajie': 'Is stung in the lip and spends the rest of the chapter unable to say anything about it.',
      guanyin: 'Names the demon and the remedy in one visit and does not come down to do it herself.' } },

  /* ---- Chapter 56 ---- */
  { ch: 56, key: 'a-needle-for-a-toll', title: 'An Embroidery Needle for the Toll', loc: 'seven-hundred-li-slope', d: ce(646, 30), tension: 4, pov: 'bandits',
    desc: 'Thirty men with spears across the road, and a monk who cannot lie tells them his disciple is carrying the silver. They give the disciple sixty blows on the skull and he thanks them for the compliment. Then he offers them a needle, plants it in the ground as a pole, invites them to lift it, and kills the two chiefs with it.',
    items: ['cudgel'], threads: ['master-and-disciple'], motifs: [],
    cast: { bandits: 'Rob the wrong party, hit the wrong head, and lose their two leaders to a joke about an embroidery needle.',
      wukong: 'Kills men rather than demons for the first time since the six brigands, and is as casual about it.',
      tripitaka: 'Buys his own safety by pointing at somebody else’s purse, and is horrified by what it costs.' } },
  { ch: 56, key: 'the-yang-farm', title: 'Sleeping in the Robbers’ House', loc: 'yang-farm', d: ce(646, 35), tension: 3, pov: 'old-yang',
    desc: 'An old man of seventy-four gives them beds, and in the night his son comes home hungry with the rest of the gang, sees a white horse in the yard, and starts sharpening knives in the kitchen. The old man walks his guests out of his own back gate in the dark and points them at the road.',
    items: [], threads: [], motifs: [],
    cast: { 'old-yang': 'Chooses four strangers over his own son, quietly, at some cost, and is not thanked for it.',
      tripitaka: 'Sleeps in the house of the men who robbed him and is got out of it by their father.',
      'sha-wujing': 'Saddles in the dark without being told and gets the luggage over the wall.' } },
  { ch: 56, key: 'the-severed-head', title: 'A Head Carried to the Horse', loc: 'seven-hundred-li-slope', d: ce(646, 40), tension: 5, pov: 'tripitaka',
    desc: 'The pursuers are scattered at sunrise. Then he asks a wounded man which one is old Yang’s son, cuts the head off, and carries it up to the saddle to be thanked for it. The spell is recited a dozen times over, and this time the letter of dismissal is not written, because the master simply refuses to speak to him.',
    items: [], threads: ['master-and-disciple', 'fillet'], motifs: [],
    cast: { tripitaka: 'Prays over the graves that the dead men sue Sun Wukong in the underworld and leave him out of it, and means every word.',
      wukong: 'Brings his master a human head as a present, and is dismissed for the second time and does not understand why.' } },

  /* ---- Chapter 57 ---- */
  { ch: 57, key: 'nowhere-to-go', title: 'Nowhere to Go Back To', loc: 'heaven-potalaka-annexe', d: ce(646, 45), tension: 3, pov: 'wukong',
    desc: 'Not the mountain, not Heaven, not the isles, not the dragon palace. He comes back once and is recited at until the band is an inch into the flesh, and then goes to Potalaka and cries at the foot of the lotus throne. The ruling he gets is the one thing he has never been told plainly: killing demons is a merit, and killing men is not.',
    items: ['fillet'], threads: ['fillet', 'master-and-disciple'], motifs: [],
    cast: { wukong: 'Runs out of places to be unwanted and ends up crying in front of the only person who will hear it.',
      guanyin: 'Draws the line the book has been circling for fifty chapters, in one sentence, and makes him stay.' } },
  { ch: 57, key: 'reading-the-passport', title: 'Reading the Passport Aloud', loc: 'ffm-water-curtain-cave', d: ce(646, 50), tension: 4, pov: 'sha-wujing',
    desc: 'Something with the monkey’s face knocks the master down on the road for a cup of water and takes the two blue-felt bundles. On the mountain it is on the stone terrace reading the travel-rescript over and over, with its own Tripitaka, its own pig and its own Sand Monk standing ready. The real Sand Monk kills the imitation of himself and finds it is a monkey.',
    items: ['rescript'], threads: ['master-and-disciple'], motifs: ['disguise'],
    cast: { 'sha-wujing': 'Kills a copy of himself, which nobody comments on, and goes to Potalaka to accuse a monkey who is standing beside the bodhisattva.',
      'six-eared-macaque': 'Wants the errand rather than the man, and has assembled a whole party to do it with.',
      wukong: 'Has been standing at the lotus throne for four days and can prove it, which proves nothing at all.',
      guanyin: 'Vouches for one of them and sends the pair of them off to look at the other.' } },

  /* ---- Chapter 58 ---- */
  { ch: 58, key: 'the-tests-that-fail', title: 'Every Test Fails', loc: 'ffm-water-curtain-cave', d: ce(646, 55), tension: 5, pov: 'guanyin',
    desc: 'Same fillet, same tiger-skin kilt, same cudgel, same face. Guanyin recites the spell and both roll on the ground. The demon-revealing mirror at the Jade Emperor’s court shows two identical images. The master’s own recitation hurts them equally. And in the underworld the Listener, lying flat, gets it right at once and refuses to say it aloud, because saying it would wreck the hall.',
    items: ['fillet', 'cudgel'], threads: ['master-and-disciple'], motifs: ['disguise', 'names'],
    cast: { guanyin: 'Applies the one test she is sure of and gets the same result twice.',
      wukong: 'Cannot prove he is himself to anybody, including the people who made him what he is.',
      'six-eared-macaque': 'Passes every examination in Heaven, earth and the underworld, which is the point of him.',
      dizang: 'Has an animal that knows the answer and will not let it be spoken in his own building.' } },
  { ch: 58, key: 'the-species-ends-here', title: 'The Four Monkeys Outside the Ten Kinds', loc: 'great-hall', d: ce(646, 60), tension: 5, pov: 'buddha',
    desc: 'The Buddha names the categories — five immortals, five worms — and then four kinds of monkey that belong to none of them. The Six-Eared Macaque hears every word spoken within a thousand li, which is how it knew everything. The alms bowl comes down over a bee, and is lifted, and the cudgel comes down before anyone can stop it. He says only that it is a pity, and there have been no six-eared macaques since.',
    items: ['alms-bowl', 'cudgel'], threads: ['who-owns-the-demon'], motifs: ['names'],
    cast: { buddha: 'Names a creature nobody else could name and watches it killed in front of him, and does not intervene.',
      'six-eared-macaque': 'Is the last of its kind, and the kind ends in this paragraph.',
      wukong: 'Kills the only being that was ever exactly his equal, and asks again to have the fillet taken off.',
      guanyin: 'Comes to Vulture Peak with them and takes the reconciled disciple back to his master herself.' } },

  /* ---- Chapter 59 ---- */
  { ch: 59, key: 'the-false-fan', title: 'Three Fannings and a Thousand Feet of Flame', loc: 'flaming-mountains', d: ce(646, 150), tension: 4, pov: 'wukong',
    desc: 'Red tiles, red brick, red doors, and autumn heat that will not explain itself; a cake off a barrow burns his hand. Eight hundred li of fire lie across the road and the only thing that puts it out is one fan, and the fan belongs to Red Boy’s mother. What she lends him is a false one: one wave and the fire jumps, two and it doubles, three and it takes the hair off his legs.',
    items: ['plantain-fan'], threads: ['bull-family'], motifs: ['fire'],
    cast: { wukong: 'Gets a fan out of a woman who hates him and does not think to ask whether it is the right one.',
      tripitaka: 'Sits down sixty li short of a wall of fire and asks whether there is a way round, and is told there is not.',
      'zhu-bajie': 'Proposes going back, is voted down, and points out that west is the only direction with scriptures in it.',
      'sha-wujing': 'Notes that the season is wrong for this heat, which is the observation that starts the whole enquiry.' } },
  { ch: 59, key: 'inside-her-belly', title: 'A Gnat in the Tea Froth', loc: 'plantain-cave', d: ce(646, 155), tension: 4, pov: 'raksasi',
    desc: 'He wakes on Little Sumeru clutching a rock, with a wind-securing pill sewn into his collar by a bodhisattva who was expecting him. Two more fannings and he does not move an inch. Then a gnat rides down her throat in a mouthful of tea and stands up inside her, offers her a bowl to sit on, and asks for the fan until she calls him uncle.',
    items: ['plantain-fan', 'wind-pill'], threads: ['bull-family'], motifs: ['transformation'],
    cast: { raksasi: 'Cannot blow him away and cannot swallow him without keeping him, and gives up the fan from the inside.',
      wukong: 'Wins by being somewhere no fan can reach, and then forgets to ask how the thing shrinks.',
      lingji: 'Hands over the wind-securing pill the Buddha left with him, and sews it into a collar so it cannot be lost.' } },

  /* ---- Chapter 60 ---- */
  { ch: 60, key: 'old-brother', title: 'Two Old Brothers on a Cliff', loc: 'thunder-heap-mountain', d: ce(646, 158), tension: 4, pov: 'bull-demon-king',
    desc: 'The local god of the burning mountain turns out to be the demoted furnace-keeper: the bricks kicked out of the eight-trigram furnace fell here still lit and have burned for five hundred years, so the fire is the monkey’s own. And the ox has a second wife two years old with a million in property, and greets his sworn brother of five hundred years with a list: my son, my wife, my mistress.',
    items: [], threads: ['bull-family'], motifs: ['fire'],
    cast: { 'bull-demon-king': 'Has three separate grievances ready before the greeting is finished, and all three are true.',
      wukong: 'Learns that he started the fire he is trying to put out, and that his oldest friend has every reason to refuse.',
      'jade-face-princess': 'Bought a husband two years ago and goes crying into his study the moment another woman’s name is mentioned.' } },
  { ch: 60, key: 'wearing-the-husband', title: 'Wearing Her Husband’s Face', loc: 'plantain-cave', d: ce(646, 162), tension: 4, pov: 'raksasi',
    desc: 'Down in Green Wave Pool the ox is drinking with an old dragon, so his mount is untied from the archway and ridden home. She takes his hand, sets out wine, leans on his shoulder, and — half drunk, complaining that the new wife has ruined his memory — tells him the real fan is the apricot leaf she keeps in her mouth, and the syllables that grow it.',
    items: ['plantain-fan'], threads: ['bull-family'], motifs: ['disguise'],
    cast: { raksasi: 'Gives away the fan and the growing spell to her own husband, and is right about whose fault that is.',
      wukong: 'Gets the real fan by wearing a face, and asks how to make it big and not how to make it small.',
      'bull-demon-king': 'Loses his mount from an archway while drinking, exactly as the monkey once lost the cudgel.' } },

  /* ---- Chapter 61 ---- */
  { ch: 61, key: 'wearing-bajie', title: 'The Ox Wears Bajie’s Face', loc: 'flaming-mountains', d: ce(646, 165), tension: 4, pov: 'wukong',
    desc: 'The same trick back the other way, and it works for the same reason: he is pleased with himself. He hands the fan to the brother who has come out to meet him, and the only reason he is still on the ground afterwards is a pill sewn into his collar by somebody who was expecting exactly this.',
    items: ['plantain-fan', 'wind-pill'], threads: ['bull-family'], motifs: ['disguise'],
    cast: { wukong: 'Loses the fan to a disguise the moment after winning it with one, and knows it while it is happening.',
      'bull-demon-king': 'Beats him at his own game, once, and spends the rest of the chapter paying for it.',
      'zhu-bajie': 'Arrives late, having been impersonated, and is aggrieved about both halves of that.' } },
  { ch: 61, key: 'nets-on-four-sides', title: 'Four Vajras and Nowhere to Run', loc: 'thunder-heap-mountain', d: ce(646, 170), tension: 5, pov: 'bull-demon-king',
    desc: 'Swan and gyrfalcon, hawk and black phoenix, crane and vermilion phoenix, musk deer and hungry tiger, leopard and lion, bear and elephant — and then a white ox a thousand fathoms long and a monkey grown to match it. North, south, east and west each has a diamond-guardian sent from Vulture Peak, and above them Li Jing and his son. Ten heads are cut off and ten grow back until a fire-wheel is hung on the horns.',
    items: [], threads: ['bull-family', 'who-owns-the-demon'], motifs: ['transformation', 'fire'],
    cast: { 'bull-demon-king': 'Is the only enemy in the book who needs Heaven, the Buddha and both disciples at once, and is taken alive.',
      wukong: 'Matches him shape for shape and cannot finish it, and has to let four departments do the last of it.',
      nezha: 'Cuts ten heads off the same neck and hangs a fire-wheel on the eleventh, which finally holds.',
      'li-jing': 'Commands the net from above and is, for once, on the winning side of one.',
      'zhu-bajie': 'Rakes the second wife through and finds a jade-faced fox under the silk, and burns both caves.',
      'jade-face-princess': 'Is killed in her own doorway by the disciple nobody was watching.' } },

  /* ---- Chapter 62 ---- */
  { ch: 62, key: 'sweeping-the-pagoda', title: 'Thirteen Storeys, Swept', loc: 'golden-light-monastery', d: ce(646, 250), tension: 3, pov: 'tripitaka',
    desc: 'Two generations of monks have been beaten to death for a theft they did not commit, and the third is begging in cangues. Three years ago it rained blood at midnight, the pagoda’s light went out, and four tributary kingdoms stopped coming. He vowed at Famen Temple to sweep every pagoda he met, so he takes a broom and starts at the bottom.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { tripitaka: 'Keeps a vow made on his first night out of Chang’an, and it turns out to be the investigation.',
      wukong: 'Takes the last three storeys when his master’s knees give out, and hears dice and drinking above him.',
      'sha-wujing': 'Carries the lamps up thirteen storeys and holds them while the sweeping is done.' } },
  { ch: 62, key: 'two-fish-on-watch', title: 'Ben-Bo-Er-Ba and Ba-Bo-Er-Ben', loc: 'golden-light-monastery', d: ce(646, 255), tension: 3, pov: 'wukong',
    desc: 'A catfish spirit and a snakehead spirit on the thirteenth storey, sent up from Green Wave Pool to watch for a monkey, give the whole thing up in one sitting: the Myriad-Sage Dragon King, his daughter, the nine-headed son-in-law, the relic taken out of the tower, and the Queen Mother’s nine-leaved fungus keeping it warm at the bottom of the pool.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Solves a three-year mystery by catching two sentries who would rather talk than fight.',
      'wan-sheng-dragon-king': 'Has been holding a stolen relic under a pool for three years and has posted a watch for exactly this visitor.',
      'zhu-bajie': 'Is sent through the city in a sedan chair under a yellow parasol to fetch the prisoners, and says he has come into his own.' } },

  /* ---- Chapter 63 ---- */
  { ch: 63, key: 'nine-headed-consort', title: 'The Nine-Headed Son-in-Law', loc: 'biboton-lake', d: ce(647, 10), tension: 5, pov: 'nine-headed-insect',
    desc: 'Thirty rounds with a crescent-moon spade, and when the rake comes in behind it makes no difference, because nine heads means eyes on every side at once. Then it drops the human shape, and a tenth head comes out of its waist and carries a pig off by the bristles.',
    items: ['rake'], threads: [], motifs: ['transformation'],
    cast: { 'nine-headed-insect': 'Cannot be flanked, and takes one of the two disciples with a head nobody knew was there.',
      wukong: 'Fights something that watches all of him at once, and has to go and find somebody who hunts.',
      'zhu-bajie': 'Charges in from behind at exactly the wrong angle and is carried off by a mouth in a waist.' } },
  { ch: 63, key: 'erlang-hunting', title: 'Erlang and the Six Brothers of Meishan', loc: 'biboton-lake', d: ce(647, 15), tension: 4, pov: 'erlang',
    desc: 'Hawks, hounds, foxes and deer coming home from a hunt, and a field banquet under the stars — and the god who once captured him, now offering him a cup. The slender hound takes the tenth head off at the neck while it is out biting. The bird flees north bleeding, and the blood is why there are still nine-headed insects in the world. In the palace, wearing the son-in-law’s face, he is handed the gold casket and the jade one and told to hide them well.',
    items: [], threads: ['kingdoms', 'who-owns-the-demon'], motifs: ['disguise'],
    cast: { erlang: 'Turns up with a hunting party, settles the fight with a dog, and drinks with the prisoner he took five hundred years ago.',
      'nine-headed-insect': 'Loses a head and its wife’s whole household, and gets away, which almost nothing in this book does.',
      wukong: 'Will not go up to greet an old enemy first, and is greeted first anyway.',
      'dragon-widow': 'Hands the relic and the stolen fungus to her own husband’s face and is left alive, chained to the pillar of the tower she helped rob.',
      'wan-sheng-dragon-king': 'Loses his palace, his household and his daughter’s marriage in one afternoon.',
      'zhu-bajie': 'Is untied by a crab, steals his own rake back off the wall, and goes in through the front door.' } },

  /* ---- Chapter 64 ---- */
  { ch: 64, key: 'four-old-poets', title: 'Four Old Gentlemen and a Night of Verse', loc: 'wooden-immortal-hermitage', d: ce(647, 60), tension: 2, pov: 'tripitaka',
    desc: 'Eight hundred li of bramble opened in a day and a night by a pig grown twenty fathoms tall, and then a stone hut with a brazier in it. Firm-Node, Lonely-Straight, Cloud-Piercer and Cloud-Brusher want a discourse on Chan and get one, and then linked verse until midnight. It is the only night of the journey on which anyone treats him as a poet.',
    items: [], threads: [], motifs: [],
    cast: { tripitaka: 'Is asked for his opinion by four people who want to hear it, for the first and last time in fourteen years.',
      'wooden-immortals': 'Want a real poet for one night and get one, and then spoil it by trying to be helpful.',
      'zhu-bajie': 'Opens a road through eight hundred li of thorn and wants two lines about it added to the stele.' } },
  { ch: 64, key: 'the-trees', title: 'A Pine, a Cypress, a Juniper, a Bamboo', loc: 'wooden-immortal-hermitage', d: ce(647, 65), tension: 3, pov: 'wukong',
    desc: 'The apricot girl comes in late, matches his poem, sits closer and dries his tears with a honey-coloured silk, and the four old men offer to be go-betweens — and the courtesy of the whole night turns out to have been the approach. By daylight the hermitage is a cliff face and the company are trees. The rake goes through all of them, the roots run with blood, and the man who was never harmed asks him to stop.',
    items: ['rake'], threads: [], motifs: ['transformation'],
    cast: { wukong: 'Arrives at dawn, identifies the whole party by their species, and lets his brother root them up.',
      'apricot-fairy': 'Turns a night of poetry into a proposal and loses the entire hermitage by it.',
      'wooden-immortals': 'Are dug up and killed for a matchmaking attempt, having harmed nobody.',
      tripitaka: 'Asks for the digging to stop, and is the only person in the scene who has noticed that nothing was done to him.',
      'zhu-bajie': 'Roots up four hundred years of poetry in about ten minutes and cannot see the objection.' } },

  /* ---- Chapter 65 ---- */
  { ch: 65, key: 'bowing-to-the-false-buddha', title: 'Three Characters, or Four', loc: 'little-thunderclap', d: ce(647, 100), tension: 5, pov: 'tripitaka',
    desc: 'He falls off the horse cursing the monkey for hiding a Thunderclap Monastery from him, and is told to count the characters over the gate again: there are four, and the first one is Small. Inside there are five hundred arhats, three thousand guardians and four vajras, and a voice from the lotus seat asking why Sun Wukong does not bow — and then a pair of golden cymbals comes down out of the air over him, head and feet.',
    items: ['golden-cymbals'], threads: ['scriptures'], motifs: ['false-buddha'],
    cast: { tripitaka: 'Bows to a false Buddha in a false monastery because it looked exactly like the end of the road.',
      'yellow-brow': 'Builds a whole counterfeit Vulture Peak and takes the entire party in it in one afternoon.',
      wukong: 'Reads the sign correctly, is overruled, and is shut inside two cymbals for his trouble.',
      'zhu-bajie': 'Kneels beside his master and is roped before he can get up again.',
      'sha-wujing': 'Is the last one standing and is taken in the same net as the others.' } },
  { ch: 65, key: 'the-cloth-sack', title: 'An Old White Cloth Wallet', loc: 'little-thunderclap', d: ce(647, 105), tension: 5, pov: 'wukong',
    desc: 'He grows a thousand fathoms and the cymbals grow with him; he shrinks to a mustard seed and they shrink too. The Gullet Dragon files his own horn to a needle and drives it through the seam, and the metal closes on it like flesh, so he bores a hole in the horn and rides out inside it. Then the wallet comes off the demon’s belt and takes the Great Sage, the twenty-eight lodges and the five guardians in one throw.',
    items: ['golden-cymbals', 'human-seed-bag'], threads: [], motifs: ['borrowed-treasure'],
    cast: { wukong: 'Gets out of the cymbals and straight into the bag, and then out of the bag and back into it by dawn.',
      'kang-jin-long': 'Files his own horn down to a needle for somebody else’s benefit and gets it holed for thanks.',
      'yellow-brow': 'Empties Heaven into a laundry bag twice in two days.' } },

  /* ---- Chapter 66 ---- */
  { ch: 66, key: 'wudang-and-sizhou', title: 'Everyone Sent For Goes In the Bag', loc: 'little-thunderclap', d: ce(647, 108), tension: 4, pov: 'wukong',
    desc: 'Zhenwu will not move against Heaven’s silence but lends five dragon spirits and the turtle-and-snake generals, and one throw of the wallet puts them in the cellar with everyone else. The King-Preceptor Bodhisattva cannot leave the Huai in flood with a newly caught water-ape in it, so he sends a prince and four generals, and the wallet takes those too.',
    items: ['human-seed-bag'], threads: [], motifs: ['borrowed-treasure'],
    cast: { wukong: 'Spends two whole pantheons on one bag and has nothing left to ask.',
      zhenwu: 'Sends what he can spare and is careful to say he is not acting against Heaven.',
      guoshiwang: 'Cannot leave a flooded river, sends a deputy, and loses him.',
      'yellow-brow': 'Adds two more delegations to the cellar without leaving his own hall.' } },
  { ch: 66, key: 'the-melon-patch', title: 'A Ripe Melon in a Field of Green', loc: 'little-thunderclap', d: ce(647, 112), tension: 4, pov: 'maitreya',
    desc: 'Maitreya sets up a hut and a melon patch on the road. The demon is his own cymbal-striking boy, the wallet is his Human-Seed Bag and the wolf-tooth club is the hammer for the cymbals. A character meaning “forbid” written on a palm keeps the bag shut; a chase across a field ends at the only ripe melon in it; and the first thing he asks about afterwards is the cymbals, which are swept up broken and breathed whole.',
    items: ['human-seed-bag', 'golden-cymbals'], threads: ['who-owns-the-demon'], motifs: ['mercy-over-death'],
    cast: { maitreya: 'Comes down grinning, sets a trap out of gardening, and takes his own servant home without a blow struck.',
      'yellow-brow': 'Eats the wrong melon and is a boy holding cymbals again inside a paragraph.',
      wukong: 'Is given a word to write on his hand and told where to stand, and does as he is told for once.',
      tripitaka: 'Is let out of the cellar with two pantheons and finds the monastery burning behind him.' } },

  /* ---- Chapter 67 ---- */
  { ch: 67, key: 'inside-the-python', title: 'A Bridge, a Boat, a Mast', loc: 'seven-extremes-mountain', d: ce(647, 160), tension: 4, pov: 'wukong',
    desc: 'Three years of something coming on a wind in the sixth month and eating the cattle, the pigs and the people; a monk was hired and died and a Daoist was hired and died, and the village paid for both coffins. The lights in the sky are not lanterns and the soft-shafted spear is a forked tongue. Swallowed, he props the belly into an arch, flattens it into a hull, and pushes the cudgel out through the spine for a mast.',
    items: ['cudgel'], threads: [], motifs: [],
    cast: { wukong: 'Takes a fee of one bowl of rice and does the job from the inside, which is his preferred office.',
      'red-scaled-python': 'Runs twenty li with a mast through its back before it stops.',
      'zhu-bajie': 'Takes the eyes for a demon carrying lanterns politely, and has to be told what he is looking at.',
      'sha-wujing': 'Is the one who tells him.' } },
  { ch: 67, key: 'the-pig-plough', title: 'The Pig Who Ploughed the Lane', loc: 'seven-extremes-mountain', d: ce(647, 165), tension: 1, pov: 'zhu-bajie',
    desc: 'Eight hundred li of persimmon with seven virtues, and a lane underneath filled with what the fruit turns into after a few centuries. Nobody can cut a new road through it, so he eats two piculs of rice, becomes a hog, and roots the old lane open over two days while the village carries food out after him.',
    items: [], threads: ['bajie-appetite'], motifs: ['transformation', 'hunger'],
    cast: { 'zhu-bajie': 'Does the single most useful thing anybody does on the road, by being exactly what he is.',
      tripitaka: 'Rides through eight hundred li of filth behind his own disciple and thanks him for it.',
      wukong: 'Can do nothing about this one at all, and says so.' } },

  /* ---- Chapter 68 ---- */
  { ch: 68, key: 'come-and-fetch-me', title: 'Medicine Is Not Hawked', loc: 'zhuzi-kingdom', d: ce(647, 220), tension: 2, pov: 'wukong',
    desc: 'A king three years sick and a proclamation under the drum tower calling for a physician. He takes the notice invisibly, tucks it into the sleeping pig’s robe, and walks back to the hostel to wait. When the guards find it they are told the terms: medicine is not hawked and a doctor is not sought out, so the court must come to him. It does.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Manufactures a summons out of a stolen poster and a sleeping brother, and makes a court walk to a hostel.',
      'zhu-bajie': 'Wakes up with an imperial proclamation in his clothes and a crowd around him, and has no idea why.',
      'zhuzi-king': 'Sends his whole court to a hostel to bow to a stranger, because three years of physicians have failed.' } },
  { ch: 68, key: 'hanging-thread', title: 'Diagnosis by Hanging Thread', loc: 'zhuzi-kingdom', d: ce(647, 225), tension: 2, pov: 'zhuzi-king',
    desc: 'The king cannot bear to be looked at by a stranger, so the pulse is taken by thread: three hairs from a tail turned into three golden lines, two fathoms four feet each, tied to the left wrist and passed out through the window. Six pulses are read through them and the diagnosis is fright, grief and longing — two birds parted by a storm, each thinking of the other.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { 'zhuzi-king': 'Is diagnosed correctly through a wall by a doctor he refuses to be in a room with.',
      wukong: 'Turns a piece of showmanship into an actual diagnosis, and is right.',
      tripitaka: 'Vouches for a disciple’s medical qualifications in front of a court, having no idea whether he has any.' } },

  /* ---- Chapter 69 ---- */
  { ch: 69, key: 'the-black-gold-pill', title: 'Rhubarb, Croton, Soot and Horse Urine', loc: 'zhuzi-kingdom', d: ce(647, 228), tension: 2, pov: 'wukong',
    desc: 'He orders three catties of each of the eight hundred and eight drugs so the court physicians cannot work out which two he wants, and then uses two. The horse argues about his contribution — his urine turns fish into dragons and grass into magic fungus — before giving half a cup. The draught must be taken with water that has never touched the ground, and the East Sea Dragon King arrives without rain gear and sneezes a shower over the palace.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Runs a whole pharmacy as misdirection and makes the actual medicine out of soot, croton and a horse.',
      'white-dragon-horse': 'Speaks for the second time in the book, to negotiate about urine.',
      aoguang: 'Comes when called, cannot make proper rain without a warrant, and sneezes instead.',
      'zhu-bajie': 'Grinds the pill and is not told what is in it until after he has handled it.',
      'sha-wujing': 'Rolls the mixture into a ball the size of a walnut and is the one who gets it to the palace intact.' } },
  { ch: 69, key: 'the-golden-queen', title: 'Three Years Since the Dragon-Boat Festival', loc: 'zhuzi-kingdom', d: ce(647, 232), tension: 3, pov: 'zhuzi-king',
    desc: 'What comes out of him is a rice dumpling swallowed in terror three years ago, at the Double Fifth, when a demon called Sai Tai Sui came out of the sky and took the Golden Queen out of the pomegranate pavilion — and has come back five times since for pairs of palace maids. The demon-avoiding tower is nine rooms sunk three fathoms under a paving slab with four vats of oil burning in it.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { 'zhuzi-king': 'Has been ill for three years from one swallowed mouthful and one afternoon he cannot stop seeing.',
      wukong: 'Tells him plainly that the thing has not once tried to hurt him, and a wind comes up out of the south while he is saying it.' } },

  /* ---- Chapter 70 ---- */
  { ch: 70, key: 'the-golden-bracelet', title: 'Her Bracelet on His Arm', loc: 'qilin-mountain', d: ce(648, 20), tension: 3, pov: 'golden-queen',
    desc: 'A small demon on the road with a gong, a yellow flag and a declaration of war, saying out loud to nobody that Heaven will not stand for what his king is doing; his name is on the tally at his belt, which is just as well. And in the cave the queen has never been touched, because an immortal gave her a five-coloured bridal gown the day she was taken and her whole body has grown needles since. She has left no token behind — but there is a pair of gold bracelets in her dressing case.',
    items: ['gold-bracelets'], threads: ['kingdoms'], motifs: ['disguise'],
    cast: { 'golden-queen': 'Has been protected for three years by a garment that hurts anyone who touches her, including herself.',
      wukong: 'Wears her own bracelet up his arm and shows her that before he shows her his face.',
      'you-lai-you-qu': 'Delivers a declaration of war to an empty road and is killed before anyone thinks to ask his name.' } },
  { ch: 70, key: 'the-cotton-pulled', title: 'The Cotton Out of the Bells', loc: 'qilin-mountain', d: ce(648, 25), tension: 4, pov: 'wukong',
    desc: 'Three hundred fathoms of fire in the first bell, three hundred of smoke in the second, three hundred of sand in the third, and it is the sand that kills. She asks for them as a wife’s due and hands them over stopped with cotton. Alone in the flaying pavilion he pulls the cotton out to look, and cannot stop what comes out; the gates go down, the bells go back on the demon’s belt, and the Great Sage spends the night as a fly on the one wall the fire has not reached.',
    items: ['purple-gold-bells'], threads: ['kingdoms'], motifs: ['fire', 'borrowed-treasure'],
    cast: { wukong: 'Steals the bells, cannot resist opening them, and loses them again inside a minute.',
      'golden-queen': 'Talks a demon out of his own weapons by asking for them as a bride, and keeps her nerve through all of it.',
      'sai-tai-sui': 'Gets his bells back by accident and does not know how close he came to losing everything.' } },

  /* ---- Chapter 71 ---- */
  { ch: 71, key: 'whose-bells-are-real', title: 'Whose Bells Are These', loc: 'qilin-mountain', d: ce(648, 28), tension: 4, pov: 'wukong',
    desc: 'As a maid he chews a handful of hair into lice, fleas and bedbugs and puts them in the demon’s clothes; the bells come out from the third layer to be deloused and go back as three hairs. Then he calls himself the Outside Grandfather come from Purple Cinnabar, and the demon goes to ask his queen whether there is such a surname at that court — and she finds it in the Thousand Character Classic and he believes her.',
    items: ['purple-gold-bells'], threads: ['kingdoms'], motifs: ['disguise'],
    cast: { wukong: 'Swaps three treasures for three hairs by giving somebody an itch, and then wins the argument about which set is genuine.',
      'sai-tai-sui': 'Shakes his own bells, gets nothing, and decides they must be shy of the female pair.',
      'golden-queen': 'Backs a lie in front of the demon who abducted her, using a schoolbook.' } },
  { ch: 71, key: 'the-golden-haired-hou', title: 'The Bodhisattva’s Own Mount', loc: 'qilin-mountain', d: ce(648, 32), tension: 3, pov: 'guanyin',
    desc: 'She puts the fire out with dew. The demon is her golden-haired hou, which bit through its chain while the boy who watches it dozed — and which came here to serve out a sentence the king earned by shooting a peacock’s mate at Falling Phoenix Slope. And back at the palace the king falls down holding his hand at the first touch of her, until an immortal comes to lift the enchantment he laid three years ago: the bridal gown was an old palm-fibre raincoat, and the needles were its bristles.',
    items: ['purple-gold-bells'], threads: ['who-owns-the-demon', 'kingdoms'], motifs: ['mercy-over-death'],
    cast: { guanyin: 'Collects her own escaped mount, and explains that the abduction was a three-year sentence with an end date.',
      'sai-tai-sui': 'Was a chained animal doing a job, and goes home under a saddle.',
      'zhang-boduan': 'Takes back the raincoat he disguised as a wedding dress, having protected a woman for three years with it.',
      'golden-queen': 'Is returned to a husband who cannot touch her until a stranger takes a coat off her.',
      'zhuzi-king': 'Gets his wife back and learns that his own arrow, years ago, is why she went.' } },

  /* ---- Chapter 72 ---- */
  { ch: 72, key: 'the-master-begs', title: 'The One Time He Goes Himself', loc: 'pansi-cave', d: ce(648, 90), tension: 3, pov: 'tripitaka',
    desc: 'The house is close enough to call to, so for once he insists on begging the meal himself and his disciples let him. Silk-work and a kickball game in the yard, and past the arbour no rooms at all, only stone benches and cold air; and what comes out of the kitchen is called vegetarian and is human fat and brains. The door is blocked when he stands up.',
    items: ['alms-bowl'], threads: ['master-and-disciple'], motifs: ['hunger'],
    cast: { tripitaka: 'Insists on doing one ordinary thing for himself and is roped to a beam within the hour.',
      'seven-spider-women': 'Run a house that looks like a farm and has no bedrooms in it, and nobody notices until the food arrives.',
      wukong: 'Lets him go because the argument is not worth having, and is wrong.' } },
  { ch: 72, key: 'the-cleansing-spring', title: 'Seven Sets of Clothes', loc: 'zhuogou-spring', d: ce(648, 95), tension: 3, pov: 'wukong',
    desc: 'The hot spring was the seven immortal maidens’ bathing pool until these took it. He will not fight women in the water, so he turns into a starving hawk and carries every set of clothes off the rack instead. His brother has no such scruple, jumps in as a catfish, slips through their hands until they are worn out, and then stands up in his own shape with the rake and spends the rest of the fight falling over.',
    items: ['rake'], threads: [], motifs: ['transformation', 'water'],
    cast: { wukong: 'Refuses a fight on a principle he does not often show, and settles it with laundry theft.',
      'zhu-bajie': 'Has no principle available and gets exactly what he deserves, at length.',
      'seven-spider-women': 'Lose their clothes and win the fight, and web the whole farmstead shut behind them.' } },

  /* ---- Chapter 73 ---- */
  { ch: 73, key: 'twelve-red-dates', title: 'Twelve Dates and a Milligram', loc: 'yellow-flower-temple', d: ce(648, 98), tension: 4, pov: 'wukong',
    desc: 'The spiders’ fellow-student poisons four cups of date tea. Served last, the monkey notices that his two dates are black where everyone else’s are red, and says so — and is told to stop being rude to a host and drink it. The other three go down.',
    items: [], threads: ['master-and-disciple'], motifs: ['hunger'],
    cast: { wukong: 'Spots the poison in the cup, is overruled on grounds of manners, and watches all three of them drink it.',
      'hundred-eyed-demon': 'Poisons four guests over a debt that is not even his, and only fails with the one who was served last.',
      tripitaka: 'Corrects his disciple’s manners and is unconscious on the floor within the paragraph.',
      'zhu-bajie': 'Drinks his in one and is the first down.',
      'sha-wujing': 'Drinks his politely and goes down beside the other two.' } },
  { ch: 73, key: 'a-thousand-eyes', title: 'A Thousand Eyes Under His Arms', loc: 'yellow-flower-temple', d: ce(648, 103), tension: 5, pov: 'pilanpo',
    desc: 'Seventy tail-hairs become seventy little monkeys with two-pronged staves, and the web is wound up ten catties at a time until seven bushel-sized spiders come out of it. Then the Daoist strips his robe off and a thousand eyes open down both sides of him, pouring gold light that cannot be got out of. A woman in mourning on the hillside names him, and names the one being who can put the light out — who has not left her cave in three hundred years and whose only weapon is a needle forged in her son’s eye.',
    items: [], threads: ['who-owns-the-demon'], motifs: [],
    cast: { pilanpo: 'Comes out of three hundred years of retirement, throws one embroidery needle, and goes home with a centipede on her finger.',
      'hundred-eyed-demon': 'Is beaten by an object made from the eye of the Star Lord who beat the scorpion, which is the same joke twice.',
      wukong: 'Is bounced off the top of a wall of light and has to go out through the ground as a pangolin.',
      'lishan-laomu': 'Comes down as a widow with paper money, names the demon and the remedy, and does not stay to be recognised.',
      'seven-spider-women': 'Are dragged out of their own web and abandoned by the fellow-student they came to for help.' } },

  /* ---- Chapter 74 ---- */
  { ch: 74, key: 'four-and-a-half-myriad', title: 'Forty-Eight Thousand Small Demons', loc: 'lion-camel-ridge', d: ce(648, 180), tension: 4, pov: 'taibai',
    desc: 'The old man on the slope makes him turn handsome before he will answer, and then gives the count: five thousand on each ridge, ten thousand at each road-mouth, five thousand patrolling, ten thousand on the gates, and cooks and woodcutters past counting. Then he vanishes, is caught in the air and called by his personal name, and this time the warning is not an exaggeration.',
    items: [], threads: ['scriptures'], motifs: [],
    cast: { taibai: 'Brings the one warning in the book that turns out to be understated, and offers ten thousand troops that are not taken.',
      wukong: 'Hears a number he does not believe and finds out over the next four chapters that it was accurate.',
      'zhu-bajie': 'Asks for the numbers, gets them, and proposes going round.' } },
  { ch: 74, key: 'the-magic-cudgel-story', title: 'Frightening an Army With a Story', loc: 'lion-camel-ridge', d: ce(648, 185), tension: 3, pov: 'wukong',
    desc: 'A patroller with a flag, a bell and a clapper gives up all three kings under questioning: one who swallowed a hundred thousand heavenly troops in a mouthful, one whose trunk crushes iron-backed men, and a Roc of Ten Thousand Li with a vase that turns a man to liquid in an hour. Then, wearing the dead patroller’s face, he tells the front ranks he has just seen Sun Wukong whetting a pole by the stream and swearing to kill the door-guard first, and ten thousand of them go home.',
    items: [], threads: [], motifs: ['disguise'],
    cast: { wukong: 'Routs an army of ten thousand with a rumour about himself, which is the most efficient thing he ever does.',
      'xiao-zuanfeng': 'Answers every question honestly under questioning and is killed for the face he is wearing.' } },

  /* ---- Chapter 75 ---- */
  { ch: 75, key: 'the-yin-yang-vase', title: 'Thirty-Six Bearers for a Two-Foot Vase', loc: 'lion-camel-cave', d: ce(648, 188), tension: 5, pov: 'wukong',
    desc: 'Two feet four inches high, and it takes thirty-six demons to carry, one for each star of the Dipper’s tally. Inside it is cool, until he says so out loud, and then it is fire, forty snakes and three fire dragons. Burned at the ankle and crying, he remembers the three hairs put into the back of his head at Coiled Snake Mountain, and makes a diamond drill, a bamboo bow and a cord out of them.',
    items: ['yin-yang-vase'], threads: ['who-owns-the-demon'], motifs: ['fire', 'borrowed-treasure'],
    cast: { wukong: 'Spends the insurance policy Guanyin left in his scalp fifty-nine chapters ago, and bores out through the bottom.',
      'roc-demon': 'Owns the one container in the book that nearly finishes him, and does not check it afterwards.' } },
  { ch: 75, key: 'inside-the-lion', title: 'Wintering in a Demon’s Stomach', loc: 'lion-camel-cave', d: ce(648, 192), tension: 4, pov: 'blue-lion-demon',
    desc: 'The mouth that opens at the crest of the slope is meant for the pig, and he walks into it instead. Salt water will not bring him up. He offers to stay until spring, describes the folding pot he would cook the liver in and where he would punch a chimney, and drinks the poisoned wine on the way down through a mouth shaped like a trumpet.',
    items: [], threads: [], motifs: ['hunger'],
    cast: { 'blue-lion-demon': 'Swallows the one thing that is worse inside him than outside, and cannot get it out again.',
      wukong: 'Takes up residence in a stomach and negotiates from there, which is the same tactic as the iron fan.',
      'zhu-bajie': 'Goes back down the hill to report the death and to propose selling the horse and dividing the luggage.',
      tripitaka: 'Hears that his disciple has been eaten and starts making arrangements for the party to go home.' } },

  /* ---- Chapter 76 ---- */
  { ch: 76, key: 'a-string-on-the-heart', title: 'A Thread on His Heart', loc: 'lion-camel-ridge', d: ce(648, 195), tension: 3, pov: 'wukong',
    desc: 'Before coming out he ties a hair round the demon’s heart in a slipknot and leaves through the nostril rather than the teeth. Then he plays him from the hillside like a kite, until the small demons observe that it is nowhere near Qingming and their king is fifty feet in the air.',
    items: [], threads: [], motifs: [],
    cast: { wukong: 'Turns an enemy into a toy and keeps the string, which is the only leash anyone ever gets on anything here.',
      'blue-lion-demon': 'Is flown on a wire by something that has already been inside him.' } },
  { ch: 76, key: 'the-trunk-and-the-cudgel', title: 'Pull the Nose', loc: 'lion-camel-ridge', d: ce(648, 200), tension: 4, pov: 'zhu-bajie',
    desc: 'He asks for a rope round his own waist and for his brothers to haul him back if he loses, and gets it slackened instead, and trips over the trailing line until a trunk takes him round the middle. Then the same trunk takes his brother, who has hands free, and is led down the slope by the nose with the rake handle beating time behind it.',
    items: ['rake'], threads: ['bajie-appetite'], motifs: [],
    cast: { 'zhu-bajie': 'Asks for a lifeline, is sabotaged with it, and then supplies the tactical suggestion that wins the fight.',
      wukong: 'Lets his brother be captured for a joke and then wins by doing what the joke suggested.',
      'yellow-tusk-elephant': 'Catches both of them with the same trunk and is led home by it.' } },

  /* ---- Chapter 77 ---- */
  { ch: 77, key: 'four-hundred-li-of-kindness', title: 'Four Hundred Li in a Sedan Chair', loc: 'lion-camel-ridge', d: ce(648, 205), tension: 4, pov: 'roc-demon',
    desc: 'The third king’s plan is hospitality: thirty cooks laying out rice, bamboo shoots, tea, mushrooms and beancurd every twenty li, eight bearers, eight criers, three meals a day and a bed each night, with the three demons walking beside the chair. A week of it. The one thing that has never once been fooled by a threat is taken in by good manners, and only notices when the black air over the city walls knocks him off his feet.',
    items: [], threads: ['scriptures', 'sha-silence'], motifs: [],
    cast: { 'roc-demon': 'Wins by being courteous for four hundred li, which no other antagonist in the book thinks of trying.',
      wukong: 'Is fooled by kindness, having been proof against everything else for seventy chapters.',
      tripitaka: 'Is carried in a chair for a week and takes the whole thing as evidence that the road is improving.',
      'zhu-bajie': 'Eats three meals a day for a week and is the last person on earth who was going to object.',
      'sha-wujing': 'Walks beside the chair the whole way and cannot say what is wrong, only that something is.' } },
  { ch: 77, key: 'the-peacocks-brother', title: 'The Buddha’s Own Kin', loc: 'great-hall', d: ce(648, 212), tension: 4, pov: 'buddha',
    desc: 'Told the master has been eaten raw overnight, he goes to Vulture Peak to hand the whole errand back and weeps through the audience. The lion is Manjusri’s and the elephant Samantabhadra’s, seven days gone from their mountains. And the roc is the peacock’s brother, and the peacock once swallowed the Buddha whole on the Snow Mountain and was made a bodhisattva instead of killed, because harming her would have been harming his mother. The roc will not come quietly, and settles for the offerings made before every good deed in the four continents.',
    items: [], threads: ['who-owns-the-demon', 'scriptures'], motifs: ['names'],
    cast: { buddha: 'Explains that the demon holding the road is his own brother-in-law, and buys him off with a permanent share of the offerings.',
      'roc-demon': 'Refuses the terms twice, is caught by a strike at a lump of red meat, and negotiates rather than surrenders.',
      wukong: 'Tries to resign, is talked out of it by an accounting of the demon’s family, and finds his master was never eaten.',
      manjusri: 'Collects his lion with a word, seven days after it went missing.',
      samantabhadra: 'Collects his elephant the same way and neither of them explains the seven days.',
      tripitaka: 'Is in an iron chest in the Brocade Fragrance Pavilion the entire time, and the rumour of his death was city policy.' } },

  /* ---- Chapter 78 ---- */
  { ch: 78, key: 'goose-coops', title: 'A Goose Coop at Every Door', loc: 'bhiksu-kingdom', d: ce(649, 30), tension: 4, pov: 'tripitaka',
    desc: 'Every house on the street has a coop hung with coloured silk, and inside each one a boy between five and seven — some playing, some crying, some asleep, and no girls anywhere. The post-house warden clears the room before he will say it: three years ago a Daoist gave the king a girl of sixteen, and the prescription for what the king has done to himself since needs the hearts of one thousand one hundred and eleven boys.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { tripitaka: 'Counts the coops down one street and cannot eat for the rest of the day.',
      wukong: 'Asks the question nobody in the city will answer out loud, and gets it answered behind a closed door.',
      'zhu-bajie': 'Wants to know why nobody has simply left, and gets no answer to that either.' } },
  { ch: 78, key: 'the-children-carried-off', title: 'A Cold Wind Down Every Street', loc: 'bhiksu-kingdom', d: ce(649, 35), tension: 3, pov: 'wukong',
    desc: 'He calls up the city gods, the local gods, the guardians and the Six Ding and Six Jia, and has every coop carried out of the city in one night to hollows and deep woods — fed, kept warm, and kept from crying — while his brothers sit in the post-house chanting. The State Preceptor calls the wind a gift from Heaven, because he has seen a better decoction walk into the throne room.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Empties a capital of eleven hundred children in a night using nothing but the civil service.',
      'national-preceptor': 'Loses his ingredients and immediately proposes a better recipe: the heart of the monk from the east.',
      'bhiksu-king': 'Agrees to it in open court within the hour.',
      tripitaka: 'Learns that he is the substitute for eleven hundred children, and offers his heart rather than argue.' } },

  /* ---- Chapter 79 ---- */
  { ch: 79, key: 'a-heap-of-hearts', title: 'A Heap of Hearts, and Not One Black', loc: 'bhiksu-kingdom', d: ce(649, 38), tension: 5, pov: 'wukong',
    desc: 'Wearing his master’s face, he opens his own belly on the throne-room floor and the hearts roll out and are named one by one: red, white, yellow, greedy, ambitious, jealous, calculating, competitive, arrogant, murderous, fearful. Every kind but a black one. Then he offers, very politely, to fetch the State Preceptor’s instead.',
    items: [], threads: ['kingdoms'], motifs: ['disguise'],
    cast: { wukong: 'Turns a public execution into a demonstration and wins the room before he has touched anybody.',
      'national-preceptor': 'Watches a man survive his own dissection and runs, which is the correct response and too late.',
      'bhiksu-king': 'Sees what he has ordered done to eleven hundred children performed once, in front of him, on a volunteer.' } },
  { ch: 79, key: 'the-white-deer', title: 'The Old Man of the South Pole’s Mount', loc: 'willow-slope', d: ce(649, 44), tension: 3, pov: 'shouxing',
    desc: 'The willow grove has no farm in it; the trick is the ninth-forked tree, three turns each way, both hands on the trunk, and the word said three times. The dragon-coiled staff the demon fights with is his master’s walking stick, also stolen. The deer went missing during an unfinished game of chess with the Eastern Flower Emperor, and would have been dead in another minute. The girl behind the stone screen is a white-faced fox, and the king is asked to look at what he took into his bed.',
    items: [], threads: ['who-owns-the-demon', 'kingdoms'], motifs: ['mercy-over-death'],
    cast: { shouxing: 'Arrives one minute before his own mount is killed and takes it home without apologising for the chess.',
      'national-preceptor': 'Is a white deer that walked off during a chess game and set a kingdom to killing its children.',
      'fox-beauty': 'Has no weapon and nowhere to run behind the screen, and the court is made to look at her afterwards.',
      wukong: 'Asks his brother not to smash her flat, so that a king can see what he has been given.',
      'zhu-bajie': 'Takes the fox with the rake and is told, for once, to be careful how he does it.',
      'bhiksu-king': 'Gets eleven hundred coops back in his streets and a city that carries the four of them home on its shoulders.' } },

  /* ---- Chapter 80 ---- */
  { ch: 80, key: 'the-voice-on-the-wind', title: 'A Voice Only He Can Hear', loc: 'black-pine-forest', d: ce(649, 120), tension: 4, pov: 'tripitaka',
    desc: 'A woman roped above the waist and buried below it, with a story about tomb-sweeping and bandits and five days without food. The monkey pulls his brother off the ropes by the ear and they leave her. Then she sends one sentence downwind — you will not save a living life, and you bow to Buddha for what — and none of the three disciples hears it, and the horse is turned round.',
    items: [], threads: ['master-and-disciple'], motifs: [],
    cast: { tripitaka: 'Turns back for a woman on the strength of a sentence that was aimed at him and nobody else.',
      'gold-nosed-mouse': 'Uses one line of doctrine as bait, which is the only weapon that has ever worked on this man.',
      wukong: 'Lays out the whole charge sheet — abduction, a revoked ordination, exile — and loses the argument anyway.',
      'zhu-bajie': 'Is offered the job of carrying her, on the grounds that his snout turns far enough round for private conversation.' } },
  { ch: 80, key: 'the-bell-in-the-weeds', title: 'Speaking to a Bell', loc: 'zhenhai-monastery', d: ce(649, 125), tension: 1, pov: 'tripitaka',
    desc: 'A bell half sunk in a courtyard of moss and frogs, white above from years of rain and blue-green below from the earth. He makes it a small speech about the founder and the caster both being dead, and a caretaker throws a brick at it to answer him. And the monastery is two monasteries: the ruined front given to the bandits who shelter there in bad weather, and a rebuilt back for the monks.',
    items: [], threads: [], motifs: [],
    cast: { tripitaka: 'Talks to a bell in a weed patch, and is the only person in the book who would.',
      wukong: 'Watches him do it and does not interrupt, which is unusual enough to be worth noting.' } },

  /* ---- Chapter 81 ---- */
  { ch: 81, key: 'the-grain-of-rice', title: 'Three Days’ Illness for One Grain of Rice', loc: 'zhenhai-monastery', d: ce(649, 130), tension: 3, pov: 'tripitaka',
    desc: 'He is ill enough to want to write to Taizong that he cannot finish. The diagnosis he gets is not medical: as the Golden Cicada he dozed through a sermon and trod a grain of rice underfoot, and this is the three days it costs. And every night two novices go to sound the bell and the drum, and in the morning there are caps, shoes and bones in the back garden.',
    items: [], threads: ['master-and-disciple'], motifs: [],
    cast: { tripitaka: 'Wants to give up for the only time in fourteen years, and is talked out of it by an accounting of a previous life.',
      wukong: 'Diagnoses a three-day fever as a debt from before either of them was born, and is not joking.' } },
  { ch: 81, key: 'the-shoe', title: 'A Shoe Left Fighting', loc: 'zhenhai-monastery', d: ce(649, 135), tension: 4, pov: 'gold-nosed-mouse',
    desc: 'He keeps vigil as a small novice with a wooden fish and reads her fortune when she puts her arms round him. She backs away, blows on her left shoe, and leaves it swinging two swords in her own shape while her real body goes to the abbot’s room. He comes back to no master, swings at both his brothers, and is told by the one who kneels that somebody still has to carry the luggage.',
    items: [], threads: ['master-and-disciple', 'sha-silence'], motifs: ['transformation'],
    cast: { 'gold-nosed-mouse': 'Fights a decoy of herself for as long as it takes to walk out of a different door with the man she came for.',
      wukong: 'Is beaten by a shoe, and takes it out on the two people who were asleep.',
      'sha-wujing': 'Kneels, points out who would be carrying the baggage, and stops the fight.',
      'zhu-bajie': 'Takes the first swing and is the reason it has to be stopped.' } },

  /* ---- Chapter 82 ---- */
  { ch: 82, key: 'the-caldera', title: 'A Jar-Mouth in a Rock', loc: 'bottomless-cave', d: ce(649, 140), tension: 3, pov: 'wukong',
    desc: 'The archway says Bottomless Cave and the way in is a hole the width of a jar’s mouth in a boulder, worn smooth by use. Three hundred li straight down, and everything in it has its own sun, its own wind and its own flowers. Two demon women at the well are greeted by his brother as demons and beat him with the carrying pole for it.',
    items: [], threads: [], motifs: [],
    cast: { wukong: 'Goes down three hundred li through a hole he can barely get a hand into, and finds a country at the bottom.',
      'zhu-bajie': 'Calls two women demons to their faces and is beaten with a pole, and gets a lecture about poplar and sandalwood for it.',
      'sha-wujing': 'Holds the archway and the horse and is told to stay there, which he does.' } },
  { ch: 82, key: 'carried-out', title: 'Carried Out on Her Own Back', loc: 'bottomless-cave', d: ce(649, 145), tension: 4, pov: 'gold-nosed-mouse',
    desc: 'The wedding banquet is laid and he prays over the cup before drinking it, so the monkey rides down in the foam as a gnat and is flicked out with a little finger. Then a red peach in the garden, offered for her beauty, goes down whole without being bitten. Her own small demons are not allowed to carry the bridegroom out; only she may, and she says so herself, and walks him out of her own gate with a monkey inside her.',
    items: [], threads: ['master-and-disciple'], motifs: ['transformation'],
    cast: { 'gold-nosed-mouse': 'Insists on carrying her husband out herself and carries her captor out with him.',
      wukong: 'Gets inside her the same way he got inside the iron fan, and uses it to walk his master out of a locked country.',
      tripitaka: 'Prays over a cup, is offered a peach, and is walked out of a wedding by the bride.' } },

  /* ---- Chapter 83 ---- */
  { ch: 83, key: 'the-tablets', title: 'Two Tablets on an Altar', loc: 'bottomless-cave', d: ce(649, 148), tension: 3, pov: 'wukong',
    desc: 'The right shoe this time, and while three of them beat it flat she picks the master up off the ground at the archway, bites through the halter, and takes horse, luggage and man back down. And behind the empty rooms there is incense still burning in front of a gilt censer and two gold-lettered tablets: Honoured Father Heavenly King Li, and Honoured Elder Brother Third Prince Nezha.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['names'],
    cast: { wukong: 'Finds the demon’s family shrine and takes both tablets to Heaven as evidence, which is a new tactic for him.',
      'gold-nosed-mouse': 'Keeps a private altar to the two people who spared her three hundred years ago, and it convicts her.',
      'zhu-bajie': 'Beats a shoe flat for the second time in three chapters.' } },
  { ch: 83, key: 'the-lawsuit', title: 'Bound and Nearly Beheaded by the Defendant', loc: 'cloud-tower-palace', d: ce(649, 152), tension: 4, pov: 'nezha',
    desc: 'Li Jing has the plaintiff tied and draws the demon-slaying sabre before his son’s blade stops it. Three hundred years ago she stole the Buddha’s incense flowers and candles and was spared instead of killed, and in gratitude she set up their tablets and called them father and brother. And rolling on the floor, the plaintiff will not be untied by anybody but the Heavenly King himself.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['names'],
    cast: { nezha: 'Stops his own father’s sword and then explains the adoption that nobody in the family had thought to mention.',
      'li-jing': 'Answers a lawsuit by tying up the plaintiff, and has to untie him personally as the price of settling.',
      wukong: 'Loses first and wins after, and says out loud that this is how his business always runs.',
      'gold-nosed-mouse': 'Is arrested by the family she adopted, in the small back room where she had moved the wedding to be private.',
      tripitaka: 'Is found in a low room in the black southeast corner, after three hundred li of cave has been searched to bare ground.' } },

  /* ---- Chapter 84 ---- */
  { ch: 84, key: 'the-chest', title: 'Sleeping in a Chest', loc: 'dharma-kingdom', d: ce(650, 20), tension: 4, pov: 'wukong',
    desc: 'A king has vowed to kill ten thousand monks and has killed nine thousand nine hundred and ninety-six nameless ones, and is waiting for four with names. So they go in as four horse-traders of different surnames, in headcloths stolen off an innkeeper’s hat-rack, and sleep in a chest four feet by seven. Then he talks loudly about four thousand taels in the saddlebags, and the chest is carried out of the city by robbers and back into it by soldiers.',
    items: [], threads: ['kingdoms'], motifs: ['disguise'],
    cast: { wukong: 'Advertises money he does not have, gets the chest stolen and impounded, and calls that the plan working.',
      tripitaka: 'Spends a night in a locked box in a customs yard, having been told it was the safe option.',
      'zhu-bajie': 'Needs two headcloths sewn into one to cover his head, and complains about the box the whole night.',
      'sha-wujing': 'Points out that they are now in official custody in a kingdom that executes monks.' } },
  { ch: 84, key: 'the-night-of-razors', title: 'A Thousand Razors in One Night', loc: 'dharma-kingdom', d: ce(650, 25), tension: 4, pov: 'dharma-destroying-king',
    desc: 'Every hair on both arms becomes a small monkey or a sleep-insect, and the cudgel becomes a thousand razors. By dawn the king, the queens, the six palaces, the eunuchs and every ranked official in the capital have been shaved. The chest is opened before the court, and a king with no hair on his head comes down off the throne to ask them to take him as a disciple; and one character of the kingdom’s name is changed — not Destroying but Respecting.',
    items: ['cudgel'], threads: ['kingdoms'], motifs: ['names', 'transformation'],
    cast: { 'dharma-destroying-king': 'Wakes up bald with his whole court, weeps into his own scalp, and renames his country before breakfast.',
      wukong: 'Ends a two-year massacre without killing anybody, which is the only time he manages that.',
      tripitaka: 'Is let out of a box into a throne room where everyone is bald and nobody is angry.' } },

  /* ---- Chapter 85 ---- */
  { ch: 85, key: 'the-four-line-verse', title: 'The Four Lines He Had Forgotten', loc: 'hidden-mist-mountain', d: ce(650, 80), tension: 2, pov: 'wukong',
    desc: 'He can recite the Heart Sutra and has forgotten the four lines the Crow’s Nest master gave him with it. The lines say that fear is itself the distance from Vulture Peak: the Buddha is on Vulture Peak, and Vulture Peak is inside your own body. It is the closest thing to a thesis the book states out loud, and it is said by the monkey to the monk.',
    items: ['heart-sutra'], threads: ['master-and-disciple', 'scriptures'], motifs: [],
    cast: { wukong: 'Quotes the gatha back at his master seventy chapters after refusing to sit still for it.',
      tripitaka: 'Is frightened by a mountain and is told, accurately, that the mountain is his own.' } },
  { ch: 85, key: 'divided-plum-blossom', title: 'The Divided Plum Blossom Plan', loc: 'hidden-mist-mountain', d: ce(650, 85), tension: 4, pov: 'south-mountain-great-king',
    desc: 'A small demon who fled Lion Camel Ridge tells his king exactly what Sun Wukong is, and then how to beat him: three picked demons in the king’s own armour, one for each disciple, three separate ambushes, and a hand reaching down out of the sky for the man left alone in the saddle. It is the only plan in the book that treats the party as a formation to be broken up.',
    items: [], threads: ['scriptures'], motifs: [],
    cast: { 'south-mountain-great-king': 'Runs the one operation that is designed around the disciples rather than around the monk.',
      wukong: 'Sees the demon in the fog, lies about it to get his brother moving, and is separated from the horse by the lie.',
      tripitaka: 'Is taken out of the saddle by a hand while all three disciples are fighting men in the same armour.',
      'zhu-bajie': 'Is sent ahead on a promise of steamed rice and white buns, and finds a demon in the king’s armour.',
      'sha-wujing': 'Gets the third ambush and holds it longest, and it makes no difference.' } },

  /* ---- Chapter 86 ---- */
  { ch: 86, key: 'the-willow-head', title: 'A Head That Sounds Like a Woodblock', loc: 'linked-ring-cave', d: ce(650, 88), tension: 4, pov: 'zhu-bajie',
    desc: 'A head comes out through the hole in the door and is wept over. Then it is dropped on a rock and it rings: carved willow root. So they send out a real one, off the flaying pavilion and scraped clean, and the pig carries it up the slope in his arms, digs, raises a mound, plants willow twigs for pines, and heaps goose-egg stones in front for offerings, to show a living man’s feeling.',
    items: [], threads: ['master-and-disciple'], motifs: [],
    cast: { 'zhu-bajie': 'Buries a stranger’s head with full honours because he thinks it is his master’s, and it is the best thing he ever does.',
      wukong: 'Tests a severed head by dropping it on a rock, which is exactly the difference between the two of them.',
      'south-mountain-great-king': 'Sends out a fake head and then a real one, and is not prepared for either being checked.',
      'sha-wujing': 'Digs the grave.' } },
  { ch: 86, key: 'the-leopard', title: 'An Artemisia-Leaf Leopard', loc: 'linked-ring-cave', d: ce(650, 93), tension: 4, pov: 'wukong',
    desc: 'Not a water snake, because his master’s ghost would think ill of a monk turning into something that coils; not a crab, too many legs. A water rat, up the outflow drain, past a small demon laying strips of human flesh out to dry. From the roof beam he listens to the kitchen deciding between chopped with spices, steamed for flavour, boiled to save firewood, or salted to keep — and then a fistful of chewed hair goes into every nose in the hall.',
    items: [], threads: [], motifs: ['transformation', 'hunger'],
    cast: { wukong: 'Chooses his disguise by what his master would think of it, which is new.',
      'south-mountain-great-king': 'Is tied hoof to hoof and carried out over a shoulder, a mugwort-patterned leopard.',
      tripitaka: 'Is found alive, and has to tell the disciple who buried a head whose it was.',
      'zhu-bajie': 'Digs the grave up again in a fury, and then buries the pieces a second time when he is told.',
      woodcutter: 'Was tied to the tree opposite for three days, and goes home to a mother who has been weeping at the gate for four.' } },

  /* ---- Chapter 87 ---- */
  { ch: 87, key: 'rice-hill-flour-hill', title: 'A Chicken, a Dog and a Lamp', loc: 'celestial-hall', d: ce(650, 150), tension: 3, pov: 'wukong',
    desc: 'A prefecture three years dry, and a proclamation being hung under the eaves as they walk past. Up in the Hall of Diffused Fragrance the answer is on display: a hill of rice ten fathoms high with a fist-sized chicken pecking at it, a hill of flour twenty fathoms high with a lapdog licking, and a gold lock an inch thick with a lamp flame on the shackle. Rain comes when those three are gone.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { wukong: 'Goes to Heaven for rain and is shown a mechanism instead of given an answer.',
      'jade-emperor': 'Keeps a three-year grudge as an exhibit with a measurable end condition.' } },
  { ch: 87, key: 'a-city-turned-good', title: 'The Hills Fall When the City Prays', loc: 'fengxian', d: ce(650, 155), tension: 2, pov: 'shangguan-prefect',
    desc: 'Three years ago, on the twenty-fifth of the twelfth month, the prefect quarrelled with his wife, overturned the table of offerings to Heaven and called the dog to it — on the one day the Jade Emperor was passing overhead. The remedy is one good thought. Every household in the city burns incense and chants; the rice and the flour go, the shackle breaks, and the rain comes to three feet and forty-two drops.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { 'shangguan-prefect': 'Learns that a whole prefecture has been paying for one afternoon of his temper, and says so publicly.',
      wukong: 'Holds the wind, cloud, thunder and rain departments in the sky afterwards and makes them show themselves.',
      tripitaka: 'Sits through the whole of it and is the reason the city believes the monks in the first place.' } },

  /* ---- Chapter 88 ---- */
  { ch: 88, key: 'three-princes-with-weapons', title: 'Three Princes and Three Weapons', loc: 'yuhua', d: ce(650, 250), tension: 1, pov: 'yuhua-princes',
    desc: 'A prince of the blood asks how far it has been, and is told nobody kept count — only that the verse said a hundred and eight thousand li. His three sons like fighting and have a staff, a rake-shaped weapon and a black club between them, and want to know where the visitors got theirs. Two of the three cannot lift the borrowed ones off the ground.',
    items: ['cudgel', 'rake', 'staff'], threads: [], motifs: [],
    cast: { 'yuhua-princes': 'Try to lift three weapons that weigh a thousand catties each and manage one nudge between them.',
      'yuhua-king': 'Asks the only question about distance anybody asks in a hundred chapters.',
      tripitaka: 'Says he never counted the years, and then names them anyway.',
      wukong: 'Puts on a display three hundred paces up until nothing can be seen but a sky of turning iron.',
      'zhu-bajie': 'Follows with the rake and is, for the first time, applauded by a whole county.',
      'sha-wujing': 'Follows with the staff, and is the only one who asks their master’s leave before agreeing to teach.' } },
  { ch: 88, key: 'the-weapons-left-out', title: 'Three Weapons Left in a Shed', loc: 'yuhua', d: ce(650, 255), tension: 3, pov: 'yellow-lion-demon',
    desc: 'Copies are to be forged, so the originals are left lying in the foundry yard overnight as patterns, and their light goes ten thousand fathoms into the sky. Seventy li away a demon on Leopard Head Mountain sees the glow, comes over to look, and carries all three home in one armful.',
    items: ['cudgel', 'rake', 'staff'], threads: [], motifs: [],
    cast: { 'yellow-lion-demon': 'Steals the three most famous weapons in the world because they were left out where they could be seen.',
      wukong: 'Leaves the cudgel in a shed, which is the single most careless thing he does in the book.',
      'yuhua-princes': 'Wake up to an empty yard and have to go and say so.' } },

  /* ---- Chapter 89 ---- */
  { ch: 89, key: 'the-rake-banquet', title: 'The Nine-Toothed Rake Banquet', loc: 'tiger-mouth-cave', d: ce(650, 260), tension: 3, pov: 'zhu-bajie',
    desc: 'Two wolf-headed couriers on the road with twenty taels for pigs and sheep, planning to pad the bill by two or three for a winter coat. Their faces and their invitation get two of them through the door, with the third playing the livestock dealer come for his last five taels. The rake is set up on the middle table like an altar-piece, and the guest is told he may look at it but not talk about it.',
    items: ['rake'], threads: [], motifs: ['disguise'],
    cast: { 'zhu-bajie': 'Cannot manage a single sentence of pretence, walks up, takes his rake off the table, and swings.',
      wukong: 'Gets them all the way inside on two stolen faces and loses the element of surprise to his brother’s temper.',
      'yellow-lion-demon': 'Throws a party for a stolen rake and invites the three people it was stolen from.',
      'sha-wujing': 'Plays the dealer, and is the only one of the three who stays in character to the end.' } },
  { ch: 89, key: 'nine-spirits-summoned', title: 'The Grandsire From Bamboo Node Mountain', loc: 'bamboo-node-mountain', d: ce(650, 265), tension: 4, pov: 'nine-headed-lion',
    desc: 'The grandsire hears the whole story, names all three of them accurately, and says the boy has picked the wrong quarrel — and then brings six lions to settle it anyway. And the two real couriers wake at last, come home to a cold fire and no household, and are kneeling there crying when their king arrives and tries to dash his head on the rock.',
    items: [], threads: [], motifs: [],
    cast: { 'nine-headed-lion': 'Knows exactly what he is walking into, says so out loud, and goes anyway out of family feeling.',
      'yellow-lion-demon': 'Loses his mountain, his household and his nerve, and has to be physically stopped from killing himself.' } },

  /* ---- Chapter 90 ---- */
  { ch: 90, key: 'nine-mouths', title: 'Nine Mouths, Six Bites', loc: 'yuhua', d: ce(650, 268), tension: 5, pov: 'nine-headed-lion',
    desc: 'While seven lions hold the two disciples at the wall, the grandsire comes over the tower and carries away six people in six of his nine mouths — the monk, the old king, three princes and the pig — and leaves three mouths empty. In the cave they break willow switches on the monkey’s skull all evening and he does not make a sound, and it is the quiet one who cannot watch it and offers to take a hundred.',
    items: [], threads: ['sha-silence'], motifs: [],
    cast: { 'nine-headed-lion': 'Takes six prisoners in one pass and has room for three more.',
      wukong: 'Is beaten with switches all night without a sound, which is the only time anyone sees him take punishment quietly.',
      'sha-wujing': 'Offers to take a hundred strokes in his brother’s place, and means it.',
      'zhu-bajie': 'Works out that he is third in the queue and says so.',
      tripitaka: 'Is carried off in a mouth for the last time in the book.',
      'yuhua-king': 'Loses his three sons and himself to a beast that came for a rake.' } },
  { ch: 90, key: 'the-beast-kneels', title: 'The Beast Kneels to Its Owner', loc: 'nine-fold-cave', d: ce(650, 274), tension: 3, pov: 'taiyi-jiuku',
    desc: 'The Nine-Spirit Primal Sage is the Heavenly Honoured One’s own mount, gone since its keeper drank a bottle of Laozi’s Wheel-of-Rebirth liquor and slept through the theft — three days above, two years below. The monkey shouts at the door until it charges out, and one word from behind him puts it flat on four legs. The seven lions are killed and skinned and cut into one- and two-ounce pieces and given out through the whole city, to taste and to settle the fright.',
    items: [], threads: ['who-owns-the-demon'], motifs: [],
    cast: { 'taiyi-jiuku': 'Collects his mount, punches its neck a hundred times, and puts the saddle blanket on himself.',
      'nine-headed-lion': 'Kneels at one word from a man who has been asleep for the whole episode.',
      wukong: 'Draws it out of its own door and steps aside, which is all he is needed for.',
      'yuhua-king': 'Feeds the whole city and its garrison on the animals that ate his family, which is not subtle and works.' } },

  /* ---- Chapter 91 ---- */
  { ch: 91, key: 'three-buddhas-on-the-bridge', title: 'Three Buddhas Come Down to the Lamps', loc: 'golden-lamp-bridge', d: ce(651, 14), tension: 4, pov: 'tripitaka',
    desc: 'Two hundred and forty households are assessed for the lamp oil: five hundred catties a vat, three vats, sweet-gum oil at thirty-two taels the catty, and by the third night it is gone and the people say the Buddhas took it. The wind rises before the third watch and the whole prefecture runs. The one man who walks towards it is on the bridge bowing when the lights go out.',
    items: [], threads: ['kingdoms'], motifs: ['false-buddha'],
    cast: { tripitaka: 'Bows to three Buddhas for the second time in the book, and is carried off for the second time by doing it.',
      'three-rhinoceros-demons': 'Have been eating a prefecture’s lamp oil for a thousand years by standing still and letting people kneel.',
      wukong: 'Gets to the bridge one moment after the lights go out.' } },
  { ch: 91, key: 'three-goats', title: 'Three Rams for Three Yangs', loc: 'green-dragon-mountain', d: ce(651, 16), tension: 3, pov: 'wukong',
    desc: 'Four men driving three sheep down the west slope shouting a word that means the tai hexagram opening: the Year, Month, Day and Hour officers, arranging three yangs to break his master’s run of ill luck. They also supply the identification — three rhinoceroses a thousand years old, who have loved sweet-gum oil since they were young, in a cave hung with three banners.',
    items: [], threads: ['who-owns-the-demon'], motifs: [],
    cast: { wukong: 'Meets four heavenly officers doing an astrological favour on a hillside and gets a full briefing out of it.',
      'three-rhinoceros-demons': 'Are named, aged and explained before the first blow is struck.' } },

  /* ---- Chapter 92 ---- */
  { ch: 92, key: 'the-firefly', title: 'A Firefly in the First Month', loc: 'mysterious-yin-cave', d: ce(651, 20), tension: 3, pov: 'tripitaka',
    desc: 'He sees a light in the dark and says the season is wrong for fireflies — the insects have only just begun to stir — and it answers him in his disciple’s voice. The lock comes open under a hand and they are nearly out when the watch is woken, and the fighting goes out through several doors with one of them left chained behind it.',
    items: [], threads: [], motifs: ['transformation'],
    cast: { tripitaka: 'Identifies his own rescue by knowing when fireflies hatch, which is the sharpest thing he does all book.',
      wukong: 'Gets a lock open and most of the way to the door, and has to fight out alone.',
      'three-rhinoceros-demons': 'Wake the watch in time and chain the prisoner again behind the retreat.' } },
  { ch: 92, key: 'the-four-wood-stars', title: 'The Four Wood Beasts', loc: 'mysterious-yin-cave', d: ce(651, 25), tension: 4, pov: 'four-wood-stars',
    desc: 'The Gold Star names the species — rhinoceroses of seven kinds, one horn, three hairs, two horns, that part water and love to be clean — and names their masters, the four lodges of the twenty-eight whose element is wood. The sight of the four of them alone puts three demon kings back on four hooves. Their horns open a path through the western sea and they run down it, and one of them is a moment too late to be taken alive.',
    items: [], threads: ['who-owns-the-demon', 'kingdoms'], motifs: ['water'],
    cast: { 'four-wood-stars': 'Settle a hundred and fifty rounds by walking into view, because their element outranks the demons’ own.',
      'three-rhinoceros-demons': 'Kneel to four star officers, and two of the three are taken alive and one is not.',
      wukong: 'Calls for them alive and is a moment too slow for the third, and says so.',
      moang: 'Brings shrimp and crab soldiers out to block the far end of the sea road.',
      'zhu-bajie': 'Wants to know what rhinoceros horn is worth by weight, and finds out.' } },

  /* ---- Chapter 93 ---- */
  { ch: 93, key: 'the-girl-in-the-cell', title: 'A Girl Kept in a Walled-Up Room', loc: 'jetavana-monastery', d: ce(651, 200), tension: 3, pov: 'hundred-year-abbot',
    desc: 'The Jetavana, whose ground was bought by covering it in gold bricks and still washes up gold and silver beads after heavy rain. A year ago tonight a wind put a girl on the old foundation who said she was the princess of India, blown out of a moonlit garden. The abbot walled her into a back room with a hole for a bowl and told the monastery she was a demon, and she understood at once and has feigned madness ever since.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { 'hundred-year-abbot': 'Saves a woman’s life by defaming her, and has been keeping her alive on that lie for a year.',
      tripitaka: 'Hears the whole account and is the first person in a year the abbot has been able to tell it to.',
      wukong: 'Listens, says nothing, and walks into the capital the next morning already knowing what he is looking for.' } },
  { ch: 93, key: 'the-embroidered-ball', title: 'The Ball Falls on a Monk', loc: 'tianzhu-capital', d: ce(651, 205), tension: 4, pov: 'jade-hare',
    desc: 'A princess of twenty choosing a husband from a tower by throwing a ball into a crowd — and the ball is aimed. It knocks the pilgrim’s hat crooked and rolls into his sleeve, and a disciple grows three fathoms tall to keep the crowd off it. The plan settled on is to let the wedding proceed: agree, ask that the disciples be summoned to take their leave, and get one of them close enough to see what she is.',
    items: [], threads: ['kingdoms'], motifs: ['disguise'],
    cast: { 'jade-hare': 'Aims a ball at the one man in a crowd of thousands, having waited a year in a princess’s body for him.',
      tripitaka: 'Is married off for the second time in the book and consents for the same reason as the first.',
      wukong: 'Advises going through with the wedding, because refusing means the executioner and settles nothing about the girl in the cell.' } },

  /* ---- Chapter 94 ---- */
  { ch: 94, key: 'four-screens-of-verse', title: 'Four Seasons on a Gold Screen', loc: 'tianzhu-capital', d: ce(651, 210), tension: 1, pov: 'tripitaka',
    desc: 'A son-in-law should not be left standing among the courtiers, so a stool is fetched with some shouting. Then four screens of spring, summer, autumn and winter, painted with poems by court scholars, and the king asks his son-in-law to match the rhymes. He does, in four, and they are set to music the same day.',
    items: [], threads: [], motifs: [],
    cast: { tripitaka: 'Matches four court poems on the spot, and is a poet in public for the second and last time.',
      'tianzhu-king': 'Has his son-in-law’s verses set to music before the wedding he is about to lose.',
      wukong: 'Shouts at a king across his own throne room about a chair, and gets one.' } },
  { ch: 94, key: 'the-bee-on-the-hat', title: 'A Bee on the Bishop’s Cap', loc: 'tianzhu-capital', d: ce(651, 214), tension: 3, pov: 'wukong',
    desc: 'The princess asks that the three ugly disciples be sent out of the city before the wedding, for fear of the sight of them, and it is the last thing she does before the one who wanted a look gets close enough. Gold and silver are taken, farewells made in front of the court, a hair keeps his place at the hostel, and the real one comes back through a palace window as a bee and speaks from the brim of a hat.',
    items: [], threads: [], motifs: ['transformation', 'disguise'],
    cast: { wukong: 'Is formally expelled from a city and back inside the palace within the hour, two inches long.',
      'jade-hare': 'Removes the only three people who could identify her, one day too late.',
      'tianzhu-king': 'Signs the expulsion order his daughter asks for without asking why she wants it.',
      tripitaka: 'Has his hand squeezed on the way out and understands exactly what it means.' } },

  /* ---- Chapter 95 ---- */
  { ch: 95, key: 'the-jade-hare', title: 'The Moon’s Own Hare', loc: 'tianzhu-capital', d: ce(651, 217), tension: 4, pov: 'taiyin',
    desc: 'From the hat brim he sees it: a thin trace of demon air above her head, and not a very fierce one. She fights with a thing thick at one end and thin at the other, like the head of a rice-mortar, and in naming it she names herself — then calls him Bimawen, which is the one word that makes him swing without listening. The Star Lord of the Moon comes down to stop the blow: the hare that pounds the elixir of dark frost, out through the jade lock a year ago.',
    items: [], threads: ['who-owns-the-demon', 'kingdoms'], motifs: ['names', 'mercy-over-death'],
    cast: { taiyin: 'Arrives one swing before his own hare is killed, and explains an eighteen-year-old grudge on the way down.',
      'jade-hare': 'Went down to repay a slap given eighteen years ago in the moon palace, and is taken home alive.',
      wukong: 'Nearly kills her over the one insult he has never been able to hear, and is stopped mid-blow.',
      tripitaka: 'Asks him to wait until the king and queen have withdrawn, and is not waited for.' } },
  { ch: 95, key: 'the-locked-room-opened', title: 'The Door in the Back Wall', loc: 'jetavana-monastery', d: ce(651, 221), tension: 2, pov: 'tianzhu-king',
    desc: 'A king who has never been outside his own city walls rides sixty li and has the iron lock struck off a door, and holds a filthy, raving daughter without minding the filth. The abbot who defamed her is made Monk Official of the Realm and the monastery is given a name by imperial grant.',
    items: [], threads: ['kingdoms'], motifs: [],
    cast: { 'tianzhu-king': 'Leaves his own capital for the first time in his life and finds his daughter in a walled-up room.',
      'real-princess': 'Has been mad in a locked cell for a year in order to stay alive, and is not immediately able to stop.',
      'hundred-year-abbot': 'Is rewarded for a lie that saved a life, and does not attempt to explain it away.',
      tripitaka: 'Rides sixty li back the way he came to close a case that had nothing to do with his errand.' } },

  /* ---- Chapter 96 ---- */
  { ch: 96, key: 'ten-thousand-monks', title: 'Nine Thousand Nine Hundred and Ninety-Six', loc: 'kou-mansion', d: ce(652, 100), tension: 1, pov: 'kou-hong',
    desc: 'A tiger-seated gate with a board on it saying no monk is turned away. He is sixty-four, vowed at forty to feed ten thousand of them, and keeps a ledger: four short, and four arrive. The house wants them to stay — a wife offers her needlework money for another fortnight, two sons their school allowance for a third — and the answer is that he told an emperor three years and it has been fourteen.',
    items: [], threads: ['scriptures', 'tang-emperor'], motifs: ['hunger'],
    cast: { 'kou-hong': 'Completes a twenty-four-year vow to the exact number and cannot bear to let the last four leave.',
      tripitaka: 'Counts his own years out loud for the second time and uses them to refuse hospitality.',
      'kou-wife': 'Offers her own money to keep four strangers a fortnight longer.',
      'zhu-bajie': 'Argues for taking all of it, is punched by his brother, and slaps his own mouth.' } },
  { ch: 96, key: 'ten-li-of-farewell', title: 'Banners, Drums, Monks and Daoists', loc: 'kou-mansion', d: ce(652, 110), tension: 2, pov: 'kou-hong',
    desc: 'Two hundred invitations, twenty pairs of coloured banners, a band, a company of monks and a company of Daoists, and the whole prefecture out in the road to watch. At the ten-li pavilion he weeps and asks them to come back through on the way home. What the procession has actually done is tell the entire district which house is the richest.',
    items: [], threads: [], motifs: [],
    cast: { 'kou-hong': 'Buys the most conspicuous send-off in the county and is dead within twelve hours because of it.',
      tripitaka: 'Accepts a farewell he has been trying to decline for a fortnight, and is followed by the consequences for two chapters.',
      'sha-wujing': 'Says at the ten-li pavilion that it is too much, and is not listened to.' } },

  /* ---- Chapter 97 ---- */
  { ch: 97, key: 'the-widows-accusation', title: 'Four Names Read Off in the Dark', loc: 'kou-mansion', d: ce(652, 115), tension: 5, pov: 'kou-wife',
    desc: 'A dozen men who have gambled their inheritances away come over the wall in the rain, and the old man who asks them to leave him something to be buried in is kicked to death. From under the bed his wife says she saw them by the lamp: the monk holding the torch, the pig with the knife, the quiet one carrying out the silver, and the monkey the one who kicked him. Her sons believe her, because she was the only one who looked.',
    items: [], threads: [], motifs: [],
    cast: { 'kou-wife': 'Names four innocent men in the dark and is believed because nobody else in the house dared look.',
      'kou-hong': 'Asks the men robbing him to leave enough for a coffin, and is killed for asking.' } },
  { ch: 97, key: 'three-hauntings', title: 'Three Visits Before Dawn', loc: 'tongtai', d: ce(652, 120), tension: 4, pov: 'wukong',
    desc: 'They meet the prefect’s constables on the road carrying the stolen property they had just recovered, and go into the cells with it. So: a voice from inside a coffin calling the widow by her childhood name; an uncle’s portrait on a wall speaking to a nephew at his morning incense; and a foot the size of a courtroom lowered out of the sky over the county bench. Then the old man is fetched back from the ledger of good deeds with twelve more years, and climbs out of his own coffin and asks the officials what they are doing in his house.',
    items: [], threads: ['who-owns-the-demon'], motifs: ['mercy-over-death'],
    cast: { wukong: 'Wins an appeal by haunting three separate people in one night and then producing the victim alive.',
      'kou-hong': 'Walked into the underworld unsummoned, was given a desk, and is carried home breathed into a sleeve.',
      'tongtai-prefect': 'Arrests four monks on one accusation and spends a night being visited about it.',
      tripitaka: 'Insists on carrying the recovered goods back to the house himself, and is arrested for doing it.',
      dizang: 'Gives up the keeper of his ledger of good deeds on request, and adds twelve years to the man’s life.',
      'kou-wife': 'Is asked, in front of the prefect, which of these men kicked her husband, and has to answer.' } },

  /* ---- Chapter 98 ---- */
  { ch: 98, key: 'the-bottomless-boat', title: 'A Boat With No Bottom', loc: 'cloud-reaching-ford', d: ce(653, 10), tension: 4, pov: 'tripitaka',
    desc: 'An immortal at the foot of the mountain who was told ten years ago to expect them in two or three complains about it, and then shows them that the path west goes out through the back of his own hall. Eight or nine li of water and one round log across it, which the monkey runs and comes back over. Then a ferryman poles up a boat with no bottom in it, and a corpse comes down the current, and everyone including the ferryman tells him whose it is.',
    items: [], threads: ['scriptures'], motifs: ['water'],
    cast: { tripitaka: 'Is pushed aboard a bottomless boat from behind and watches his own body float past him.',
      'golden-topped-immortal': 'Has watched the road every year for ten years and greets them with a complaint about the estimate.',
      jieyin: 'Poles a boat with no bottom and takes no fare.',
      wukong: 'Does the pushing, and is the one who names the corpse.',
      'zhu-bajie': 'Lies down on the bank and asks to be allowed to fly across, and is told that is exactly why he cannot.',
      'sha-wujing': 'Gets on last, holding the horse, and says nothing about any of it.' } },
  { ch: 98, key: 'the-wordless-scriptures', title: 'Blank Paper for No Present', loc: 'scripture-hall', d: ce(653, 15), tension: 3, pov: 'ananda',
    desc: 'The two servants in the treasure loft ask what present has been brought and are told there is none. The scrolls loaded on the horse are white from end to end, and it takes a snatched-away bundle and a scattering wind before anybody thinks to open one.',
    items: ['scriptures'], threads: ['scriptures'], motifs: [],
    cast: { ananda: 'Asks for a gratuity at the end of a fourteen-year journey and issues blank paper when he does not get one.',
      kasyapa: 'Hands the cases down off the shelves and says nothing while his colleague does the asking.',
      tripitaka: 'Carries a canon of blank paper out of the building without opening a single case.',
      wukong: 'Is the one who goes back up the stairs to complain, and is not the one who is angriest.' } },
  { ch: 98, key: 'three-pecks-of-gold', title: 'Sold Too Cheap Already', loc: 'great-hall', d: ce(653, 20), tension: 2, pov: 'buddha',
    desc: 'He is not angry about the gratuity. Scripture is not given free: monks once recited these at a rich man’s house in Sravasti for three pecks and three pints of gold, and he told them they had sold it too cheap. And the wordless scrolls, he adds, were the true ones — the east is simply not ready for them. The only thing the party owns worth giving is the purple-gold begging bowl an emperor put into their hands at the gate of Chang’an.',
    items: ['scriptures', 'alms-bowl'], threads: ['scriptures', 'tang-emperor'], motifs: [],
    cast: { buddha: 'Defends his own servants, prices the canon, and reveals that the blank version was the better one.',
      tripitaka: 'Hands over the emperor’s bowl for the scriptures that have words in them, and counts every scroll this time.',
      ananda: 'Takes the bowl and is laughed at by the kitchen staff for the rest of the afternoon.',
      wukong: 'Gets a straight answer for once, and does not like it any better for being straight.' } },

  /* ---- Chapter 99 ---- */
  { ch: 99, key: 'the-ledger-of-ordeals', title: 'Eighty Ordeals, and One Short', loc: 'heaven-potalaka-annexe', d: ce(653, 30), tension: 3, pov: 'guanyin',
    desc: 'The guardians hand over the register they have kept the whole way. She reads it through and does the arithmetic out loud: nine times nine is the number that completes a work, and he has had eighty. One more is ordered, and a guardian is sent to catch the vajras up before they finish carrying him home.',
    items: ['scriptures'], threads: ['ordeal-count'], motifs: [],
    cast: { guanyin: 'Orders one more disaster for a man who has finished, because the total was short by one.',
      'eight-vajras': 'Are carrying four men, a horse and a canon east and are told to put them down.' } },
  { ch: 99, key: 'the-turtle-asks', title: 'The Question He Never Asked', loc: 'tongtian-river', d: ce(653, 35), tension: 4, pov: 'old-turtle',
    desc: 'Eight years the turtle has waited at the bank for the one thing he was promised: an answer about when he might be let out of his shell. In four days on Vulture Peak the monk thought about scriptures. He says nothing, and the turtle knows, and dips. Then a night of wind, thunder and dark trying to take the sutras back, and a morning laying them out on a boulder — and the last scroll sticks to the stone and tears.',
    items: ['scriptures'], threads: ['ordeal-count'], motifs: ['water'],
    cast: { 'old-turtle': 'Asks the only favour anybody asks of the pilgrimage and does not get it, and drops them in the river.',
      tripitaka: 'Forgets one question in four days and pays for it with the whole canon in the water.',
      wukong: 'Says that heaven and earth are themselves incomplete, so the canon may as well be, and is not wrong.',
      'zhu-bajie': 'Carries wet scrolls up a bank one armful at a time and does not complain once.',
      'sha-wujing': 'Spreads them on the rock and is the one who notices the last page is stuck.' } },

  /* ---- Chapter 100 ---- */
  { ch: 100, key: 'the-pine-branches', title: 'The Pines Turned East', loc: 'changan-hongfu', d: ce(653, 45), tension: 2, pov: 'tripitaka',
    desc: 'Fourteen years ago he told the monks of his own temple that when the pines in the courtyard turned their heads east he would be coming back. On this morning they have, and the whole house is out of the gate and down the road before any messenger has arrived.',
    items: ['scriptures'], threads: ['scriptures'], motifs: [],
    cast: { tripitaka: 'Comes home to a temple that has been reading its own trees for fourteen years.' } },
  { ch: 100, key: 'the-passport-returned', title: 'Twelve Seals on a Passport', loc: 'changan-daming-palace', d: ce(653, 50), tension: 2, pov: 'taizong',
    desc: 'Issued in the thirteenth year of Zhenguan and handed back in the twenty-seventh. The emperor reads the stamps down the page in order — Precious Elephant, Wuji, Cart-Slow, the Women’s Country, Jisai, Purple Cinnabar, Bhiksu, Dharma-Respecting and the four prefectures after them — and then sits up all night and dictates a preface in the morning, and apologises for the quality of it.',
    items: ['rescript', 'scriptures'], threads: ['tang-emperor', 'scriptures'], motifs: [],
    cast: { taizong: 'Gets his sworn brother back fourteen years late and writes the preface himself rather than commission one.',
      tripitaka: 'Hands back a document with twelve foreign seals on it, which is the whole road in one page.',
      wukong: 'Stands in a Tang throne room in a tiger-skin kilt and is presented to a court that has heard of none of it.',
      'zhu-bajie': 'Is presented as well, and is the reason the court has trouble concentrating.',
      'sha-wujing': 'Stands at the end of the line and is the last of the four to be named.' } },
  { ch: 100, key: 'five-holy-ones', title: 'Say the Loosening Spell', loc: 'thunderclap-monastery', d: ce(653, 55), tension: 3, pov: 'wukong',
    desc: 'The reading has begun at the pagoda and the first page is open when the vajras call down through the incense to put it down and come west, and the court is left bowing at an empty platform. Sandalwood Merit Buddha; Victorious in Strife Buddha; Cleanser of Altars, over loud objection and with the answer that it is a post with something in it; Golden Body Arhat; and a horse into the Dragon-Transforming Pool and up onto a pillar of the gate. And the first thing the new Buddha asks for is to have the band taken off his head, and is told to reach up and feel for it.',
    items: ['fillet', 'scriptures'], threads: ['fillet', 'scriptures', 'ordeal-count'], motifs: ['names'],
    cast: { wukong: 'Is made a Buddha and asks, before anything else, for the hat to come off — and it is already gone.',
      tripitaka: 'Is called away from the reading desk mid-sentence and does not finish the page.',
      buddha: 'Hands out five titles and defends the least glamorous of them on the grounds that it comes with the offerings.',
      'zhu-bajie': 'Objects out loud to his own promotion in front of the assembly, and is answered rather than silenced.',
      'sha-wujing': 'Is made an arhat and does not say anything at all, which is how he began.',
      'white-dragon-horse': 'Goes into the pool, comes out with scales, and is coiled on a pillar of the gate for good.',
      'eight-vajras': 'Carry four men and a horse back west inside a day, having carried them east inside eight.' } },
]

/* --------------------------------------------------- derived records --- */

const eventsForChapterBefore = (index, chapter) => scenes.slice(0, index).filter((s) => s.ch === chapter).length
const timelineFor = (ch) => (ch <= 8 ? ageTimelineId : roadTimelineId)

/*
  Elapsed time is measured against the previous scene *on the same timeline*.
  The frame and the road share one day axis but not one clock, and a road scene
  in 640 CE does not follow a frame scene in 140 CE by five hundred years of
  travel.
*/
const lastDayOnTimeline = new Map()
const events = scenes.map((s, i) => {
  const timelineId = timelineFor(s.ch)
  const prev = lastDayOnTimeline.get(timelineId) ?? s.d
  lastDayOnTimeline.set(timelineId, s.d)
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
    travelDays: Math.max(0, s.d - prev),
    inWorldTime: s.d,
    tension: s.tension,
    structureBeat: null,
    threadIds: s.threads.map(T),
    motifIds: s.motifs.map(O),
    status: 'final',
    povCharacterId: C(s.pov),
    isFlashback: false,
  }
})

/*
  Deaths that the world has to know about, because a snapshot that says a
  character is alive after the scene that kills them is the exact error EX-106
  is about. Everything else in this book is taken alive.
*/
const diesAt = new Map(Object.entries({
  'demon-king-of-havoc': 'demon-king-killed',
  'chen-guangrui': 'murder-at-the-ford',
  'liu-hong': 'vengeance',
  'yin-wenjiao': 'vengeance',
  'jing-dragon': 'dream-and-chess',
  'guanyin-abbot': 'monastery-burnt',
  'white-bone-demon': 'the-dismissal',
  'three-daoist-immortals': 'head-belly-oil',
  'scorpion-demon': 'the-rooster',
  'six-eared-macaque': 'the-species-ends-here',
  'jade-face-princess': 'nets-on-four-sides',
  'apricot-fairy': 'the-trees',
  'wooden-immortals': 'the-trees',
  'red-scaled-python': 'inside-the-python',
  'hundred-eyed-demon': 'a-thousand-eyes',
  'you-lai-you-qu': 'the-golden-bracelet',
  'xiao-zuanfeng': 'the-magic-cudgel-story',
  'fox-beauty': 'the-white-deer',
  'south-mountain-great-king': 'the-leopard',
  'yellow-lion-demon': 'the-beast-kneels',
  bandits: 'a-needle-for-a-toll',
  'kou-hong': 'the-widows-accusation',
}))

const characterSnapshots = scenes.flatMap((s, si) =>
  Object.entries(s.cast).map(([slug, statusNotes], ci) => {
    const location = locations.find((l) => l.id === L(s.loc))
    const deathScene = diesAt.get(slug)
    const deathIndex = deathScene ? scenes.findIndex((sc) => sc.key === deathScene) : -1
    /* Squire Kou is killed in one scene and fetched back out of the underworld
       in the next, so he is dead for exactly one event and alive again after. */
    const revived = slug === 'kou-hong' && si > scenes.findIndex((sc) => sc.key === 'the-widows-accusation')
    return {
      ...base,
      id: id('snapshot', `${String(si + 1).padStart(3, '0')}-${slug}`),
      characterId: C(slug),
      eventId: EV(s.key),
      sortKey: (si + 1) * 10000 + ci,
      isAlive: deathIndex < 0 || si < deathIndex || revived,
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
  ['scriptures', 'The Errand', '#c2a14e', 'Three baskets of scripture in the west and a man who has to walk to them, because a thing carried easily is valued cheaply.'],
  ['heaven-vs-monkey', 'Heaven and the Monkey', '#c9803a', 'Seven chapters of a stone monkey being appeased, promoted, fought, burned and finally sat on, and ninety-three of the bill for it.'],
  ['master-and-disciple', 'Master and Disciple', '#b8912f', 'A monk who cannot tell a demon from a widow, a disciple who always can, and the two dismissals and one reconciliation between them.'],
  ['fillet', 'The Gold Fillet', '#a8452f', 'A hat given by an old woman on a road, a rhyme taught to the only person who would use it, and a band that is gone before anyone notices.'],
  ['who-owns-the-demon', 'Whose Beast Is This', '#6d8a5f', 'The book’s standing joke and its actual argument: almost every monster on the road has an owner upstairs who wants it back alive.'],
  ['bull-family', 'The Bull Demon King’s House', '#8a4a44', 'A brotherhood sworn five hundred years ago, and a son, a wife, a mistress and a brother who all remember it differently.'],
  ['kingdoms', 'Kingdoms Set Right', '#5f7fa8', 'A dozen realms passed through and left better than they were found: a drowned king raised, a religion freed, eleven hundred children carried out of a city in one night.'],
  ['bajie-appetite', 'The Luggage and the Appetite', '#8f5a4a', 'The pig eats, complains, proposes selling the horse, and does the two most practical things anybody does on the whole road.'],
  ['sha-silence', 'The One Nobody Listens To', '#5a6e78', 'Sha Wujing says the sensible thing in almost every argument in the book and carries the baggage through all of them.'],
  ['tang-emperor', 'The Emperor’s Debt', '#7d6a86', 'A dragon beheaded over a chessboard, a tour of the underworld, a borrowed storehouse of paper gold, and a Grand Mass that needs a celebrant.'],
  ['ordeal-count', 'Eighty-One Ordeals', '#7a6d8f', 'A register kept the whole way by guardians nobody thanks, and an arithmetic that requires one more disaster after the work is finished.'],
].map(([slug, name, color, description]) => ({ ...base, id: T(slug), name, color, description }))

const motifs = [
  ['transformation', 'Changing Shape', '#c9803a', 'Seventy-two changes, thirty-six, and one contest that runs from sparrow to shrine — and the flagpole behind it that gives the shrine away.'],
  ['disguise', 'Wearing Another Face', '#7d6a86', 'A dead abbot, an old mother, a bull, a princess, a bodhisattva: half the fights in the book are won by turning up as somebody the enemy trusts.'],
  ['borrowed-treasure', 'Borrowed Treasures', '#b0973f', 'A gourd, a vase, a bracelet, a bag, a fan, a set of bells — the decisive objects almost always belong to somebody who lent them out or lost them.'],
  ['false-buddha', 'The False Holy Place', '#8a7a5e', 'A cave lit like a temple, a monastery one character short of the real one, three Buddhas on a lamp bridge: the pilgrim’s piety is the standard bait.'],
  ['names', 'Names and Titles', '#c2a14e', 'A register struck through, an office with no rank, four characters on a banner, a gourd that will swallow anything that answers to a name.'],
  ['fire', 'Fire', '#a8452f', 'A furnace that made the eyes, a monastery burnt for a robe, eight hundred li of mountain still alight from bricks kicked out of that same furnace.'],
  ['water', 'Water That Must Be Crossed', '#4d6f8a', 'A river that will not float a feather, one eight hundred li wide, one that freezes on purpose, and a boat with no bottom at the end of them all.'],
  ['hunger', 'Something to Eat', '#8f5a4a', 'Peaches, elixir, manfruit, a fruit shaped like a baby, and a whole book of demons who want the same meal for the same reason.'],
  ['mercy-over-death', 'Taken Alive', '#5f8f6a', 'The book’s quiet rule: a demon with an owner is collected, a demon without one is killed, and the collection is the commoner ending by a long way.'],
].map(([slug, name, color, description]) => ({ ...base, id: O(slug), name, color, description }))

/* ------------------------------------------------------ relationships --- */

const relRows = [
  ['tripitaka-wukong', 'tripitaka', 'wukong', 'master and first disciple', 'strong', 'complex', 'The spine of the book: a man who cannot see demons and a disciple who sees nothing else, bound by a hat and separated twice.', 'seal-peeled'],
  ['tripitaka-bajie', 'tripitaka', 'zhu-bajie', 'master and second disciple', 'moderate', 'complex', 'A monk who forgives him everything and a pig who repays it by believing the worst about his own brother at every opportunity.', 'rake-and-oath'],
  ['tripitaka-sha', 'tripitaka', 'sha-wujing', 'master and third disciple', 'moderate', 'positive', 'The steadiest relation in the party, and the one that generates no incidents at all in seventy-eight chapters.', 'gourd-and-skulls'],
  ['wukong-bajie', 'wukong', 'zhu-bajie', 'brothers by the same errand', 'strong', 'complex', 'Constant mockery, one deliberate drowning, one lie about a demon swearing to skin him — and neither of them ever actually leaves the other.', 'rake-and-oath'],
  ['wukong-sha', 'wukong', 'sha-wujing', 'first and third disciple', 'moderate', 'positive', 'The one who acts and the one who says what ought to be done, and who kneels when the acting goes wrong.', 'gourd-and-skulls'],
  ['bajie-sha', 'zhu-bajie', 'sha-wujing', 'the luggage between them', 'moderate', 'neutral', 'Two former officers of Heaven in disgrace, arguing about whose turn it is, for fourteen years.', 'gourd-and-skulls'],
  ['tripitaka-horse', 'tripitaka', 'white-dragon-horse', 'rider and mount', 'moderate', 'positive', 'A dragon prince under sentence who carries him the whole way and speaks twice.', 'dragon-made-horse'],
  ['guanyin-wukong', 'guanyin', 'wukong', 'bodhisattva and recruit', 'strong', 'complex', 'She lets him out of a mountain, puts a band on his head, takes his life-saving hair as collateral, and is the only person he ever cries in front of.', 'promise-at-the-mountain'],
  ['guanyin-tripitaka', 'guanyin', 'tripitaka', 'sponsor and pilgrim', 'strong', 'positive', 'She chose him in a market in Chang’an and intervenes eleven times, mostly without being thanked.', 'great-vehicle'],
  ['buddha-wukong', 'buddha', 'wukong', 'the one power he cannot beat', 'strong', 'complex', 'A wager on an open palm, five hundred years under a hand, and — at the very end — the same hand handing him a title.', 'the-wager'],
  ['jade-emperor-wukong', 'jade-emperor', 'wukong', 'court and rebel', 'strong', 'negative', 'Two appointments, one banquet, one war, and a working relationship afterwards conducted entirely through roll-calls.', 'two-petitions'],
  ['taibai-wukong', 'taibai', 'wukong', 'the man who kept proposing a title', 'moderate', 'positive', 'Heaven’s appeasement policy in one person, and later the most reliable source of warnings on the road.', 'two-petitions'],
  ['laozi-wukong', 'laozi', 'wukong', 'alchemist and thief', 'moderate', 'complex', 'Elixir eaten, a furnace kicked over, a bracelet dropped on his head, and a pill palmed off a tray four hundred years later.', 'banquet-and-elixir'],
  ['taizong-tripitaka', 'taizong', 'tripitaka', 'sworn brothers', 'strong', 'positive', 'An emperor with an underworld debt and a monk who volunteers to pay it, bound by a cup of wine with dust in it.', 'great-vehicle'],
  ['wukong-bull', 'wukong', 'bull-demon-king', 'sworn brothers, five hundred years ago', 'strong', 'complex', 'The oldest friendship in the book, ruined in three moves: a son, a wife and a mistress.', 'armour-extorted'],
  ['bull-raksasi', 'bull-demon-king', 'raksasi', 'husband and first wife', 'moderate', 'negative', 'Two years since he last came home, and she still gives away the fan for his face.', 'wearing-the-husband'],
  ['bull-red-boy', 'bull-demon-king', 'red-boy', 'father and son', 'moderate', 'complex', 'Three hundred years at the Fiery Mountains, and a father who does not know his own son’s birth-hour.', 'false-guanyin'],
  ['guanyin-red-boy', 'guanyin', 'red-boy', 'bodhisattva and page', 'strong', 'complex', 'Thirty-six sabres for a throne, five rings for a relapse, and the attendant who stands beside her in every picture afterwards.', 'boy-of-good-wealth'],
  ['tripitaka-taizong-brothers', 'wei-zheng', 'taizong', 'minister and emperor', 'strong', 'positive', 'A man who beheads a dragon in his sleep during a chess game his emperor is losing on purpose.', 'dream-and-chess'],
  ['wukong-erlang', 'wukong', 'erlang', 'the god who caught him', 'moderate', 'complex', 'A duel through six shapes, a bracelet from behind, and a cup of wine offered on a hillside five hundred years later.', 'erlang-duel'],
  ['kou-hong-wife', 'kou-hong', 'kou-wife', 'husband and wife', 'moderate', 'complex', 'She names four innocent men over his body and has to answer for it in front of him when he climbs out of the coffin.', 'ten-thousand-monks'],
  ['jade-hare-princess', 'jade-hare', 'real-princess', 'the hare and the woman she replaced', 'moderate', 'negative', 'A slap in the moon palace eighteen years ago, repaid with a year in a walled-up room.', 'the-girl-in-the-cell'],
].map(([slug, a, b, label, strength, sentiment, description, start]) => ({
  ...base, id: R(slug), characterAId: C(a), characterBId: C(b), label, strength, sentiment, description, isBidirectional: true, startEventId: EV(start),
}))

const relationshipSnapshots = [
  ['tripitaka-wukong', 'the-fillet', 'master and a disciple who can now be punished', 'strong', 'complex', 'A hat has just given one of them the only authority he will ever have over the other.'],
  ['tripitaka-wukong', 'the-dismissal', 'dismissed', 'weak', 'negative', 'A letter written on a stone by a stream over three correct killings.'],
  ['tripitaka-wukong', 'kui-wood-wolf', 'reconciled, and neither of them says so', 'strong', 'positive', 'The disciple who was dismissed washes a spell off the man who dismissed him and nothing is said about the letter.'],
  ['tripitaka-wukong', 'the-severed-head', 'dismissed a second time', 'weak', 'negative', 'A human head brought up to the saddle as a present, and a prayer that the dead sue the disciple and leave the master out.'],
  ['tripitaka-wukong', 'the-tests-that-fail', 'a master who cannot tell which one is his', 'moderate', 'complex', 'The spell hurts both of them equally, which is the only test he has and the one that proves nothing.'],
  ['tripitaka-wukong', 'the-four-line-verse', 'the disciple explaining the doctrine to the monk', 'strong', 'positive', 'He recites the gatha his master has forgotten, and the direction of the teaching is reversed for good.'],
  ['wukong-bull', 'old-brother', 'sworn brothers with three grievances between them', 'strong', 'negative', 'Five hundred years of brotherhood settled in one exchange: my son, my wife, my mistress.'],
  ['wukong-bull', 'nets-on-four-sides', 'taken alive by four departments', 'moderate', 'complex', 'The oldest friendship in the book ends with a fire-wheel on the horns and both of them still alive.'],
  ['guanyin-wukong', 'pledged-hair', 'agent and sponsor, with collateral', 'strong', 'complex', 'She will not lend the vase without security and takes the one thing she gave him for free.'],
  ['guanyin-wukong', 'nowhere-to-go', 'the only person he will cry in front of', 'strong', 'positive', 'Nowhere left to be unwanted, and a ruling that killing men is not the same as killing demons.'],
  ['buddha-wukong', 'five-phases-mountain', 'the hand and the signature on it', 'strong', 'negative', 'He wrote his name on what he thought was a pillar at the end of the world.'],
  ['buddha-wukong', 'five-holy-ones', 'the same hand, handing over a title', 'strong', 'positive', 'Sandalwood Merit Buddha, and the band on his head already gone.'],
  ['kou-hong-wife', 'three-hauntings', 'asked, in front of a prefect, which of them kicked him', 'moderate', 'negative', 'The accusation has to be withdrawn by the woman who made it, with the victim standing there.'],
].map(([rel, event, label, strength, sentiment, description], i) => ({
  ...base, id: id('relationship-snapshot', `${rel}-${event}`), relationshipId: R(rel), eventId: EV(event), sortKey: i, label, strength, sentiment, description, isActive: true,
}))

/* ----------------------------------------------------------- factions --- */

const factionRows = [
  ['pilgrims', 'The Scripture Pilgrims', 'One monk, three convicted criminals working off sentences, and a dragon under commuted execution, walking west for fourteen years.', '#c2a14e'],
  ['heaven', 'The Celestial Court', 'The Jade Emperor’s administration: a throne hall, a roll-call of twenty-eight lodges, four departments of weather, and a standing habit of solving problems by appointment.', '#7d8fb0'],
  ['vulture-peak', 'The Buddha’s Establishment', 'Vulture Peak and its bodhisattvas — the power that commissions the journey, owns half the demons on it, and charges for the scriptures at the end.', '#c9a94a'],
  ['ffm-monkeys', 'The Monkeys of Flower-Fruit Mountain', 'Forty-seven thousand of them, armed out of a stolen armoury, burnt out by a heavenly army, and down to a thousand by the time their king comes home.', '#c9803a'],
  ['dragon-kings', 'The Four Dragon Kings', 'The seas and the rivers, run as a family firm: tea for guests, weapons handed over under protest, rain made strictly to written order.', '#4d6f8a'],
  ['underworld', 'The Courts of the Underworld', 'Ten kings, a register, a judge who can be written to, and a bureaucracy that turns out to be negotiable in both directions.', '#6a5a7a'],
  ['bull-clan', 'The Bull Demon King’s House', 'A demon king, two wives, a son, a brother and a mountain of fire — the only family in the book with a foreign policy.', '#8a4a44'],
  ['daoist-usurpers', 'The Daoists of Cart-Slow', 'Three immortals who brought the rain when the monks could not, and made a kingdom’s monks into their servants for twenty years.', '#7a6244'],
]
const factions = factionRows.map(([slug, name, description, color]) => ({
  ...base,
  id: F(slug),
  name,
  description,
  color,
  coverImageId: null,
  tags: [],
}))

const factionMemberships = [
  ['pilgrims', 'tripitaka', 'The pilgrim', 'pinch-of-dust', null],
  ['pilgrims', 'wukong', 'First disciple', 'seal-peeled', null],
  ['pilgrims', 'zhu-bajie', 'Second disciple, and the luggage', 'rake-and-oath', null],
  ['pilgrims', 'sha-wujing', 'Third disciple', 'gourd-and-skulls', null],
  ['pilgrims', 'white-dragon-horse', 'The horse', 'dragon-made-horse', null],
  ['heaven', 'jade-emperor', 'August Emperor of Jade', 'two-petitions', null],
  ['heaven', 'taibai', 'Gold Star of Venus, and the court’s appeaser', 'two-petitions', null],
  ['heaven', 'li-jing', 'Pagoda-Bearing Heavenly King', 'nezha-beaten', null],
  ['heaven', 'nezha', 'Third Prince', 'nezha-beaten', null],
  ['heaven', 'laozi', 'Keeper of the eight-trigram furnace', 'banquet-and-elixir', null],
  ['heaven', 'wukong', 'Great Sage Equal to Heaven, an office with no duties', 'great-sage-titled', 'diamond-snare'],
  ['vulture-peak', 'buddha', 'Tathagata', 'three-baskets', null],
  ['vulture-peak', 'guanyin', 'Commissioner of the journey east', 'three-baskets', null],
  ['vulture-peak', 'moksa', 'Guanyin’s disciple', 'sha-converted', null],
  ['vulture-peak', 'manjusri', 'Bodhisattva, and owner of a blue lion', 'manjusri-claims-him', null],
  ['vulture-peak', 'lingji', 'Keeper of the Flying Dragon Staff', 'marten-taken', null],
  ['ffm-monkeys', 'wukong', 'The Handsome Monkey King', 'waterfall-and-crown', null],
  ['dragon-kings', 'aoguang', 'Dragon King of the Eastern Sea', 'cudgel-won', null],
  ['dragon-kings', 'aoshun', 'Dragon King of the Western Sea', 'nine-sons', null],
  ['dragon-kings', 'moang', 'Prince of the Western Sea', 'nine-sons', null],
  ['underworld', 'cui-jue', 'Judge of Fengdu', 'gate-of-ghosts', null],
  ['underworld', 'dizang', 'Ksitigarbha', 'the-tests-that-fail', null],
  ['bull-clan', 'bull-demon-king', 'Head of the house', 'old-brother', null],
  ['bull-clan', 'raksasi', 'First wife, and keeper of the fan', 'inside-her-belly', null],
  ['bull-clan', 'jade-face-princess', 'Second wife, by purchase', 'old-brother', 'nets-on-four-sides'],
  ['bull-clan', 'red-boy', 'Son', 'whose-son', 'boy-of-good-wealth'],
  ['bull-clan', 'ruyi-immortal', 'Brother, and holder of the Abortion Spring', 'the-bucket', null],
  ['daoist-usurpers', 'three-daoist-immortals', 'Preceptors of the realm', 'the-cart-pullers', 'head-belly-oil'],
].map(([faction, character, role, start, end]) => ({
  ...base, id: id('membership', `${faction}-${character}`), factionId: F(faction), characterId: C(character), role, startEventId: EV(start), endEventId: end ? EV(end) : null, notes: '',
}))

const factionRelationships = [
  { ...base, id: id('faction-relationship', 'heaven-monkeys'), factionAId: F('heaven'), factionBId: F('ffm-monkeys'), stance: 'hostile', notes: 'A hundred thousand troops and eighteen nets went to the island, and burnt out everything on it that could not fight back.' },
  { ...base, id: id('faction-relationship', 'heaven-vulture-peak'), factionAId: F('heaven'), factionBId: F('vulture-peak'), stance: 'allied', notes: 'Heaven sends for the Buddha when its own execution ground fails, and the Buddha lends four vajras when Heaven’s nets are not enough.' },
  { ...base, id: id('faction-relationship', 'pilgrims-vulture-peak'), factionAId: F('pilgrims'), factionBId: F('vulture-peak'), stance: 'allied', notes: 'The errand is Vulture Peak’s and so are most of the rescues, and the canon is still charged for at the end of it.' },
  { ...base, id: id('faction-relationship', 'pilgrims-bull-clan'), factionAId: F('pilgrims'), factionBId: F('bull-clan'), stance: 'hostile', notes: 'Three separate feuds — a son converted, a fan stolen twice, and a brother who wants revenge for a nephew who is not dead.' },
  { ...base, id: id('faction-relationship', 'dragon-kings-underworld'), factionAId: F('dragon-kings'), factionBId: F('underworld'), stance: 'neutral', notes: 'Both petitioned the throne about the same monkey on the same morning, and neither got an army out of it.' },
]

/* --------------------------------------------------------------- lore --- */

const loreCategories = [
  { id: id('lore-category', 'world'), worldId, name: 'The Four Continents and the Road', color: '#5f8f6a', sortOrder: 0 },
  { id: id('lore-category', 'powers'), worldId, name: 'Heaven, Hell and the Rules', color: '#8a6fa8', sortOrder: 1 },
  { id: id('lore-category', 'sources'), worldId, name: 'Sources and Editorial Notes', color: '#7d7466', sortOrder: 2 },
]

const loreRows = [
  ['continents', 'world', 'The Four Continents',
    'The world of this book is four continents around a central sea. The monkey is born in the East (Purvavideha), rafts to the South (Jambudvipa) looking for a teacher and finds only men chasing name and profit, and crosses to the West (Aparagodaniya) to find one. The Tang empire is in the South; Vulture Peak is in the West; and the whole pilgrimage is a journey from one continent to another that the book measures at a hundred and eight thousand li — the same distance the somersault cloud crosses in one jump, which is the joke the first seven chapters set up and the next ninety-three pay off.',
    'raft-east', null],
  ['heavenly-time', 'powers', 'One Day Above, One Year Below',
    'Heaven runs on a different clock, and the book says so repeatedly: a day in the celestial court is a year on earth. Half a month in the heavenly stables is fifteen years on the ground. A star officer absent from four roll-calls has been missing thirteen days above and thirteen years below. This is why the frame chapters cover four centuries in eight chapters, and why the day numbers in this world jump the way they do between one heavenly scene and the next.',
    'rank-discovered', null],
  ['register', 'powers', 'The Register of Life and Death',
    'Everything alive is written in a book kept in the Hall of Judgment, with a species, a name and a span of years. Striking a line out of it works — the monkey cancels his own death and his whole people’s with a borrowed brush — and so does adding to it, as a judge demonstrates by turning a thirteen into a thirty-three while an emperor watches. The underworld is a bureaucracy, and the book’s point is that a bureaucracy can be argued with.',
    'register-struck', null],
  ['fillet-lore', 'powers', 'The Three Fillets',
    'Guanyin is given three gold fillets with three separate spells, for whoever on the road will not be ruled. All three are spent: one on the monkey, one on the black bear who stole the cassock, and one on Red Boy, whose goes on his head and his hands and his feet because he picks the spear up again as soon as the pain stops. The band cannot be pulled off, cut off, or reasoned off — and at the very end it is simply gone, and nobody can say when.',
    'the-fillet', null],
  ['whose-demon', 'powers', 'Whose Beast Is This',
    'The running structure of the road: a demon stops the pilgrims, cannot be beaten, and turns out to belong to somebody. A blue lion is Manjusri’s. An elephant is Samantabhadra’s. A green ox is Laozi’s, and so are the two furnace-boys, and the bracelet. A goldfish is Guanyin’s, and so is a golden-haired hou. A deer is the Star of Longevity’s. A hare is the moon’s. A nine-headed lion belongs to a Heavenly Honoured One whose keeper drank a bottle of Laozi’s liquor and slept for three days. Very few of them are killed, and most of the ones that are had no owner to come for them.',
    'marten-taken', null],
  ['ordeals', 'powers', 'Eighty-One Ordeals',
    'The guardians assigned at Eagle Grief Stream keep a written register of every disaster on the road, and hand it in at the end. Nine times nine is the number that completes a work, so when the count comes to eighty with the pilgrims already flying home, one more is ordered and a guardian is sent to catch the couriers up. It is the book at its most openly designed: the last ordeal exists because the arithmetic required it, and the book says so out loud.',
    'the-ledger-of-ordeals', null],
  ['chronology', 'sources', 'How This Chronology Was Reconstructed',
    'Unusually for a book this size, the novel dates itself. The travel rescript is issued in the thirteenth year of Zhenguan and handed back in the twenty-seventh, and the road is stated over and over to have taken fourteen years. Day 0 in this world is the first day of Zhenguan 1, taken as 627 CE, so the pilgrimage runs 639–653. That is the book’s own count and not the historical one: the real Zhenguan era ended in its twenty-third year, and the historical Xuanzang left in 629 and returned in 645 without an imperial passport. The frame chapters run on a second timeline and on negative day numbers, reconstructed from the book’s own arithmetic — the underworld register gives the monkey’s age as 342, Heaven runs a day to the world’s year, and five hundred years pass under the mountain. Followed backwards from the year he is freed, that puts his birth in the third century BCE. Treat the frame dates as a reconstruction with the working shown, not as claims.',
    'stone-monkey-born', null],
  ['two-timelines', 'sources', 'Why There Are Two Timelines',
    'Chapters 1–8 are not a prologue to the road; they are a separate story on a separate clock, four centuries long, that the road spends ninety chapters paying for. They are kept here as their own timeline, linked to the pilgrimage as a historical echo. Both timelines share one absolute day axis — day 0 is the same day on both — so the two can be merged chronologically and still make sense, and elapsed time within each is measured only against the previous scene on that same timeline.',
    'promise-at-the-mountain', null],
  ['titles', 'sources', 'The Chapter Titles',
    'Every chapter of this novel is titled with a matched couplet, two lines of seven characters each, and the couplets are the author’s own — they are not editorial signposts added by a later editor. The titles in this world render both halves in English, joined with a middle dot. The verbatim Chinese for all hundred is kept beside the generator script in scripts/journey-to-the-west/chapters.json, because a couplet is a piece of the book and a translation of one is not.',
    'stone-monkey-born', null],
  ['text-source', 'sources', 'The Text Behind This World',
    'Chapters, chapter titles, characters, places and events follow the complete hundred-chapter Chinese text at Chinese Wikisource (西遊記), read chapter by chapter; the reading record is kept beside the generator in scripts/journey-to-the-west/scene-ledger.md. Every summary, description and status note in this world is original structural writing about the book — none of the novel’s prose is reproduced here, in Chinese or in translation. Names are given in the forms an English-language reader is most likely to meet: Tripitaka rather than Xuanzang for the pilgrim, Sun Wukong rather than the Monkey King where both are used.',
    'stone-monkey-born', null],
  ['pictures', 'sources', 'The Pictures in This World',
    'Every map, portrait, place and item picture here is an AI-generated image supplied by this world’s author, who states they are their own work. None of it is public domain and none of it comes from an edition of the novel. Each picture was opened and checked against the entity it is attached to before it was assigned. A great many characters and places have no picture at all rather than a borrowed or approximate one, which is the honest state of the set: SOURCES.md lists what is missing.',
    'stone-monkey-born', null],
  ['maps', 'sources', 'The Maps in This World',
    'There are seven layers: the road west, Chang’an, Vulture Peak, Flower-Fruit Mountain, the celestial court, the dragon palace and the underworld. All are paintings rather than surveys, none carries a scale, and nothing in them should be read as a distance — the book’s own figures are religious numbers rather than measurements. Where the road painting names a feature, the marker sits on that name even when the book’s order would put it elsewhere: that is why the road doubles back east once, between the Guanyin Monastery and Gao Village, because the painting puts the village inside the Tang frontier and the text puts it a long way past. The painting also carries some mangled English lettering, including a "Thunderbolt Temple" spelt with an O and a duplicated Tang border. Places the paintings do not draw at all — Subhuti’s cave, the Jing River, the ford where Chen Guangrui was killed and a dozen caves — are pinned along the drawn road between the features that bracket them in the text, and SOURCES.md lists every one of those as an approximation.',
    'famen-temple', null],
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
  ['register-struck', 'The monkeys’ names are struck out of the Register of Life and Death', 'One visit to the Hall of Judgment with a borrowed brush cancels the deaths of an entire species, and nobody in the underworld can put them back.', 'register-struck'],
  ['furnace-eyes', 'The furnace gave him eyes that see through a shape', 'Forty-nine days in the wind corner of the eight-trigram furnace leave him with fiery golden eyes — which is why he is right about every disguise on the road, and why smoke is the one thing that still blinds him.', 'furnace'],
  ['fillet-spell', 'The gold fillet answers to a rhyme', 'An old woman on a road gives a monk a cap and teaches him a spell, and the band takes root in the skin the first time it is said.', 'the-fillet'],
  ['scriptures-price', 'The Buddha will not send the scriptures east himself', 'A thing carried easily is valued cheaply, so someone has to walk — which is the premise of ninety-two chapters.', 'three-baskets'],
  ['heaven-clock', 'A day in Heaven is a year on earth', 'Stated by the court itself when a missing star officer is found to have been absent four roll-calls, which is thirteen days above and thirteen years below.', 'kui-wood-wolf'],
  ['owner-rule', 'Almost every demon on the road belongs to somebody', 'A rat from Vulture Peak, a lion of Manjusri’s, an ox of Laozi’s, a goldfish of Guanyin’s: the ones that cannot be beaten are the ones that will be collected.', 'marten-taken'],
  ['killing-men', 'Killing men is not a merit, and killing demons is', 'The ruling Guanyin gives at the lotus throne after the bandits, and the one line in the book that explains both dismissals.', 'nowhere-to-go'],
  ['six-eared', 'The Six-Eared Macaque hears everything spoken within a thousand li', 'Which is how it knew the errand, the passport, the party and the spell — and why every test in Heaven, earth and the underworld came back identical.', 'the-species-ends-here'],
  ['fan-method', 'The fire only stays out after forty-nine strokes of the fan', 'One wave puts it out, two brings wind, three brings rain; forty-nine and it never comes back, which is the only permanent thing anybody does on the road.', 'nets-on-four-sides'],
  ['wordless-true', 'The wordless scrolls were the true scriptures', 'The blank canon was not a swindle by two servants but the better version, withheld because the eastern continent is not ready to read it.', 'three-pecks-of-gold'],
  ['ordeal-count-fact', 'The ordeals must come to nine times nine', 'The register the guardians keep the whole way comes to eighty, so one more disaster is ordered after the journey is already over.', 'the-ledger-of-ordeals'],
]
const knowledgeFacts = factRows.map(([slug, title, description, event]) => ({
  ...base, id: K(slug), title, description, tags: [], readerLearnsAtEventId: EV(event), originEventId: EV(event),
}))

const revealRows = [
  ['register-struck', 'wukong', 'register-struck'], ['register-struck', 'jade-emperor', 'two-petitions'],
  ['furnace-eyes', 'wukong', 'furnace'], ['furnace-eyes', 'laozi', 'furnace'],
  ['fillet-spell', 'tripitaka', 'the-fillet'], ['fillet-spell', 'wukong', 'the-fillet'],
  ['fillet-spell', 'guanyin', 'the-fillet'],
  ['scriptures-price', 'guanyin', 'three-baskets'], ['scriptures-price', 'buddha', 'three-baskets'],
  ['scriptures-price', 'tripitaka', 'three-pecks-of-gold'],
  ['heaven-clock', 'wukong', 'kui-wood-wolf'], ['heaven-clock', 'jade-emperor', 'kui-wood-wolf'],
  ['owner-rule', 'wukong', 'marten-taken'], ['owner-rule', 'zhu-bajie', 'laozi-claims-them'],
  ['owner-rule', 'sha-wujing', 'manjusri-claims-him'],
  ['killing-men', 'wukong', 'nowhere-to-go'], ['killing-men', 'guanyin', 'nowhere-to-go'],
  ['six-eared', 'buddha', 'the-species-ends-here'], ['six-eared', 'wukong', 'the-species-ends-here'],
  ['six-eared', 'guanyin', 'the-species-ends-here'],
  ['fan-method', 'wukong', 'nets-on-four-sides'], ['fan-method', 'raksasi', 'nets-on-four-sides'],
  ['wordless-true', 'tripitaka', 'three-pecks-of-gold'], ['wordless-true', 'wukong', 'three-pecks-of-gold'],
  ['wordless-true', 'buddha', 'three-pecks-of-gold'],
  ['ordeal-count-fact', 'guanyin', 'the-ledger-of-ordeals'],
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
  ['wukong-deathless', 'wukong', 'want', 'Get out from under the Register of Life and Death, by learning, by force, or by ink.', 'fear-of-death', 'register-struck'],
  ['wukong-rank', 'wukong', 'want', 'Be given a title in Heaven that actually means something.', 'bimawen', 'rank-discovered'],
  ['wukong-fillet', 'wukong', 'want', 'Have the gold band taken off his head.', 'the-fillet', 'five-holy-ones'],
  ['wukong-temper', 'wukong', 'flaw', 'He cannot let an insult go, and it costs him the cudgel, the fan, the manfruit tree and his place in the party twice.', 'six-brigands', 'the-four-line-verse'],
  ['tripitaka-scriptures', 'tripitaka', 'want', 'Reach Vulture Peak and bring three baskets of scripture back to Chang’an.', 'great-vehicle', 'the-passport-returned'],
  ['tripitaka-discernment', 'tripitaka', 'need', 'Learn to tell a demon from a woman crying beside a road, which he never does.', 'three-disguises', null],
  ['tripitaka-fear', 'tripitaka', 'fear', 'He is frightened of every noise on the road, and is told at last that the fear is itself the distance from Vulture Peak.', 'famen-temple', 'the-four-line-verse'],
  ['bajie-home', 'zhu-bajie', 'want', 'Go back to Gao Village, or failing that, to a meal and a bed.', 'rake-and-oath', 'five-holy-ones'],
  ['bajie-luggage', 'zhu-bajie', 'flaw', 'He proposes selling the horse and dividing the luggage at every reverse, and carries it the whole way anyway.', 'the-goading', null],
  ['sha-sentence', 'sha-wujing', 'want', 'Work off a sentence of a hundred knives a week and get back on the heavenly rolls.', 'gourd-and-skulls', 'five-holy-ones'],
  ['guanyin-errand', 'guanyin', 'want', 'Deliver the scriptures east by assembling a party out of four convicted criminals and a monk.', 'three-baskets', 'the-ledger-of-ordeals'],
  ['taizong-debt', 'taizong', 'need', 'Pay for what he was shown in the underworld, which paper money will not cover.', 'borrowed-gold', 'the-passport-returned'],
  ['bull-grievance', 'bull-demon-king', 'want', 'Get satisfaction for a son converted, a wife insulted and a mistress frightened.', 'old-brother', 'nets-on-four-sides'],
].map(([slug, character, type, text, start, end]) => ({
  ...base, id: id('goal', slug), characterId: C(character), type, text, startEventId: EV(start), endEventId: end ? EV(end) : null,
}))

/* ------------------------------------------- travel, routes, snapshots --- */

/*
  No travel modes (EX-403, recorded rather than padded). A TravelMode is a
  `speedPerDay` in the map layer's `scaleUnit`, and none of these seven layers
  carries a scale. The book's own distances — a hundred and eight thousand li
  to the west, eight hundred li of river, eight hundred li of thorn — are
  formulas rather than measurements, and dividing one by a number of days would
  produce a figure nothing in the text supports.
*/
const travelModes = []

const mapRoutes = [
  {
    ...base, id: id('route', 'the-road-west'), mapLayerId: M('route'), name: 'The Road West', routeType: 'road',
    waypoints: ['changan', 'famen-temple', 'shuangcha-ridge', 'liu-farm', 'gao-village', 'five-phases-mountain', 'eagle-grief-stream', 'guanyin-monastery', 'black-wind-mountain', 'cloud-ladder-cave', 'pagoda-mountain', 'yellow-wind-ridge', 'flowing-sands-river', 'wuzhuang-temple', 'white-tiger-ridge', 'pingding-mountain', 'baolin-monastery', 'wuji-kingdom', 'roaring-mountain', 'black-water-river', 'cart-slow-kingdom', 'tongtian-river', 'jindou-mountain', 'mother-child-river', 'west-liang', 'pipa-cave', 'seven-hundred-li-slope', 'flaming-mountains', 'jisai-kingdom', 'thorn-ridge', 'little-thunderclap', 'seven-extremes-mountain', 'zhuzi-kingdom', 'pansi-cave', 'lion-camel-ridge', 'bhiksu-kingdom', 'zhenhai-monastery', 'dharma-kingdom', 'hidden-mist-mountain', 'fengxian', 'yuhua', 'jinping', 'jetavana-monastery', 'tianzhu-capital', 'tongtai', 'jade-truth-temple', 'cloud-reaching-ford', 'vulture-peak-gate'].map(L),
    color: '#c2a14e', notes: 'The pilgrimage as the painting draws it, from the capital to the mountain. It doubles back east once, between the Guanyin Monastery and Gao Village, because the painting puts the village inside the Tang frontier and the book puts it well beyond it.',
  },
  {
    ...base, id: id('route', 'homeward'), mapLayerId: M('route'), name: 'Carried Home in Eight Days', routeType: 'trail',
    waypoints: ['vulture-peak-gate', 'tongtian-river', 'sun-drying-rock', 'chen-village', 'changan'].map(L),
    color: '#7d8fb0', notes: 'The return, carried by eight vajras: dropped once at the Heaven-Reaching River for the eighty-first ordeal, dried on a rock, and set down in Chang’an.',
  },
  {
    ...base, id: id('route', 'guanyin-east'), mapLayerId: M('route'), name: 'Guanyin’s Journey East', routeType: 'trail',
    waypoints: ['vulture-peak-gate', 'flowing-sands-river', 'cloud-ladder-cave', 'five-phases-mountain', 'changan'].map(L),
    color: '#5f8f6a', notes: 'The recruiting trip made a year before the pilgrimage: a river monster, a boar, a condemned dragon and a monkey under a mountain, in that order, and then a back shrine in the capital.',
  },
]

const locationSnapshots = [
  ['mountain-sealed', 'five-phases-mountain', 'five-phases-mountain', 'Sealed with six gold characters', 'Five joined peaks with a paper on the summit, and a local god instructed to feed what is under it iron pellets and molten copper.'],
  ['mountain-opened', 'five-phases-mountain', 'seal-peeled', 'Open', 'The seal has gone up on a scented wind and the mountain has split; the road past the frontier is walkable again.'],
  ['monastery-burnt', 'guanyin-monastery', 'monastery-burnt', 'Burnt to the walls', 'Two hundred and seventy monks set a fire to kill their guests and lost the whole house, the chests and the seven hundred robes.'],
  ['tree-down', 'wuzhuang-temple', 'tree-toppled', 'The manfruit tree is on the ground', 'A tree that fruits thirty times in ten thousand years has been pushed out of the earth by the root, and every fruit on it has sunk.'],
  ['tree-restored', 'wuzhuang-temple', 'sweet-dew', 'The tree is standing, and counts twenty-three', 'A spring under the root and dew off a willow spray have put the leaves back, and the fruit that sank into the earth has come back with it.'],
  ['fire-out', 'flaming-mountains', 'nets-on-four-sides', 'The fire is out for good', 'Forty-nine strokes of the fan, and eight hundred li that have burned for five hundred years will not light again.'],
  ['pagoda-relic', 'golden-light-monastery', 'nine-headed-consort', 'The relic is back and the name is changed', 'The tower has its light again, the stolen fungus is keeping it warm, and the monastery is renamed from Golden Light to Subdued Dragon.'],
  ['false-monastery-burnt', 'little-thunderclap', 'the-melon-patch', 'Burnt behind them', 'The counterfeit Thunderclap is on fire and the two pantheons that were in its cellar are walking out of the gate.'],
  ['city-renamed', 'dharma-kingdom', 'the-night-of-razors', 'Renamed Dharma-Respecting', 'A king who vowed to kill ten thousand monks has changed one character of his country’s name and asked four of them to take him as a disciple.'],
  ['lane-opened', 'seven-extremes-mountain', 'the-pig-plough', 'The old lane is open again', 'Eight hundred li of rotted persimmon rooted through by a hog over two days, with the village carrying food out behind him.'],
].map(([slug, loc, event, status, notes], i) => ({
  ...base, id: id('location-snapshot', slug), locationMarkerId: L(loc), eventId: EV(event), sortKey: i, status, notes,
}))

/* --------------------------------------------------------------- data --- */

const timelines = [
  { id: ageTimelineId, worldId, name: 'The Age of the Monkey', description: 'Four centuries in eight chapters: a stone monkey born on an island, taught in the west, promoted twice by a court that wanted him quiet, and pinned under a mountain for five hundred years — and the recruiting trip Guanyin makes east while he is still under it.', color: '#c9803a', dayOffset: 0, createdAt: now },
  { id: roadTimelineId, worldId, name: 'The Journey West', description: 'Chang’an to Vulture Peak and back: a murdered scholar’s son, an emperor’s debt, a rescript issued in the thirteenth year of Zhenguan and handed back in the twenty-seventh.', color: '#c2a14e', dayOffset: 0, createdAt: now },
]

const timelineRelationships = [
  {
    ...base,
    id: id('timeline-relationship', 'age-echoes-road'),
    sourceTimelineId: roadTimelineId,
    targetTimelineId: ageTimelineId,
    type: 'historical_echo',
    /* What actually joins the two: a monkey who is in both, the bodhisattva who
       recruits him in one and supervises him in the other, and the mountain the
       first timeline puts him under and the second takes him out from. */
    anchors: [
      { kind: 'character', entityId: C('wukong') },
      { kind: 'character', entityId: C('guanyin') },
      { kind: 'location', entityId: L('five-phases-mountain') },
    ],
    syncPoints: [],
    label: 'The five hundred years the road pays for',
    description: 'The pilgrimage is the sentence handed down at the end of the frame. The disciple under the mountain, the fillet, the ownership of half the demons on the road and the Buddha who charges for the scriptures are all set up in chapters one to eight and settled in the ninety-two after them.',
  },
]

const data = {
  version: 16,
  type: 'worldbreaker-export',
  exportedAt: now,
  world: {
    id: worldId,
    name: 'Journey to the West',
    description: 'A stone monkey fights Heaven to a standstill and is pinned under a mountain for five hundred years. A Tang emperor comes back from the underworld owing more than he can pay and sends a monk west for scriptures that will settle it. The two stories meet on a road eighty-one disasters long, walked by a pilgrim who cannot tell a demon from a widow, a pig who wants to go home, a river monster nobody listens to, a dragon in the shape of a horse, and the monkey — who is right about almost everything and is punished for it with a hat.',
    coverImageId: null,
    theme: 'theme-fantasy',
    readingMode: true,
    createdAt: now,
    updatedAt: now,
    continuityStaleThreshold: 5,
    calendar: {
      startYear: 627,
      yearSuffix: ' CE',
      months: [['First Month', 30], ['Second Month', 30], ['Third Month', 31], ['Fourth Month', 30], ['Fifth Month', 31], ['Sixth Month', 30], ['Seventh Month', 31], ['Eighth Month', 30], ['Ninth Month', 31], ['Tenth Month', 30], ['Eleventh Month', 31], ['Twelfth Month', 30]].map(([name, days]) => ({ name, days })),
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
  timelines,
  chapters,
  events,
  blobs,
  travelModes,
  timelineRelationships,
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

if (chapters.length !== 100) fail('the book has a hundred chapters')
if (daysInCalendarYear() !== YEAR) fail('the calendar year does not match the day axis')
function daysInCalendarYear() {
  return data.world.calendar.months.reduce((n, m) => n + m.days, 0)
}
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
  if (!timelines.some((t) => t.id === event.timelineId)) fail(`${event.title}: unknown timeline (EX-404)`)
  for (const characterId of event.involvedCharacterIds) {
    if (!characters.some((c) => c.id === characterId)) fail(`${event.title}: unknown character (EX-404)`)
  }
  for (const itemId of event.involvedItemIds) {
    if (!items.some((it) => it.id === itemId)) fail(`${event.title}: unknown item (EX-404)`)
  }
  for (const threadId of event.threadIds) {
    if (!plotThreads.some((t) => t.id === threadId)) fail(`${event.title}: unknown thread (EX-404)`)
  }
  for (const motifId of event.motifIds) {
    if (!motifs.some((m) => m.id === motifId)) fail(`${event.title}: unknown motif (EX-404)`)
  }
}
/* Every thread and motif has to be about something. */
for (const thread of plotThreads) {
  if (!events.some((e) => e.threadIds.includes(thread.id))) fail(`${thread.name} is on no scene (EX-403)`)
}
for (const motif of motifs) {
  if (!events.some((e) => e.motifIds.includes(motif.id))) fail(`${motif.name} is on no scene (EX-403)`)
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
/* EX-106: nobody is alive after the scene that kills them. */
const orderOf = new Map(events.map((e, i) => [e.id, i]))
for (const [slug, key] of diesAt) {
  if (!scenes.some((s) => s.key === key)) fail(`${slug} dies in a scene this world does not have (EX-404)`)
  const deathAt = orderOf.get(EV(key))
  for (const snapshot of characterSnapshots.filter((s) => s.characterId === C(slug))) {
    const at = orderOf.get(snapshot.eventId)
    if (at > deathAt && snapshot.isAlive && slug !== 'kou-hong') fail(`${slug} is alive after the scene that kills them (EX-106)`)
    if (at < deathAt && !snapshot.isAlive) fail(`${slug} is dead before the scene that kills them (EX-106)`)
  }
}
/* EX-203: exactly one gateway per submap, and it sits on the parent map. */
for (const child of maps.filter((m) => m.parentMapId)) {
  const gateways = locations.filter((l) => l.linkedMapLayerId === child.id)
  if (gateways.length !== 1) fail(`${child.name} has ${gateways.length} gateways (EX-203)`)
  if (gateways[0].mapLayerId !== child.parentMapId) fail(`${child.name}'s gateway is not on its parent map (EX-203)`)
}
/* EX-204: no empty maps, and every marker inside its own image. */
for (const layer of maps) {
  if (!locations.some((l) => l.mapLayerId === layer.id)) fail(`${layer.name} has no locations (EX-204)`)
}
for (const marker of locations) {
  const layer = maps.find((m) => m.id === marker.mapLayerId)
  if (marker.x < 0 || marker.x > layer.imageWidth || marker.y < 0 || marker.y > layer.imageHeight) {
    fail(`${marker.name} is off the edge of ${layer.name} (EX-206)`)
  }
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
/* EX-306/EX-404: every blob a record names is declared, and every file shipped. */
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
const namedEvents = [
  ...knowledgeFacts.map((f) => f.readerLearnsAtEventId),
  ...knowledgeReveals.map((r) => r.eventId),
  ...goalRows.flatMap((g) => [g.startEventId, g.endEventId]),
  ...relRows.map((r) => r.startEventId),
  ...relationshipSnapshots.map((r) => r.eventId),
  ...factionMemberships.flatMap((m) => [m.startEventId, m.endEventId]),
  ...locationSnapshots.map((s) => s.eventId),
]
for (const record of namedEvents) {
  if (record && !events.some((e) => e.id === record)) fail(`${record} is not an event in this world (EX-404)`)
}
for (const snapshot of locationSnapshots) {
  if (!locations.some((l) => l.id === snapshot.locationMarkerId)) fail(`${snapshot.id}: unknown location (EX-404)`)
}
/* EX-106: chronology must not run backwards — per timeline, because the frame
   and the road are two clocks sharing one axis. */
const lastSeen = new Map()
for (const event of events) {
  const previous = lastSeen.get(event.timelineId)
  if (previous && event.inWorldTime < previous.inWorldTime) {
    fail(`${event.title} happens before ${previous.title}, which it follows on the same timeline (EX-106)`)
  }
  lastSeen.set(event.timelineId, event)
}
for (const link of timelineRelationships) {
  if (!timelines.some((t) => t.id === link.sourceTimelineId)) fail(`${link.label}: unknown source timeline (EX-404)`)
  if (!timelines.some((t) => t.id === link.targetTimelineId)) fail(`${link.label}: unknown target timeline (EX-404)`)
  /* The dashboard reads `type` and maps over `anchors`; a record spelt any
     other way crashes the screen rather than rendering nothing, which is how
     this was found. */
  if (!['frame_narrative', 'historical_echo', 'embedded_fiction', 'alternate'].includes(link.type)) {
    fail(`${link.label}: not a TimelineRelationshipType (EX-404)`)
  }
  if (!Array.isArray(link.anchors) || !Array.isArray(link.syncPoints)) fail(`${link.label}: anchors and syncPoints are required (EX-404)`)
  for (const anchor of link.anchors) {
    const pool = anchor.kind === 'character' ? characters : anchor.kind === 'location' ? locations : items
    if (!pool.some((e) => e.id === anchor.entityId)) fail(`${link.label}: anchor names nothing in this world (EX-404)`)
  }
}

/* -------------------------------------------------------------- write --- */

const text = `${JSON.stringify(data, null, 2)}\n`
fs.writeFileSync('example/Journey to the West.pwk', text)
fs.writeFileSync('public/library/journey-to-the-west.pwk', text)

const index = JSON.parse(fs.readFileSync('public/library/index.json', 'utf8'))
const entry = {
  id: 'journey-to-the-west',
  title: 'Journey to the West',
  author: 'Wu Cheng’en',
  blurb: 'A monkey who fought Heaven, a monk who cannot tell a demon from a widow, and eighty-one disasters between Chang’an and Vulture Peak.',
  data: 'journey-to-the-west.pwk',
  dataBytes: Buffer.byteLength(text),
  counts: { characters: characters.length, chapters: chapters.length, events: events.length, locations: locations.length },
  notice: 'Unofficial reference for a public-domain novel. This example contains original structural summaries and a reconstructed chronology, not the novel’s prose. The chapter titles are the book’s own couplets, rendered in English; the verbatim Chinese ships beside the generator script. Every map and picture is the world author’s own AI-generated work and is not public domain; SOURCES.md and the Lore say so.',
  worldId,
  /* No cover yet. The catalogue advertises a cover only where the world really
     links one, and no cover plate has been drawn for this book; the request is
     on the Tier 1 list in scripts/journey-to-the-west/ART-REQUESTS.md. */
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
