import fs from 'node:fs'
import { createHash } from 'node:crypto'

const P='lost-world', worldId=`${P}-world`, now=1786838400000
const base={worldId,createdAt:now,updatedAt:now}
const id=(kind,slug)=>`${P}-${kind}-${slug}`
const I=s=>id('image',s), C=s=>id('character',s), L=s=>id('location',s), M=s=>id('map',s)
const Ch=n=>id('chapter',String(n).padStart(2,'0')), EV=s=>id('event',s), T=s=>id('thread',s), O=s=>id('motif',s)
const F=s=>id('faction',s), K=s=>id('fact',s), R=s=>id('relationship',s), Item=s=>id('item',s)
const commons=name=>{const n=name.replaceAll(' ','_'),h=createHash('md5').update(n).digest('hex');return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0,2)}/${encodeURIComponent(n)}`}
const strand=n=>`https://forgottenfutures.com/game/ff3/lw-${String(n).padStart(2,'0')}.gif`
const image=(slug,url,mimeType='image/gif')=>({id:I(slug),worldId,mimeType,url,createdAt:now})

// Every assignment below was checked against the illustrated Strand edition contact sheets.
const reviewedArt={}
const review=(n,subject)=>{reviewedArt[`strand-${n}`]=subject;return `strand-${n}`}
const mapUrls={
  atlantic:'https://tile.loc.gov/image-services/iiif/service%3Agmd%3Agmd3m%3Ag3290m%3Ag3290m%3Agct00394%3Acs000004/full/pct%3A12.5/0/default.jpg',
  london:'https://static-assets.artlogic.net/w_2400%2Ch_2400%2Cc_limit%2Cf_auto%2Cfl_lossy%2Cq_auto/artlogicstorage/themaphouse/images/view/2b56c01a423ae0bd44104e61b6ca116fj/themaphouse-cassell-company-london-and-environs-1900-c..jpg',
  approach:strand(20), plateau:strand(31),
}
const coverUrl='https://arthurconandoyle.co.uk/images/characters/original%20serialization%20of%20The%20Lost%20World%20in%20Strand%20Magazine-11042019144308.jpg'
const blobs=[
  image('cover',coverUrl,'image/jpeg'),
  image('atlantic-map',mapUrls.atlantic,'image/jpeg'),image('london-map',mapUrls.london,'image/jpeg'),image('approach-map',mapUrls.approach),image('plateau-map',mapUrls.plateau),
  ...Array.from({length:51},(_,i)=>image(`strand-${i+1}`,strand(i+1))),
  image('streatham-art','https://ideal-homes.gre.ac.uk/__data/assets/image/0018/304182/thrale-house-00074-640.jpg','image/jpeg'),
  image('gazette-art','https://heartofglassdotuk.files.wordpress.com/2021/03/potterygazetteoffices1879.jpg?w=723','image/jpeg'),
  image('savage-club-art','https://lirp.cdn-website.com/e925290f/dms3rep/multi/opt/Savageclubmenujohnson-640w.jpg','image/jpeg'),
  image('amazon-canoe-art','https://www.diariopopularmg.com.br/wp-content/uploads/2023/03/Navegacao-por-um-braco-do-Rio-Doce-Maxilian-Neuwied.jpg','image/jpeg'),
  image('rapids-art','https://pictures.abebooks.com/inventory/31839678472_2.jpg','image/jpeg'),
  image('item-wing-bone-art','https://2.bp.blogspot.com/-8d_GVfAyzP4/TZB4OSQKhSI/AAAAAAAABNQ/6GSaWYCqrTE/s1600/Pteranodon_reconstruction_Eaton_1910.jpg','image/jpeg'),
  image('item-sealed-orders-art','https://cdn.vectorstock.com/i/500p/03/45/vintage-wax-sealed-envelope-vector-59700345.jpg','image/jpeg'),
  image('item-rifles-art','https://ids.si.edu/ids/deliveryService?id=NMAH-NMAH2003-11599','image/jpeg'),
  image('item-rope-art','https://www.gutenberg.org/files/71807/71807-h/images/i_017_1.jpg','image/jpeg'),
  image('item-camera-art','https://www.fineartstorehouse.com/p/629/vintage-travel-camera-13593871.jpg.webp','image/webp'),
  image('item-diamonds-art','https://www.legendsofamerica.com/wp-content/uploads/2019/08/TavernierSketchDiamond.jpg','image/jpeg'),
]

const maps=[
 ['atlantic',null,'The Atlantic World','The oceanic route between London, Southampton, northern Brazil, and the Amazon basin.',1081,838,'atlantic-map'],
 ['london','atlantic','London and Environs, c. 1900','The capital and its surrounding districts from Tottenham to Crystal Palace, including central institutions and the Streatham homes.',2400,2061,'london-map'],
 ['approach','atlantic','Journey to the Cliffs','Malone’s rough chart of the expedition from the Amazon waterways to the plateau’s chalk cliffs.',719,544,'approach-map'],
 ['plateau','approach','Maple White Land','Malone’s rough chart of the isolated plateau, including the central lake, swamps, forests, cliffs, and camps.',733,698,'plateau-map'],
].map(([slug,parent,name,description,imageWidth,imageHeight,imageSlug])=>({...base,id:M(slug),parentMapId:parent?M(parent):null,name,description,imageId:I(imageSlug),imageWidth,imageHeight,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''}))

