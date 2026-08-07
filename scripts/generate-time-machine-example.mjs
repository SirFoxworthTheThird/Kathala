import fs from 'node:fs'

const P = 'time-machine'
const worldId = `${P}-world`
const frameTimelineId = `${P}-timeline-frame`
const journeyTimelineId = `${P}-timeline-journey`
const now = 1786122000000
const base = { worldId, createdAt: now, updatedAt: now }
const id = (kind, slug) => `${P}-${kind}-${slug}`
const chId = n => id('chapter', String(n).padStart(2, '0'))
const charId = slug => id('char', slug)
const itemId = slug => id('item', slug)
const locId = slug => id('loc', slug)
const mapId = slug => id('map', slug)
const threadId = slug => id('thread', slug)
const motifId = slug => id('motif', slug)
const imageId = slug => id('image', slug)
const factionId = slug => id('faction', slug)

const months = [
  ['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],
  ['July',31],['August',31],['September',30],['October',31],['November',30],['December',31],
].map(([name, days]) => ({ name, days }))

const commons = (name, width = 960) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}?width=${width}`
const blob = (slug, url, mimeType = 'image/jpeg') => ({ id: imageId(slug), worldId, mimeType, url, createdAt: now })
const blobs = [
  blob('cover', commons('The Time Machine by Norman Saunders.jpg', 960)),
  blob('finlay-1', commons('The Time Machine by Virgil Finlay 1.png', 960), 'image/png'),
  blob('finlay-2', commons('The Time Machine by Virgil Finlay 2.png', 960), 'image/png'),
  blob('finlay-3', commons('The Time Machine by Virgil Finlay 3.png', 960), 'image/png'),
  blob('finlay-4', commons('The Time Machine by Virgil Finlay 4.png', 960), 'image/png'),
  blob('white-sphinx', commons('White Sphinx.png', 960), 'image/png'),
  blob('title-page', commons('The Time Machine (H. G. Wells, William Heinemann, 1895) title page.jpg', 720)),
  blob('portrait-victorian-gentleman', commons('Victorian Gentleman.png', 720), 'image/png'),
  blob('portrait-noble-man', commons('Vintage noble man illustration (39820339183).jpg', 720)),
  blob('portrait-gentleman-gb', commons('Portrait of a Gentleman (GB 19c).jpg', 720)),
  blob('portrait-fragonard', commons('Fragonard - Portrait of a Gentleman.jpg', 720)),
  blob('portrait-vandyck', commons('Anthony van Dyck - Portrait of a Gentleman.jpg', 720)),
  blob('portrait-addison', commons('Portrait of a gentleman, traditionally identified as Edward Addison (by George Romney).jpg', 720)),
  blob('portrait-wright', commons('Portrait of a Gentleman by Joseph Wright.jpg', 720)),
  blob('portrait-wood', commons('Portrait of a gentleman, circa 1800 (by William Wood).jpg', 720)),
  blob('portrait-constable', commons('Constable - Portrait of a Gentleman (unfinished), 1803–1804, L.F11.1936.0.0.jpg', 720)),
  blob('portrait-watchett', commons('Jane-Austen-portrait-victorian-engraving.png', 720), 'image/png'),
  blob('item-mechanism', commons('Mécanisme.jpg', 800)),
  blob('item-machine', commons('The Time Machine by Norman Saunders.jpg', 800)),
  blob('item-lever', commons('Archimedes lever.png', 800), 'image/png'),
  blob('item-matches', commons('Congreve matchbox.jpg', 800)),
  blob('item-camphor', commons('NAS-083 Cinnamomum camphora.png', 800), 'image/png'),
  blob('item-iron-bar', commons('Lever (PSF).png', 800), 'image/png'),
  blob('item-flowers', commons('White Flowers in a Vase MET DP805121.jpg', 800)),
  blob('item-fruit', commons('Botanical plate with spray of apples MET DP-1687-040.jpg', 800)),
  blob('item-camera', commons("Pocket Kodak Camera Advert (McClure's Magazine 1895).jpg", 800)),
  blob('map-richmond', commons('Map of "Environs of Richmond and Kingston," London, 1915.jpg', 1400)),
  blob('map-house', commons('Cambridge cottage floorplan.jpg', 1920)),
]

const mapLayers = [
  { ...base, id: mapId('richmond'), parentMapId: null, name: 'Richmond and the Thames Valley', description: 'A period map of Richmond, Kew, the Thames, Richmond Park, and Kingston: the real landscape beneath the novel’s Victorian frame and imagined future.', imageId: imageId('map-richmond'), imageWidth: 1920, imageHeight: 2560, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('house'), parentMapId: mapId('richmond'), name: 'The Time Traveller’s House', description: 'An editorial floor plan for the fictional Richmond house, using a period plan of Cambridge Cottage at Kew. Room positions are navigational aids, not a claim that Wells supplied a canonical blueprint.', imageId: imageId('map-house'), imageWidth: 1920, imageHeight: 1259, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
  { ...base, id: mapId('future'), parentMapId: mapId('richmond'), name: 'Thames Valley, Year 802,701', description: 'An editorial reconstruction of the future landscape over the Richmond map. Wells gives relative journeys, a river valley, wooded slopes, and distant ruins, but no surveyed plan.', imageId: imageId('map-richmond'), imageWidth: 1920, imageHeight: 2560, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' },
]

const locationMarkers = []
function location(slug, map, name, description, x, y, iconType = 'landmark', linked = null, artwork = null) {
  locationMarkers.push({ ...base, id: locId(slug), mapLayerId: mapId(map), linkedMapLayerId: linked ? mapId(linked) : null, name, description, x, y, imageId: artwork ? imageId(artwork) : null, iconType, tags: [], factionId: null })
}
// Leaflet's Simple CRS stores Y upward from the image bottom, so these Y values
// are the visually measured top-down pixels inverted against each image height.
location('house-portal', 'richmond', 'The Time Traveller’s House, Richmond', 'The unnamed inventor’s suburban home, where two Thursday dinners frame his account.', 837, 1525, 'building', 'house', 'title-page')
location('future-portal', 'richmond', 'Richmond in the Distant Future', 'Portal to the Thames Valley as the Time Traveller encounters it in the year 802,701.', 926, 1435, 'region', 'future', 'finlay-1')
location('dining-room', 'house', 'Dining Room', 'The Thursday guests eat here before argument, demonstration, and testimony move into the evening.', 1115, 454, 'building', null, 'title-page')
location('drawing-room', 'house', 'Smoking and Drawing Room', 'The guests debate the fourth dimension and watch the model machine vanish from a table.', 1675, 479, 'building', null, 'finlay-1')
location('laboratory', 'house', 'Laboratory and Workshop', 'The editorial plan assigns the inventor’s laboratory to the garden-room wing beside the central hall.', 750, 414, 'building', null, 'finlay-2')
location('central-hall', 'house', 'Central Hall', 'The route between dinner, the drawing room, and the laboratory passes through this broad interior hall.', 910, 569, 'building', null, 'title-page')
location('garden', 'house', 'Garden and Lawn', 'The Richmond garden outside the house, associated with the machine’s starting point and the narrator’s final vigil.', 985, 129, 'region', null, 'finlay-1')

location('sphinx-lawn', 'future', 'White Sphinx Lawn', 'The machine stops on a hail-whitened lawn below a colossal white sphinx on a bronze pedestal.', 898, 1483, 'landmark', null, 'white-sphinx')
location('great-hall', 'future', 'Eloi Great Hall', 'A vast, weathered communal building where the Eloi eat fruit, sleep together, and receive the traveller.', 837, 1573, 'building', null, 'finlay-1')
location('river-bank', 'future', 'River Bank', 'A reach of the Thames valley where the traveller rescues Weena from the water.', 600, 1535, 'landmark', null, 'finlay-2')
location('well', 'future', 'Morlock Well and Shaft', 'One of the circular wells whose descending ladder, cool air, and machinery connect the surface to the underworld.', 1008, 1326, 'custom', null, 'finlay-3')
location('underworld', 'future', 'Morlock Underworld', 'A schematic point for the dark galleries and machinery reached through the well; their underground extent is not mapped by Wells.', 1042, 1271, 'custom', null, 'finlay-3')
location('wood', 'future', 'Wooded Slope', 'The moonless forest crossed on the return journey, where fire becomes both defence and catastrophe.', 1138, 1134, 'region', null, 'finlay-4')
location('green-palace', 'future', 'Palace of Green Porcelain', 'A remote, museum-like ruin containing decayed exhibits, preserved matches, camphor, and an iron bar.', 1419, 1017, 'building', null, 'finlay-4')
location('sphinx-chamber', 'future', 'Chamber Inside the Sphinx', 'The hollow pedestal conceals the Time Machine and becomes a trap when the bronze panels close.', 926, 1456, 'building', null, 'white-sphinx')
location('far-shore', 'future', 'Far Future Shore', 'A temporal overlay rather than a geographic claim: millions of years later, a red shore lies beneath a swollen sun.', 1400, 310, 'landmark', null, 'finlay-4')

const charDefs = [
  ['traveller','The Time Traveller','The unnamed inventor whose experiment becomes an eight-day expedition through humanity’s remote future.','finlay-1','#6b7280',true],
  ['narrator','The Narrator','An unnamed member of the Richmond dinner circle who records the traveller’s argument, testimony, and disappearance.','portrait-victorian-gentleman','#7c6f64',true],
  ['weena','Weena','An Eloi whom the traveller rescues and befriends; her trust changes his expedition from observation to responsibility.','finlay-2','#b7798c',false],
  ['filby','Filby','An argumentative guest who resists the traveller’s geometric explanation.','portrait-noble-man','#817267',true],
  ['psychologist','The Psychologist','A guest trained to scrutinise perception, and the first to handle the vanished model’s empty space.','portrait-gentleman-gb','#65758b',true],
  ['medical-man','The Medical Man','A dinner guest who examines the traveller’s exhausted physical condition.','portrait-fragonard','#70806f',true],
  ['mayor','The Provincial Mayor','A ceremonious, sceptical guest at the first Thursday discussion.','portrait-vandyck','#897354',true],
  ['young-man','The Very Young Man','A guest who extends the time-travel idea into practical fantasies.','portrait-addison','#6f8292',true],
  ['editor','The Editor','A later dinner guest who treats the returned traveller’s appearance as extraordinary news.','portrait-wright','#625f66',true],
  ['journalist','The Journalist','A later guest eager to turn the traveller’s return into copy.','portrait-wood','#70665f',true],
  ['silent-man','The Silent Man','A quiet, observant guest at the second Thursday dinner.','portrait-constable','#5f6368',true],
  ['mrs-watchett','Mrs Watchett','The housekeeper who briefly sees the inventor cross his laboratory during the first moments of travel.','portrait-watchett','#87756d',true],
  ['morlocks','The Morlocks','A collective character for the pale underground people who maintain machinery and hunt on moonless nights.','finlay-3','#777b82',true],
  ['eloi','The Eloi','A collective character for the delicate surface people of the year 802,701.','finlay-4','#a98578',true],
]
const characters = charDefs.map(([slug,name,description,artwork,color,isAlive]) => ({ ...base, id: charId(slug), name, aliases: [], description, portraitImageId: imageId(artwork), color, tags: [], isAlive, birthDate: null }))

const itemDefs = [
  ['model','Model Time Machine','A small ivory-and-nickel model used to demonstrate motion through the fourth dimension.','clock','item-mechanism'],
  ['machine','The Time Machine','The full-sized saddle-like apparatus of brass, nickel, ivory, and crystal that carries its rider through time.','settings','item-machine'],
  ['lever','Starting Lever','The small lever removed for safety and reattached when the traveller needs the machine to move.','wrench','item-lever'],
  ['matches','Wax Matches','The traveller’s dwindling Victorian matches give light, evidence, and temporary protection from Morlocks.','flame','item-matches'],
  ['camphor','Camphor','A flammable block taken from the Palace of Green Porcelain to sustain light in the forest.','flask-conical','item-camphor'],
  ['iron-bar','Iron Bar','A metal lever broken from a museum machine and carried as a mace.','hammer','item-iron-bar'],
  ['flowers','Weena’s Flowers','Two strange white flowers placed in the traveller’s pocket and preserved as the narrator’s final material evidence.','flower-2','item-flowers'],
  ['fruit','Eloi Fruit','The abundant fruit that feeds the surface people and initially suggests an effortless golden age.','apple','item-fruit'],
  ['camera','Small Camera','A camera packed for the traveller’s final departure, intended to bring back clearer evidence.','camera','item-camera'],
]
const items = itemDefs.map(([slug,name,description,iconType,artwork]) => ({ ...base, id: itemId(slug), name, description, iconType, imageId: imageId(artwork), tags: [] }))

if (new Set(characters.map(character => character.portraitImageId)).size !== characters.length) throw new Error('Every character must have a distinct portrait image')
if (new Set(items.map(item => item.imageId)).size !== items.length) throw new Error('Every item must have a distinct illustration')
const rosterArtworkIds = new Set([...characters.map(character => character.portraitImageId), ...items.map(item => item.imageId)])
const rosterArtworkFiles = blobs.filter(image => rosterArtworkIds.has(image.id)).map(image => new URL(image.url).pathname)
if (new Set(rosterArtworkFiles).size !== rosterArtworkFiles.length) throw new Error('Character and item artwork must not reuse the same source image')

const chapterDefs = [
  ['Introduction','At a Thursday dinner in Richmond, the Time Traveller asks his guests to accept time as a fourth dimension.'],
  ['The Machine','A model disappears before the guests, and the inventor reveals the full machine in his laboratory.'],
  ['The Time Traveller Returns','At the next Thursday dinner, the inventor arrives late, injured and famished, and demands to tell his story uninterrupted.'],
  ['Time Travelling','He mounts the machine, tests a short jump, and accelerates from 1895 into the year 802,701.'],
  ['In the Golden Age','The Eloi welcome the traveller; he explores their communal life, food, architecture, and river valley.'],
  ['The Sunset of Mankind','His first theory of effortless human decline collapses when the Time Machine disappears.'],
  ['A Sudden Shock','The traveller searches the White Sphinx, discovers its pedestal is locked, and begins to notice the wells.'],
  ['Explanation','Surface and underground humanity become evidence of an ancient division between leisure and labour.'],
  ['The Morlocks','The traveller descends a well, sees the machinery below, and escapes the Morlocks by matchlight.'],
  ['When Night Came','With the moon waning, he and Weena begin the long journey toward the Palace of Green Porcelain.'],
  ['The Palace of Green Porcelain','In a ruined museum, the traveller gathers matches, camphor, and an iron bar for the return.'],
  ['In the Darkness','Morlocks surround the travellers in the moonless wood; a defensive fire becomes a forest blaze.'],
  ['The Trap of the White Sphinx','The opened pedestal offers the recovered machine but closes around the traveller as a trap.'],
  ['The Further Vision','Instead of stopping in 1895, the traveller sees a dying Earth millions of years farther ahead.'],
  ['The Time Traveller’s Return','He regains his laboratory and completes the account before the Richmond guests.'],
  ['After the Story','Most guests reject the tale; the narrator returns next day and witnesses the traveller’s final departure.'],
  ['Epilogue','Three years later, the narrator keeps Weena’s flowers and the possibility that humanity may retain gratitude and tenderness.'],
]
const chapters = chapterDefs.map(([title,synopsis], i) => ({ ...base, id: chId(i + 1), timelineId: (i + 1 >= 4 && i + 1 <= 15) ? journeyTimelineId : frameTimelineId, number: i + 1, title, synopsis, notes: '', wordGoal: null }))

const threadDefs = [
  ['proof','Proof of Time Travel','#64748b','Argument, model, wounds, dirt, flowers, and disappearance compete as evidence for an impossible journey.'],
  ['machine','The Missing Time Machine','#8b6f55','The stolen machine turns observation into a struggle to recover the only route home.'],
  ['weena','Weena and the Traveller','#a56f83','Rescue grows into companionship, care, and grief.'],
  ['morlocks','The Morlock Threat','#665d6c','Wells, machinery, darkness, and predation expose the danger beneath the Eloi world.'],
  ['class','The Division of Humanity','#7b684e','The traveller repeatedly revises his theory of how Victorian class division could shape Eloi and Morlocks.'],
  ['future','The Fate of Earth','#536b77','The year 802,701 opens onto still more remote scenes of planetary decline.'],
  ['disappearance','The Final Disappearance','#715f72','A second expedition leaves the narrator with no return, explanation, or closure.'],
]
const plotThreads = threadDefs.map(([slug,name,color,description]) => ({ ...base, id: threadId(slug), name, color, description }))
const motifDefs = [
  ['light-dark','Light and Darkness','#d1974b','Daylight belongs to the Eloi; matchlight and fire become weapons in the Morlocks’ darkness.'],
  ['decay','Ruins and Decay','#788070','Great buildings and museums outlast the knowledge that made them.'],
  ['scale','The Scale of Time','#667789','Clock hands, celestial motion, and geological change expand the story beyond human proportion.'],
  ['hands','Hands, Levers, and Control','#8b6b55','Small physical acts determine whether immense temporal forces can be directed.'],
  ['flowers','Flowers and Tenderness','#a66f80','Weena’s flowers oppose the traveller’s darkest account with fragile evidence of affection.'],
  ['hunger','Hunger and Consumption','#785e54','Fruit, exhaustion, cannibalism, and predation connect appetite to social order.'],
  ['vertical','Above and Below','#5f6d72','Surface leisure and underground labour become a literal vertical hierarchy.'],
]
const motifs = motifDefs.map(([slug,name,color,description]) => ({ ...base, id: motifId(slug), name, color, description }))

const events = []
function event(ch, title, description, loc, states, itemSlugs = [], tension = 2, day = 0, opts = {}) {
  const n = events.length + 1
  const timelineId = opts.timeline || chapters[ch - 1].timelineId
  // The shorthand values below preserve day-to-day spacing while this converts
  // their 802,701 anchor to the exact 365-day calendar offset from 1895.
  const calendarDay = day >= 292496900 && day <= 292496906 ? day - 202710 : day
  events.push({ ...base, id: id('event', String(n)), chapterId: chId(ch), timelineId, title, description, locationMarkerId: loc ? locId(loc) : null,
    involvedCharacterIds: Object.keys(states).map(charId), mentionedCharacterIds: (opts.mentioned || []).map(charId), involvedItemIds: itemSlugs.map(itemId),
    tags: [`chapter-${ch}`], threadIds: (opts.threads || ['proof']).map(threadId), motifIds: (opts.motifs || ['scale']).map(motifId), sortOrder: events.filter(e => e.chapterId === chId(ch)).length * 10,
    travelDays: opts.travelDays ?? 0, inWorldTime: calendarDay, tension, structureBeat: opts.beat ?? null, status: 'final', povCharacterId: charId(opts.pov || 'traveller'), isFlashback: opts.flashback ?? false, _states: states })
}

event(1,'Time as a Fourth Dimension','After dinner, the inventor uses geometry to argue that duration is another direction through which a body might move.','drawing-room',{traveller:'Leading the room through a precise geometric argument and testing which guests will follow it.',narrator:'Listening closely and preserving the sequence of the inventor’s claim.',filby:'Interrupting the geometry with practical objections and refusing easy agreement.',psychologist:'Testing whether the fourth-dimension argument describes reality or only an abstraction.',mayor:'Responding ceremoniously but sceptically to an idea that seems to defy common sense.','young-man':'Turning the theory toward speculative possibilities faster than the older guests accept them.'},[],2,0,{threads:['proof'],motifs:['scale'],pov:'narrator',beat:'opening_image'})
event(1,'A Traveller Through Time','The inventor asks the circle to imagine a machine able to move deliberately along the temporal axis.','drawing-room',{traveller:'Committing his abstract geometry to a concrete mechanical claim.',narrator:'Recognising that the conversation has shifted from philosophy to an asserted experiment.',filby:'Treating the proposed machine as a paradox to be exposed.',psychologist:'Watching the inventor’s confidence for signs of performance or delusion.',mayor:'Waiting for a demonstration before granting the proposal any seriousness.','young-man':'Imagining personal uses for controlled travel into other eras.'},['model'],2,0,{threads:['proof'],motifs:['hands','scale'],pov:'narrator'})
event(2,'The Model Vanishes','A small machine is set on the table; the Psychologist presses its lever and it disappears in a gust and flicker.','drawing-room',{traveller:'Supervising the test while withholding the full explanation of where the model has gone.',narrator:'Watching the model occupy the table and then leave no visible trace.',filby:'Searching for a trick that could account for the disappearance.',psychologist:'Withdrawing his hand from the lever and physically checking the empty space.',mayor:'Confronted with a demonstration more difficult to dismiss than the argument.','young-man':'Staring at the cleared tabletop and recalculating what the machine might permit.'},['model','lever'],3,0,{threads:['proof'],motifs:['hands','scale'],pov:'narrator',beat:'inciting_incident'})
event(2,'The Full Machine','The guests follow their host to the laboratory, where a larger, unfinished apparatus waits among tools and materials.','laboratory',{traveller:'Revealing the full-sized machine while warning that parts of it remain incomplete.',narrator:'Inspecting the brass, ivory, crystal, and saddle-like frame at close range.',filby:'Looking for an ordinary mechanism behind the claimed temporal one.',psychologist:'Comparing the large apparatus with the vanished model he operated.',mayor:'Taking in the workshop evidence without surrendering his doubts.','young-man':'Seeing a practical vehicle where the others still see an elaborate claim.'},['machine','lever'],3,0,{threads:['proof'],motifs:['hands'],pov:'narrator'})
event(3,'The Second Thursday Dinner','A week later, the narrator joins a changed group of guests, but their host has not appeared by eight o’clock.','dining-room',{narrator:'Waiting for the absent host and recalling the previous week’s impossible demonstration.','medical-man':'Assessing whether the inventor’s absence suggests illness or accident.',editor:'Treating the delayed dinner as a social mystery with a possible story behind it.',journalist:'Expecting novelty from a host already associated with an extraordinary claim.',psychologist:'Returning with the model’s disappearance still unresolved in his mind.','silent-man':'Observing the restless dinner party without adding speculation.'},[],2,7,{threads:['proof'],motifs:['scale'],pov:'narrator'})
event(3,'The Traveller Appears','The inventor enters dishevelled, limping, bloodied, and ravenously hungry, then leaves briefly to wash and dress.','dining-room',{traveller:'Barely upright after the return, prioritising food and composure before any explanation.',narrator:'Taking the torn clothes, wounds, and exhaustion as physical facts requiring an account.','medical-man':'Reading the traveller’s limp, pallor, and injuries as genuine bodily distress.',editor:'Confronted by a spectacle more urgent than the dinner conversation.',journalist:'Suppressing questions while the traveller insists on eating first.',psychologist:'Comparing this battered man with the confident inventor of the previous week.','silent-man':'Watching the room reorganise itself around the returned host.'},[],4,7,{threads:['proof'],motifs:['hunger'],pov:'narrator'})
event(3,'The Condition of the Story','After eating, the traveller agrees to explain only if no one interrupts until he has finished.','drawing-room',{traveller:'Recovering enough strength to control the terms on which his testimony will be heard.',narrator:'Accepting the rule of silence so the account can remain continuous.','medical-man':'Postponing medical questions while monitoring the traveller’s condition.',editor:'Agreeing to hear the narrative before challenging its plausibility.',journalist:'Holding back questions despite the story value of every visible detail.',psychologist:'Preparing to compare testimony with the earlier experiment.','silent-man':'Settling into the role of silent witness requested by the speaker.'},['flowers'],3,7,{threads:['proof'],motifs:['flowers','hunger'],pov:'narrator'})
event(4,'The First Short Jump','At ten that morning, the traveller mounts the completed machine and pushes its lever, finding the laboratory advanced into the afternoon.','laboratory',{traveller:'Testing the controls through a brief jump and discovering that motion in time produces physical terror as well as exhilaration.','mrs-watchett':'Crossing the laboratory as an instant blur from the traveller’s accelerated perspective.'},['machine','lever'],4,7,{threads:['proof','future'],motifs:['hands','scale'],beat:'break_into_two'})
event(4,'Years Become a Blur','He increases speed until days, seasons, buildings, and civilisations flicker around the stationary machine.','garden',{traveller:'Clinging to the saddle while the visible world accelerates beyond ordinary perception.'},['machine','lever'],4,292496900,{threads:['future'],motifs:['scale','decay']})
event(4,'Arrival in 802,701','Fear of collision makes him stop abruptly in a hailstorm beneath the White Sphinx, where small figures approach.','sphinx-lawn',{traveller:'Regaining balance beside the machine while assessing the sphinx, the storm, and the approaching people.',eloi:'Gathering around the impossible visitor with curiosity rather than aggression.'},['machine','lever'],4,292496900,{threads:['future','class','proof'],motifs:['scale','decay']})
event(5,'The Eloi Welcome the Visitor','The slight, brightly dressed Eloi examine the traveller and lead him into their enormous communal hall.','great-hall',{traveller:'Following the Eloi while comparing their delicacy and playfulness with Victorian expectations of progress.',eloi:'Touching the stranger, laughing, and guiding him into their shared building.'},[],2,292496900,{threads:['class','future'],motifs:['decay']})
event(5,'A Meal of Fruit','The traveller eats unfamiliar fruit while the Eloi lose interest in his attempts at conversation.','great-hall',{traveller:'Recovering from the journey, testing the Eloi language, and noticing their short attention span.',eloi:'Sharing abundant fruit without ceremony and drifting away from sustained questions.'},['fruit'],2,292496900,{threads:['class'],motifs:['hunger']})
event(5,'The Future Valley','He surveys ruined buildings, garden-like vegetation, and the Thames landscape, initially imagining a classless golden age.','sphinx-lawn',{traveller:'Building an optimistic first theory from the mild climate, shared life, and apparent absence of labour.'},[],2,292496901,{threads:['class','future'],motifs:['decay','scale']})
event(5,'Weena in the River','When an Eloi struggles in the water and the others ignore her, the traveller rescues her.','river-bank',{traveller:'Entering the river because the watching Eloi will not act.',weena:'Recovering on the bank after the stranger pulls her from the current.',eloi:'Watching the rescue without the urgency the traveller expects.'},[],3,292496901,{threads:['weena','class'],motifs:['flowers']})
event(6,'A Bond of Flowers','Weena begins following her rescuer and expresses gratitude through touch, trust, and flowers.','great-hall',{traveller:'Accepting Weena’s companionship while still treating the future as a field of inquiry.',weena:'Staying close to the traveller and marking gratitude with two flowers.'},['flowers'],2,292496901,{threads:['weena'],motifs:['flowers']})
event(6,'The Machine Is Gone','Returning to the lawn, the traveller finds only tracks where the machine stood.','sphinx-lawn',{traveller:'Moving from disbelief to panic as the sole route back to 1895 has vanished.'},['machine'],5,292496901,{threads:['machine'],motifs:['hands']})
event(6,'Tracks to the Pedestal','Marks in the turf lead to the White Sphinx, whose bronze panels remain closed against force and pleading.','sphinx-lawn',{traveller:'Examining the drag marks and attacking the pedestal before forcing himself to conserve strength.',eloi:'Keeping their distance from his rage and showing fear when he gestures at the sphinx.'},['machine'],4,292496901,{threads:['machine','morlocks'],motifs:['hands','vertical']})
event(7,'The Locked Bronze Panels','Rested but no calmer, the traveller tests the pedestal again and concludes intelligence has hidden the machine inside.','sphinx-lawn',{traveller:'Replacing panic with the working hypothesis that unseen hands moved the machine.'},['machine','lever'],4,292496902,{threads:['machine','morlocks'],motifs:['hands']})
event(7,'Air from the Wells','Circular wells, metal rungs, and a persistent subterranean sound reveal an active world below the surface.','well',{traveller:'Listening at the shaft and recognising machinery and ventilation beneath the Eloi landscape.',weena:'Recoiling from the well and resisting the traveller’s interest in what lies below.'},[],3,292496902,{threads:['morlocks','class'],motifs:['vertical','light-dark']})
event(7,'Pale Creatures at Dusk','The traveller glimpses a white, ape-like figure retreating into darkness and connects it with the wells.','well',{traveller:'Pursuing the glimpse far enough to identify a second future people without yet understanding them.',morlocks:'Withdrawing from fading surface light toward the protected shaft.'},[],4,292496902,{threads:['morlocks','class'],motifs:['vertical','light-dark']})
event(8,'Two Human Species','He proposes that the Eloi descend from the leisured classes and the underground people from workers driven below.','great-hall',{traveller:'Revising the golden-age theory into a social and evolutionary division between surface and underworld.',weena:'Remaining near him while his questions about the dark produce visible fear.',eloi:'Continuing their daylight play without explaining the machinery that supports it.'},[],3,292496902,{threads:['class','morlocks'],motifs:['vertical']})
event(8,'Weena Fears the Dark','Her terror of shadows and moonless nights warns the traveller that the surface is not secure after sunset.','great-hall',{traveller:'Recognising Weena’s fear as evidence that the Eloi and Morlocks are not peacefully separated.',weena:'Clinging to the traveller as daylight fades and refusing to be left alone.'},[],3,292496903,{threads:['weena','morlocks'],motifs:['light-dark']})
event(9,'Descent into the Well','Leaving Weena above, the traveller climbs down a long shaft toward the sound of machinery.','well',{traveller:'Descending rung by rung despite exhaustion and the narrowing circle of daylight overhead.',weena:'Waiting anxiously at the rim after failing to dissuade him.'},['matches'],4,292496903,{threads:['morlocks','class'],motifs:['vertical','light-dark']})
event(9,'The Machinery Below','In the dark, he finds great mechanisms, Morlocks, and evidence that the underworld sustains the surface.','underworld',{traveller:'Exploring by touch and intermittent matchlight while trying to understand the underground machines.',morlocks:'Gathering beyond the matchlight and testing whether the intruder can be seized.'},['matches'],4,292496903,{threads:['morlocks','class'],motifs:['vertical','light-dark']})
event(9,'Escape by Matchlight','Morlocks close around him, but flame startles them long enough for him to reach the ladder and climb.','underworld',{traveller:'Striking precious matches one-handed and fighting toward the shaft before the darkness closes again.',morlocks:'Recoiling from each flare, then returning as soon as the light fails.'},['matches'],5,292496903,{threads:['morlocks'],motifs:['light-dark','hands']})
event(10,'A Moonless Night Approaches','The traveller decides the distant green palace may contain tools, even though the new moon will leave the return in darkness.','sphinx-lawn',{traveller:'Choosing a dangerous search for weapons and knowledge over waiting helplessly beside the locked sphinx.',weena:'Insisting on accompanying the traveller away from the familiar Eloi buildings.'},[],3,292496904,{threads:['machine','weena','morlocks'],motifs:['light-dark','decay']})
event(10,'The Long Walk Begins','He carries Weena when she tires, and the pair cross the transformed valley toward the remote ruin.','wood',{traveller:'Measuring distance, fatigue, and the shrinking margin of daylight while carrying Weena.',weena:'Alternating between trust, weariness, and fear as familiar ground falls behind.'},[],3,292496904,{threads:['weena','machine'],motifs:['light-dark']})
event(10,'Fire as Protection','A small fire fascinates Weena and gives the traveller a weapon the Morlocks cannot comfortably approach.','wood',{traveller:'Teaching Weena to value controlled fire while calculating how few matches remain.',weena:'Delighted by flame in daylight yet beginning to understand it as protection after dark.'},['matches'],3,292496904,{threads:['weena','morlocks'],motifs:['light-dark']})
event(11,'The Ruined Museum','The Palace of Green Porcelain proves to be a decayed museum whose books and machines have collapsed beyond use.','green-palace',{traveller:'Searching the ruin for practical help while grieving the loss of accumulated human knowledge.',weena:'Following through the enormous galleries and staying close among unfamiliar relics.'},[],3,292496905,{threads:['future','machine'],motifs:['decay','scale']})
event(11,'Weapons and Fire','He finds preserved matches and camphor, then breaks an iron lever from a machine to use as a mace.','green-palace',{traveller:'Selecting portable light and a crude weapon from a civilisation’s unusable remains.',weena:'Watching him test the matches and gather objects she cannot name.'},['matches','camphor','iron-bar'],3,292496905,{threads:['machine','morlocks'],motifs:['light-dark','hands','decay']})
event(11,'No Way but the Wood','With no firearms or working vehicles, they leave the palace and attempt to cross the forest before complete darkness.','green-palace',{traveller:'Accepting that preparation has improved their odds but not removed the danger.',weena:'Leaving the shelter of the palace because she trusts the traveller’s route home.'},['matches','camphor','iron-bar'],4,292496905,{threads:['weena','morlocks'],motifs:['light-dark']})
event(12,'Morlocks in the Forest','Hands reach through the dark; the traveller swings the iron bar while trying to keep hold of Weena.','wood',{traveller:'Fighting blind, burdened by supplies and determined not to lose Weena in the crowd.',weena:'Clinging to the traveller as Morlocks press between them.',morlocks:'Surrounding the pair beyond the weak matchlight and grabbing whenever flame subsides.'},['matches','camphor','iron-bar'],5,292496905,{threads:['weena','morlocks'],motifs:['light-dark','hands']})
event(12,'The Forest Fire','A fire lit for defence spreads through dry growth, separating the traveller from the Morlocks but consuming the wood.','wood',{traveller:'Stumbling beyond the spreading blaze and realising too late that Weena is no longer with him.',morlocks:'Panicking within the firelight, some blinded or trapped by the advancing flames.'},['matches','camphor','iron-bar'],5,292496905,{threads:['weena','morlocks'],motifs:['light-dark','flowers']})
event(12,'Weena Is Lost','At dawn, the traveller searches but finds no trace of Weena and carries only the flowers already in his pocket.','wood',{traveller:'Exhausted, burned, and grieving, forced to continue without knowing Weena’s final moments.'},['flowers','iron-bar'],4,292496906,{threads:['weena','machine'],motifs:['flowers','light-dark']})
event(13,'The Sphinx Opens','Back at the lawn, he finds the bronze panels open and the Time Machine visible inside the pedestal.','sphinx-lawn',{traveller:'Approaching the recovered machine with suspicion because the invitation is too deliberate.',morlocks:'Waiting inside and around the pedestal for darkness and the trap to close.'},['machine','lever','matches'],4,292496906,{threads:['machine','morlocks'],motifs:['hands','light-dark']})
event(13,'The Trap Closes','The panels shut after he enters; in darkness, Morlocks seize him while the starting lever lies detached.','sphinx-chamber',{traveller:'Fighting on the floor for the loose lever while protecting the machine’s controls.',morlocks:'Closing around the trapped traveller and trying to pull him away from the apparatus.'},['machine','lever','matches'],5,292496906,{threads:['machine','morlocks'],motifs:['hands','light-dark']})
event(13,'Escape into Time','He fits the lever, drives it forward, and leaves the Morlocks behind as the chamber dissolves into temporal motion.','sphinx-chamber',{traveller:'Operating the machine from the floor at the last possible instant and choosing forward motion to escape.',morlocks:'Losing their grip as the machine vanishes from the sealed pedestal.'},['machine','lever'],5,292496906,{threads:['machine','future'],motifs:['hands','scale'],beat:'climax'})
event(14,'The Red Shore','More than thirty million years ahead, he stops beside a lifeless sea under a swollen red sun and faces giant crab-like creatures.','far-shore',{traveller:'Enduring thin air and oppressive stillness while observing the transformed coast and its slow predators.'},['machine','lever'],4,10950000000,{threads:['future'],motifs:['scale','decay']})
event(14,'The Last Eclipse','Farther on, cold darkness, a black shape crossing the sun, and a final tentacled life form drive him back toward human time.','far-shore',{traveller:'Reaching the limit of curiosity as planetary death replaces every recognisable human reference.'},['machine','lever'],5,12000000000,{threads:['future'],motifs:['scale','light-dark']})
event(15,'Back to the Laboratory','He reverses through the ages and stops in the laboratory shortly after his original departure, with the machine displaced and reversed.','laboratory',{traveller:'Collapsing beside the returned machine with dirt, wounds, and flowers carried across impossible time.'},['machine','lever','flowers'],4,7,{threads:['proof','future'],motifs:['hands','flowers','scale']})
event(15,'The Account Reaches the Dinner','The traveller finishes describing the return and offers his battered condition and flowers without demanding belief.','drawing-room',{traveller:'Concluding the testimony too exhausted to argue with every objection.',narrator:'Holding the complete account alongside the evidence visible in the room.','medical-man':'Comparing the narrated injuries with the body he examined before dinner.',editor:'Beginning to turn the impossible tale into a hypothesis, joke, or publishable sensation.',journalist:'Evaluating whether the story’s improbability increases or destroys its value as news.',psychologist:'Measuring the account against his own memory of the model’s disappearance.','silent-man':'Remaining an observer as the imposed silence ends.'},['flowers'],3,7,{timeline:frameTimelineId,threads:['proof'],motifs:['flowers'],pov:'narrator',beat:'resolution'})
event(16,'The Guests Reject the Tale','The dinner party disperses into jokes, disbelief, and competing rational explanations.','central-hall',{traveller:'Letting the sceptical guests leave without reopening the argument.',narrator:'Finding disbelief less satisfying than the unresolved physical details.','medical-man':'Preferring an explanation grounded in exhaustion and bodily stress.',editor:'Treating the account as ingenious fiction rather than verified report.',journalist:'Leaving with a remarkable story but no certainty that it is news.',psychologist:'Unable to reconcile the model demonstration with the larger claim.','silent-man':'Departing without offering a verdict.'},[],2,7,{threads:['proof'],motifs:['scale'],pov:'narrator'})
event(16,'The Machine Stands in Daylight','The narrator returns next afternoon and sees the full machine in the laboratory while the inventor prepares supplies.','laboratory',{traveller:'Packing a camera and provisions for a short evidentiary expedition he expects to survive.',narrator:'Examining the machine in daylight and asking for proof that can outlast testimony.'},['machine','camera'],3,8,{threads:['proof','disappearance'],motifs:['hands'],pov:'narrator'})
event(16,'The Final Departure','A gust and broken-glass sound mark the machine’s disappearance; the traveller does not return.','laboratory',{traveller:'Beginning a second journey with the intention of returning quickly and bringing evidence.',narrator:'Reaching the laboratory seconds too late and finding the space where man and machine had stood empty.'},['machine','camera'],4,8,{threads:['disappearance','proof'],motifs:['scale','hands'],pov:'narrator'})
event(17,'Three Years Without Return','The narrator reflects that the traveller may be anywhere in time, beyond every attempt at rescue or confirmation.','garden',{narrator:'Keeping faith with uncertainty after three years have produced neither traveller nor message.'},[],2,1103,{threads:['disappearance','proof'],motifs:['scale','flowers'],pov:'narrator'})
event(17,'The Flowers Remain','The two withered flowers survive as evidence that gratitude and tenderness endured in humanity’s remote future.','garden',{narrator:'Preserving Weena’s flowers as modest evidence and as a moral answer to the traveller’s darkest conclusions.'},['flowers'],2,1103,{threads:['proof','weena'],motifs:['flowers'],pov:'narrator'})

const locById = new Map(locationMarkers.map(l => [l.id, l]))
const characterSnapshots = []
for (const [eventIndex, ev] of events.entries()) {
  Object.entries(ev._states).forEach(([slug, statusNotes], characterIndex) => {
    const marker = ev.locationMarkerId ? locById.get(ev.locationMarkerId) : null
    const isAlive = !(slug === 'weena' && ['The Forest Fire','Weena Is Lost'].includes(ev.title))
    characterSnapshots.push({ ...base, id: id('snapshot', `${eventIndex + 1}-${slug}`), characterId: charId(slug), eventId: ev.id, isAlive,
      currentLocationMarkerId: ev.locationMarkerId, currentMapLayerId: marker?.mapLayerId ?? null, inventoryItemIds: [], inventoryNotes: '', travelModeId: null,
      sortKey: eventIndex * 100 + characterIndex, statusNotes })
  })
  delete ev._states
}

const itemPlacements = []
for (const [eventIndex, ev] of events.entries()) {
  ev.involvedItemIds.forEach((iid, itemIndex) => itemPlacements.push({ ...base, id: id('placement', `${eventIndex + 1}-${itemIndex + 1}`), itemId: iid, eventId: ev.id, locationMarkerId: ev.locationMarkerId, sortKey: eventIndex * 10 + itemIndex, notes: `Present during “${ev.title}”.` }))
}

const relationshipDefs = [
  ['traveller','narrator','Friend, host, and witness','strong','positive','The narrator listens more seriously than the other guests and preserves both the story and its unresolved evidence.'],
  ['traveller','weena','Protector and companion','strong','positive','Rescue grows into mutual trust; Weena gives affection while the traveller gives protection and care.'],
  ['traveller','morlocks','Intruder and prey','strong','negative','The traveller enters the Morlocks’ domain, uses fire against them, and fights for the machine they conceal.'],
  ['traveller','eloi','Observer and guest','medium','mixed','The Eloi welcome him but frustrate his questions and fail to share his urgency or courage.'],
  ['weena','morlocks','Prey and predators','strong','negative','Weena’s fear of darkness reflects the Morlocks’ nocturnal threat to the Eloi.'],
  ['eloi','morlocks','Surface and underworld descendants','strong','negative','An ancient division of labour has become dependence, separation, and predation.'],
  ['traveller','psychologist','Inventor and experimental witness','medium','mixed','The Psychologist operates the model yet remains cautious about accepting the full account.'],
  ['narrator','psychologist','Fellow witnesses','medium','neutral','Both see the model demonstration, but the narrator remains more open to its implications.'],
]
const relationships = relationshipDefs.map(([a,b,label,strength,sentiment,description], i) => ({ ...base, id: id('relationship', String(i + 1)), characterAId: charId(a), characterBId: charId(b), label, strength, sentiment, description, isBidirectional: true, startEventId: null }))

const loreCategories = [
  ['science','Science and Time','#617384'],['future','The Future Earth','#6d775f'],['society','Evolution and Society','#826b58'],['sources','Sources and Editorial Notes','#7a6d66'],
].map(([slug,name,color], i) => ({ id: id('lore-category', slug), worldId, name, color, sortOrder: i + 1 }))
const loreDefs = [
  ['science','The Fourth Dimension','The opening argument treats time as a measurable dimension analogous to length, breadth, and thickness, then asks whether machinery could control motion along it.','finlay-1'],
  ['science','The Machine’s Controls','A pair of levers governs departure and direction. Because the traveller removes the starting lever, recovering and refitting it becomes essential inside the White Sphinx.','finlay-1'],
  ['future','The Year 802,701','The machine first stops in a warm Thames Valley transformed by long biological, architectural, and social change. The exact geography is recognisable only in broad features.','finlay-2'],
  ['future','The Further Vision','Millions of years later, the traveller sees a red sun, altered sea, giant shore creatures, cold, and darkness. The sequence expands the novel beyond human history into planetary mortality.','finlay-4'],
  ['society','Eloi and Morlocks','The traveller interprets the two peoples through Victorian class division, but revises his theory as evidence of machinery, fear, dependence, and predation accumulates. His account remains an inference, not an omniscient history.','finlay-3'],
  ['society','The Palace of Green Porcelain','The palace resembles a museum whose collections have decayed into fragments. It represents knowledge preserved physically after its systems of meaning and use have failed.','finlay-4'],
  ['sources','Text Source','Chapter order and factual checking follow the public-domain Project Gutenberg edition of The Time Machine, ebook 35. All summaries and notes here are newly written.','title-page'],
  ['sources','Illustration Sources','The cover and future-world scenes use public-domain illustrations by Norman Saunders and Virgil Finlay. Because Wells leaves most Richmond guests physically undescribed, their distinct portraits are clearly editorial public-domain period artworks rather than canonical likenesses. Every story item likewise uses its own period object, botanical, or mechanical illustration. Images are linked from Wikimedia Commons.','cover'],
  ['sources','Map Sources','The Richmond map is a 1915 environs map; the house uses a period Cambridge Cottage plan from Kew. Future markers are an editorial reconstruction based on relative movement in the novel, not canonical coordinates.','map-richmond'],
]
const lorePages = loreDefs.map(([cat,title,body,artwork], i) => ({ ...base, id: id('lore', String(i + 1)), categoryId: id('lore-category', cat), title, body, tags: [], coverImageId: imageId(artwork), linkedEntityIds: [], visibleFromEventId: null }))

const factionDefs = [
  ['dinner-circle','The Richmond Dinner Circle','#716b6b','The changing group of professionals and sceptics who hear the inventor’s claims.','title-page'],
  ['eloi','The Eloi','#a98277','The small surface people living communally among the ruins and gardens of 802,701.','finlay-2'],
  ['morlocks','The Morlocks','#636b73','The pale underground people associated with machinery, darkness, and the hidden economy of the future.','finlay-3'],
]
const factions = factionDefs.map(([slug,name,color,description,artwork]) => ({ ...base, id: factionId(slug), name, description, color, coverImageId: imageId(artwork), tags: [] }))
const membershipDefs = [
  ['dinner-circle','traveller','Host and speaker'],['dinner-circle','narrator','Recorder'],['dinner-circle','filby','Sceptic'],['dinner-circle','psychologist','Experimental witness'],['dinner-circle','medical-man','Medical witness'],['dinner-circle','mayor','Guest'],['dinner-circle','young-man','Guest'],['dinner-circle','editor','Guest'],['dinner-circle','journalist','Guest'],['dinner-circle','silent-man','Guest'],
  ['eloi','weena','Companion'],['eloi','eloi','Surface community'],['morlocks','morlocks','Underground community'],
]
const factionMemberships = membershipDefs.map(([f,c,role], i) => ({ ...base, id: id('membership', String(i + 1)), factionId: factionId(f), characterId: charId(c), role, startEventId: null, endEventId: null, notes: '' }))
const factionRelationships = [
  { ...base, id: id('faction-rel','1'), factionAId: factionId('eloi'), factionBId: factionId('morlocks'), stance: 'hostile', notes: 'Surface dependence has become a nocturnal predator-prey relationship.' },
  { ...base, id: id('faction-rel','2'), factionAId: factionId('dinner-circle'), factionBId: factionId('eloi'), stance: 'neutral', notes: 'The dinner circle knows the Eloi only through the traveller’s disputed account.' },
]

const findEvent = title => events.find(e => e.title === title).id
const factDefs = [
  ['model','The model can leave ordinary time','The tabletop model disappears when its lever is pressed.','The Model Vanishes'],
  ['arrival','The traveller reaches the year 802,701','The machine stops in a transformed Thames Valley beneath the White Sphinx.','Arrival in 802,701'],
  ['stolen','The machine is hidden in the White Sphinx','Tracks and the sealed pedestal show that intelligent hands removed it.','Tracks to the Pedestal'],
  ['two-species','Future humanity has divided into Eloi and Morlocks','The surface people and underground people are distinct descendants with different environments.','Two Human Species'],
  ['predation','The Morlocks prey upon the Eloi','Fear of darkness and underground evidence overturn the traveller’s simpler division-of-labour theory.','The Machinery Below'],
  ['fire','Morlocks fear strong light and fire','Matches repeatedly make underground attackers recoil.','Escape by Matchlight'],
  ['trap','The open sphinx is a Morlock trap','The panels close after the traveller enters to recover the machine.','The Trap Closes'],
  ['far-future','Earth continues toward planetary death','The red shore and later darkness reveal a future far beyond humanity.','The Last Eclipse'],
  ['flowers','Weena’s flowers survive the journey','The flowers in the traveller’s pocket remain as anomalous material evidence.','The Account Reaches the Dinner'],
  ['gone','The traveller disappears on a second journey','He leaves with a camera and does not return within three years.','The Final Departure'],
]
const knowledgeFacts = factDefs.map(([slug,title,description,eventTitle]) => ({ ...base, id: id('fact',slug), title, description, tags: [], readerLearnsAtEventId: findEvent(eventTitle), originEventId: findEvent(eventTitle) }))
const reveals = []
function reveal(fact, character, eventTitle, note) { reveals.push({ ...base, id: id('reveal', String(reveals.length + 1)), factId: id('fact',fact), characterId: charId(character), eventId: findEvent(eventTitle), note }) }
reveal('model','narrator','The Model Vanishes','The narrator sees the model disappear from the table.')
reveal('model','psychologist','The Model Vanishes','The Psychologist operates the lever and checks the empty space.')
reveal('arrival','traveller','Arrival in 802,701','The machine’s dials establish the destination.')
reveal('stolen','traveller','Tracks to the Pedestal','The drag marks terminate at the sealed pedestal.')
reveal('two-species','traveller','Two Human Species','Surface and underground evidence supports a divided descent.')
reveal('predation','traveller','The Machinery Below','The underworld evidence forces a darker revision of his theory.')
reveal('fire','traveller','Escape by Matchlight','The Morlocks retreat from each struck match.')
reveal('trap','traveller','The Trap Closes','The closing panels reveal why the machine was left accessible.')
reveal('far-future','traveller','The Last Eclipse','He witnesses the late planetary future directly.')
reveal('flowers','narrator','The Account Reaches the Dinner','The narrator sees and later keeps the flowers.')
reveal('gone','narrator','The Final Departure','He witnesses the machine and traveller vanish and waits in vain.')

const characterGoals = [
  ['traveller','The First Short Jump','Back to the Laboratory','want','Travel into the future, understand what humanity becomes, and return to 1895.'],
  ['traveller','The Machine Is Gone','Escape into Time','want','Recover the Time Machine from whoever concealed it.'],
  ['traveller','Weena in the River','Weena Is Lost','want','Protect Weena during exploration and the journey back to the sphinx.'],
  ['traveller','Descent into the Well','Escape by Matchlight','want','Discover how the underground people and machinery relate to the Eloi world.'],
  ['narrator','The Traveller Appears','The Flowers Remain','want','Decide what can responsibly be believed and preserve the evidence that remains.'],
  ['weena','A Bond of Flowers','The Forest Fire','want','Stay with the traveller and avoid the darkness she associates with Morlocks.'],
].map(([c,start,end,type,text], i) => ({ ...base, id: id('goal', String(i + 1)), characterId: charId(c), startEventId: findEvent(start), endEventId: findEvent(end), type, text }))

const mapRoutes = [
  { ...base, id: id('route','house'), mapLayerId: mapId('house'), name: 'The Thursday Demonstrations', routeType: 'foot', waypoints: [locId('dining-room'),locId('drawing-room'),locId('central-hall'),locId('laboratory')], color: '#6b7280', notes: 'The dinner circle moves from table to theory, model, and full machine.' },
  { ...base, id: id('route','future'), mapLayerId: mapId('future'), name: 'The Eight-Day Expedition', routeType: 'foot', waypoints: [locId('sphinx-lawn'),locId('great-hall'),locId('river-bank'),locId('well'),locId('green-palace'),locId('wood'),locId('sphinx-chamber')], color: '#8b6f55', notes: 'An editorial route based on the traveller’s relative movements; the novel supplies no measured bearings.' },
]

const data = {
  version: 16, type: 'worldbreaker-export', exportedAt: now,
  world: { id: worldId, name: 'The Time Machine', description: 'H. G. Wells’s novel follows an unnamed Victorian inventor from a sceptical Richmond dinner into the year 802,701, where the Eloi, Morlocks, ruined institutions, and a still more distant dying Earth turn technological triumph into an inquiry about class, evolution, mortality, and human tenderness.', coverImageId: imageId('cover'), theme: 'theme-scifi', readingMode: true, createdAt: now, updatedAt: now, continuityStaleThreshold: 5, calendar: { startYear: 1895, yearSuffix: '', months }, wordTarget: null },
  mapLayers, locationMarkers, characters, items, characterSnapshots, characterMovements: [], itemPlacements, locationSnapshots: [], itemSnapshots: [], relationships, relationshipSnapshots: [],
  timelines: [
    { id: frameTimelineId, worldId, name: 'The Richmond Frame', description: 'The two Thursday dinners, the testimony, the final departure, and the narrator’s three-year vigil.', color: '#70676a', dayOffset: 0, createdAt: now },
    { id: journeyTimelineId, worldId, name: 'The Journey Through Time', description: 'The traveller’s personal chronology from his laboratory departure through 802,701, the farther future, and his return.', color: '#617789', dayOffset: 0, createdAt: now },
  ],
  chapters, events, blobs, travelModes: [], timelineRelationships: [
    { ...base, id: id('timeline-rel','1'), sourceTimelineId: frameTimelineId, targetTimelineId: journeyTimelineId, type: 'frame_narrative', anchors: [{ kind: 'character', entityId: charId('traveller') }], syncPoints: [{ innerEventId: findEvent('The First Short Jump'), outerEventId: findEvent('The Condition of the Story') }, { innerEventId: findEvent('Back to the Laboratory'), outerEventId: findEvent('The Account Reaches the Dinner') }], label: 'The traveller recounts his journey', description: 'The future expedition is narrated inside the second Thursday dinner.' },
  ], crossTimelineArtifacts: [], mapRoutes, mapRegions: [], mapRegionSnapshots: [], mapAnnotations: [],
  loreCategories, lorePages, factions, factionMemberships, factionRelationships, knowledgeFacts, knowledgeReveals: reveals, characterGoals, sceneTexts: [], plotThreads, motifs, continuitySuppressions: [], writingLogs: [], sceneRevisions: [],
}

const allIds = new Map()
for (const [collectionName, rows] of Object.entries(data)) if (Array.isArray(rows)) for (const row of rows) if (row.id) {
  if (allIds.has(row.id)) throw new Error(`Duplicate id ${row.id} in ${collectionName} and ${allIds.get(row.id)}`)
  allIds.set(row.id, collectionName)
}
const refSet = rows => new Set(rows.map(row => row.id))
const assertRef = (value, rows, label) => { if (value != null && !refSet(rows).has(value)) throw new Error(`${label}: missing ${value}`) }
for (const layer of mapLayers) { assertRef(layer.parentMapId, mapLayers, `${layer.id}.parentMapId`); assertRef(layer.imageId, blobs, `${layer.id}.imageId`) }
for (const marker of locationMarkers) { assertRef(marker.mapLayerId, mapLayers, `${marker.id}.mapLayerId`); assertRef(marker.linkedMapLayerId, mapLayers, `${marker.id}.linkedMapLayerId`); assertRef(marker.imageId, blobs, `${marker.id}.imageId`); const layer = mapLayers.find(m => m.id === marker.mapLayerId); if (marker.x < 0 || marker.x > layer.imageWidth || marker.y < 0 || marker.y > layer.imageHeight) throw new Error(`${marker.id}: out of bounds`) }
for (const ev of events) { assertRef(ev.chapterId, chapters, `${ev.id}.chapterId`); assertRef(ev.timelineId, data.timelines, `${ev.id}.timelineId`); assertRef(ev.locationMarkerId, locationMarkers, `${ev.id}.location`); ev.involvedCharacterIds.forEach(v => assertRef(v,characters,`${ev.id}.character`)); ev.involvedItemIds.forEach(v => assertRef(v,items,`${ev.id}.item`)); ev.threadIds.forEach(v => assertRef(v,plotThreads,`${ev.id}.thread`)); ev.motifIds.forEach(v => assertRef(v,motifs,`${ev.id}.motif`)); if (ev.tension < 1 || ev.tension > 5) throw new Error(`${ev.id}: tension`); if (ev.travelDays != null && ev.travelDays < 0) throw new Error(`${ev.id}: negative elapsed time`) }
for (const snapshot of characterSnapshots) { assertRef(snapshot.characterId,characters,`${snapshot.id}.character`); assertRef(snapshot.eventId,events,`${snapshot.id}.event`); assertRef(snapshot.currentLocationMarkerId,locationMarkers,`${snapshot.id}.location`); const ev = events.find(e => e.id === snapshot.eventId); if (!ev.involvedCharacterIds.includes(snapshot.characterId)) throw new Error(`${snapshot.id}: snapshot for absent character`) }
if (chapters.length !== 17 || new Set(events.map(e => e.chapterId)).size !== 17) throw new Error('Every chapter must contain events')
if (new Set(characterSnapshots.map(s => s.statusNotes)).size !== characterSnapshots.length) throw new Error('Character status notes must be event-specific')
for (const submap of mapLayers.filter(m => m.parentMapId)) if (!locationMarkers.some(l => l.linkedMapLayerId === submap.id)) throw new Error(`${submap.id}: no parent entrance`)
for (const ev of events) { const snapIds = characterSnapshots.filter(s => s.eventId === ev.id).map(s => s.characterId).sort(); if (JSON.stringify(snapIds) !== JSON.stringify([...ev.involvedCharacterIds].sort())) throw new Error(`${ev.id}: snapshot presence mismatch`) }

const text = JSON.stringify(data, null, 2) + '\n'
fs.writeFileSync('example/The Time Machine.pwk', text)
fs.writeFileSync('public/library/the-time-machine.pwk', text)
console.log(JSON.stringify({ chapters: chapters.length, events: events.length, characters: characters.length, maps: mapLayers.length, locations: locationMarkers.length, items: items.length, snapshots: characterSnapshots.length, facts: knowledgeFacts.length }, null, 2))
