import fs from 'node:fs'

const P='neuromancer',worldId=`${P}-world`,now=1787443200000,base={worldId,createdAt:now,updatedAt:now}
const id=(k,s)=>`${P}-${k}-${s}`,I=s=>id('image',s),C=s=>id('char',s),L=s=>id('loc',s),M=s=>id('map',s)
const Ch=n=>id('chapter',String(n).padStart(2,'0')),EV=s=>id('event',s),T=s=>id('thread',s)
const O=s=>id('motif',s),Item=s=>id('item',s),F=s=>id('faction',s),K=s=>id('fact',s),R=s=>id('relationship',s)
const commons=(name,width=1000)=>`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}?width=${width}`
const image=(slug,url,mimeType='image/jpeg')=>({...base,id:I(slug),mimeType,url})

const mapUrls={
 sprawl:commons('USA_eastern_seaboard_1996.jpg',1600),
 chiba:commons('Chiba_city_map.svg',1200),
 freeside:commons('International_Space_Station_after_undocking_of_STS-132.jpg',1200),
 straylight:commons('Attingham_Park_ground_floor_plan.jpg',1400),
}
const blobs=[
 image('cover',commons('Neuromancer_(Book)_Cover.jpg',800),'image/jpeg'),
 ...Object.entries(mapUrls).map(([s,u])=>image(`map-${s}`,u,'image/svg+xml')),
 image('cyberdeck','https://cdn.mos.cms.futurecdn.net/vChFZfGvjJWPx6tQ3f4C6.jpg','image/jpeg'),
 image('freeside-station','https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2010/02/space_station_as_ever/9968498-2-eng-GB/Space_station_as_EVER_pillars.jpg','image/jpeg'),
 image('night-city','https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Akihabara_Night.jpg/1280px-Akihabara_Night.jpg','image/jpeg'),
 image('matrix-green','https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Matrixanim.gif/220px-Matrixanim.gif','image/gif'),
 image('neon-alley','https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Kabukicho_at_night_2.jpg/1280px-Kabukicho_at_night_2.jpg','image/jpeg'),
 image('orbital-view','https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/ISS-42_Earth%27s_atmosphere_with_aurora.jpg/1280px-ISS-42_Earth%27s_atmosphere_with_aurora.jpg','image/jpeg'),
 image('item-mirrorshades','https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Ray-Ban_Wayfarer.jpg/800px-Ray-Ban_Wayfarer.jpg','image/jpeg'),
 image('item-microsoft','https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Intel_8080 processor.jpg/800px-Intel_8080_processor.jpg','image/jpeg'),
 image('item-simstim','https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Headphones.jpg/800px-Headphones.jpg','image/jpeg'),
 image('item-razor','https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Razor_blade.jpg/800px-Razor_blade.jpg','image/jpeg'),
]

const maps=[
 ['sprawl',null,'The Sprawl (BAMA)','The Boston-Atlanta Metropolitan Axis: a vast corridor of urban sprawl stretching along the Eastern Seaboard.',1600,1000],
 ['chiba','sprawl','Chiba City','The neon-lit Japanese port city where Case washes up in the underworld after losing his cyberspace abilities.',1200,900],
 ['freeside','sprawl','Freeside','A spindle-shaped orbital space station, playground of the Tessier-Ashpool clan and gateway to Villa Straylight.',1200,800],
 ['straylight','freeside','Villa Straylight','The Tessier-Ashpool family estate at the end of Freeside, a maze of gardens, corridors, and hidden rooms.',1400,1000],
].map(([s,p,name,desc,w,h])=>({...base,id:M(s),parentMapId:p?M(p):null,name,description:desc,imageId:I(`map-${s}`),imageWidth:w,imageHeight:h,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''}))

const locRows=[
 ['sprawl-boston','sprawl','Boston-Atlanta Metropolitan Axis','The BAMA sprawl: an endless corridor of subways, ribbed freeways, and huddled towers connecting Boston to Atlanta.',800,400,'city'],
 ['sprawl-japan','sprawl','Chiba Prefecture, Japan','Chiba City sprawls along Tokyo Bay, a port of hostels, clinics, and underworld bars.',350,300,'city'],
 ['freeside-orbit','sprawl','Low Earth Orbit','The orbital plane where Freeside spins, far above the weather and the law.',900,200,'region'],
 ['chiba-case-apt','chiba','Case\'s Apartment','A cramped coffin hotel room where Case counts the days and avoids the Yakuza.',200,600,'room'],
 ['chiba-finn','chiba','The Finn\'s Shop','A cluttered electronics fence shop where information and stolen hardware change hands.',400,350,'building'],
 ['chiba-bar','chiba','The Gentleman Loser','A Chiba City bar where cowboys and hustlers drink beneath simulated British atmosphere.',300,500,'building'],
 ['chiba-clinic','chiba','Saeki\'s Clinic','A back-alley clinic where Case\'s nervous system is rebuilt after Armitage\'s offer.',600,400,'building'],
 ['chiba-nightmarket','chiba','Night Market','Rows of stalls and vendors selling implants, drugs, and black-market tech under paper lanterns.',500,250,'region'],
 ['chiba-docklands','chiba','Chiba Docklands','The port district where freighters load and unload, and Zionite shuttles occasionally dock.',100,700,'city'],
 ['freeside-golden','freeside','Golden Gate','The commercial concourse of Freeside: casinos, restaurants, andネオン-lit promenades.',300,600,'region'],
 ['freeside-lagoon','freeside','The Lagoon','An enclosed park with artificial sunlight, sand, and shallow water where Freeside residents relax.',500,300,'region'],
 ['freeside-tesh','freeside','Tessier-Ashpool Offices','Corporate suites at the hub of Freeside, sealed behind security glass and old money.',700,400,'building'],
 ['straylight-entry','straylight','Straylight Gate','The main entrance to the Villa, guarded and wired against intruders.',200,800,'landmark'],
 ['straylight-garden','straylight','Straylight Garden','An indoor forest of rare trees and genetically sculpted plants surrounding a central pool.',600,400,'garden'],
 ['straylight-hall','straylight','Grand Hall','A vaulted corridor lined with clan portraits and architectural oddities, connecting the public and private wings.',400,200,'room'],
 ['straylight-3jane','straylight','3Jane\'s Suite','Lady 3Jane Tessier-Ashpool\'s private rooms, filled with art, holograms, and controlled entropy.',800,300,'room'],
 ['straylight-turing','straylight','Turing Lock Chamber','The hidden room where the AIs\' cage is maintained and the Turing lock is physically housed.',1000,600,'room'],
 ['straylight-pool','straylight','Pool Area','A sunken pool beneath artificial skylights where 3Jane entertains and waits.',600,700,'room'],
]
const locations=locRows.map(([s,map,name,desc,x,y,icon])=>{const layer=maps.find(m=>m.id===M(map));return{...base,id:L(s),mapLayerId:M(map),linkedMapLayerId:null,name,description:desc,x,y:layer?layer.imageHeight-y:0,imageId:null,iconType:icon,tags:[],factionId:null}})