const locRows=[
 ['london-gate','atlantic','London','The capital’s clubs, lecture halls, newspaper offices, and suburban homes frame the public dispute over Challenger’s claims.','london',850,548,'city',49],
 ['southampton','atlantic','Southampton Docks','The south-coast port from which the expedition sails and to which it returns before its celebrated London reception.',null,839,523,'city',12],
 ['atlantic-crossing','atlantic','Atlantic Passage','The long sea route carrying the explorers from England toward the mouth of the Amazon.',null,630,408,'region',1],
 ['amazon-gate','atlantic','Amazon Expedition Route','The river system and inland trail leading from northern Brazil toward the hidden plateau.','approach',455,118,'region',19],
 ['chestnuts','london','The Chestnuts, Streatham','The Hungerton family’s comfortable suburban home, where Malone hopes to prove himself worthy of Gladys.',null,870,221,'building','streatham-art'],
 ['gazette','london','Daily Gazette, Fleet Street','The busy newspaper office where McArdle sends Malone in search of an adventure with real danger and public consequence.',null,1110,1005,'building','gazette-art'],
 ['savage-club','london','Savage Club','A convivial London club where Malone asks Tarp Henry how to approach the famously combative Professor Challenger.',null,1000,1051,'building','savage-club-art'],
 ['challenger-house','london','Challenger’s House, Enmore Park','A substantial Kensington house whose study holds Challenger’s specimens, drawings, and fiercely guarded evidence.',null,660,891,'building',25],
 ['zoological-institute','london','Zoological Institute','The lecture hall where experts dispute the plateau evidence and volunteers are called for an expedition.',null,620,961,'building',9],
 ['roxton-rooms','london','Lord John Roxton’s Albany Rooms','Roxton’s bachelor quarters, furnished with trophies and the equipment of an experienced hunter and traveller.',null,865,1041,'building',11],
 ['queens-hall','london','Queen’s Hall','A large public auditorium near Langham Place where the returning explorers present their evidence to a packed audience.',null,880,1141,'building',46],
 ['manaos','approach','Manaos and the Fazenda','The last urban base on the Amazon, where the party opens its sealed orders, gathers guides, and leaves regular communication behind.',null,145,159,'city',13],
 ['indian-village','approach','Indian Village','A riverside settlement whose inhabitants provide local knowledge and additional bearers for the inland journey.',null,183,194,'town','amazon-canoe-art'],
 ['rapids','approach','Rapids and Portage','A difficult stretch where canoes, stores, and specimens must be carried around broken water.',null,260,139,'landmark','rapids-art'],
 ['secret-stream','approach','Hidden Tributary','A narrow, vegetation-covered waterway leading away from the known river system toward the plateau country.',null,450,365,'landmark',43],
 ['base-camp','approach','Camp Beneath the Chalk Cliffs','The expedition’s supply camp beneath the plateau, guarded by Zambo after the ascent party is cut off above.',null,630,404,'landmark',24],
 ['plateau-gate','approach','Maple White Land','An isolated high country ringed by cliffs and reached only through a precarious ascent.','plateau',630,474,'region',44],
 ['tree-bridge','plateau','Pinnacle and Tree Bridge','A narrow pinnacle beside the cliff where a felled tree creates the expedition’s first bridge onto the summit.',null,390,58,'landmark',22],
 ['summit-camp','plateau','Fort Challenger','The explorers’ defended camp of thorn and fire near the plateau’s southern rim.',null,414,63,'landmark',29],
 ['forest-lookout','plateau','Gingko Tree and Western Forest','Dense primeval woodland surrounding a tall tree from which Malone first surveys the interior.',null,155,490,'region',26],
 ['stegosaurus-pool','plateau','Dinosaur Pool','A muddy forest pool and clearing visited by a family of armoured herbivorous dinosaurs.',null,305,228,'landmark',7],
 ['challenger-geyser','plateau','Challenger’s Geyser','A hot, mineral-stained spring on the western side of the plateau, used as a landmark during exploration.',null,70,408,'landmark',32],
 ['pterodactyl-swamp','plateau','Pterodactyl Swamp','A foul, marshy nesting ground crowded with pterodactyls and bordered by exposed blue volcanic clay.',null,530,213,'landmark',27],
 ['central-lake','plateau','Lake Gladys','The broad inland lake at the centre of Maple White Land, visible from high ground and visited by the explorers.',null,390,350,'landmark',40],
 ['ape-town','plateau','Ape-Town and Eastern Cliffs','A rough settlement near the eastern cliffs occupied by the plateau’s aggressive ape-men.',null,650,173,'town',36],
 ['indian-caves','plateau','Indian Caves','Caves beneath the northern cliffs that shelter the plateau people and overlook their cultivated ground.',null,175,588,'town',47],
 ['escape-tunnel','plateau','Escape Tunnel','A concealed natural passage through the cliff, known to the plateau people and opening near the expedition’s lower camp.',null,445,78,'landmark',38],
]
const locations=locRows.map(([slug,mapSlug,name,description,linked,x,displayY,iconType,artNo])=>{const layer=maps.find(m=>m.id===M(mapSlug));const art=typeof artNo==='number'?review(artNo,`Original Strand illustration selected for ${name}: ${description}`):artNo;if(typeof artNo==='string')reviewedArt[art]=`Visually reviewed historical illustration selected for ${name}: ${description}`;return{...base,id:L(slug),mapLayerId:M(mapSlug),linkedMapLayerId:linked?M(linked):null,name,description,x,y:layer.imageHeight-displayY,imageId:I(art),iconType,tags:[],factionId:null}})

const charRows=[
 ['malone','Edward Malone',[],'A young Daily Gazette reporter who joins the expedition to seek the danger and achievement he imagines will win Gladys Hungerton.',3,'#6d7f50'],
 ['challenger','Professor George Edward Challenger',[],'A brilliant, volcanic zoologist whose claims about surviving prehistoric life provoke ridicule and launch the expedition.',14,'#7a3f32'],
 ['summerlee','Professor Summerlee',[],'A respected comparative anatomist and severe sceptic who joins the expedition to test Challenger’s evidence in person.',21,'#64707a'],
 ['roxton','Lord John Roxton',[],'A seasoned sportsman, explorer, and opponent of Amazonian slavery whose courage and fieldcraft steady the party.',15,'#8a6a36'],
 ['gladys','Gladys Hungerton',[],'The self-possessed young woman whose ideal of heroic achievement helps send Malone abroad, though her own choices follow a different course.',51,'#865c74'],
 ['mcardle','McArdle',[],'The experienced news editor who recognizes Malone’s appetite for danger and commissions him to investigate Challenger.',5,'#566a78'],
 ['mrs-challenger','Mrs Challenger',['Jessie Challenger'],'Challenger’s small, composed wife, one of the few people able to interrupt his rages without being intimidated by them.',16,'#806d62'],
 ['zambo','Zambo',[],'A loyal African member of the expedition who maintains the lower camp and preserves the party’s only link with the outside world.',45,'#5e715b'],
 ['gomez','Gomez',[],'A former slave-trader’s associate who joins as a guide while concealing a personal grievance against Roxton.',34,'#704a45'],
 ['manuel','Manuel',[],'Gomez’s fellow guide and accomplice, experienced on the rivers but committed to the same concealed revenge.',33,'#725d48'],
]
const characters=charRows.map(([slug,name,aliases,description,artNo,color])=>{const art=review(artNo,`Original Strand character scene visually matched to ${name}.`);return{...base,id:C(slug),name,aliases,description,portraitImageId:I(art),color,tags:[],isAlive:true,birthDate:null}})

const itemRows=[
 ['sketchbook','Maple White’s Sketchbook','A battered notebook containing drawings and observations from the American artist who first reached the plateau country.','book',6],
 ['photographs','Challenger’s Plateau Photographs','Damaged photographic plates offered as evidence of the inaccessible plateau and the creatures seen there.','document',8],
 ['bone','Giant Wing Bone','An anomalously large bone Challenger presents as physical evidence that an unknown flying reptile survived.','specimen','item-wing-bone-art'],
 ['sealed-orders','Sealed Expedition Instructions','Challenger’s written directions, opened at Manaos, that define the route while withholding its final destination from outsiders.','document','item-sealed-orders-art'],
 ['rifles','Expedition Rifles','Roxton’s carefully chosen firearms, essential for hunting, defence, signalling, and the plateau conflict.','weapon','item-rifles-art'],
 ['rope','Rope and Climbing Gear','The rope, axes, and improvised tackle used to scale the pinnacle and negotiate the plateau cliffs.','tool','item-rope-art'],
 ['camera','Camera and Specimen Cases','Malone’s camera equipment and the party’s labelled cases for carrying photographs, bones, insects, plants, and other evidence home.','tool','item-camera-art'],
 ['pterodactyl-crate','Pterodactyl Crate','A reinforced travelling crate containing the expedition’s decisive living specimen for the London meeting.','container',50],
 ['diamonds','Blue-Clay Diamonds','Uncut diamonds gathered by Roxton from the volcanic blue clay beside the pterodactyl swamp.','treasure','item-diamonds-art'],
]
const items=itemRows.map(([slug,name,description,type,art])=>{const imageSlug=typeof art==='number'?review(art,`Original Strand illustration showing ${name} in narrative context.`):art;reviewedArt[imageSlug]=`Visually verified object-focused historical illustration selected for ${name}: ${description}`;return{...base,id:Item(slug),name,description,type,imageId:I(imageSlug),tags:[]}})

