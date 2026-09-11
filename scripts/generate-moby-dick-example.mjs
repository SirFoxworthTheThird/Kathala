import fs from 'node:fs'

const P='moby-dick', worldId=`${P}-world`, now=1788480000000
const base={worldId,createdAt:now,updatedAt:now}
const id=(kind,slug)=>`${P}-${kind}-${slug}`
const I=s=>id('image',s), C=s=>id('character',s), L=s=>id('location',s), M=s=>id('map',s)
const Ch=n=>id('chapter',String(n).padStart(3,'0')), EV=n=>id('event',String(n).padStart(3,'0'))
const Item=s=>id('item',s), T=s=>id('thread',s), O=s=>id('motif',s), F=s=>id('faction',s), K=s=>id('fact',s), R=s=>id('relationship',s)
const asset=(slug,url,mimeType='image/png')=>({...base,id:I(slug),mimeType,url})

const chapterText=`
Loomings|Ishmael answers a recurring need for the sea by setting out for a whaling port rather than remaining ashore.
The Carpet-Bag|A late arrival in New Bedford leaves Ishmael searching for inexpensive lodging before the Nantucket packet sails.
The Spouter-Inn|At Peter Coffin's inn, Ishmael studies strange maritime relics and reluctantly agrees to share a bed with an absent harpooneer.
The Counterpane|Ishmael wakes beside Queequeg, and alarm gives way to the first practical accommodations of trust.
Breakfast|The inn's intimidating sailors eat in silence while Queequeg's composure unsettles Ishmael's assumptions.
The Street|New Bedford's whaling wealth, polyglot crowds, and harsh winter reveal how completely the town faces the sea.
The Chapel|Ishmael and Queequeg enter the Whaleman's Chapel, where memorial tablets make the cost of the trade immediate.
The Pulpit|Father Mapple climbs a rope ladder into a pulpit shaped like a ship's bow and isolates himself above the congregation.
The Sermon|Mapple retells Jonah's flight and return as a demand to speak difficult truth without seeking comfort.
A Bosom Friend|Ishmael abandons inherited prejudice and accepts Queequeg's friendship as the two share tobacco and vows.
Nightgown|A warm room and frank conversation deepen the new companions' intimacy before their journey.
Biographical|Queequeg recounts his royal origin, departure from Rokovoko, and determination to learn the wider world's ways.
Wheelbarrow|Queequeg answers ridicule with restraint, then saves a mocking passenger when the packet is struck by a squall.
Nantucket|The companions reach the sandy island whose ships and sailors range across the world's oceans.
Chowder|At the Try Pots, clam and cod chowder restore the travelers before they seek a berth.
The Ship|Ishmael inspects the Pequod and bargains with Peleg and Bildad for his lay in the voyage.
The Ramadan|Queequeg's prolonged religious observance alarms Ishmael, who waits until the ritual ends without forcing entry.
His Mark|Peleg and Bildad test Queequeg's skill and accept his mark on the ship's articles.
The Prophet|Elijah delivers an obscure warning about Ahab and the fate awaiting those who sail with him.
All Astir|The Pequod takes on provisions while mysterious men and contradictory rumors sharpen Ishmael's unease.
Going Aboard|Before dawn Ishmael and Queequeg board and glimpse shadowy sailors slipping aboard ahead of them.
Merry Christmas|The Pequod leaves Nantucket on Christmas Day as Peleg and Bildad relinquish command to the officers.
The Lee Shore|Ishmael remembers Bulkington as a man who chooses the perilous open sea over the safety of a lee shore.
The Advocate|Ishmael defends whaling as dangerous, global labor too easily dismissed by those who benefit from it.
Postscript|The narrator adds ceremonial evidence that whale oil reaches even the crowns and rituals of monarchs.
Knights and Squires|Starbuck, Stubb, and Flask emerge as three sharply different mates entrusted with the whale boats.
Knights and Squires|Queequeg, Tashtego, and Daggoo are introduced as the harpooneers paired with the three mates.
Ahab|After days below, Ahab finally stands on deck, marked by a scar and balanced on an ivory leg.
Enter Ahab; to Him, Stubb|Stubb's attempt to soften the captain's restless pacing earns a humiliating rebuke.
The Pipe|Ahab finds that the pipe offers no peace and throws it away, rejecting ordinary consolation.
Queen Mab|Stubb turns his encounter with Ahab into a comic dream, protecting his spirits through interpretation.
Cetology|Ishmael builds an openly provisional classification of whales and exposes the limits of tidy systems.
The Specksnyder|The old authority of harpooneers helps explain the private command Ahab exercises beyond formal rank.
The Cabin-Table|The officers' rigid dining order gives way to the harpooneers' noisy ease after the mates leave the cabin.
The Mast-Head|Ishmael recalls the dreamy dangers of lookout duty, where contemplation can dissolve practical attention.
The Quarter-Deck|Ahab nails a gold doubloon to the mast and binds the crew to his private hunt for the white whale.
Sunset|Alone after the oath, Ahab names the suffering that has hardened his will against the world.
Dusk|Starbuck recognizes the voyage's blasphemous danger but cannot yet oppose the captain who commands it.
First Night-Watch|Stubb answers dread with song and laughter while the ship's new purpose settles over the watch.
Midnight, Forecastle|The multinational crew sings, boasts, quarrels, and dances before a squall drives them back to work.
Moby Dick|Ishmael explains Ahab's maiming and the way the captain has made one whale the agent of every hidden evil.
The Whiteness of the Whale|The narrator examines how whiteness can signify holiness, emptiness, and terror at once.
Hark!|Archy hears concealed human sounds below deck, but Cabaco dismisses the evidence.
The Chart|Ahab studies years of whale sightings and currents to predict where Moby Dick may surface.
The Affidavit|Ishmael assembles testimony that individual whales can be recognized and survive repeated encounters.
Surmises|Ahab preserves the appearance of ordinary whaling so the crew will continue to support his true objective.
The Mat-Maker|Ishmael and Queequeg weave a sword-mat until Tashtego's cry turns meditation into immediate pursuit.
The First Lowering|The first chase reveals Ahab's hidden boat crew and ends with Starbuck's boat overturned in darkness.
The Hyena|Back aboard, Ishmael confronts the voyage's casual proximity to death and adds Queequeg to his will.
Ahab's Boat and Crew. Fedallah.|Ahab's secret preparations and Fedallah's uncanny influence take visible form in the fourth boat.
The Spirit-Spout|A distant midnight spout repeatedly lures the Pequod onward while Ahab keeps solitary watch.
The Albatross|A weathered homeward ship fails to answer before the wind tears away its speaking trumpet.
The Gam|Ishmael explains the social ritual by which whaling ships exchange news while crews visit across the water.
The Town-Ho's Story|Ishmael relates how Radney's cruelty, Steelkilt's mutiny, and Moby Dick's intervention converge aboard another ship.
Of the Monstrous Pictures of Whales|The narrator catalogs inaccurate whale images whose errors grow as artists copy one another.
Of the Less Erroneous Pictures of Whales, and the True Pictures of Whaling Scenes|Ishmael distinguishes plausible depictions from the few works grounded in direct whaling experience.
Of Whales in Paint; in Teeth; in Wood; in Sheet-Iron; in Stone; in Mountains; in Stars|Whale forms spread across scrimshaw, signs, landscapes, and constellations wherever human imagination looks.
Brit|A living field of minute sea life supports immense whales and turns the ocean surface into a pastoral feeding ground.
Squid|The crew encounters a giant white squid whose ghostly shape may signal sperm whales nearby.
The Line|Ishmael describes the lethal order of the whale line coiled in every boat and the discipline required around it.
Stubb Kills a Whale|Stubb's boat completes a long pursuit, and the mate smokes calmly beside the dying sperm whale.
The Dart|The narrator argues that exhausting a harpooneer at the oar undermines the decisive throw demanded at the chase's end.
The Crotch|The simple notched support for spare harpoons becomes another example of the boat's dangerous precision.
Stubb's Supper|Stubb eats steak cut from the whale while forcing Fleece to preach unsuccessfully to the circling sharks.
The Whale as a Dish|Ishmael considers the rarity, excess, and moral discomfort of humans eating the animal they hunt.
The Shark Massacre|Queequeg and the crew drive back sharks feeding on the secured carcass through the night.
Cutting In|The crew strips the whale's blubber in a continuous spiral while the ship becomes a working factory.
The Blanket|Ishmael studies the whale's patterned skin and the insulating layer that protects its immense warmth.
The Funeral|The stripped carcass drifts away as a scavenged, unrecognized monument on the sea.
The Sphynx|Ahab questions the severed whale head for cosmic knowledge and receives only silence.
The Jeroboam's Story|A quarantined ship reports the prophet Gabriel's power and Moby Dick's destruction of its mate.
The Monkey-Rope|Ishmael tends Queequeg's safety line and feels their lives made literally dependent on one another.
Stubb and Flask Kill a Right Whale; and Then Have a Talk over Him|The mates secure a right whale head to balance the sperm whale head and speculate about Fedallah's hold on Ahab.
The Sperm Whale's Head—Contrasted View|Ishmael examines the sperm whale's head as a blind fortress organized around sound and force.
The Right Whale's Head—Contrasted View|The second head presents a different mouth, feeding system, and symbolic expression.
The Battering-Ram|The sperm whale's blunt brow becomes a living engine whose apparent softness conceals enormous momentum.
The Great Heidelburgh Tun|Ishmael enters the vast internal reservoir of spermaceti housed within the whale's head.
Cistern and Buckets|Tashtego falls into the sinking head, and Queequeg cuts through the side to rescue him.
The Prairie|The whale's nearly featureless brow invites a physiognomy built from vastness rather than human features.
The Nut|The small, complex whale brain complicates any easy measure of intelligence by bodily proportion.
The Pequod Meets The Virgin|After assisting an inexperienced German ship, the Pequod wins the chase for an old, sinking sperm whale.
The Honor and Glory of Whaling|Ishmael recruits heroes, gods, and saints into an extravagant ancestral fellowship of whalers.
Jonah Historically Regarded|The narrator answers practical objections to Jonah's voyage without reducing its spiritual force.
Pitchpoling|Tashtego demonstrates the long, high throw of a lance used after the harpoon has fastened.
The Fountain|Ishmael weighs evidence about whether the whale's spout is water, vapor, or something not safely observed.
The Tail|The whale's flukes become an anatomy of power, grace, communication, and unknowable intention.
The Grand Armada|Among the Sunda islands, the Pequod enters a vast herd and the boats reach a calm nursery inside its defensive circle.
Schools and Schoolmasters|Ishmael distinguishes female whale schools led by one bull from roaming groups of young males.
Fast-Fish and Loose-Fish|Whaling law about possession expands into a satire on conquest, ownership, and political power.
Heads or Tails|A dispute over a whale claimed by the Duke of Albany shows how law divides valuable parts from labor.
The Pequod Meets The Rose-Bud|Stubb tricks a foul-smelling French ship into abandoning a carcass that hides precious ambergris.
Ambergris|The fragrant substance found in decay lets Ishmael challenge the assumption that whalers and whales must smell foul.
The Castaway|Pip is abandoned during a lowering, survives alone in the sea, and returns with his mind permanently altered.
A Squeeze of the Hand|The crew kneads cooling spermaceti together, and fellowship briefly replaces the ship's violence.
The Cassock|The mincer prepares the whale's black outer tissue as protective clothing for the labor at the try-works.
The Try-Works|At night the blazing furnaces transform blubber into oil and make the Pequod resemble a ship sailing out of ruin.
The Lamp|Abundant whale oil gives the crew clean light even as their labor feeds distant households.
Stowing Down and Clearing Up|The processed oil is sealed below and the scrubbed ship resumes its deceptive appearance of order.
The Doubloon|Ahab, Starbuck, Stubb, Flask, the harpooneers, and Pip read radically different worlds in the same nailed coin.
Leg and Arm|Captain Boomer describes losing an arm to Moby Dick but refuses Ahab's invitation to turn injury into revenge.
The Decanter|The convivial discipline aboard the Samuel Enderby offers a social contrast to Ahab's isolated command.
A Bower in the Arsacides|Ishmael recalls measuring a whale skeleton preserved as a sacred grove on a Pacific island.
Measurement of The Whale's Skeleton|The narrator converts the remembered skeleton into proportions while admitting what bare bones omit.
The Fossil Whale|Whale remains open a geological scale of time that dwarfs recorded human history.
Does the Whale's Magnitude Diminish?—Will He Perish?|Ishmael rejects claims that whales are shrinking or nearing extinction despite expanding human pursuit.
Ahab's Leg|Damage to Ahab's ivory leg forces him to seek the carpenter's practical skill.
The Carpenter|The ship's carpenter appears as an adaptable maker whose competence carries little interest in metaphysics.
Ahab and the Carpenter|Ahab demands a new leg while mocking the craftsman and imagining a body remade beyond pain.
Ahab and Starbuck in the Cabin|Starbuck reports leaking oil casks and wins a temporary order to stop, despite Ahab's armed resistance.
Queequeg in His Coffin|Queequeg falls gravely ill, commissions a coffin, then chooses to recover when he remembers unfinished duties.
The Pacific|The ship enters seemingly peaceful waters that pull Ishmael toward home even as Ahab closes on his quarry.
The Blacksmith|Perth's ruined domestic life and hard labor make him a craftsman suited to Ahab's final weapon.
The Forge|Ahab has Perth weld a special harpoon and tempers it through a private ritual with the harpooneers.
The Gilder|A golden calm illuminates the crew's longings but cannot arrest the voyage's narrowing course.
The Pequod Meets The Bachelor|A successful whaler sails home in celebration, and Ahab rejects its invitation to join the feast.
The Dying Whale|A dying sperm whale turns toward the setting sun, giving its final motion an ambiguous dignity.
The Whale Watch|Fedallah and Ahab keep watch among dead whales, and Fedallah gives the captain a double prophecy of death.
The Quadrant|Ahab destroys the instrument that can tell latitude but cannot point directly toward Moby Dick.
The Candles|A typhoon crowns the masts with electrical fire, and Ahab turns the crew's terror into renewed allegiance.
The Deck Towards the End of the First Night Watch|Starbuck urges Ahab to shorten sail while the captain treats the storm as a test of command.
Midnight.—The Forecastle Bulwarks|Stubb and Flask struggle with anchors and debate whether resistance to Ahab is still possible.
Midnight Aloft.—Thunder and Lightning|Tashtego works high in the rigging as lightning makes every task immediately mortal.
The Musket|Starbuck finds Ahab asleep and considers killing him, but conscience prevents the act.
The Needle|Ahab discovers the lightning has reversed the compasses and makes new needles to preserve his authority.
The Log and Line|The rotten log line fails, and Pip's plea to hold the line exposes the captain's shrinking human connection.
The Life-Buoy|After a sailor falls to his death, Queequeg's unused coffin is transformed into a replacement life-buoy.
The Deck|Ahab recognizes the coffin in its new role while the carpenter calmly seals it for the sea.
The Pequod Meets The Rachel|Captain Gardiner begs Ahab to help search for a missing boat containing his son, but Ahab refuses.
The Cabin|Pip clings to Ahab, whose tenderness cannot overcome his decision to pursue the whale alone.
The Hat|A sea hawk steals Ahab's hat as the ship drives onward beneath accumulating omens.
The Pequod Meets The Delight|A ship damaged by Moby Dick carries a fresh burial past the Pequod and warns what lies ahead.
The Symphony|Ahab and Starbuck share a final calm appeal to home and family before the captain submits again to the chase.
The Chase—First Day|Moby Dick smashes Ahab's boat, and the captain returns to the Pequod more determined after his first defeat.
The Chase—Second Day|The whale wrecks the boats again, Fedallah disappears, and Ahab interprets disaster as confirmation.
The Chase.—Third Day|Ahab attacks once more; Moby Dick sinks the Pequod, the line kills Ahab, and the vortex takes the crew.
Epilogue|Ishmael survives on Queequeg's coffin until the Rachel, still searching for her lost, finds him.
`.trim().split('\n').map(line=>{const at=line.indexOf('|');return{title:line.slice(0,at),summary:line.slice(at+1)}})