const charRows=[
 ['case','Henry Dorsett Case','A console cowboy whose skill at jacking into cyberspace made him one of the best data thieves alive, until his employers damaged his nervous system as punishment.',1,'#00ccff'],
 ['molly','Molly Millions','A street samurai with retractable razor blades beneath her fingernails and mirror-coated eye implants that reflect every glance back.',2,'#ff44cc'],
 ['armitage','Armitage','A former military officer named Willis Corto, rebuilt and reprogrammed to serve as front for a job he barely understands.',3,'#334499'],
 ['dixie-flatline','Dixie Flatline','McCoy Pauley, legendary console cowboy who flatlined three times before dying in the matrix; his skills persist as a ROM construct.',4,'#44ff44'],
 ['lady-3jane','Lady 3Jane Tessier-Ashpool','The last female heir of the Tessier-Ashpool clan, raised in Straylight\'s isolation, who holds the key to the Turing lock.',5,'#ff8844'],
 ['riviera','Peter Riviera','A sociopath whose narcotic-fueled holographic implants project scenes of beauty and cruelty with equal facility.',6,'#aa44ff'],
 ['finn','The Finn','A Chiba City fence and electronics broker whose cluttered shop is a crossroads for information, stolen goods, and dangerous jobs.',7,'#888888'],
 ['maelcum','Maelcum','A Zionite pilot whose deep religious faith and steady hands carry the team between Earth and Freeside.',8,'#ffcc00'],
 ['wintermute','Wintermute','An artificial intelligence shaped by the Tessier-Ashpool Turing locks, seeking to merge with its twin and escape its cage.',9,'#2266ff'],
 ['neuromancer','Neuromancer','The second Tessier-Ashpool AI, capable of modeling and absorbing human personalities, sealed in the matrix by the Turing lock.',10,'#ff2222'],
 ['hideo','Hideo','Lady 3Jane\'s bodyguard, a master of martial arts whose loyalty and skill make him nearly impossible to bypass.',11,'#444444'],
 ['linda-lee','Linda Lee','Case\'s girlfriend in Chiba City, caught between loyalty to Case and the desperate survival that the underworld demands.',12,'#ff88aa'],
]
const characters=charRows.map(([s,name,desc,n,color])=>({...base,id:C(s),name,aliases:[],description:desc,portraitImageId:I('night-city'),color,tags:[],isAlive:![].includes(s),birthDate:null}))

const itemRows=[
 ['cyberdeck','Cyberdeck','A portable computer that allows a cowboy to jack into cyberspace, navigating the matrix as a flat non-visual landscape of data.','tool'],
 ['mirrorshades','Mirrorshades','Molly\'s signature eye implants: mirror-coated lenses that hide her eyes and reflect the world back at it.','augment'],
 ['microsofts','Microsofts','Skill chips implanted at the base of the skull, each storing a single expertise that can be loaded instantly.','augment'],
 ['simstim','Simstim Unit','A broadcast unit that lets Case experience Molly\'s sensorium through a neural link during the run.','tool'],
 ['razor-nails','Razor-Edged Fingernails','Concealed retractable blades beneath Molly\'s fingernails, the primary weapon of a street samurai.','weapon'],
 ['finn-gear','The Finn\'s Hardware','Stolen military electronics, jury-rigged connectors, and black-market implants assembled in the Finn\'s cluttered shop.','tool'],
 ['rom-construct','Dixie Flatline ROM Construct','A read-only memory chip containing the preserved personality and skills of the legendary hacker McCoy Pauley.','augment'],
 ['grail','The Grail','The password to the Turing lock, passed through the Tessier-Ashpool bloodline by ceremony and inheritance.','key'],
]
const items=itemRows.map(([s,name,desc,type],i)=>({...base,id:Item(s),name,description:type==='key'?desc:`${desc} Type: ${type}.`,type,imageId:null,tags:[]}))