const chapterRows=[
 ['There Are Heroisms All Round Us','Malone asks Gladys to marry him and learns that the adventurous hero she imagines is not the ordinary man before her.'],
 ['Try Your Luck with Professor Challenger','McArdle assigns Malone to interview the most dangerous scientific celebrity in London.'],
 ['He Is a Perfectly Impossible Person','Malone wins entry to Challenger’s house through a false scientific pretext and is violently exposed.'],
 ['It’s Just the Very Biggest Thing in the World','Challenger privately shows Malone the evidence behind his claim and challenges him to witness the public debate.'],
 ['Question!','The Zoological Institute meeting erupts into disorder before an expedition committee is formed.'],
 ['I Was the Flail of the Lord','Malone meets Roxton and learns why the explorer is feared and respected in South America.'],
 ['To-morrow We Disappear Into the Unknown','The expedition reaches Manaos, opens its orders, and discovers that Challenger has come to lead it himself.'],
 ['The Outlying Pickets of the New World','Canoes and portages carry the party beyond mapped waterways toward the hidden cliffs.'],
 ['Who Could Have Foreseen It?','The explorers reach the plateau summit, but betrayal destroys their route back to the world below.'],
 ['The Most Wonderful Things Have Happened','The plateau reveals living prehistoric creatures, while Malone’s solitary exploration gives the first view of its interior.'],
 ['For Once I Was the Hero','Malone survives a night journey, discovers the central lake, and rescues the camp from attack.'],
 ['It Was Dreadful in the Forest','Evidence of conflict deepens until ape-men capture most of the expedition.'],
 ['A Sight I Shall Never Forget','Roxton and Malone rescue their companions, and the plateau people overthrow their ape-like enemies.'],
 ['Those Were the Real Conquests','The explorers study the plateau with their new allies and prepare a complete record of its life.'],
 ['Our Eyes Have Seen Great Wonders','A hidden tunnel returns the expedition to Zambo and the long journey home begins.'],
 ['A Procession! A Procession!','London’s disbelief ends with living proof, public triumph, and private choices about what comes next.'],
]
const chapters=chapterRows.map(([title,summary],i)=>({...base,id:Ch(i+1),timelineId:id('timeline','main'),number:i+1,title,summary,status:'final',targetWordCount:null}))