if(chapterText.length!==136)throw new Error(`Expected 136 reading units, got ${chapterText.length}`)

const imageRows=[
 ['world','library/moby-dick/art/world.png'],['map-world','library/moby-dick/maps/world-voyage.png'],['map-new-england','library/moby-dick/maps/new-england.png'],['map-deck','library/moby-dick/maps/pequod-deck.png'],['map-below','library/moby-dick/maps/pequod-below-decks.png'],
 ...['ishmael','queequeg','ahab','starbuck','stubb','flask','tashtego','daggoo','pip','fedallah','peleg','bildad','mapple','elijah','boomer','gardiner','moby-dick','fleece','gabriel','perth','carpenter'].map(s=>[`character-${s}`,`library/moby-dick/art/characters/${s}.png`]),
 ...['carpet-bag','queequeg-harpoon','articles','doubloon','ahab-chart','whale-line','ahab-harpoon','quadrant','compass','queequeg-coffin','oil-casks','pip-tambourine'].map(s=>[`item-${s}`,`library/moby-dick/art/items/${s}.png`]),
 ...['new-england-gate','pequod-gate','azores','cape','indian','sunda','japan','final-pacific','new-bedford','spouter','chapel','nantucket','try-pots','nantucket-wharf','quarterdeck','main-deck','tryworks','forecastle','masthead','whaleboats','companionway','ahab-cabin','cabin-table','crew-berths','oil-hold','blubber-room'].map(s=>[`location-${s}`,`library/moby-dick/art/locations/${s}.png`]),
 ...['owners','officers','harpooneers','crew'].map(s=>[`faction-${s}`,`library/moby-dick/art/factions/${s}.png`]),
]
const blobs=imageRows.map(([slug,url])=>asset(slug,url))