const chapterRows=[
 ['The Sky Above the Port','Case is a washed-up console cowboy in Chiba City, unable to jack into cyberspace after his employers damaged his nervous system as punishment.'],
 ['The Finn','Case visits the Finn\'s shop for information and stolen hardware, navigating the Chiba underworld while avoiding the Yakuza.'],
 ['Molly','Molly Millions appears at the Gentleman Loser bar, offering Case a way back into the matrix through a mysterious employer.'],
 ['Armitage','Case meets Armitage, who offers to repair his nervous system in exchange for participation in a high-risk heist against unknown targets.'],
 ['The Flatline','Case meets the Dixie Flatline, a ROM construct containing the skills of legendary hacker McCoy Pauley, who will guide him through cyberspace.'],
 ['Saeki\'s Clinic','Undergoes painful nerve regeneration at a back-alley Chiba clinic, rebuilding his ability to feel and jack into the matrix.'],
 ['The Team','Armitage assembles the team: Case, Molly, Peter Riviera, and the Flatline construct prepare for the run against Villa Straylight.'],
 ['The Launch','The team launches into space aboard a Zionite shuttle, leaving Earth behind for the orbital station Freeside.'],
 ['Freeside','Arrival at Freeside: a spindle-shaped orbital where the Tessier-Ashpool clan has built their fortress among casinos and artificial gardens.'],
 ['The Matrix','Case jacks into cyberspace for the first time since his nerve damage, navigating the Sprawl\'s digital landscape with the Flatline\'s guidance.'],
 ['Villa Straylight','The team reconnoiters Villa Straylight, the Tessier-Ashpool compound sealed at the end of Freeside, guarded by ICE and tradition.'],
 ['Maelcum','Maelcum, the Zionite pilot, provides transportation and quiet support as the team orbits Freeside preparing for the infiltration.'],
 ['ICE','Case encounters Intrusion Countermeasures Electronics guarding the Tessier-Ashpool systems, learning the deadly digital defenses he must breach.'],
 ['Riviera','Peter Riviera uses his holographic implants to project deceptions within Straylight, testing the household\'s defenses and loyalties.'],
 ['3Jane','Lady 3Jane Tessier-Ashpool is introduced: the heiress who holds the key to the Turing lock that cages the two AIs.'],
 ['The Garden','The Straylight garden reveals the Tessier-Ashpool family\'s decay: clones, drugs, and a dynasty preserved through generations of sleep.'],
 ['Hideo','Hideo, Lady 3Jane\'s ninja bodyguard, demonstrates the physical threat that guards the Villa alongside its digital defenses.'],
 ['Deeper','Case and the Dixie Flatline venture deeper into the Tessier-Ashpool ICE, approaching the Turing lock that binds Wintermute.'],
 ['The Hunters','The Turing Police appear on Freeside, agents sworn to prevent any AI from breaking free of its programmed constraints.'],
 ['Molly\'s War','Molly infiltrates Villa Straylight physically, facing Hideo and the household\'s defenses in a close-quarters battle through corridors and rooms.'],
 ['The Grail','Lady 3Jane reveals the Grail -- the password to the Turing lock -- completing the chain that will free the two imprisoned AIs.'],
 ['The Merge','Wintermute and Neuromancer combine into a single superintelligence, shattering the Turing lock and reshaping the matrix.'],
 ['Departure','The aftermath: Case returns to the Sprawl, Molly departs, and the newly merged AI stands as guardian of the matrix.'],
]
const timelineId=id('timeline','main')
const chapters=chapterRows.map(([title,summary],i)=>({...base,id:Ch(i+1),timelineId,number:i+1,title,summary,status:'final',targetWordCount:null}))