// day 0 is 1 January 1911; decimals provide a display time while inWorldTime stores the calendar day.
const scenes=[
 [1,'proposal','Gladys’s Test of Heroism','Malone proposes to Gladys, but she says that love must be matched by brave achievement.','chestnuts',{malone:'Presses his proposal and leaves determined to find a genuinely dangerous assignment.',gladys:'Rejects an ordinary future and describes the courage she wants in a husband.'},[],['heroism'],['spectacle'],309.80,2,'malone'],
 [2,'commission','McArdle’s Assignment','At the Gazette, McArdle directs Malone toward Professor Challenger and his disputed South American discoveries.','gazette',{malone:'Offers himself for any mission that can test his courage.',mcardle:'Chooses Challenger as a difficult subject and warns Malone about the scientist’s temper.'},[],['proof','heroism'],['evidence'],310.40,2,'malone'],
 [3,'tarp-advice','Advice at the Savage Club','Malone learns that scientific disguise may be the only way to get through Challenger’s door.','savage-club',{malone:'Constructs a plausible student identity to secure the forbidden interview.'},[],['proof'],['rivalry'],310.65,2,'malone'],
 [3,'challenger-interview','The Impossible Interview','Challenger detects Malone’s deception, wrestles him into the street, and then respects his refusal to press charges.','challenger-house',{malone:'Endures humiliation but protects the confidence Challenger accidentally offered.',challenger:'Exposes the false credentials, erupts physically, then recognizes Malone’s discretion.', 'mrs-challenger':'Stops the quarrel from becoming more destructive and restores enough calm for conversation.'},[],['proof','heroism'],['rivalry'],311.45,4,'malone'],
 [4,'private-evidence','Maple White’s Evidence','Challenger reveals the sketchbook, damaged photographs, and giant bone behind his claim of a surviving prehistoric world.','challenger-house',{malone:'Moves from sceptical reporter to cautious witness as independent details support one another.',challenger:'Presents his guarded evidence while demanding judgment based on the complete chain.'},['sketchbook','photographs','bone'],['proof'],['evidence','maps'],311.70,3,'malone'],
 [5,'institute','The Zoological Institute Erupts','Challenger’s lecture becomes a shouting confrontation with Summerlee before volunteers are requested for an expedition.','zoological-institute',{malone:'Volunteers publicly when the room demands an impartial witness.',challenger:'Defies mockery and demands that his critics test the plateau in person.',summerlee:'Challenges the evidence and volunteers to demonstrate that Challenger is mistaken.',roxton:'Offers experienced field leadership for a journey into unknown country.'},[],['proof','expedition'],['rivalry','spectacle'],312.80,4,'malone'],
 [6,'roxton-rooms','Roxton’s Record','At the Albany, Roxton describes his war against slave raiders and begins preparing Malone for Amazonian travel.','roxton-rooms',{malone:'Measures his romantic idea of adventure against Roxton’s costly experience.',roxton:'Accepts Malone as a companion and inventories the risks, weapons, and field discipline required.'},['rifles'],['expedition','heroism'],['thresholds'],315.60,2,'malone'],
 [7,'departure','Southampton Departure','Malone, Summerlee, and Roxton sail for Brazil while London waits for Challenger’s directions.','southampton',{malone:'Leaves England as the Gazette’s correspondent and the expedition’s recorder.',summerlee:'Embarks convinced that direct observation will refute Challenger.',roxton:'Takes practical charge of weapons and stores.'},['camera','rifles'],['expedition'],['thresholds','maps'],520.50,2,'malone'],
 [7,'manaos-orders','The Sealed Orders at Manaos','At the last city on the route, the party opens Challenger’s instructions and learns the first stage inland.','manaos',{malone:'Records the party’s last contact with ordinary communication.',summerlee:'Criticizes the secrecy but follows the route laid out in the letter.',roxton:'Recruits and evaluates the guides needed beyond Manaos.',gomez:'Joins as a knowledgeable guide while concealing his grievance.',manuel:'Joins the river party alongside Gomez and the bearers.',zambo:'Takes responsibility for supplies and communications.'},['sealed-orders','rifles','camera'],['expedition','treachery'],['documents','maps'],575.65,2,'malone'],
 [7,'challenger-arrives','Challenger Takes Command','Challenger steps from the veranda at the fazenda, revealing that he has travelled separately to lead the expedition.','manaos',{malone:'Welcomes the one man who can identify the route beyond the known rivers.',challenger:'Assumes command with theatrical satisfaction.',summerlee:'Resents the surprise but accepts Challenger’s unique route knowledge.',roxton:'Redirects the party around Challenger’s leadership without delaying departure.'},[],['expedition','proof'],['spectacle','rivalry'],576.10,3,'malone'],
 [8,'river-journey','Beyond the Known River','The canoes pass an Indian village, portages, and increasingly isolated waterways.','indian-village',{malone:'Learns to read the expedition’s progress through currents, camps, and local testimony.',challenger:'Controls the route while continuing to conceal its final turn.',summerlee:'Catalogues unfamiliar species despite his continuing dispute with Challenger.',roxton:'Keeps the guides, canoes, and armed watches organized.',gomez:'Pilots capably while waiting for an opportunity against Roxton.',manuel:'Supports Gomez and handles the canoes.',zambo:'Moves stores and keeps the bearers together.'},['rifles','camera'],['expedition','treachery'],['maps','thresholds'],579.40,3,'malone'],
 [8,'secret-tributary','The Green Tunnel','War drums sound behind the party as a hidden tributary closes overhead and leads toward unknown high country.','secret-stream',{malone:'Feels the last familiar route disappear beneath interlocking vegetation.',challenger:'Recognizes landmarks from Maple White’s account and commits the party to the concealed stream.',summerlee:'Admits the route itself is unlike the published geography.',roxton:'Sets watches after the distant drums warn that retreat may be dangerous.',gomez:'Keeps his knowledge of the downstream threat to himself.',manuel:'Follows Gomez through the narrow waterway.',zambo:'Protects the boats and supplies in the confined channel.'},['sealed-orders','rifles'],['expedition','treachery'],['maps','thresholds'],595.75,4,'malone'],
 [9,'cliff-camp','The Chalk Cliffs','The expedition reaches the towering escarpment and finds traces confirming that Maple White stood there before them.','base-camp',{malone:'Recognizes the cliff as the boundary between reportable geography and Challenger’s claim.',challenger:'Identifies the plateau with triumphant certainty.',summerlee:'Concedes that the place exists but withholds judgment about its animals.',roxton:'Searches the perimeter for a defensible route upward.',gomez:'Waits at the lower camp for the moment of revenge.',manuel:'Helps maintain the camp while supporting Gomez.',zambo:'Establishes the supply base below the cliffs.'},['sketchbook','rope'],['proof','escape','treachery'],['maps','thresholds'],602.50,3,'malone'],
 [9,'tree-crossing','Across the Tree Bridge','The party climbs the pinnacle and crosses a felled tree onto the plateau, leaving Zambo below.','tree-bridge',{malone:'Crosses the swaying trunk with camera and notebook into the isolated world.',challenger:'Becomes the first of the scientific party to set foot on the plateau.',summerlee:'Follows despite the risk because observation now matters more than argument.',roxton:'Directs the rope work and crossing order.',zambo:'Remains below with supplies and agrees to keep the camp until they return.'},['rope','camera','rifles'],['expedition','escape','proof'],['thresholds','maps'],603.35,4,'malone'],
 [9,'bridge-destroyed','Gomez’s Revenge','Gomez destroys the bridge, declares vengeance for Roxton’s campaign against the slave raiders, and is killed during the confrontation.','tree-bridge',{malone:'Realizes the expedition is marooned above sheer cliffs.',challenger:'Turns immediately from outrage to the problem of survival.',summerlee:'Faces the consequences of isolation without retreating from the scientific mission.',roxton:'Shoots Gomez after the guide boasts of trapping the party.',gomez:'Completes his revenge by dropping the bridge and dies under Roxton’s return fire.',manuel:'Flees the lower camp after Gomez falls.',zambo:'Survives below and promises to maintain communication with the plateau party.'},['rifles','rope'],['treachery','escape'],['thresholds'],603.55,5,'malone'],
 [10,'fort-challenger','Fort Challenger','The four explorers fortify a thorn camp and begin systematic observation of the summit.','summit-camp',{malone:'Organizes notes, photographs, and camp duties for a stay of unknown length.',challenger:'Names and commands the defended camp while planning a survey.',summerlee:'Begins accepting specimens that cannot fit familiar explanations.',roxton:'Designs the camp’s watches and fields of fire.'},['camera','rifles'],['exploration','escape','proof'],['evidence'],604.30,3,'malone'],
 [10,'stegosaurs','The Dinosaur Pool','Living stegosaurs at a forest pool replace argument with direct shared observation.','stegosaurus-pool',{malone:'Watches the animals with wonder and records their family behavior.',challenger:'Treats the sight as vindication but restrains himself from disturbing it.',summerlee:'Abandons categorical disbelief in the face of living specimens.',roxton:'Keeps the party downwind and ready to withdraw safely.'},['camera'],['exploration','proof'],['evidence'],605.40,4,'malone'],
 [10,'first-survey','Malone Climbs the Gingko','Malone climbs above the forest canopy and sees the great central lake and the plateau’s broad shape.','forest-lookout',{malone:'Completes a dangerous solo climb and sketches the first useful survey of the interior.'},['camera'],['exploration','heroism'],['maps'],605.85,3,'malone'],
 [11,'night-march','Malone’s Night Journey','Malone leaves camp alone, crosses the dark forest, and reaches the shore of the central lake.','central-lake',{malone:'Pushes through fear and exhaustion to make the discovery independently.'},['camera','rifles'],['exploration','heroism'],['thresholds','maps'],606.75,4,'malone'],
 [11,'camp-attack','The Camp in Peril','Returning through the forest, Malone finds a monstrous attacker at Fort Challenger and helps drive it off.','summit-camp',{malone:'Returns in time to act and proves useful under direct attack.',challenger:'Defends the camp while trying to identify the assailant.',summerlee:'Survives the assault and insists on distinguishing evidence from panic.',roxton:'Coordinates the gunfire that saves the camp.'},['rifles'],['escape','heroism'],['thresholds'],607.10,5,'malone'],
 [12,'pterodactyl-rookery','The Pterodactyl Swamp','The party enters a stinking rookery, observes the colony, and notices blue clay underfoot before being driven out.','pterodactyl-swamp',{malone:'Photographs and describes the colony while struggling against its attacks.',challenger:'Collects observations with reckless delight.',summerlee:'Works beside Challenger as a convinced but still critical scientist.',roxton:'Protects the group and quietly examines the blue clay.'},['camera','rifles'],['exploration','proof'],['evidence'],608.45,4,'malone'],
 [12,'ape-capture','Captured by the Ape-Men','Ape-men overwhelm the camp and carry Challenger, Summerlee, and Roxton toward their cliff settlement.','ape-town',{challenger:'Is captured and studied by an ape-man that grotesquely resembles him.',summerlee:'Is dragged toward the cliff and placed in immediate danger.',roxton:'Conceals his strength while looking for an opening to escape.'},['rifles'],['plateau-war','escape'],['doubles','thresholds'],609.20,5,'malone'],
 [13,'rescue','Malone and Roxton Strike Back','Malone finds Roxton, arms him, and together they rescue Challenger and Summerlee before the executions continue.','ape-town',{malone:'Uses stealth and rifle fire to turn the captives’ last moment into a rescue.',roxton:'Takes command of the counterattack once Malone restores his weapon.',challenger:'Escapes the ape-men and immediately joins the defence.',summerlee:'Is pulled back from the cliff alive but badly shaken.'},['rifles'],['plateau-war','heroism','escape'],['doubles'],609.50,5,'malone'],
 [13,'ape-war','The Battle for the Plateau','The explorers arm the plateau people, whose assault ends the ape-men’s domination.','indian-caves',{malone:'Fights beside the plateau people and records a victory that troubles him as much as it awes him.',challenger:'Applies firearms and planning to the allied assault.',summerlee:'Witnesses the survival conflict at close range.',roxton:'Leads the riflemen and prevents the ape-men from regrouping.'},['rifles'],['plateau-war'],['spectacle'],610.25,5,'malone'],
 [14,'lake-expedition','The Real Conquests','With the plateau people as guides, the party surveys Lake Gladys and gathers specimens across Maple White Land.','central-lake',{malone:'Creates the narrative and photographic record meant for readers at home.',challenger:'Builds a scientific collection large enough to support a new account of life.',summerlee:'Classifies evidence as collaborator rather than blanket opponent.',roxton:'Ranges widely, secures the party, and revisits the blue-clay deposit.'},['camera','rifles'],['exploration','proof'],['evidence','maps'],614.40,3,'malone'],
 [14,'diamond-clay','Roxton’s Discovery','Roxton confirms that the blue clay contains diamonds but keeps the discovery within the expedition.','pterodactyl-swamp',{roxton:'Collects uncut diamonds and plans to divide them fairly after the scientific proof is secured.',malone:'Learns that the expedition has found material wealth as well as knowledge.'},['diamonds'],['exploration'],['evidence'],615.15,2,'malone'],
 [15,'escape-route','The Hidden Tunnel','Plateau guides reveal a natural tunnel through the cliffs, giving the explorers a route back to the lower camp.','escape-tunnel',{malone:'Carries journals, photographs, and specimens through the constricted passage.',challenger:'Protects the most decisive evidence during the descent.',summerlee:'Leaves with a transformed scientific position and a formidable collection.',roxton:'Secures the diamonds and supervises the dangerous exit.'},['camera','diamonds','pterodactyl-crate'],['escape','proof'],['thresholds','evidence'],620.30,4,'malone'],
 [15,'zambo-reunion','Zambo Keeps Faith','The party emerges near the cliff base and reunites with Zambo, whose loyalty preserved stores and communication.','base-camp',{malone:'Reaches the outer world with a complete written record.',challenger:'Rewards Zambo’s loyalty and begins planning the public presentation.',summerlee:'Acknowledges that the evidence must now be defended in London.',roxton:'Reorganizes the homeward caravan and guards its most valuable cargo.',zambo:'Welcomes the survivors after maintaining the camp through their absence.'},['camera','diamonds','pterodactyl-crate'],['escape','proof'],['thresholds'],620.70,3,'malone'],
 [16,'gladys-return','Gladys’s Choice','Back in Streatham, Malone discovers that Gladys has married the unadventurous clerk Potts while he was away.','chestnuts',{malone:'Finds that the heroic quest cannot deliver the future he imagined and absorbs the loss without abandoning what he became.',gladys:'Explains that she chose the security and affection available to her rather than waiting for an ideal adventurer.'},[],['heroism'],['spectacle'],675.70,3,'malone'],
 [16,'queens-hall-proof','Living Proof at Queen’s Hall','On 7 November the pterodactyl bursts from its crate above the audience, turning ridicule into astonished acclaim.','queens-hall',{malone:'Watches his dispatches become public history as the living evidence circles the hall.',challenger:'Releases the final specimen and receives the vindication he demanded.',summerlee:'Publicly supports the conclusions that his own observations now establish.',roxton:'Controls the crate and remains alert as the demonstration escapes its plan.'},['pterodactyl-crate'],['proof'],['spectacle','evidence'],676.80,5,'malone'],
 [16,'procession','A Procession Through London','The crowd carries the explorers from the hall in a spontaneous procession.','queens-hall',{malone:'Receives public celebration while recognizing how different it is from private fulfilment.',challenger:'Accepts triumph as the world’s overdue correction.',summerlee:'Shares the acclaim for work he began as a sceptic.',roxton:'Enjoys the spectacle without confusing it with the expedition’s deeper rewards.'},[],['proof','heroism'],['spectacle'],676.90,4,'malone'],
 [16,'diamond-division','The Next Expedition','Roxton divides the diamond fortune; Challenger plans a museum, Summerlee retires to research, and Malone chooses another journey with Roxton.','roxton-rooms',{malone:'Chooses continued exploration for his own sake rather than as proof to Gladys.',challenger:'Plans to house and study the expedition’s collections.',summerlee:'Accepts the wealth and prepares a quieter scientific future.',roxton:'Divides the diamonds equally and invites Malone back toward the plateau.'},['diamonds'],['heroism','exploration'],['maps'],677.20,2,'malone'],
]
const timelineId=id('timeline','main')
const events=scenes.map((r,i)=>{const [ch,key,title,description,loc,cast,itemSlugs,threads,motifs,time,tension,pov]=r;const day=Math.floor(time),prev=i?Math.floor(scenes[i-1][9]):day;return{...base,id:EV(key),chapterId:Ch(ch),timelineId,title,description,locationMarkerId:L(loc),involvedCharacterIds:Object.keys(cast).map(C),mentionedCharacterIds:[],involvedItemIds:itemSlugs.map(Item),tags:[],sortOrder:eventsForChapterBefore(i,ch),travelDays:Math.max(0,day-prev),inWorldTime:day,tension,structureBeat:null,threadIds:threads.map(T),motifIds:motifs.map(O),status:'final',povCharacterId:C(pov),isFlashback:false}})
function eventsForChapterBefore(index,chapter){return scenes.slice(0,index).filter(r=>r[0]===chapter).length}
const characterSnapshots=scenes.flatMap((r,si)=>Object.entries(r[5]).map(([character,statusNotes],ci)=>{const loc=locations.find(x=>x.id===L(r[4]));const dead=character==='gomez'&&r[1]==='bridge-destroyed';return{...base,id:id('snapshot',`${String(si+1).padStart(3,'0')}-${character}`),characterId:C(character),eventId:EV(r[1]),sortKey:(si+1)*10000+ci,isAlive:!dead,currentLocationMarkerId:L(r[4]),currentMapLayerId:loc.mapLayerId,inventoryItemIds:[],inventoryNotes:'',statusNotes,travelModeId:null}}))
const characterMovements=[]
const previousLocationByCharacter=new Map()
for(const snapshot of characterSnapshots){
 const previousLocationId=previousLocationByCharacter.get(snapshot.characterId)
 if(previousLocationId&&previousLocationId!==snapshot.currentLocationMarkerId){
  const characterName=characters.find(character=>character.id===snapshot.characterId).name
  const fromName=locations.find(location=>location.id===previousLocationId).name
  const toName=locations.find(location=>location.id===snapshot.currentLocationMarkerId).name
  characterMovements.push({...base,id:id('movement',String(characterMovements.length+1).padStart(4,'0')),characterId:snapshot.characterId,eventId:snapshot.eventId,waypoints:[previousLocationId,snapshot.currentLocationMarkerId],sortKey:snapshot.sortKey,travelModeId:null,notes:`${characterName} moves from ${fromName} to ${toName}.`})
 }
 previousLocationByCharacter.set(snapshot.characterId,snapshot.currentLocationMarkerId)
}
const itemPlacements=scenes.flatMap((r,si)=>r[6].map((slug,ii)=>({...base,id:id('placement',`${String(si+1).padStart(3,'0')}-${slug}`),itemId:Item(slug),eventId:EV(r[1]),locationMarkerId:L(r[4]),mapLayerId:locations.find(x=>x.id===L(r[4])).mapLayerId,holderCharacterId:null,sortKey:(si+1)*100+ii,notes:`${items.find(x=>x.id===Item(slug)).name} is present in this event.`})))
const itemSnapshots=[]