const maps=[
 {...base,id:M('world'),parentMapId:null,name:'The Pequod’s World Voyage',description:'A period ocean chart following the Pequod from New England around the Cape of Good Hope and across the Indian and Pacific oceans.',imageId:I('map-world'),imageWidth:1536,imageHeight:1024,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
 {...base,id:M('new-england'),parentMapId:M('world'),name:'New Bedford and Nantucket',description:'The Massachusetts coast linking Ishmael’s winter arrival in New Bedford with the Nantucket harbor from which the Pequod sails.',imageId:I('map-new-england'),imageWidth:1536,imageHeight:1024,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
 {...base,id:M('deck'),parentMapId:M('world'),name:'Pequod — Weather Deck',description:'The exposed working deck of the Nantucket whaleship, from Ahab’s quarterdeck to the forecastle and bow.',imageId:I('map-deck'),imageWidth:1792,imageHeight:896,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:'pequod-levels',levelIndex:1,levelLabel:'Weather Deck'},
 {...base,id:M('below'),parentMapId:M('deck'),name:'Pequod — Below Decks',description:'The cramped cabins, berths, working spaces, and oil hold beneath the Pequod’s weather deck.',imageId:I('map-below'),imageWidth:1792,imageHeight:896,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:'pequod-levels',levelIndex:0,levelLabel:'Below Decks'},
]

const locRows=[
 ['new-england-gate','world','New Bedford and Nantucket','The Massachusetts whaling ports where Ishmael finds Queequeg, signs the Pequod’s articles, and begins the voyage.','new-england',420,335,'city'],
 ['pequod-gate','world','The Pequod’s Voyage','The moving whaling ship that becomes the crew’s entire world as it crosses toward the Pacific.','deck',500,360,'ship'],
 ['azores','world','Azores Waters','North Atlantic waters where the voyage settles into the habits of lookout, pursuit, and Ahab’s hidden purpose.',null,575,365,'region'],
 ['cape','world','Cape of Good Hope','Stormy southern waters turning the voyage from the Atlantic toward the Indian Ocean.',null,748,733,'region'],
 ['indian','world','Indian Ocean','Warm whaling grounds crossed through gams, hunts, and the growing pressure of Ahab’s search.',null,925,620,'region'],
 ['sunda','world','Sunda Strait','Crowded island waters where the boats enter the calm center of the Grand Armada.',null,1090,590,'region'],
 ['japan','world','Japan Grounds','Productive northern Pacific whaling grounds near the track Ahab expects Moby Dick to follow.',null,1190,385,'region'],
 ['final-pacific','world','Equatorial Pacific','The remote Pacific hunting ground where the three-day chase reaches the Pequod.',null,1420,520,'region'],
 ['new-bedford','new-england','New Bedford','A prosperous mainland whaling port of inns, chandlers, memorials, and ships preparing for long voyages.',null,303,375,'city'],
 ['spouter','new-england','The Spouter-Inn','Peter Coffin’s crowded waterfront inn, hung with a nearly unreadable whale painting and maritime curiosities.',null,270,405,'building'],
 ['chapel','new-england','Whaleman’s Chapel','A sober chapel whose tablets commemorate sailors lost at sea and whose prow-shaped pulpit faces the congregation.',null,290,340,'building'],
 ['nantucket','new-england','Nantucket Town','The sandy island town whose outward-looking merchants and sailors sustain a worldwide whaling fleet.',null,1190,790,'city'],
 ['try-pots','new-england','The Try Pots','A Nantucket inn marked by hanging iron pots, remembered for chowder and the companionship before departure.',null,1155,745,'building'],
 ['nantucket-wharf','new-england','Nantucket Wharf','The harbor edge where the Pequod is fitted, provisioned, signed, and finally released to sea.',null,1120,710,'landmark'],
 ['quarterdeck','deck','Quarterdeck','Ahab’s elevated station of command, where the doubloon, oath, compass, and final decisions shape the voyage.',null,285,445,'landmark'],
 ['main-deck','deck','Main Deck','The central working deck where whales are cut in, watches change, and the crew gathers under Ahab’s eye.',null,850,445,'landmark'],
 ['tryworks','deck','Try-Works','Twin brick furnaces amidships where blubber is rendered through the night into clear oil.',null,1030,465,'landmark'],
 ['forecastle','deck','Forecastle','The forward deck and crew space where songs, arguments, labor, and midnight watches reveal the ship below its officers.',null,1440,450,'landmark'],
 ['masthead','deck','Mastheads','High lookout platforms where sailors scan empty horizons and risk losing themselves in contemplation.',null,880,190,'landmark'],
 ['whaleboats','deck','Whaleboat Davits','The light open boats hung along the rails and lowered into the immediate danger of a hunt.',null,820,715,'landmark'],
 ['companionway','deck','Cabin Companionway','The narrow stair from the quarterdeck into the officers’ and captain’s rooms below.','below',470,430,'landmark'],
 ['ahab-cabin','below','Ahab’s Cabin','A stern cabin of charts and instruments where command narrows into private calculation and rare moments of tenderness.',null,285,445,'room'],
 ['cabin-table','below','Cabin Table','The officers’ ordered dining space, governed by rank until the harpooneers inherit it with easier appetites.',null,490,350,'room'],
 ['crew-berths','below','Crew Berths','Tiered bunks in the forward ship where exhausted sailors sleep close to the labor and noise of the voyage.',null,1410,450,'room'],
 ['oil-hold','below','Oil Hold','Rows of casks below the waterline where rendered oil is stored and where dangerous leaks must be found.',null,1110,430,'room'],
 ['blubber-room','below','Blubber Room','A low working compartment for cutting and preparing the whale’s blanket before rendering.',null,790,450,'room'],
]
const locations=locRows.map(([slug,map,name,description,linked,x,displayY,iconType])=>{const layer=maps.find(m=>m.id===M(map));return{...base,id:L(slug),mapLayerId:M(map),linkedMapLayerId:linked?M(linked):null,name,description,x,y:layer.imageHeight-displayY,imageId:I(`location-${slug}`),iconType,tags:[],factionId:null}})

const charRows=[
 ['ishmael','Ishmael','The reflective sailor and sole narrator whose search for sea air becomes a witness to Ahab’s final voyage.'],['queequeg','Queequeg','A royal-born Polynesian harpooneer whose skill, dignity, and friendship repeatedly save Ishmael.'],['ahab','Captain Ahab','The Pequod’s scarred captain, consumed by the belief that Moby Dick embodies the hostile force behind appearances.'],['starbuck','Starbuck','The conscientious Quaker first mate who understands Ahab’s madness but cannot turn recognition into decisive resistance.'],['stubb','Stubb','The humorous second mate, whose pipe, jokes, and practical courage keep terror at conversational distance.'],['flask','Flask','The compact, energetic third mate who treats whales as adversaries without metaphysical weight.'],['tashtego','Tashtego','An Aquinnah Wampanoag harpooneer of exceptional speed and balance, paired with Stubb.'],['daggoo','Daggoo','A towering African harpooneer whose composure and power make him Flask’s indispensable boat-steerer.'],['pip','Pip','A young Alabama cabin boy whose abandonment at sea breaks his ordinary relation to the crew and draws Ahab’s compassion.'],['fedallah','Fedallah','Ahab’s secret Parsee harpooneer and prophetic shadow, concealed aboard until the first lowering.'],['peleg','Captain Peleg','A bluff Quaker shipowner who bargains hard yet understands the danger of the command he gives Ahab.'],['bildad','Captain Bildad','An austere Quaker owner who combines religious severity with exacting commercial terms.'],['mapple','Father Mapple','A former harpooneer whose sermon on Jonah frames truth as obedience without comfort.'],['elijah','Elijah','A ragged Nantucket prophet whose warnings remain obscure until the voyage fulfills them.'],['boomer','Captain Boomer','The genial one-armed captain of the Samuel Enderby who survived Moby Dick without making vengeance his life.'],['gardiner','Captain Gardiner','The Rachel’s captain, searching the Pacific for a missing whale boat carrying his young son.'],['moby-dick','Moby Dick','The immense scarred white sperm whale pursued by Ahab and known across the Pacific by crews who survived him.'],['fleece','Fleece','The Pequod’s elderly cook, ordered by Stubb to address sharks that answer appetite more readily than sermons.'],['gabriel','Gabriel','A fervent sailor-prophet aboard the Jeroboam whose influence survives a fatal encounter with Moby Dick.'],['perth','Perth','The Pequod’s blacksmith, a ruined craftsman who gives Ahab’s final weapon its material form.'],['carpenter','The Carpenter','The ship’s practical, emotionally detached maker of legs, coffins, repairs, and the life-buoy.'],
]
const characters=charRows.map(([slug,name,description],i)=>({...base,id:C(slug),name,aliases:[],description,portraitImageId:I(`character-${slug}`),color:['#64798a','#8b6749','#5a6678','#78846c','#8c6c50','#80604c'][i%6],tags:[],isAlive:true,birthDate:null}))

const itemRows=[
 ['carpet-bag','Ishmael’s Carpet-Bag','The modest traveling bag carried from the road into New Bedford and onward toward Nantucket.','container'],['queequeg-harpoon','Queequeg’s Harpoon','The barbed iron that advertises Queequeg’s trade before Ishmael understands the man who carries it.','weapon'],['articles','Pequod’s Articles','The contract assigning each sailor a fractional lay of the voyage’s eventual proceeds.','document'],['doubloon','Ecuadorian Doubloon','A gold coin nailed to the mast as reward and later interpreted by nearly every principal sailor.','treasure'],['ahab-chart','Ahab’s Whale Chart','Layered records of currents, seasons, sightings, and routes used to anticipate Moby Dick.','document'],['whale-line','Whale Line','Carefully coiled hemp that connects boat, harpoon, whale, and every sailor standing inside its dangerous geometry.','tool'],['ahab-harpoon','Ahab’s Forged Harpoon','A specially welded weapon reserved for the final encounter and consecrated by Ahab’s private ritual.','weapon'],['quadrant','Ahab’s Quadrant','A navigational instrument destroyed when its limited answers no longer satisfy the captain.','tool'],['compass','Pequod’s Compass Needles','Needles reversed by lightning and remade by Ahab to preserve the voyage’s direction and his authority.','tool'],['queequeg-coffin','Queequeg’s Coffin','A carved coffin commissioned during illness, converted into a life-buoy, and finally made Ishmael’s raft.','container'],['oil-casks','Sperm-Oil Casks','Sealed barrels holding the voyage’s commercial purpose beneath Ahab’s private hunt.','cargo'],['pip-tambourine','Pip’s Tambourine','The small instrument associated with Pip’s place among the crew before his abandonment changes him.','instrument'],
]
const items=itemRows.map(([slug,name,description,type])=>({...base,id:Item(slug),name,description,type,imageId:I(`item-${slug}`),tags:[]}))

const timelineId=id('timeline','voyage')
const chapters=chapterText.map((c,i)=>({...base,id:Ch(i+1),timelineId,number:i+1,title:c.title,summary:c.summary,status:'final',targetWordCount:null}))
const locationFor=n=> n<=1?'new-bedford':n===2||n<=5?'spouter':n===6?'new-bedford':n<=9?'chapel':n<=13?'spouter':n===14?'nantucket':n===15?'try-pots':n<=21?'nantucket-wharf':n===22?'quarterdeck':n===30||n===34||n===44||n===109||n===129?'ahab-cabin':n===31||n===40||n===54||n===121?'forecastle':n===35||n===122||n===130?'masthead':n===43||n===97||n===110?'crew-berths':n===96?'tryworks':n===98?'oil-hold':n===102||n===103||n===104||n===105?'blubber-room':n===48||n===51||n===52||n===58||n===59||n===60||n===61||n===62||n===63||n===71||n===73||n===81||n===87||n===91||n===93||n===100||n===115||n===116||n===117||n===128||n===131?'whaleboats':n>=133?'final-pacific':n===136?'final-pacific':'main-deck'
const specificCast={1:['ishmael'],2:['ishmael'],3:['ishmael','queequeg'],4:['ishmael','queequeg'],5:['ishmael','queequeg'],7:['ishmael','queequeg'],8:['ishmael','queequeg','mapple'],9:['ishmael','queequeg','mapple'],10:['ishmael','queequeg'],12:['ishmael','queequeg'],13:['ishmael','queequeg'],16:['ishmael','queequeg','peleg','bildad'],17:['ishmael','queequeg'],18:['ishmael','queequeg','peleg','bildad'],19:['ishmael','queequeg','elijah'],20:['ishmael','queequeg','peleg','bildad'],21:['ishmael','queequeg','elijah'],22:['ishmael','queequeg','peleg','bildad','starbuck','stubb','flask'],26:['ishmael','starbuck','stubb','flask'],27:['ishmael','queequeg','starbuck','stubb','flask','tashtego','daggoo'],28:['ishmael','ahab'],29:['ahab','stubb'],30:['ahab'],31:['stubb'],34:['ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo'],36:['ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo'],37:['ahab'],38:['starbuck'],39:['stubb'],40:['stubb','flask','queequeg','tashtego','daggoo','pip'],43:['tashtego'],44:['ahab'],47:['ishmael','queequeg'],48:['ishmael','ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo','fedallah'],49:['ishmael','queequeg'],50:['ahab','fedallah'],51:['ahab','fedallah'],52:['ahab'],54:['ishmael','stubb'],59:['ishmael','starbuck','stubb','flask'],61:['stubb','tashtego'],64:['stubb','fleece'],66:['queequeg'],70:['ahab'],71:['ahab','starbuck','gabriel'],72:['ishmael','queequeg'],73:['stubb','flask','tashtego','daggoo'],78:['tashtego','queequeg'],81:['ahab','starbuck','stubb','flask','queequeg'],87:['ishmael','ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo'],91:['stubb'],93:['pip','stubb'],94:['ishmael','queequeg','starbuck','stubb','flask','tashtego','daggoo'],99:['ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo','pip'],100:['ahab','boomer'],106:['ahab'],108:['ahab'],109:['ahab','starbuck'],110:['queequeg','ishmael','starbuck'],112:['perth'],113:['ahab','perth','queequeg','tashtego','daggoo'],115:['ahab'],117:['ahab','fedallah'],118:['ahab'],119:['ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo','fedallah'],120:['ahab','starbuck'],121:['stubb','flask'],122:['tashtego'],123:['starbuck','ahab'],124:['ahab','starbuck'],125:['ahab','pip'],126:['ishmael','queequeg'],127:['ahab','carpenter'],128:['ahab','gardiner'],129:['ahab','pip'],130:['ahab'],131:['ahab','starbuck'],132:['ahab','starbuck'],133:['ishmael','ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo','fedallah','moby-dick'],134:['ishmael','ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo','fedallah','moby-dick'],135:['ishmael','ahab','starbuck','stubb','flask','queequeg','tashtego','daggoo','pip','moby-dick'],136:['ishmael']}
const castFor=n=>specificCast[n]??(n>=23?['ishmael']:['ishmael','queequeg'])
const seaDay=n=> n<=22?Math.max(0,n-1):22+Math.round((n-22)*2.55)
const events=chapterText.map((c,i)=>{const n=i+1,cast=castFor(n);return{...base,id:EV(n),chapterId:Ch(n),timelineId,title:c.title,description:c.summary,locationMarkerId:L(locationFor(n)),involvedCharacterIds:cast.map(C),mentionedCharacterIds:[],involvedItemIds:[],tags:[],sortOrder:0,travelDays:n===1?0:Math.max(0,seaDay(n)-seaDay(n-1)),inWorldTime:seaDay(n),tension:n>=133?5:[36,48,78,87,93,109,110,119,123,128,131,132].includes(n)?4:[9,19,28,41,44,61,71,81,96,100,113,117,118,126].includes(n)?3:2,structureBeat:null,threadIds:[],motifIds:[],status:'final',povCharacterId:C('ishmael'),isFlashback:false}})

const roleAt=(slug,n,summary)=>{
 const lead={ishmael:'Observes and records',queequeg:'Meets the moment with practiced resolve as',ahab:'Drives his command through',starbuck:'Measures duty against conscience while',stubb:'Uses humor and seamanship while',flask:'Acts with blunt practical energy as',tashtego:'Applies a harpooneer’s speed and balance as',daggoo:'Brings steady physical authority as',pip:'Responds with exposed sensitivity as',fedallah:'Shadows Ahab’s purpose as',peleg:'Protects the owners’ bargain as',bildad:'Applies severe commercial faith as',mapple:'Preaches hard obedience through',elijah:'Warns without explaining as',boomer:'Answers injury without obsession as',gardiner:'Places his missing son above all other aims as','moby-dick':'Moves as an autonomous and overwhelming animal while',fleece:'Answers Stubb in his own hard-earned voice as',gabriel:'Turns the Jeroboam’s loss into prophecy as',perth:'Shapes grief into exact craft as',carpenter:'Responds through practical workmanship as'}[slug]
 return `${lead} ${summary.charAt(0).toLowerCase()+summary.slice(1)}`
}
const characterSnapshots=events.flatMap((e,ei)=>e.involvedCharacterIds.map((characterId,ci)=>{const slug=characterId.replace(`${P}-character-`,'');const dead=numeric(e.chapterId)===135&&!['ishmael','moby-dick'].includes(slug);const loc=locations.find(l=>l.id===e.locationMarkerId);return{...base,id:id('snapshot',`${String(ei+1).padStart(3,'0')}-${slug}`),characterId,eventId:e.id,sortKey:(ei+1)*10000+ci,isAlive:!dead,currentLocationMarkerId:e.locationMarkerId,currentMapLayerId:loc.mapLayerId,inventoryItemIds:[],inventoryNotes:'',statusNotes:roleAt(slug,ei+1,e.description),travelModeId:null}}))
function numeric(chapterId){return Number(chapterId.slice(-3))}
const characterMovements=[];const prev=new Map();for(const s of characterSnapshots){const from=prev.get(s.characterId);if(from&&from!==s.currentLocationMarkerId)characterMovements.push({...base,id:id('movement',String(characterMovements.length+1).padStart(4,'0')),characterId:s.characterId,eventId:s.eventId,waypoints:[from,s.currentLocationMarkerId],sortKey:s.sortKey,travelModeId:null,notes:'Movement recorded between consecutive scenes in which this character is present.'});prev.set(s.characterId,s.currentLocationMarkerId)}

const itemEvents={1:['carpet-bag'],3:['queequeg-harpoon'],16:['articles'],18:['articles','queequeg-harpoon'],36:['doubloon'],44:['ahab-chart'],48:['whale-line'],60:['whale-line'],78:['whale-line'],93:['pip-tambourine'],98:['oil-casks'],99:['doubloon'],109:['oil-casks'],110:['queequeg-coffin'],113:['ahab-harpoon'],118:['quadrant'],124:['compass'],126:['queequeg-coffin'],127:['queequeg-coffin'],133:['ahab-harpoon','whale-line'],134:['ahab-harpoon','whale-line'],135:['ahab-harpoon','whale-line','queequeg-coffin'],136:['queequeg-coffin']}
for(const [n,slugs] of Object.entries(itemEvents))events[n-1].involvedItemIds=slugs.map(Item)
const itemPlacements=Object.entries(itemEvents).flatMap(([n,slugs])=>slugs.map((slug,i)=>{const e=events[n-1],loc=locations.find(l=>l.id===e.locationMarkerId);return{...base,id:id('placement',`${n}-${slug}`),itemId:Item(slug),eventId:e.id,locationMarkerId:e.locationMarkerId,mapLayerId:loc.mapLayerId,holderCharacterId:null,sortKey:Number(n)*100+i,notes:`${items.find(x=>x.id===Item(slug)).name} is materially present in ${e.title}.`}}))

const plotThreads=[['friendship','Ishmael and Queequeg','#7b6a4c','Prejudice gives way to a friendship that survives separation, illness, and death through the coffin that saves Ishmael.'],['obsession','Ahab’s Hunt','#6f3940','Ahab converts a commercial voyage and an entire crew into instruments of revenge against Moby Dick.'],['conscience','Starbuck’s Conscience','#687657','Starbuck repeatedly sees the moral danger yet cannot find an action equal to his judgment.'],['labor','The Work of Whaling','#586f7d','Hunts, cutting-in, rendering, storage, and navigation reveal the skilled collective labor beneath the voyage.'],['knowledge','Knowing the Whale','#766550','Ishmael tests classifications, pictures, anatomy, law, myth, and direct witness without pretending the whale is exhausted by them.'],['omens','Omens and Prophecy','#6f5b78','Warnings, dreams, electrical fire, lost instruments, and Fedallah’s prophecy accumulate around Ahab’s chosen course.']].map(([s,name,color,description])=>({...base,id:T(s),name,color,description}))
const motifs=[['whiteness','Whiteness','#d6d0ba','Whiteness moves between purity, blankness, natural variation, and metaphysical terror.'],['coffins','Coffins and Rescue','#645c50','Objects prepared for death become instruments of survival, while rescue repeatedly arrives too late for someone else.'],['eyes','Seeing and Blindness','#526b78','Lookouts, charts, pictures, instruments, and scarred bodies make perception necessary yet incomplete.'],['fire','Fire and Oil','#8a573e','The hunt’s dark labor produces domestic light while the try-works and lightning turn illumination threatening.'],['gold','Gold and Value','#9a7a42','Lays, oil, ambergris, and the doubloon expose competing meanings of wealth and reward.']].map(([s,name,color,description])=>({...base,id:O(s),name,color,description}))
for(const e of events){const n=numeric(e.chapterId);if(n>=36)e.threadIds.push(T('obsession'));if(n<=18||[47,49,72,78,110,126,136].includes(n))e.threadIds.push(T('friendship'));if([38,109,119,120,123,128,132,135].includes(n))e.threadIds.push(T('conscience'));if(n>=32&&n<=105)e.threadIds.push(T('knowledge'));if(n>=43)e.threadIds.push(T('omens'));if(n>=47&&n<=98)e.threadIds.push(T('labor'));if([42,58,59,70,96,99,119,126,136].includes(n))e.motifIds.push(O(['whiteness','eyes','eyes','fire','gold','fire','gold','coffins','coffins'][[42,58,59,70,96,99,119,126,136].indexOf(n)]))}

const relRows=[['ishmael-queequeg','ishmael','queequeg','closest friends','bond','positive','A shared bed becomes a chosen kinship whose practical loyalty and emotional force sustain the voyage.'],['ahab-starbuck','ahab','starbuck','captain and resisting first mate','strong','complex','Formal duty binds Starbuck to a captain whose private purpose he judges destructive.'],['ahab-fedallah','ahab','fedallah','captain and prophetic shadow','strong','complex','Fedallah serves Ahab’s secret hunt while framing its end through ambiguous prophecy.'],['starbuck-queequeg','starbuck','queequeg','mate and harpooneer','strong','positive','Starbuck trusts Queequeg at the prow of his whale boat and beside him in danger.'],['stubb-tashtego','stubb','tashtego','mate and harpooneer','strong','positive','Stubb’s irreverence and Tashtego’s precision make an effective hunting partnership.'],['flask-daggoo','flask','daggoo','mate and harpooneer','strong','positive','Flask depends on Daggoo’s imposing balance and power in the third boat.'],['ahab-pip','ahab','pip','wounded protector and castaway','bond','positive','Pip’s broken candor reaches the tenderness Ahab otherwise refuses.'],['ahab-moby','ahab','moby-dick','hunter and hunted','strong','negative','Ahab assigns the whale responsibility for all injury and stakes every life on striking through it.'],['boomer-ahab','boomer','ahab','survivors with opposing responses','moderate','complex','Two maimed captains meet, but only Ahab treats survival as an obligation to revenge.'],['gardiner-ahab','gardiner','ahab','pleading father and refusing captain','strong','negative','Gardiner asks for a search Ahab could join, exposing the human duty his hunt has displaced.']]
const relationships=relRows.map(([s,a,b,label,strength,sentiment,description])=>({...base,id:R(s),characterAId:C(a),characterBId:C(b),label,strength,sentiment,description,isBidirectional:true,startEventId:EV({ 'ishmael-queequeg':4,'ahab-starbuck':36,'ahab-fedallah':48,'starbuck-queequeg':27,'stubb-tashtego':27,'flask-daggoo':27,'ahab-pip':129,'ahab-moby':41,'boomer-ahab':100,'gardiner-ahab':128}[s])}))
const relationshipSnapshots=[['ishmael-queequeg',4,'unexpected roommates','moderate','complex','Fear yields to practical trust in the shared room.'],['ishmael-queequeg',10,'bosom friends','bond','positive','Ishmael explicitly chooses Queequeg as family.'],['ahab-starbuck',36,'captain and dissenting mate','strong','negative','Starbuck rejects vengeance against an unreasoning animal.'],['ahab-starbuck',132,'captain and final human appeal','bond','complex','For one calm interval, home and family almost redirect Ahab.'],['ahab-pip',129,'protective companions','bond','positive','Ahab recognizes Pip’s broken mind without mocking or abandoning him.'],['ahab-moby',135,'destroyed hunter and surviving quarry','none','negative','The final line takes Ahab as the whale turns upon the Pequod.']].map(([rel,n,label,strength,sentiment,description],i)=>({...base,id:id('relationship-snapshot',`${rel}-${n}`),relationshipId:R(rel),eventId:EV(n),sortKey:i,label,strength,sentiment,description,isActive:strength!=='none'}))

const factions=[['owners','Pequod’s Owners','Nantucket investors who fit and finance the voyage through fractional lays and delegated command.','#74674d'],['officers','Pequod’s Officers','Ahab and the three mates who organize watches, boats, discipline, and navigation.','#546d78'],['harpooneers','Harpooneers','Queequeg, Tashtego, Daggoo, and Fedallah, whose specialized boat work gives the hunt its striking force.','#7a5747'],['crew','Pequod’s Crew','A multinational company of sailors bound first by wages and labor, then by Ahab’s oath.','#66725e']].map(([s,name,description,color])=>({...base,id:F(s),name,description,color,coverImageId:I(`faction-${s}`),tags:[]}))
const memberships=[['owners','peleg','Managing owner',16],['owners','bildad','Managing owner',16],['officers','ahab','Captain',28],['officers','starbuck','First mate',26],['officers','stubb','Second mate',26],['officers','flask','Third mate',26],['harpooneers','queequeg','Starbuck’s harpooneer',27],['harpooneers','tashtego','Stubb’s harpooneer',27],['harpooneers','daggoo','Flask’s harpooneer',27],['harpooneers','fedallah','Ahab’s harpooneer',48],['crew','ishmael','Foremast hand',22],['crew','pip','Cabin boy',40]].map(([f,c,role,n])=>({...base,id:id('membership',`${f}-${c}`),factionId:F(f),characterId:C(c),role,startEventId:EV(n),endEventId:null,notes:''}))

const loreCategories=[{id:id('lore-category','source'),worldId,name:'Edition and Chronology',color:'#667789',sortOrder:0},{id:id('lore-category','whaling'),worldId,name:'Whaling World',color:'#77664c',sortOrder:1},{id:id('lore-category','interpretation'),worldId,name:'Ideas and Symbols',color:'#6f5f75',sortOrder:2}]
const lorePages=[
 ['source','Complete Source and Editorial Calendar','The structure follows the complete Project Gutenberg edition #2701: 135 author-titled chapters and the Epilogue. The voyage’s exact dates are often unstated, so the calendar begins with Ishmael’s winter departure and uses an explicitly editorial sequence of elapsed days to preserve order rather than claiming historical precision.',1],
 ['source','Visual Provenance','The world cover, regional chart, voyage chart, Pequod plans, and character portraits are original generated illustrations created for this example in a mature engraved nineteenth-century style. They are repository-hosted and visually reviewed; maps and entity artwork serve separate purposes.',1],
 ['whaling','The Lay System','Instead of ordinary wages, a whaler receives a fractional share called a lay. Rank, experience, and bargaining determine how much of a successful voyage each sailor may claim.',16],
 ['whaling','A Gam at Sea','A gam is a social meeting between whaleships, allowing captains and crews to exchange letters, news, sightings, and stories during voyages that may last years.',53],
 ['whaling','Trying Out','Cut blubber is minced and boiled in brick furnaces called try-works. The resulting oil is cooled into casks and stored below, turning the ship into a mobile processing works.',67],
 ['interpretation','One Whale, Many Readings','The example preserves the book’s distinction between Moby Dick as a living sperm whale and the meanings Ahab, Ishmael, and others project onto him. No single interpretation is presented as the animal’s secret essence.',41],
].map(([cat,title,body,n],i)=>({...base,id:id('lore',String(i+1)),categoryId:id('lore-category',cat),title,body,tags:[],coverImageId:I(i===1?'world':'character-ishmael'),linkedEntityIds:[],visibleFromEventId:EV(n)}))

const factRows=[['friends','Ishmael and Queequeg have chosen one another as family','Their friendship replaces Ishmael’s first fear with reciprocal loyalty.',10],['ahab-hunt','Ahab intends to hunt Moby Dick rather than merely complete a whaling voyage','The doubloon and oath reveal the private purpose hidden from the signed crew.',36],['fedallah-aboard','Fedallah and a hidden boat crew have sailed aboard the Pequod','The first lowering exposes Ahab’s concealed preparations.',48],['pip-changed','Pip’s abandonment at sea has permanently altered his mind','The crew recovers him physically but cannot restore his former relation to the world.',93],['coffin-buoy','Queequeg’s coffin has been remade as a life-buoy','An object prepared for his death becomes emergency equipment for the ship.',126],['rachel-search','The Rachel is searching for Captain Gardiner’s missing son','Ahab refuses to divert even for another captain’s child.',128],['fedallah-prophecy','Fedallah’s prophecy predicts hearses, hemp, and his own death before Ahab’s','Ahab treats the words as protection rather than warning.',117],['ishmael-survives','Ishmael is the Pequod’s sole survivor','Queequeg’s coffin keeps him afloat until the Rachel finds him.',136]]
const knowledgeFacts=factRows.map(([s,title,description,n])=>({...base,id:K(s),title,description,tags:[],readerLearnsAtEventId:EV(n),originEventId:EV(n)}))
const revealTo={friends:['ishmael','queequeg'],'ahab-hunt':['ahab','starbuck','stubb','flask','ishmael'],'fedallah-aboard':['ahab','ishmael','starbuck'],'pip-changed':['pip','stubb','ishmael'],'coffin-buoy':['queequeg','ishmael','ahab'],'rachel-search':['gardiner','ahab'],'fedallah-prophecy':['fedallah','ahab'],'ishmael-survives':['ishmael']}
const knowledgeReveals=factRows.flatMap(([s,,,n])=>revealTo[s].map(c=>({...base,id:id('reveal',`${s}-${c}`),factId:K(s),characterId:C(c),eventId:EV(n),note:`${characters.find(x=>x.id===C(c)).name} knows: ${knowledgeFacts.find(x=>x.id===K(s)).title}.`})))
const characterGoals=[['ishmael-sea','ishmael','want','Escape the confinement of shore life through a whaling voyage.',1,22],['ishmael-understand','ishmael','need','Witness the voyage without forcing the whale or the world into one final meaning.',23,136],['queequeg-sail','queequeg','want','Practice his skill honorably beside the friend he has chosen.',13,135],['ahab-revenge','ahab','want','Find and strike Moby Dick regardless of commercial duty or human cost.',36,135],['starbuck-home','starbuck','want','Complete the voyage and return to his wife and child without surrendering conscience.',26,135],['pip-belong','pip','need','Remain held within human fellowship after the sea has broken his former certainty.',93,135],['gardiner-son','gardiner','want','Find the missing boat carrying his son.',128,136]].map(([s,c,type,text,start,end])=>({...base,id:id('goal',s),characterId:C(c),type,text,startEventId:EV(start),endEventId:EV(end)}))

const mapRoutes=[{...base,id:id('route','world'),mapLayerId:M('world'),name:'The Pequod’s Outward Track',routeType:'sea',waypoints:[L('new-england-gate'),L('azores'),L('cape'),L('indian'),L('sunda'),L('japan'),L('final-pacific')],color:'#7b3f3f',notes:'Editorial reconstruction of the principal ocean sequence described in the novel.'}]
const travelModes=[{...base,id:id('travel-mode','ship'),name:'Whaleship',type:'sea',speed:7,color:'#566f7d',icon:'ship'},{...base,id:id('travel-mode','boat'),name:'Whaleboat',type:'water',speed:4,color:'#7d674d',icon:'route'},{...base,id:id('travel-mode','foot'),name:'On Foot',type:'land',speed:3,color:'#71685b',icon:'route'}]

const data={version:16,type:'worldbreaker-export',exportedAt:now,world:{id:worldId,name:'Moby-Dick; or, The Whale',description:'Herman Melville’s sea epic follows Ishmael aboard the Nantucket whaleship Pequod, where Captain Ahab turns a global working voyage into an absolute pursuit of the white sperm whale that maimed him. Friendship, labor, belief, natural history, and the limits of interpretation gather around a ship driven toward the Pacific and its captain’s chosen end.',coverImageId:I('world'),theme:'theme-adventure',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1840,yearSuffix:' (editorial chronology)',months:[['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],['July',31],['August',31],['September',30],['October',31],['November',30],['December',31]].map(([name,days])=>({name,days}))},wordTarget:null},mapLayers:maps,locationMarkers:locations,characters,items,characterSnapshots,characterMovements,itemPlacements,itemSnapshots:[],locationSnapshots:[],relationships,relationshipSnapshots,timelines:[{id:timelineId,worldId,name:'The Voyage of the Pequod',description:'One continuous chronology from Ishmael’s departure through the voyage and the Epilogue.',color:'#5a7180',dayOffset:0,createdAt:now}],chapters,events,blobs,travelModes,timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes,mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],loreCategories,lorePages,factions,factionMemberships:memberships,factionRelationships:[],knowledgeFacts,knowledgeReveals,characterGoals,sceneTexts:[],plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[]}

for(const child of maps.filter(m=>m.parentMapId)){const gates=locations.filter(l=>l.linkedMapLayerId===child.id);if(gates.length!==1)throw new Error(`${child.name}: expected one gateway, got ${gates.length}`)}
if(chapters.length!==136||new Set(events.map(e=>e.chapterId)).size!==136)throw new Error('Complete chapter coverage failed')
if(characterSnapshots.length!==events.reduce((n,e)=>n+e.involvedCharacterIds.length,0))throw new Error('Snapshot coverage mismatch')
if(new Set(characterSnapshots.map(s=>`${s.eventId}:${s.characterId}`)).size!==characterSnapshots.length)throw new Error('Duplicate character snapshot')
for(const e of events){if(e.tension<1||e.tension>5||e.travelDays<0||!Number.isInteger(e.inWorldTime))throw new Error(`${e.title}: invalid pacing`);if(!locations.some(l=>l.id===e.locationMarkerId))throw new Error(`${e.title}: missing location`)}
for(const m of maps)if(!locations.some(l=>l.mapLayerId===m.id))throw new Error(`${m.name}: empty map`)

const text=`${JSON.stringify(data,null,2)}\n`
fs.writeFileSync('example/Moby-Dick.pwk',text)
fs.writeFileSync('public/library/moby-dick.pwk',text)
const index=JSON.parse(fs.readFileSync('public/library/index.json','utf8'))
const entry={id:'moby-dick',title:'Moby-Dick; or, The Whale',author:'Herman Melville',blurb:'Ishmael joins the Pequod, where Captain Ahab turns a whaling voyage into a consuming hunt for the white sperm whale that maimed him.',data:'moby-dick.pwk',dataBytes:Buffer.byteLength(text),counts:{characters:characters.length,chapters:chapters.length,events:events.length,locations:locations.length},notice:'Unofficial structural reference for a public-domain novel. Includes original summaries, an editorial calendar, and original generated illustrations; it does not include the novel’s prose.',worldId,cover:'library/moby-dick/art/world.png'}
const at=index.entries.findIndex(x=>x.id===entry.id);if(at>=0)index.entries[at]=entry;else index.entries.push(entry)
fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)
console.log(JSON.stringify({chapters:chapters.length,events:events.length,characters:characters.length,snapshots:characterSnapshots.length,relationships:relationships.length,locations:locations.length,maps:maps.length,items:items.length,threads:plotThreads.length,lore:lorePages.length,factions:factions.length,facts:knowledgeFacts.length,goals:characterGoals.length,bytes:Buffer.byteLength(text)},null,2))