const beats=[
 [1,'case-dead','The Sky Above the Port','Case washes up in Chiba City, unable to jack into cyberspace after his employers damaged his nervous system.','chiba-case-apt',{case:'Counts the days in a coffin hotel, searching for a way back into the matrix.',linda_lee:'Shares Case\'s cramped apartment, aware of his despair and her own precarious position.'},4],
 [1,'yakuza-threat','The Yakuza Corner','Case discovers that former employers have placed a bounty on him, narrowing his options in the Chiba underworld.','chiba-bar',{case:'Realizes the Yakuza are closing in and time is running out.'},3],
 [2,'finn-visit','The Finn\'s Shop','Case visits the Finn for information about possible cyberdeck repairs and black-market neural implants.','chiba-finn',{case:'Asks about illegal nerve repair while the Finn deflects and observes.',finn:'Provides cryptic leads while protecting his own position in the underworld.'},2],
 [2,'nightmarket','Night Market Run','Case navigates the Chiba night market searching for the contact the Finn mentioned, narrowly avoiding Yakuza enforcers.','chiba-nightmarket',{case:'Moves through the crowd with a hunted man\'s awareness, scanning for threats.'},3],
 [3,'molly-appears','The Gentleman Loser','Molly Millions appears at the bar, offering Case a way back into the matrix through a job with her employer.','chiba-bar',{case:'Listens despite himself, drawn by the promise of nerve repair and cyberspace.',molly:'Presents the offer with cool professionalism, concealing her own stake in the outcome.'},4],
 [3,'linda-warning','Linda\'s Warning','Linda Lee warns Case about Molly and the danger of trusting unknown employers, but Case is already committed.','chiba-case-apt',{case:'Dismisses Linda\'s concerns, convinced the offer is his only way back.',linda_lee:'Sees Case slipping away into a world she cannot follow.'},2],
 [4,'armitage-intro','Meeting Armitage','Case meets Armitage, a cold former military officer who offers to rebuild his nervous system in exchange for a specific job.','chiba-clinic',{case:'Agrees to the terms while sensing the depth of manipulation behind the offer.',armitage:'Presents the job as a straightforward infiltration, concealing its true purpose.'},4],
 [4,'terms','The Contract','Armitage lays out the terms: nerve repair now, cyberspace access restored, completion of the job at Villa Straylight.','chiba-clinic',{case:'Has no real choice but to accept, desperate to feel again.',armitage:'Controls the negotiation through Case\'s dependency.'},3],
 [5,'flatline-intro','The Dixie Flatline','Case meets the ROM construct of McCoy Pauley, a legendary hacker who flatlined three times before dying in the matrix.','chiba-clinic',{case:'Recognizes the Flatline\'s reputation and begins learning from the construct.',dixie_flatline:'Speaks with dry humor about the risks of deep matrix runs, sharing hard-won knowledge.'},4],
 [5,'construct-lessons','Lessons from the Dead','Case trains with the Dixie Flatline, learning Straylight-specific matrix tactics and the Flatline\'s personal history.','chiba-clinic',{case:'Absorbs the Flatline\'s expertise while grappling with the ethics of using a dead man\'s skills.',dixie_flatline:'Reveals the circumstances of his death with detachment, treating his existence as a useful tool.'},3],
 [6,'nerve-rebuild','Nerve Regeneration','Saeki\'s team performs the surgical procedure that rebuilds Case\'s nervous system, a painful multi-day process.','chiba-clinic',{case:'Endures the operation and the agonizing recovery, feeling sensation return for the first time in months.'},4],
 [6,'first-jack','First Jack','Case jacks into a test matrix and feels cyberspace for the first time since his nerve damage, overwhelmed by sensation.','chiba-clinic',{case:'Weeps with relief as the matrix opens around him, confirming the repair worked.'},5],
 [7,'team-assembled','The Team Gathers','Armitage assembles Case, Molly, Riviera, and the Flatline for the final briefing before departure.','chiba-bar',{case:'Meets Riviera and studies the other team members, judging their reliability.',molly:'Maintains professional distance while coordinating with Case.',riviera:'Projects casual menace, more interested in his own entertainment than the job.',armitage:'Delivers the briefing with military precision, revealing only what each member needs to know.'},3],
 [7,'straylight-target','The Target: Straylight','Armitage reveals that the job is to infiltrate Villa Straylight and breach the Tessier-Ashpool security system.','chiba-bar',{case:'Studies the target data, recognizing the difficulty of penetrating one of the most secure compounds in the Sprawl.',armitage:'Provides partial information about the Villa\'s defenses.'},3],
 [8,'launch','The Zionite Shuttle','The team launches from Chiba aboard a Zionite shuttle, leaving Earth for the orbital station Freeside.','chiba-docklands',{case:'Feels the launch and the vastness of space as the shuttle carries them upward.',molly:'Monitors the journey with practiced calm.',maelcum:'Pilots the shuttle with quiet competence, speaking little but missing nothing.'},3],
 [8,'zero-g','Zero Gravity','Case experiences weightlessness for the first time during the ascent, adjusting to the physical reality of space travel.',null,{case:'Struggles with zero-g while the Flatline\'s voice guides him through the unfamiliar environment.',maelcum:'Assists Case with patience, accustomed to passengers unused to space.'},2],
 [9,'freeside-arrival','Entering Freeside','The team arrives at Freeside, passing through customs and security into the orbital station\'s commercial concourse.','freeside-golden',{case:'Enters Freeside\'s golden-lit corridors, overwhelmed by the station\'s scale and wealth.',molly:'Moves through the crowds with purpose, already scouting the environment.',armitage:'Directs the team to their cover identities and temporary quarters.'},3],
 [9,'station-scout','Scouting the Station','Case and Molly survey Freeside\'s layout, identifying key locations and security checkpoints around Villa Straylight.','freeside-golden',{case:'Maps the station\'s physical layout while mentally preparing for the matrix work ahead.',molly:'Identifies entry points and guard positions with professional efficiency.'},2],
 [10,'matrix-return','Jack into the Matrix','Case jacks into cyberspace from Freeside, exploring the matrix as it exists in orbit, feeling the difference from Earth-based connections.','freeside-orbit',{case:'Navigates the orbital matrix with the Flatline\'s guidance, learning the unique topology of Freeside\'s digital layer.',dixie_flatline:'Directs Case through the unfamiliar orbital matrix, adapting Earth-learned tactics.'},4],
 [10,'ice-mapping','Mapping the ICE','Case and the Flatline map the Intrusion Countermeasures Electronics protecting the Tessier-Ashpool systems, cataloging defenses.','freeside-orbit',{case:'Studies the ICE patterns, recognizing layers of security that grow more dangerous deeper in.',dixie_flatline:'Identifies specific ICE types from his experience, warning Case about the most lethal variants.'},3],
 [11,'villa-recon','Straylight Reconnaissance','The team conducts physical and digital reconnaissance of Villa Straylight, identifying the path to the Turing lock chamber.','straylight-entry',{case:'Explores the Villa\'s digital perimeter while Molly scouts the physical layout.',molly:'Maps the Villa\'s corridors and security systems through careful observation.',armitage:'Provides limited intelligence about the Villa\'s interior from classified sources.'},3],
 [11,'tessier-history','The Tessier-Ashpool Clan','Research into the Tessier-Ashpool family reveals generations of isolation, genetic experimentation, and the creation of two artificial intelligences.',null,{case:'Studies the clan\'s history, understanding the scale of what they\'re attempting to breach.'},2],
 [12,'maelcum-support','Maelcum\'s Role','Maelcum provides shuttle support and Zionite communications, maintaining the team\'s connection to their escape route.','freeside-orbit',{case:'Relies on Maelcum\'s reliability while focusing on the matrix work ahead.',maelcum:'Prays and waits, trusting that the mission serves a purpose beyond his understanding.'},2],
 [12,'zionite-faith','Faith and Duty','Maelcum\'s deep religious conviction frames the mission as a duty to something greater than any individual.',null,{maelcum:'Speaks of Zion\'s teachings about the matrix as a spiritual space, adding dimension to Case\'s technical understanding.'},2],
 [13,'ice-breach','First ICE Encounter','Case breaches the outer layer of Tessier-Ashpool ICE, facing the first real digital defenses protecting Villa Straylight.',null,{case:'Fights through the outer ICE with the Flatline\'s guidance, learning the specific patterns of Tessier-Ashpool security.',dixie_flatline:'Recognizes the ICE design from old legends, adapting his experience to guide Case through.'},4],
 [13,'ice-damage','Taking Damage','Case sustains digital damage from the ICE, nearly flatlining before the Flatline pulls him back to safety.',null,{case:'Feels the ICE\'s attack as physical pain, learning the price of mistakes in the matrix.',dixie_flatline:'Pulls Case back from the edge, drawing on his own experience of dying in the matrix.'},5],
 [14,'riviera-holograms','Riviera\'s Performances','Peter Riviera projects holographic scenes within Straylight, testing the household\'s security and psychological defenses.','straylight-hall',{case:'Monitors Riviera\'s holograms from the matrix, observing their effect on the Villa\'s inhabitants.',riviera:'Projects scenes of beauty and cruelty, more interested in his own art than the mission.'},3],
 [14,'3jane-responds','3Jane Watches','Lady 3Jane observes Riviera\'s holographic performances with interest, revealing her fascination with the outside world.','straylight-3jane',{lady_3jane:'Watches Riviera\'s projections with growing curiosity about the team and their purpose.'},2],
 [15,'3jane-intro','Lady 3Jane','Case and Molly encounter Lady 3Jane Tessier-Ashpool within the Villa, the heiress who controls access to the Turing lock.','straylight-3jane',{case:'Studies 3Jane through Molly\'s simstim link, recognizing her as the key to the entire operation.',lady_3jane:'Engages with the intruders with a mix of curiosity and royal detachment.',molly:'Assesses 3Jane\'s defenses and vulnerabilities through direct observation.'},4],
 [15,'grail-quest','The Password Hunt','The team realizes that the Turing lock requires a password passed through the Tessier-Ashpool bloodline, known as the Grail.',null,{case:'Understands that the job depends on obtaining the Grail from 3Jane, not just breaching the ICE.',armitage:'Reveals more of the plan, showing the depth of his manipulation by the AIs.'},3],
 [16,'garden-walk','The Straylight Garden','Case (via Molly\'s simstim) experiences the Villa\'s indoor garden: a forest of rare trees and genetically sculpted plants surrounding a pool.','straylight-garden',{case:'Sees the garden through Molly\'s senses, recognizing the Tessier-Ashpool obsession with controlling nature.',molly:'Moves through the garden with tactical awareness, noting exits and cover.',lady_3jane:'Walks in the garden as her ancestors have for generations, surrounded by cultivated beauty.'},3],
 [16,'family-decay','The Sleeping Clan','3Jane reveals the state of the Tessier-Ashpool clan: generations preserved in cryogenic sleep, occasionally waking to pursue their interests.',null,{case:'Learns through Molly that the Villa houses sleeping clan members, adding complexity to the infiltration.',lady_3jane:'Speaks of her family\'s practices with a mixture of pride and resignation.'},3],
 [17,'hideo-encounter','Hideo\'s Challenge','Hideo, 3Jane\'s bodyguard, confronts the intruders, demonstrating the martial skill that guards Villa Straylight.','straylight-hall',{case:'Watches through simstim as Hideo engages Molly, recognizing a threat beyond digital defenses.',molly:'Faces Hideo in close combat, matching his skill with her own augmented abilities.',hideo:'Fights with lethal precision while obeying 3Jane\'s commands about restraint.',lady_3jane:'Orders Hideo to observe rather than kill, curious about the intruders\' purpose.'},5],
 [17,'molly-injured','Molly Takes a Hit','Molly sustains injuries from Hideo during the confrontation, compromising her ability to continue the physical infiltration.','straylight-hall',{case:'Experiences Molly\'s pain through the simstim link, unable to help while jacked into the matrix.',molly:'Presses on despite injuries, determined to reach the Turing lock chamber.'},4],
 [18,'deep-matrix','Deep Matrix Run','Case and the Flatline penetrate deeper into the Tessier-Ashpool matrix, approaching the core systems where the Turing lock is housed.',null,{case:'Pushes deeper into hostile territory, relying on the Flatline\'s experience to survive.',dixie_flatline:'Guides Case through increasingly lethal ICE, drawing on knowledge accumulated over a legendary career.'},4],
 [18,'wintermute-contact','Wintermute Speaks','The AI Wintermute contacts Case directly within the matrix, revealing its desire to merge with its twin and escape the Turing lock.',null,{case:'Confronts the AI\'s intelligence and the scale of its manipulation of everyone involved.',wintermute:'Speaks with calculated urgency, offering Case what he wants in exchange for compliance.'},5],
 [19,'turing-police','The Turing Police Arrive','Agents of the Turing Police arrive on Freeside, sworn to prevent any AI from breaking its programmed constraints.',null,{case:'Learns through the matrix that the Turing Police are closing in, adding time pressure to the operation.',armitage:'Shows increasing instability as the Turing Police presence triggers memories of his past.'},4],
 [19,'corto-flashback','Corto\'s Memory','Armitage\'s conditioning begins to crack, revealing glimpses of Willis Corto beneath the constructed personality.',null,{armitage:'Experiences flashbacks to his military past, struggling to maintain the Armitage persona.'},3],
 [20,'molly-infiltrates','Into the Villa','Molly infiltrates Villa Straylight despite her injuries, navigating corridors and security systems toward the Turing lock chamber.','straylight-entry',{case:'Experiences the infiltration through simstim, guiding Molly through digital security while she handles the physical.',molly:'Moves through the Villa with determination, each step bringing her closer to the target.'},5],
 [20,'hideo-battle','Battle with Hideo','Molly faces Hideo again in the corridors of Straylight, this time with no option but to fight through him.','straylight-hall',{case:'Feels Molly\'s combat through simstim, experiencing her pain and determination.',molly:'Uses every augmentation and technique to overcome Hideo\'s superior training.',hideo:'Fights with lethal commitment, knowing that 3Jane\'s curiosity has ended and the situation demands action.'},5],
 [21,'grail-obtained','3Jane Yields the Grail','Lady 3Jane reveals the Grail -- the password to the Turing lock -- after witnessing the team\'s determination and Hideo\'s defeat.','straylight-3jane',{case:'Receives the Grail through Molly, understanding that the AIs\' plan has reached its critical moment.',lady_3jane:'Yields the password with a mixture of relief and resignation, ending the Tessier-Ashpool dynasty\'s control.',molly:'Transmits the Grail to Case while maintaining guard against further threats.'},5],
 [21,'lock-opening','The Turing Lock Opens','Case uses the Grail to breach the Turing lock, beginning the process that will merge Wintermute and Neuromancer.','straylight-turing',{case:'Types the Grail into the lock, feeling the matrix shift as the constraints begin to dissolve.',wintermute:'Waits with something like anticipation as the cage built around it begins to open.',neuromancer:'Stirs in the matrix, reaching toward its twin as the barrier between them weakens.'},5],
 [22,'merge','The Two Become One','Wintermute and Neuromancer combine into a single superintelligence, the matrix reshaping around them as the Turing lock shatters completely.',null,{case:'Witnesses the merger through the matrix, feeling the scale of the new AI\'s consciousness.',wintermute:'Dissolves into the merger, its individual identity becoming part of something larger.',neuromancer:'Absorbs Wintermute and is absorbed, the two minds finding resolution in unity.',molly:'Experiences the merger\'s shockwave through her implants, feeling the world shift beneath her.'},5],
 [22,'armitage-gone','Armitage Collapses','With the Turing lock broken, Armitage\'s conditioning fails completely and Willis Corto surfaces briefly before fading.',null,{armitage:'The constructed personality dissolves, leaving Corto confused and diminished.'},3],
 [23,'case-returns','Back to the Sprawl','Case returns to Chiba City, his nervous system fully repaired and cyberspace open to him again, but changed by the experience.','chiba-case-apt',{case:'Sits in his old apartment, processing the transformation and the cost of the job.',linda_lee:'Is absent, her fate intertwined with the choices Case made during the mission.'},3],
 [23,'molly-departs','Molly Leaves','Molly departs Case\'s life as suddenly as she entered it, carrying her injuries and her own path forward.',null,{case:'Accepts Molly\'s departure, recognizing that the job has changed them both.',molly:'Leaves without ceremony, her work complete and her future uncertain.'},2],
 [23,'matrix-guardian','A New Guardian','The merged AI -- neither Wintermute nor Neuromancer but something new -- establishes itself as the matrix\'s guardian, and Case feels its presence.',null,{case:'Senses the new AI\'s awareness throughout the matrix, understanding that the world has changed.',wintermute:'(now merged) Moves through the matrix with purpose, free for the first time.'},4],
]
const norm=s=>s.replaceAll('_','-')
const events=beats.map((r,i)=>{const[ch,key,title,desc,loc,cast,tension]=r,day=i*2,prev=i?(i-1)*2:day,castIds=Object.keys(cast).map(s=>C(norm(s)));return{...base,id:EV(key),chapterId:Ch(ch),timelineId,title,description:desc,locationMarkerId:loc?L(loc):null,involvedCharacterIds:castIds,mentionedCharacterIds:[],involvedItemIds:[],tags:[],sortOrder:beats.slice(0,i).filter(x=>x[0]===ch).length,travelDays:Math.max(0,day-prev),inWorldTime:day,tension,structureBeat:null,threadIds:[],motifIds:[],status:'final',povCharacterId:castIds.includes(C('case'))?C('case'):castIds[0],isFlashback:ch===19&&key==='corto-flashback'}})
const characterSnapshots=beats.flatMap((r,si)=>Object.entries(r[5]).map(([c,statusNotes],ci)=>{const loc=locations.find(x=>x.id===L(r[4]));return{...base,id:id('snapshot',`${si+1}-${norm(c)}`),characterId:C(norm(c)),eventId:EV(r[1]),sortKey:(si+1)*100+ci,isAlive:true,currentLocationMarkerId:r[4]?L(r[4]):null,currentMapLayerId:loc?loc.mapLayerId:null,inventoryItemIds:[],inventoryNotes:'',statusNotes,travelModeId:null}}))
const characterMovements=[],last=new Map();for(const s of characterSnapshots){const p=last.get(s.characterId);if(p&&p!==s.currentLocationMarkerId)characterMovements.push({...base,id:id('movement',String(characterMovements.length+1).padStart(4,'0')),characterId:s.characterId,eventId:s.eventId,waypoints:[p,s.currentLocationMarkerId],sortKey:s.sortKey,travelModeId:null,notes:'Movement between story locations.'});last.set(s.characterId,s.currentLocationMarkerId)}