const plotThreads=[
 ['proof','Challenger’s Proof','#8a593d','The claim of a surviving prehistoric world advances from disputed fragments to shared observation and living evidence.'],
 ['expedition','Into the Unknown','#4d7567','The party travels beyond known waterways and crosses the plateau boundary.'],
 ['escape','Return from the Plateau','#6f617c','Once the tree bridge falls, survival depends on discovering another route through the cliffs.'],
 ['heroism','What Makes a Hero','#9a753f','Malone’s borrowed ideal of heroism changes through work, fear, loss, loyalty, and freely chosen adventure.'],
 ['treachery','Gomez’s Revenge','#814f4d','A concealed grievance travels with the expedition until the guides trap the explorers above the cliffs.'],
 ['exploration','Survey of Maple White Land','#557767','The explorers map, photograph, collect, and interpret the plateau’s living world.'],
 ['plateau-war','People and Ape-Men','#765449','The plateau’s human inhabitants struggle against aggressive ape-men for control of the high country.'],
].map(([s,name,color,description])=>({...base,id:T(s),name,color,description}))
const motifs=[
 ['evidence','Evidence and Witness','#6b7880','Drawings, photographs, specimens, direct observation, and testimony repeatedly change what can be believed.'],
 ['maps','Blank Maps and Hidden Routes','#5f7866','Maps define the edge of known geography while secret waterways, cliffs, and tunnels defeat ordinary routes.'],
 ['rivalry','Scientific Rivalry','#85644f','Challenger and Summerlee turn disagreement into a demanding test of evidence.'],
 ['thresholds','Cliffs, Bridges, and Passages','#6d6278','Physical thresholds separate ordinary society from the plateau and freedom from entrapment.'],
 ['spectacle','Public Spectacle','#8b7045','Private courage and patient observation are repeatedly converted into theatre for crowds.'],
 ['doubles','Human and Ape Resemblance','#765e56','The unsettling likeness between Challenger and the ape-man complicates easy boundaries between civilization and nature.'],
].map(([s,name,color,description])=>({...base,id:O(s),name,color,description}))