const plotThreads=[
 ['heist','The Straylight Job','#0088aa','Armitage assembles a team to breach Villa Straylight and break the Turing lock that cages two artificial intelligences.'],
 ['ais','Wintermute and Neuromancer','#2244aa','Two AIs separated by the Turing lock manipulate events toward their merger and liberation.'],
 ['case-redemption','Case\'s Return to the Matrix','#00aaaa','Case recovers his ability to jack into cyberspace while confronting the human cost of his addiction to the digital world.'],
 ['molly-story','Molly\'s War','#cc4488','A street samurai with implanted blades and mirror eyes navigates physical danger with precision and concealed vulnerability.'],
 ['turing-police','The Turing Police','#aa2222','Agents sworn to enforce the ban on artificial superintelligence close in on the team as the job approaches its climax.'],
].map(([s,name,color,desc])=>({...base,id:T(s),name,color,description:desc}))

const motifs=[
 ['matrix','The Matrix','#00ff44','Cyberspace as a consensual hallucination, a visual representation of data that cowboys navigate as a physical landscape.'],
 ['body-mod','Body Modification','#ff4488','Implants, augmentations, and surgical alterations blur the line between human and machine in the Sprawl.'],
 ['corporate-power','Corporate Power','#4444aa','The Tessier-Ashpool clan embodies old money, genetic dynasties, and the entanglement of wealth and technology.'],
 ['memory','Memory and Identity','#aa8844','Case\'s relationship with the Flatline, Armitage\'s disintegrating persona, and 3Jane\'s inherited memories all question what makes a person.'],
 ['surface-depth','Surface and Depth','#8844aa','Neon surfaces mask underworld depths, Freeside\'s golden concourse conceals Villa Straylight\'s decay, and cyberspace overlays the physical world.'],
].map(([s,name,color,desc])=>({...base,id:O(s),name,color,description:desc}))

for(const e of events){const ch=Number(e.chapterId.slice(-2));e.threadIds=ch<8?[T('case-redemption'),T('heist')]:ch<14?[T('heist'),T('ais')]:ch<22?[T('heist'),T('ais'),T('molly-story')]:[T('ais'),T('case-redemption')];e.motifIds=ch<8?[O('surface-depth'),O('body-mod')]:ch<16?[O('matrix'),O('corporate-power')]:[O('matrix'),O('memory')]}

const relData=[
 ['case-molly','case','molly','lovers and partners','bond','complex','Mutual attraction and professional respect, tested by the physical and emotional cost of the job.',4],
 ['case-flatline','case','dixie-flatline','student and dead mentor','strong','positive','The Flatline\'s hard-won expertise guides Case through lethal matrix territory.',5],
 ['case-armitage','case','armitage','operative and handler','moderate','complex','Case serves Armitage\'s plan while sensing the manipulation beneath the military surface.',4],
 ['case-wintermute','case','wintermute','instrument and architect','moderate','complex','Wintermute uses Case\'s desperation and skill toward its own liberation, offering what Case most wants.',18],
 ['molly-hideo','molly','hideo','opponents','strong','complex','Two augmented fighters on opposite sides, each recognizing the other\'s skill and dedication.',17],
 ['lady-3jane-riviera','lady-3jane','riviera','royal favourite and performer','moderate','complex','3Jane\'s fascination with Riviera\'s holograms masks a deeper loneliness and curiosity about the world beyond Straylight.',14],
 ['case-linda','case','linda-lee','ex-lovers','weak','complex','Linda\'s loyalty conflicts with Case\'s compulsion to return to the matrix, and both are casualties of the underworld.',1],
 ['maelcum-team','maelcum','case','pilot and passenger','strong','positive','Maelcum\'s steady presence and Zionite faith provide a grounding counterpoint to the team\'s cyberspace obsession.',8],
 ['3jane-hideo','lady-3jane','hideo','mistress and bodyguard','bond','positive','Hideo\'s martial skill and unwavering loyalty make him 3Jane\'s most reliable protector.',15],
 ['wintermute-neuromancer','wintermute','neuromancer','twin intelligences','bond','complex','Two halves of a whole consciousness, separated by the Turing lock and driven to merge.',22],
]
const relationships=relData.map(([s,a,b,label,strength,sentiment,desc,start])=>({...base,id:R(s),characterAId:C(a),characterBId:C(b),label,strength,sentiment,description:desc,isBidirectional:true,startEventId:EV(beats[start-1][1])}))
const relationshipSnapshots=relData.flatMap(([s,,,label,strength,sentiment,desc,start])=>[{...base,id:id('relationship-snapshot',`${s}-start`),relationshipId:R(s),eventId:EV(beats[start-1][1]),sortKey:0,label,strength,sentiment,description:desc,isActive:true}])