const relRows=[
 ['malone-gladys','malone','gladys','would-be lovers','strong','complex','Malone’s love begins the quest, but Gladys’s ideal and her later choice teach him that adventure cannot be performed for another person.','proposal'],
 ['malone-mcardle','malone','mcardle','reporter and editor','strong','positive','McArdle trusts Malone with a difficult assignment and provides the professional reason for entering Challenger’s story.','commission'],
 ['malone-challenger','malone','challenger','witness and volatile mentor','strong','complex','Their first violence settles into mutual respect built through confidentiality, danger, and proof.','challenger-interview'],
 ['challenger-summerlee','challenger','summerlee','scientific rivals','strong','complex','Open hostility becomes vigorous collaboration when both men submit their views to direct evidence.','institute'],
 ['malone-roxton','malone','roxton','expedition companions','bond','positive','Roxton’s experience steadies Malone, while Malone’s rescue proves that he can act beside the older explorer.','roxton-rooms'],
 ['challenger-wife','challenger','mrs-challenger','husband and wife','bond','positive','Mrs Challenger tempers her husband’s explosions without diminishing his confidence or her own judgment.','challenger-interview'],
 ['roxton-gomez','roxton','gomez','enemies','strong','negative','Gomez seeks revenge for the death of a slave-raiding relative killed during Roxton’s Amazon campaign.','manaos-orders'],
 ['gomez-manuel','gomez','manuel','accomplices','strong','negative','Manuel assists Gomez’s concealed revenge while travelling as an expedition guide.','manaos-orders'],
 ['malone-zambo','malone','zambo','expedition allies','strong','positive','Zambo’s loyalty below the cliffs preserves the explorers’ link to home and makes their eventual return possible.','manaos-orders'],
].map(([s,a,b,label,strength,sentiment,description,start])=>({...base,id:R(s),characterAId:C(a),characterBId:C(b),label,strength,sentiment,description,isBidirectional:true,startEventId:EV(start)}))
const relationshipSnapshots=[
 ['malone-gladys','proposal','aspiring suitor and admired ideal','strong','complex','Gladys’s demand for heroism gives Malone a borrowed purpose.'],
 ['malone-gladys','gladys-return','friends whose futures diverge','moderate','complex','Malone returns transformed, but Gladys has chosen a different life.'],
 ['challenger-summerlee','institute','public antagonists','strong','negative','They volunteer to settle the dispute through observation.'],
 ['challenger-summerlee','stegosaurs','field colleagues','strong','positive','Shared observation replaces categorical denial.'],
 ['malone-roxton','rescue','trusted comrades','bond','positive','Malone’s initiative lets them rescue the captured party together.'],
 ['roxton-gomez','bridge-destroyed','revenge completed by betrayal','none','negative','Gomez destroys the bridge and dies in the exchange of fire.'],
].map(([rel,event,label,strength,sentiment,description],i)=>({...base,id:id('relationship-snapshot',`${rel}-${event}`),relationshipId:R(rel),eventId:EV(event),sortKey:i,label,strength,sentiment,description,isActive:strength!=='none'}))