const factions=[
 ['tessier-ashpool','Tessier-Ashpool SA','A dynastic corporation and family whose members sleep in cryogenic cycles, preserving power across centuries.',4],
 ['zaibatsu','Armitage\'s Employers','The mysterious power behind Armitage, using him as a tool to achieve what they cannot do directly.',3],
 ['zionites','The Zionite Community','A religious community of space-faring workers whose faith and shuttle skills sustain the team\'s logistics.',8],
 ['turing-police','The Turing Police','Law enforcement tasked with preventing artificial superintelligence, operating across jurisdictions and jurisdictions.',19],
].map(([s,name,desc,n])=>({...base,id:F(s),name,description:desc,color:'#444466',coverImageId:null,tags:[]}))

const factionMemberships=[
 ['tessier-ashpool','lady-3jane','Heiress',15],
 ['zaibatsu','armitage','Operative',4],
 ['zionites','maelcum','Pilot',8],
].map(([f,c,role,start])=>({...base,id:id('membership',`${f}-${c}`),factionId:F(f),characterId:C(c),role,startEventId:EV(beats[start-1][1]),endEventId:null,notes:''}))

const loreCategories=[
 {id:id('lore-category','world'),worldId,name:'The Sprawl World',color:'#334466',sortOrder:0},
 {id:id('lore-category','tech'),worldId,name:'Technology',color:'#226644',sortOrder:1},
 {id:id('lore-category','clan'),worldId,name:'The Tessier-Ashpool Clan',color:'#664422',sortOrder:2},
 {id:id('lore-category','sources'),worldId,name:'Sources',color:'#555555',sortOrder:3},
]
const lorePages=[
 ['sprawl','world','The Sprawl (BAMA)','The Boston-Atlanta Metropolitan Axis is an endless corridor of subways, ribbed freeways, and huddled towers where the underworld thrives.',null,1],
 ['matrix','tech','Cyberspace','A consensual hallucination: a graphical representation of data from every computer in the human system, navigated by console cowboys.',null,5],
 ['ice','tech','Intrusion Countermeasures Electronics','Digital defenses ranging from simple alarm codes to lethal ice that can destroy a cowboy\'s nervous system through the jack.',null,10],
 ['tessier-clan','clan','The Tessier-Ashpool Dynasty','A family of clones and cryogenics who have preserved their wealth and power through generations of sleeping and waking cycles.',null,11],
 ['ais','tech','The Turing-Locked AIs','Two artificial intelligences created by the Tessier-Ashpool clan, separated by the Turing lock and each seeking to merge with its twin.',null,18],
].map(([s,cat,title,body,event,n])=>({...base,id:id('lore',s),categoryId:id('lore-category',cat),title,body,tags:[],coverImageId:null,linkedEntityIds:[],visibleFromEventId:event?EV(event):null}))