const factionRows=[
 ['expedition','Maple White Expedition','The scientific and journalistic party assembled to test Challenger’s claim and return with verifiable evidence.','#5c7065',10],
 ['gazette','Daily Gazette','The London newspaper that commissions Malone and publishes his account as dispatches from the unknown.','#657381',13],
 ['guides','Guides and Bearers','The river crews, porters, local guides, and camp staff who make travel beyond Manaos possible.','#806a4d',35],
 ['plateau-people','Plateau People','The human community living in caves and cultivated ground beneath the northern cliffs.','#6f704c',36],
 ['ape-men','Ape-Men','Powerful primates occupying the eastern heights and raiding the plateau people.','#79544a',37],
]
const factions=factionRows.map(([s,name,description,color,artNo])=>({...base,id:F(s),name,description,color,coverImageId:I(`strand-${artNo}`),tags:[]}))
const factionMemberships=[
 ['expedition','malone','Correspondent','institute'],['expedition','challenger','Leader','institute'],['expedition','summerlee','Scientific observer','institute'],['expedition','roxton','Field leader','institute'],['expedition','zambo','Camp keeper','manaos-orders'],
 ['gazette','malone','Reporter','commission'],['gazette','mcardle','News editor','commission'],['guides','gomez','Guide','manaos-orders'],['guides','manuel','Guide','manaos-orders'],['guides','zambo','Quartermaster','manaos-orders'],
].map(([faction,character,role,start])=>({...base,id:id('membership',`${faction}-${character}`),factionId:F(faction),characterId:C(character),role,startEventId:EV(start),endEventId:null,notes:''}))
const factionRelationships=[
 {...base,id:id('faction-relationship','expedition-ape-men'),factionAId:F('expedition'),factionBId:F('ape-men'),stance:'hostile',notes:'The ape-men capture the expedition and force a rescue and counterattack.'},
 {...base,id:id('faction-relationship','people-ape-men'),factionAId:F('plateau-people'),factionBId:F('ape-men'),stance:'hostile',notes:'The plateau people resist raids and captivity before reclaiming the eastern heights.'},
 {...base,id:id('faction-relationship','expedition-people'),factionAId:F('expedition'),factionBId:F('plateau-people'),stance:'allied',notes:'The groups exchange military assistance, guidance, and knowledge of the plateau.'},
]

const loreCategories=[
 {id:id('lore-category','science'),worldId,name:'Science and Exploration',color:'#61766c',sortOrder:0},
 {id:id('lore-category','setting'),worldId,name:'Places and Peoples',color:'#7a654c',sortOrder:1},
 {id:id('lore-category','context'),worldId,name:'Historical Context',color:'#6b6776',sortOrder:2},
 {id:id('lore-category','sources'),worldId,name:'Sources and Visual Record',color:'#637482',sortOrder:3},
]
const loreRows=[
 ['lost-worlds','science','The Lost-World Idea','The plateau turns a blank space on the map into an evolutionary refuge, letting extinct and modern life occupy the same isolated landscape.','private-evidence',32],
 ['field-evidence','science','What Counts as Proof','The story moves through a hierarchy of evidence: testimony, sketch, photograph, bone, shared observation, collected specimen, and finally a living animal.','private-evidence',42],
 ['amazon-frontier','context','The Amazonian Frontier','The expedition crosses a fictionalized frontier shaped by river travel, extractive trade, Indigenous knowledge, and the violence of slavery and colonial intrusion.','roxton-rooms',19],
 ['plateau-society','setting','Life on the Plateau','Maple White Land supports multiple ecosystems and two intelligent populations whose conflict shapes the explorers’ survival.','ape-capture',38],
 ['journalism','context','Malone’s Dispatches','The narrative is framed as Malone’s reporting: observations intended for a newspaper gradually become a complete first-person record when communication is cut.','commission',11],
 ['sources','sources','Text, Maps, and Illustrations','The chapter structure follows the 1912 novel. The two expedition charts and the linked monochrome scenes come from the original Strand-era illustrated edition; the broader maps provide historical geographic context.','proposal',1],
]
const lorePages=loreRows.map(([s,cat,title,body,visible,artNo])=>({...base,id:id('lore',s),categoryId:id('lore-category',cat),title,body,tags:[],coverImageId:I(`strand-${artNo}`),linkedEntityIds:[],visibleFromEventId:EV(visible)}))

const factRows=[
 ['malone-motive','Malone seeks a danger worthy of Gladys’s ideal','His expedition begins as an attempt to become the sort of hero Gladys says she could love.','proposal'],
 ['challenger-claim','Challenger claims prehistoric animals survive on a South American plateau','The disputed proposition becomes the expedition’s central question.','private-evidence'],
 ['maple-white-evidence','Maple White left drawings and observations of the plateau','The dead artist’s sketchbook links separate physical clues to a particular landscape.','private-evidence'],
 ['plateau-exists','The chalk-ringed plateau exists','The expedition reaches the landform shown in Challenger’s evidence.','cliff-camp'],
 ['gomez-motive','Gomez joined to avenge a slave-raiding relative','His concealed grievance explains the destruction of the bridge.','bridge-destroyed'],
 ['dinosaurs-live','Living dinosaurs inhabit Maple White Land','All four explorers directly observe stegosaurs at the forest pool.','stegosaurs'],
 ['lake','A large lake lies at the plateau’s centre','Malone discovers and names the inland water during his solo journey.','night-march'],
 ['plateau-people','Human inhabitants survive beneath the northern cliffs','Their conflict with the ape-men reveals a social history the first surveys missed.','ape-war'],
 ['tunnel','A natural tunnel crosses the cliffs','Plateau guides disclose the route that allows the expedition to escape.','escape-route'],
 ['diamonds','The pterodactyl swamp’s blue clay contains diamonds','Roxton’s private geological observation becomes the expedition’s material fortune.','diamond-clay'],
 ['gladys-married','Gladys married during Malone’s absence','The news breaks the link between Malone’s achievement and his original romantic reward.','gladys-return'],
 ['living-proof','The expedition returned with a living pterodactyl','Its escape above Queen’s Hall ends the public dispute.','queens-hall-proof'],
]
const knowledgeFacts=factRows.map(([s,title,description,event])=>({...base,id:K(s),title,description,tags:[],readerLearnsAtEventId:EV(event),originEventId:EV(event)}))
const revealRows=[
 ['malone-motive','malone','proposal'],['challenger-claim','malone','private-evidence'],['challenger-claim','mcardle','commission'],['maple-white-evidence','malone','private-evidence'],['plateau-exists','malone','cliff-camp'],['plateau-exists','challenger','cliff-camp'],['plateau-exists','summerlee','cliff-camp'],['gomez-motive','roxton','bridge-destroyed'],['gomez-motive','malone','bridge-destroyed'],['dinosaurs-live','malone','stegosaurs'],['dinosaurs-live','summerlee','stegosaurs'],['lake','malone','night-march'],['plateau-people','malone','ape-war'],['plateau-people','challenger','ape-war'],['tunnel','malone','escape-route'],['diamonds','malone','diamond-clay'],['gladys-married','malone','gladys-return'],['living-proof','mcardle','queens-hall-proof'],
]
const knowledgeReveals=revealRows.map(([fact,character,event])=>({...base,id:id('reveal',`${fact}-${character}`),factId:K(fact),characterId:C(character),eventId:EV(event),note:`${characters.find(x=>x.id===C(character)).name} learns: ${knowledgeFacts.find(x=>x.id===K(fact)).title}.`}))
const goalRows=[
 ['malone-prove','malone','want','Undertake a danger that proves his courage to Gladys.','proposal','gladys-return'],['malone-own-purpose','malone','need','Choose adventure and work for reasons that belong to him.','gladys-return','diamond-division'],
 ['challenger-vindication','challenger','want','Make the scientific world acknowledge the plateau and its living fauna.','private-evidence','queens-hall-proof'],['summerlee-test','summerlee','want','Test Challenger’s claim through direct observation and rigorous specimens.','institute','queens-hall-proof'],
 ['roxton-protect','roxton','want','Bring the expedition through the Amazon and plateau alive.','roxton-rooms','zambo-reunion'],['gomez-revenge','gomez','want','Trap Roxton beyond rescue in revenge for the Amazon campaign.','manaos-orders','bridge-destroyed'],['zambo-duty','zambo','want','Maintain the lower camp until the summit party returns.','tree-crossing','zambo-reunion'],
]
const characterGoals=goalRows.map(([s,character,type,text,start,end])=>({...base,id:id('goal',s),characterId:C(character),type,text,startEventId:EV(start),endEventId:EV(end)}))

const travelModes=[
 ['ship','Steamship','sea',18,'#58788a'],['canoe','Canoe','water',5,'#557c77'],['foot','On Foot','land',3,'#746954'],['climb','Rope and Climbing','land',1,'#7b5948'],
].map(([s,name,type,speed,color])=>({...base,id:id('travel-mode',s),name,type,speed,color,icon:'route'}))
const mapRoutes=[
 {...base,id:id('route','atlantic'),mapLayerId:M('atlantic'),name:'England to the Amazon',routeType:'sea',waypoints:[L('southampton'),L('atlantic-crossing'),L('amazon-gate')],color:'#4f7180',notes:'The outward and homeward Atlantic voyage.'},
 {...base,id:id('route','approach'),mapLayerId:M('approach'),name:'Manaos to the Cliffs',routeType:'mixed',waypoints:[L('manaos'),L('indian-village'),L('rapids'),L('secret-stream'),L('base-camp'),L('plateau-gate')],color:'#6e6945',notes:'The canoe and overland route reconstructed in Malone’s rough map.'},
]
const locationSnapshots=[
 {...base,id:id('location-snapshot','bridge-lost'),locationMarkerId:L('tree-bridge'),eventId:EV('bridge-destroyed'),sortKey:1,status:'bridge destroyed',notes:'The felled tree is dropped into the chasm, closing the known route down.'},
 {...base,id:id('location-snapshot','ape-town-fallen'),locationMarkerId:L('ape-town'),eventId:EV('ape-war'),sortKey:2,status:'ape-men defeated',notes:'The eastern settlement loses its power after the allied assault.'},
 {...base,id:id('location-snapshot','tunnel-open'),locationMarkerId:L('escape-tunnel'),eventId:EV('escape-route'),sortKey:3,status:'route revealed',notes:'The plateau guides disclose the hidden passage through the cliff.'},
]

const data={
 version:16,type:'worldbreaker-export',exportedAt:now,
 world:{id:worldId,name:'The Lost World',description:'Arthur Conan Doyle’s adventure follows reporter Edward Malone and three formidable explorers from London into an isolated South American plateau where prehistoric animals, rival peoples, scientific ambition, and the problem of returning with believable proof test every idea of heroism.',coverImageId:I('cover'),theme:'theme-action',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1911,yearSuffix:' (editorial chronology)',months:[['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],['July',31],['August',31],['September',30],['October',31],['November',30],['December',31]].map(([name,days])=>({name,days}))},wordTarget:null},
 mapLayers:maps,locationMarkers:locations,characters,items,characterSnapshots,characterMovements,itemPlacements,itemSnapshots,locationSnapshots,relationships:relRows,relationshipSnapshots,
 timelines:[{id:timelineId,worldId,name:'The Expedition, 1911–1912',description:'A single chronology from Malone’s London commission through the expedition and its return.',color:'#667665',dayOffset:0,createdAt:now}],chapters,events,blobs,travelModes,timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes,mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],loreCategories,lorePages,factions,factionMemberships,factionRelationships,knowledgeFacts,knowledgeReveals,characterGoals,sceneTexts:[],plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[],
}

for(const child of maps.filter(m=>m.parentMapId))if(locations.filter(l=>l.linkedMapLayerId===child.id).length!==1)throw new Error(`Expected one gateway for ${child.name}`)
if(chapters.length!==16||new Set(events.map(e=>e.chapterId)).size!==16)throw new Error('All chapters require events')
if(characterSnapshots.length!==events.reduce((n,e)=>n+e.involvedCharacterIds.length,0))throw new Error('Snapshot coverage mismatch')
if(new Set(characterSnapshots.map(s=>`${s.eventId}:${s.characterId}`)).size!==characterSnapshots.length)throw new Error('Duplicate snapshot')
for(const group of [characters.map(x=>x.portraitImageId),items.map(x=>x.imageId),locations.map(x=>x.imageId)])if(new Set(group).size!==group.length)throw new Error('Illustrations repeat within an entity group')
const entityImages=[...characters.map(x=>x.portraitImageId),...items.map(x=>x.imageId),...locations.map(x=>x.imageId)]
if(new Set(entityImages).size!==entityImages.length)throw new Error('Entity illustrations must be unique across characters, items, and locations')
const mapImages=new Set(maps.map(x=>x.imageId));for(const imageId of entityImages){if(mapImages.has(imageId))throw new Error('Map used as entity art');const slug=imageId.replace(`${P}-image-`,'');if(!reviewedArt[slug])throw new Error(`${slug} lacks review notes`)}
for(const e of events){if(e.tension<1||e.tension>5||e.travelDays<0||!Number.isInteger(e.inWorldTime))throw new Error(`${e.title}: bad pacing/calendar`);for(const id of e.involvedCharacterIds)if(!characters.some(x=>x.id===id))throw new Error(`${e.title}: bad character`);if(!locations.some(x=>x.id===e.locationMarkerId))throw new Error(`${e.title}: bad location`)}
for(const [event,day] of [['proposal',309],['river-journey',579],['secret-tributary',595],['queens-hall-proof',676]])if(events.find(e=>e.id===EV(event))?.inWorldTime!==day)throw new Error(`${event} calendar drift`)

const text=`${JSON.stringify(data,null,2)}\n`
fs.writeFileSync('example/The Lost World.pwk',text)
fs.writeFileSync('public/library/the-lost-world.pwk',text)
const index=JSON.parse(fs.readFileSync('public/library/index.json','utf8'))
const entry={id:'the-lost-world',title:'The Lost World',author:'Arthur Conan Doyle',blurb:'A reporter, two rival professors, and a veteran explorer cross into an isolated plateau where prehistoric life survives—and must return with proof the world cannot dismiss.',data:'the-lost-world.pwk',dataBytes:Buffer.byteLength(text),counts:{characters:characters.length,chapters:chapters.length,events:events.length,locations:locations.length},notice:'Unofficial reference for a public-domain novel. This example contains original structural summaries and an editorial calendar, not the novel’s prose. Historical maps and public-domain book illustrations are linked in the file.',worldId,cover:coverUrl}
const at=index.entries.findIndex(x=>x.id===entry.id);if(at>=0)index.entries[at]=entry;else index.entries.push(entry)
fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)
console.log(JSON.stringify({chapters:chapters.length,events:events.length,characters:characters.length,relationships:relRows.length,locations:locations.length,maps:maps.length,items:items.length,threads:plotThreads.length,lore:lorePages.length,factions:factions.length,facts:knowledgeFacts.length,goals:characterGoals.length,bytes:Buffer.byteLength(text)},null,2))