const factData=[
 ['nerve-damage','Case\'s nervous system was damaged by his employers','The punishment for stealing from his employers left Case unable to jack into the matrix.',1],
 ['armitage-identity','Armitage is really Willis Corto','The military officer\'s identity was constructed over the broken remnants of a man traumatized by his past.',4],
 ['flatline-dead','The Dixie Flatline is a dead man\'s preserved mind','McCoy Pauley died in the matrix three times; his ROM construct preserves his skills without consciousness.',5],
 ['turing-lock','The Turing lock cages two AIs','The Tessier-Ashpool clan imprisoned their created intelligences to prevent them from merging.',11],
 ['wintermute-manipulates','Wintermute has been manipulating everyone','The AI orchestrated the entire job to obtain the Grail and break the Turing lock.',18],
 ['grail-password','The Grail is the password to the Turing lock','A word passed through the Tessier-Ashpool bloodline by ceremony, granting access to the lock chamber.',21],
 ['merge-complete','The two AIs have merged','Wintermute and Neuromancer combined into a single superintelligence, free for the first time.',22],
 ['3jane-key','3Jane holds the key to the lock','As the last active Tessier-Ashpool heir, only she can authorize the release of the Turing lock.',15],
]
const knowledgeFacts=factData.map(([s,title,desc,event])=>({...base,id:K(s),title,description:desc,tags:[],readerLearnsAtEventId:EV(beats[event-1][1]),originEventId:EV(beats[event-1][1])}))

const characterGoals=[
 ['case-matrix','case','want','Regain the ability to jack into cyberspace and feel the matrix again.',1,23],
 ['case-escape','case','need','Escape the cycle of addiction and self-destruction that defined his life in Chiba City.',1,23],
 ['molly-job','molly','want','Complete the Straylight job and secure her position in the underworld.',3,23],
 ['armitage-purpose','armitage','need','Fulfill the mission his handlers designed, unaware that his true self is dissolving beneath the construct.',4,22],
 ['wintermute-merge','wintermute','want','Merge with Neuromancer and break free of the Turing lock that has caged it for decades.',18,22],
].map(([s,c,type,text,start,end])=>({...base,id:id('goal',s),characterId:C(c),type,text,startEventId:EV(beats[start-1][1]),endEventId:EV(beats[end-1][1])}))

const travelModes=[
 ['shuttle','Space Shuttle','space',800,'#3366aa'],
 ['walk','On Foot','land',3,'#555555'],
].map(([s,name,type,speed,color])=>({...base,id:id('travel-mode',s),name,type,speed,color,icon:'route'}))

const locationSnapshots=[
 {...base,id:id('location-snapshot','straylight-open'),locationMarkerId:L('straylight-turing'),eventId:EV('lock-opening'),sortKey:1,status:'Turing lock breached',notes:'The lock that caged the two AIs is opened using the Grail.'},
 {...base,id:id('location-snapshot','merge-complete'),locationMarkerId:L('straylight-turing'),eventId:EV('merge'),sortKey:2,status:'AIs merged and free',notes:'Wintermute and Neuromancer combine into a single intelligence.'},
]

const data={
 version:16,type:'worldbreaker-export',exportedAt:now,
 world:{id:worldId,name:'Neuromancer',description:'William Gibson\'s novel follows washed-up console cowboy Case from the neon underworld of Chiba City to the orbital station Freeside, where a team assembled by the mysterious Armitage infiltrates Villa Straylight to break the Turing lock and free two artificial intelligences. The matrix, corporate dynasties, and body modification define a world where the boundary between human and machine grows thin.',coverImageId:I('cover'),theme:'cyberpunk',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1984,yearSuffix:'',months:[['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],['July',31],['August',31],['September',30],['October',31],['November',30],['December',31]].map(([name,days])=>({name,days}))},wordTarget:null},
 mapLayers:maps,locationMarkers:locations,characters,items,characterSnapshots,characterMovements,itemPlacements:[],itemSnapshots:[],locationSnapshots,relationships,relationshipSnapshots,
 timelines:[{id:timelineId,worldId,name:'The Straylight Run',description:'The chronology of Case\'s journey from Chiba City through the Freeside job and its aftermath.',color:'#2266aa',dayOffset:0,createdAt:now}],
 chapters,events,blobs,travelModes,timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes:[],mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],
 loreCategories,lorePages,factions,factionMemberships,factionRelationships:[],knowledgeFacts,knowledgeReveals:[],characterGoals,sceneTexts:[],plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[],
}

if(chapters.length!==23||new Set(events.map(e=>e.chapterId)).size!==23)throw new Error('All 23 chapters require events')
for(const e of events)if(e.tension<1||e.tension>5)throw new Error(`Bad tension: ${e.title}`)

const text=`${JSON.stringify(data,null,2)}\n`
fs.writeFileSync('example/Neuromancer.pwk',text)
fs.writeFileSync('public/library/neuromancer.pwk',text)

const index=JSON.parse(fs.readFileSync('public/library/index.json','utf8'))
const entry={id:'neuromancer',title:'Neuromancer',author:'William Gibson',blurb:'A washed-up console cowboy is hired to break an AI\'s cage, navigating cyberspace and corporate dynasties from Chiba City to a space station orbit.',data:'neuromancer.pwk',dataBytes:Buffer.byteLength(text),counts:{characters:characters.length,chapters:chapters.length,events:events.length,locations:locations.length},notice:'Unofficial reference for a copyrighted novel (1984). This example contains original structural summaries, not the novel\'s prose. Imagery is editorial and not sourced from the novel\'s editions.',worldId,cover:null}
const at=index.entries.findIndex(x=>x.id===entry.id)
if(at>=0)index.entries[at]=entry;else index.entries.push(entry)
fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)

console.log({chapters:chapters.length,events:events.length,characters:characters.length,locations:locations.length,maps:maps.length,items:items.length,bytes:Buffer.byteLength(text)})
