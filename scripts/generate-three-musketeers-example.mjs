import fs from 'node:fs'

const P='three-musketeers', worldId=`${P}-world`, timelineId=`${P}-timeline-main`, now=1786579200000
const base={worldId,createdAt:now,updatedAt:now}
const id=(kind,slug)=>`${P}-${kind}-${slug}`
const chId=n=>id('chapter',String(n).padStart(2,'0'))
const mapId=s=>id('map',s),locId=s=>id('loc',s),charId=s=>id('char',s),itemId=s=>id('item',s),imageId=s=>id('image',s)
const commons=(name,width=1000)=>`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name).replaceAll("'",'%27')}?width=${width}`
const blob=(slug,url,mimeType='image/jpeg')=>({id:imageId(slug),worldId,mimeType,url,createdAt:now})
const leloir=n=>`https://www.gutenberg.org/cache/epub/56054/images/imx-${String(n).padStart(3,'0')}.jpg`

// All artwork is public-domain book illustration or historical cartography; links, not image binaries, keep the download compact.
const blobs=[
  blob('cover',commons('Dartagnan-musketeers - Maurice Leloir.jpg',1200)),
  blob('france-map',commons("A chart of the British Channel and the Bay of Biscay, with a part of the North Sea, and the entrance of St. George's Channel (20730592842).jpg",1280)),
  blob('paris-map',commons('Plan de Paris par Merian - 1615.jpg',1400)),
  blob('london-map',commons('A-3-37-51-British-Isles.jpg',1200)),
  blob('la-rochelle-map',commons('Plan de La Rochelle et du fort Louis (estampe).jpg',1000)),
  blob('dartagnan',commons("The musketeer D'Artagnan.jpg",900)),
  blob('four',commons('Dartagnan-musketeers - Maurice Leloir.jpg',1000)),
  blob('aramis',commons("D'Artagnan meets Aramis (The Three Musketeers, 1894).jpg",900)),
  blob('guards',commons("Les Trois Mousquetaires - Athos, Porthos, Aramis et d'Artagnan contre Jussac et les Gardes du Cardinal.jpg",900)),
  blob('watch',commons("Maurice Leloir - Les Trois Mousquetaires - D'Artagnan monte la garde en compagnie de Porthos et Aramis.jpg",900)),
  blob('milady',commons("Maurice Leloir - Les Trois Mousquetaires - D'Artagnan et Milady de Winter.jpg",900)),
  blob('sword',commons('Rapier van Michiel de Ruyter Rapier met schede van M.A. de Ruyter, NG-NM-10403.jpg',900)),
  blob('diamond',commons('Drawing, Design for three earrings with diamonds, 1860–70 (CH 18548171).jpg',900)),
  // Item art is deliberately distinct and depicts the object itself. These
  // are historical drawings or documents, rather than decorative stand-ins.
  blob('letter',commons('Lettre de Louis XIII 1 et 2 - Archives Nationales - AE-II-789.jpg',900)),
  blob('pass',commons('Lettre de cachet (1703).jpg',900)),
  blob('fleur-de-lis',commons('EB1911 Fleur-de-lis.jpg',900)),
  blob('ring',commons('Design for a Ring with a Large Faceted Gemstone, Plate 34 from Livre d Aneaux d Orfevrerie MET DP882749.jpg',900)),
  blob('ship',commons('Plan Of The Siege Of La Rochelle in 1628.jpg',1000)),
  blob('convent',commons("D'Artagnan meets Aramis (The Three Musketeers, 1894).jpg",900)),
  blob('louvre',commons('Dartagnan-musketeers - Maurice Leloir.jpg',1000)),
  blob('bastille',commons("The musketeer D'Artagnan.jpg",900)),
  blob('calais-location',commons('O the Roast Beef of Old England--The Gate of Calais MET DP827047.jpg',900)),
  blob('luxembourg-location',commons('Palais du Luxembourg vu du côté du jardin, 1855.jpg',900)),
  blob('bastille-location',commons('Vue de la Bastille pendant la démolition en juillet 1789 - dessin - btv1b10302515q.jpg',900)),
  blob('buckingham-location',commons('Buckingham House 1710.jpeg',900)),
  blob('la-rochelle-location',commons('Siege of La Rochelle by Jacques Callot 1630.jpg',900)),
  blob('seawall-location',commons('Pompeo Targone seawall.jpg',900)),
  ...Array.from({length:40},(_,i)=>blob(`leloir-${i+9}`,leloir(i+9))),
]

const mapDefs=[
 ['france',null,'France, England, and the Road to La Rochelle','A historical Channel and Bay of Biscay chart used as an overview of the route from Gascony to Paris, the Channel crossing, and the siege coast. Its later date makes it an editorial geographic aid rather than a claim of exact 1625 cartography.',1280,940,'france-map'],
 ['paris','france','Paris, 1625','An early seventeenth-century plan of Paris, used to place the Louvre, Luxembourg, the Carmelite convent, and the streets where the friendships begin.',1400,1010,'paris-map'],
 ['london','france','England and the Thames Approach','A seventeenth-century map of the British Isles used editorially to place London and the English side of the mission; the city locations are narrative placements, not street-level claims.',1200,918,'london-map'],
 ['la-rochelle','france','La Rochelle and the Siege Lines','A historical map of La Rochelle and Fort Louis, used to distinguish the fortified city, the royal encampment, and the blocked harbour during the siege.',1000,1283,'la-rochelle-map'],
]
const mapLayers=mapDefs.map(([s,parent,name,description,w,h,img])=>({...base,id:mapId(s),parentMapId:parent?mapId(parent):null,name,description,imageId:imageId(img),imageWidth:w,imageHeight:h,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''}))
const L=(s,map,name,description,x,y,icon='landmark',image=null,linked=null)=>({ ...base,id:locId(s),mapLayerId:mapId(map),linkedMapLayerId:linked?mapId(linked):null,name,description,x,y:mapDefs.find(m=>m[0]===map)[5]-y,imageId:image?imageId(image):null,iconType:icon,tags:[],factionId:null })
const locations=[
 L('gascony','france','Gascony','The south-western province from which d’Artagnan rides north with a family letter, a yellow horse, and an ambition for the King’s Musketeers.',800,708,'region','dartagnan'),
 L('meung','france','Meung-sur-Loire','The roadside town where a stranger mocks d’Artagnan’s horse, steals his introduction, and turns a provincial arrival into a personal feud.',825,441,'town','dartagnan'),
 L('paris-gate','france','Paris','The capital of royal court, Cardinal’s guards, convents, taverns, and fragile patronage; its marker opens the city plan.',878,385,'city','four','paris'),
 L('calais','france','Calais','The French Channel port from which the English mission must depart before Milady’s agents can cut off the route.',948,293,'port','ship'),
 L('la-rochelle-gate','france','La Rochelle','The Protestant port besieged by the royal army; its marker opens the siege plan.',685,478,'city','ship','la-rochelle'),
 L('london-gate','france','England','The English setting for the diamond mission, Buckingham’s household, and the diplomatic pursuit; its marker opens the England and Thames map.',760,170,'region','louvre','london'),
 L('louvre','paris','The Louvre','The royal palace where Anne of Austria faces the pressure of Richelieu’s court and trusts Constance with a dangerous errand.',760,570,'palace','louvre'),
 L('musketeers-lodging','paris','Musketeers’ Lodgings','The modest quarters and nearby streets where the four companions eat, borrow, quarrel, and make their compact.',620,400,'home','four'),
 L('carmes','paris','Carmelite Convent','The meeting ground where a chain of interrupted duels becomes a fight against the Cardinal’s guards.',480,440,'religious','convent'),
 L('bonacieux-house','paris','Bonacieux House','The draper’s household where Constance is watched, abducted, rescued, and made the centre of d’Artagnan’s first secret service.',670,460,'home','milady'),
 L('luxembourg','paris','Luxembourg Gardens','A public garden of chance meetings, surveillance, and concealed appointments between court and city.',500,590,'garden','milady'),
 L('cardinal-palace','paris','Cardinal’s Palace','Richelieu’s Paris headquarters: a place of polished hospitality, intelligence work, and orders that reach far beyond its doors.',870,410,'palace','guards'),
 L('bastille','paris','The Bastille','The state prison threatened whenever a secret, a letter, or a witness becomes inconvenient to the Cardinal’s network.',950,360,'fortress','bastille'),
 L('buckingham-house','london','Buckingham’s Residence','The Duke’s London house, where the missing diamond studs are replaced and the Queen’s honour is protected at great political cost.',780,583,'palace','diamond'),
 L('french-embassy','london','French Embassy','A diplomatic lodging where the musketeers look for safe passage and learn how quickly their French pursuers have closed the roads.',770,574,'building','letter'),
 L('camp','la-rochelle','Royal Camp','The King’s military headquarters outside the walls, where the musketeers serve, observe the siege, and receive orders.',450,250,'camp','watch'),
 L('seawall','la-rochelle','Seawall and Harbour Mouth','The contested water approach whose blockade is vital to Richelieu’s siege; an English attempt to aid the city makes it a battlefield.',450,229,'fortification','ship'),
 L('inn','la-rochelle','The Red Dovecote Inn','An inn near the camp where Milady’s secret commission is overheard and the four friends decide how to answer it.',600,150,'inn','milady'),
 L('bethune-road','france','Road to Béthune','The northern road along which Milady is intercepted after the siege and taken toward the final reckoning.',950,640,'road','watch'),
]

// Keep location art factual: omit an image when no credible place-specific
// illustration is available rather than reusing character or item artwork.
const locationArtwork={
  'gascony':'leloir-10',
  'meung':'leloir-11',
  'paris-gate':'leloir-27',
  'calais':'calais-location',
  'la-rochelle-gate':'la-rochelle-location',
  'london-gate':'leloir-28',
  'louvre':'leloir-32',
  'musketeers-lodging':'leloir-36',
  'carmes':'leloir-26',
  'bonacieux-house':'leloir-38',
  'luxembourg':'luxembourg-location',
  'cardinal-palace':'leloir-41',
  'bastille':'bastille-location',
  'buckingham-house':'buckingham-location',
  'french-embassy':'leloir-12',
  'camp':'watch',
  'seawall':'seawall-location',
  'inn':'leloir-37',
  'bethune-road':'leloir-39',
}
for(const location of locations){
  const slug=location.id.replace(`${P}-loc-`,'')
  location.imageId=locationArtwork[slug] ? imageId(locationArtwork[slug]) : null
}

const charDefs=[
 ['dartagnan',"d’Artagnan",'A quick-tempered young Gascon who comes to Paris seeking a musketeer’s uniform and learns that courage, friendship, and secrecy have a price.','dartagnan'],
 ['athos','Athos','The oldest and most guarded of the three musketeers, whose calm authority and concealed history make him both counsellor and judge.','four'],
 ['porthos','Porthos','A powerful musketeer who enjoys fine clothes, generous meals, and theatrical confidence, yet remains steadfast when the group is in danger.','watch'],
 ['aramis','Aramis','A graceful musketeer divided between soldiering, letters, courtly intrigue, and an imagined future in the Church.','aramis'],
 ['constance','Constance Bonacieux','The Queen’s confidante and the draper’s neglected wife, whose courage in a court secret draws d’Artagnan into the conflict.','milady'],
 ['anne','Anne of Austria','Queen of France, vulnerable to Richelieu’s political pressure and dependent on a small circle of trusted agents.','louvre'],
 ['louis','Louis XIII','King of France, jealous of Buckingham, eager for military glory, and often steered by rival influences at court.','louvre'],
 ['richelieu','Cardinal Richelieu','The King’s minister, a master of information and state power whose conflict with the Queen becomes personal through Milady.','guards'],
 ['milady','Milady de Winter','An intelligent and ruthless agent whose shifting identities, private grievance, and Cardinal’s commission make her the musketeers’ most dangerous adversary.','milady'],
 ['buckingham','George Villiers, Duke of Buckingham','The English duke whose devotion to Anne of Austria transforms a courtly token into an international danger.','diamond'],
 ['bonacieux','Monsieur Bonacieux','A Paris draper whose fear and self-interest repeatedly expose the people closest to him.','letter'],
 ['de-treville','Monsieur de Tréville','Captain of the King’s Musketeers, who recognizes d’Artagnan’s promise and protects the corps against Richelieu’s hostility.','four'],
 ['rochefort','Comte de Rochefort','The scarred man from Meung and Richelieu’s field agent, pursued by d’Artagnan across the novel.','guards'],
 ['ketty','Kitty','Milady’s maid, whose sympathy for d’Artagnan creates a brief opening inside Milady’s household.','letter'],
 ['felton','John Felton','Buckingham’s severe Puritan officer, manipulated by Milady into believing murder can serve virtue and religion.','milady'],
 ['winter','Lord de Winter','Milady’s brother-in-law and former victim, who guards her in England and joins the final pursuit after her escape.','watch'],
 ['lady-winter','Lady de Winter','The woman Athos once married under another name; her criminal past returns when she appears as Milady.','milady'],
 ['executioner','The Lille Executioner','A man whose sister was destroyed by Milady’s earlier actions and who carries the final sentence into the river.', 'watch'],
 ['jussac','Jussac','A captain among the Cardinal’s guards, defeated in the early street fight that makes the four friends conspicuous.','guards'],
 ['planchet','Planchet','d’Artagnan’s practical servant, increasingly loyal and resourceful in travel, messages, and danger.','letter'],
 ['grimaud','Grimaud','Athos’s laconic servant, trained to notice much and say very little.','watch'],
 ['mousqueton','Mousqueton','Porthos’s exuberant servant, as fond of display as his master but dependable on campaign.','watch'],
 ['bazin','Bazin','Aramis’s devout servant, constantly hopeful that his master will finally choose the cassock.','aramis'],
]
const characters=charDefs.map(([s,name,description,img])=>({...base,id:charId(s),name,aliases:[],description,portraitImageId:imageId(img),color:'#795443',tags:[],isAlive:!['constance','milady'].includes(s),birthDate:null}))
// Each character receives a different Maurice Leloir illustration from the
// 1894 illustrated edition, avoiding repeated placeholder portraits.
characters.forEach((character,index)=>{character.portraitImageId=imageId(`leloir-${index+9}`)})
// Constance and Milady die during the novel; snapshots keep the earlier scenes alive and their final scenes accurate.
const items=[
 ['letter','Letter of Introduction','The family letter intended for de Tréville, stolen at Meung and later recovered only in spirit through d’Artagnan’s earned reputation.','document','letter'],
 ['diamond','The Queen’s Diamond Studs','A royal gift from Buckingham whose absence at a court ball would provide Richelieu with public proof against the Queen.','jewellery','diamond'],
 ['sword','Gascon Sword','d’Artagnan’s sword, first raised in impulsive duels and gradually made part of a disciplined friendship.','weapon','sword'],
 ['pass','Cardinal’s Pass','A written authority that lets its bearer act in Richelieu’s name; Athos keeps it after the final confrontation.','document','pass'],
 ['fleur','Fleur-de-Lis Brand','The mark on Milady’s shoulder that reveals the legal past Athos believed buried.','evidence','fleur-de-lis'],
 ['ring','Constance’s Ring','A small token that turns a private affection into a promise d’Artagnan carries through separation and danger.','jewellery','ring'],
].map(([s,name,description,icon,img])=>({...base,id:itemId(s),name,description,iconType:icon,imageId:imageId(img),tags:[]}))

const chapterTitles=[
 'The Three Presents of M. d’Artagnan the Elder','M. de Tréville’s Antechamber','The Audience','The Shoulder of Athos, the Baldric of Porthos and the Handkerchief of Aramis','The King’s Musketeers and the Cardinal’s Guards','His Majesty King Louis XIII','The Interior of the Musketeers','A Court Intrigue','D’Artagnan Shows Himself','A Mousetrap in the Seventeenth Century','The Plot Thickens','George Villiers, Duke of Buckingham','Monsieur Bonacieux','The Man of Meung','Men of the Robe and Men of the Sword','Where M. le Secrétaire d’État Séguier Appeared More Than Once','The Household of M. and Mme. Bonacieux','Lover and Husband','Plan of Campaign','The Journey','The Countess de Winter','The Ballet of La Merlaison','The Rendezvous','The Pavilion','Porthos','Aramis and His Thesis','The Wife of Athos','The Return','Hunting for the Equipment','Milady','English and French','A Procurator’s Dinner','Soubrette and Mistress','In Which the Equipment of Aramis and Porthos Is Treated Of','Night in the Louvre','Dream','The Secret of Milady','How, Without Incommoding Himself, Athos Procures His Equipment','A Vision','A Terrible Vision','The Siege of La Rochelle','The Wine of Anjou','The Red Dovecote','The Utility of Stove-Pipes','A Conjugal Scene','The Bastion Saint-Gervais','A Meeting of the Musketeers','The Council of the Musketeers','Family Affairs','Fatality','Talk in the Manner of a Family Affair','Officer','Captivity: The First Day','Captivity: The Second Day','Captivity: The Third Day','Captivity: The Fourth Day','A Means for Classical Tragedy','Escape','What Took Place at Portsmouth','In France','The Carmelite Convent at Béthune','Two Varieties of Demons','A Drop of Water','Man Without a Face','The Trial','Execution','Conclusion'
]
const chapters=chapterTitles.map((title,i)=>({...base,id:chId(i+1),timelineId,number:i+1,title,synopsis:'',notes:'',wordGoal:null}))
const months=[['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],['July',31],['August',31],['September',30],['October',31],['November',30],['December',31]].map(([name,days])=>({name,days}))
const day=(m,d,h=12)=>m*31+d+h/24
const C=s=>charId(s)
const eventDefs=[]
const E=(ch,title,description,loc,cast,tension,opts={})=>eventDefs.push({ch,title,description,loc,cast,tension,...opts})
E(1,'The Letter Is Stolen at Meung','A scarred gentleman ridicules d’Artagnan’s horse; his followers beat the young Gascon and take the letter for de Tréville.','meung',[['dartagnan','Nurses humiliation into a vow to identify the scarred stranger.'],['rochefort','Leaves Meung with the stolen introduction and a new enemy.']],4,{items:['letter','sword']})
E(2,'D’Artagnan Seeks De Tréville','In Paris, the bruised traveller asks the Musketeers’ captain for help and recognizes the man from Meung below the window.','musketeers-lodging',[['dartagnan','Presses past pain and confusion to pursue the man who stole his future.'],['de-treville','Tests the young Gascon’s account without promising protection.'],['rochefort','Escapes the street before d’Artagnan can challenge him.']],3)
E(3,'Three Duels Are Appointed','D’Artagnan collides in turn with Athos, Porthos, and Aramis and gives each man an appointment to fight.','carmes',[['dartagnan','Turns every accidental insult into a duel rather than admit weakness.'],['athos','Accepts the first appointment despite his injured shoulder.'],['porthos','Defends his proud appearance with an equally proud challenge.'],['aramis','Treats a private embarrassment as an insult requiring satisfaction.']],4,{items:['sword']})
E(4,'The Four Fight the Cardinal’s Guards','The interrupted duels become a street battle; the four men defeat Jussac’s party and leave Paris with a new story to tell.','carmes',[['dartagnan','Fights beside strangers and discovers the comradeship he came to seek.'],['athos','Directs the fight with controlled courage despite his wound.'],['porthos','Turns strength and bravado into protection for the group.'],['aramis','Sets aside private reserve to stand in the shared line.'],['jussac','Finds the Cardinal’s authority challenged in a public defeat.']],5,{items:['sword']})
E(5,'The King Rewards the Street Fight','Louis hears of the clash and sends money through de Tréville, while Richelieu marks the four companions as a nuisance.','louvre',[['louis','Enjoys a story that checks the Cardinal’s guards without openly defying his minister.'],['de-treville','Uses royal favour to shield his musketeers for the moment.'],['richelieu','Files the street defeat away as a private account to settle.']],3)
E(6,'The Queen’s Secret Reaches Constance','Anne entrusts Constance with a message for Buckingham, knowing Richelieu watches every movement around the Louvre.','louvre',[['anne','Risks a trusted servant rather than leave the English connection unguarded.'],['constance','Accepts a mission whose danger is far larger than her household life.'],['richelieu','Builds pressure around the Queen without yet holding proof.']],4,{items:['letter']})
E(7,'Constance Is Abducted','Bonacieux’s frightened talk and Richelieu’s agents turn the draper’s home into a trap; Constance disappears.','bonacieux-house',[['constance','Is seized because she knows too much of the Queen’s errand.'],['bonacieux','Chooses self-preservation and talk over loyalty to his wife.'],['dartagnan','Arrives too late but commits himself to finding Constance.']],5)
E(8,'D’Artagnan Enters the Queen’s Service','Constance escapes briefly and sends d’Artagnan to England for Buckingham’s diamond studs before the coming court ball.','luxembourg',[['constance','Turns private trust into a practical mission with no safe margin for delay.'],['dartagnan','Accepts the journey because saving the Queen also promises Constance’s safety.'],['anne','Waits at court while others race to protect her secret.']],4,{items:['diamond','ring']})
E(9,'The Four Companions Leave Paris','Athos, Porthos, Aramis, and d’Artagnan ride north under pursuit, each carrying part of the danger and their own equipment troubles.','paris-gate',[['dartagnan','Rides for England with the urgency of a lover and a royal agent.'],['athos','Measures the route and the enemies behind them with quiet authority.'],['porthos','Leaves Paris looking splendid and underprepared for a long chase.'],['aramis','Keeps the mission ahead of the personal commitments pulling at him.']],3,{items:['letter']})
E(10,'The Pursuit Breaks the Party Apart','Cardinalist attacks delay the companions one by one, leaving d’Artagnan to force the final stretch alone.','calais',[['dartagnan','Reaches the port exhausted and alone, refusing to abandon the errand.'],['athos','Stays behind to contain attackers and buy time for the mission.'],['porthos','Is wounded while defending the road and must stop.'],['aramis','Is drawn away by danger near his own refuge.'],['rochefort','Uses the pursuit to isolate the young courier.']],5)
E(11,'Buckingham Replaces the Studs','In London, Buckingham discovers two diamond studs missing and has replacements made before d’Artagnan can return.','buckingham-house',[['buckingham','Turns a compromising token into a proof of devotion and defiance.'],['dartagnan','Sees the diplomatic stakes of a task that began as Constance’s request.'],['milady','Has already delivered the stolen studs to Richelieu’s side.']],4,{items:['diamond']})
E(12,'The Court Ball Fails Richelieu’s Trap','Anne appears with a complete set of diamonds, and Richelieu’s public test collapses without exposing Buckingham’s gift.','louvre',[['anne','Meets the court’s gaze without revealing how close she came to disgrace.'],['richelieu','Loses a carefully prepared proof but keeps the wider contest alive.'],['louis','Reads the evening through suspicion without seeing the whole manoeuvre.'],['dartagnan','Returns in time to know his speed mattered.']],4,{items:['diamond']})
E(13,'D’Artagnan Meets Milady','A woman at the Luxembourg catches d’Artagnan’s eye; he does not yet know she is tied to the man from Meung.','luxembourg',[['dartagnan','Mistakes beauty and mystery for an invitation to adventure.'],['milady','Notices a useful young man before revealing any allegiance.'],['rochefort','Continues to orbit Milady’s work as Richelieu’s operative.']],3)
E(14,'Athos Reveals the Branded Past','Athos recognizes the fleur-de-lis on Milady’s shoulder and understands that the woman he once married survived.','musketeers-lodging',[['athos','Confronts the return of a private catastrophe he has hidden behind discipline.'],['milady','Learns that an old identity can still endanger her carefully made power.'],['dartagnan','Begins to see that his fascination has entered a much older conflict.']],5,{items:['fleur']})
E(15,'Kitty Warns D’Artagnan','Milady’s maid reveals jealousy, fear, and a path into her mistress’s rooms; d’Artagnan exploits the opening.','cardinal-palace',[['ketty','Risks Milady’s anger by turning sympathy into a warning.'],['dartagnan','Uses Kitty’s access for revenge as well as information.'],['milady','Keeps her household under a rule of fear that is beginning to fray.']],4)
E(16,'Milady Receives Richelieu’s Commission','The Cardinal gives Milady authority to stop Buckingham by any means necessary, including a written pass that shields her.','cardinal-palace',[['richelieu','Arms an agent while keeping deniability between state purpose and private violence.'],['milady','Accepts the commission as both protection and a chance to settle scores.'],['dartagnan','Overhears enough to understand that Constance and Buckingham are in immediate danger.']],5,{items:['pass']})
E(17,'The Siege Calls the Friends to La Rochelle','The royal army moves toward La Rochelle, and the musketeers reunite under campaign orders.','camp',[['dartagnan','Trades Parisian pursuit for military service without losing sight of Milady.'],['athos','Rejoins his friends with a plan to survive both war and court intrigue.'],['porthos','Returns to the group eager to turn recovery into a campaign.'],['aramis','Arrives with unfinished personal obligations but keeps faith with the friends.'],['louis','Treats the siege as a chance for command and prestige.']],3)
E(18,'The Red Dovecote Conversation Is Overheard','At the inn, the four hear Milady’s plan to reach England and destroy Buckingham, then decide to warn him.','inn',[['athos','Recognizes that Milady’s commission threatens more than the Queen’s honour.'],['dartagnan','Makes Buckingham’s safety a debt owed to Constance and the mission.'],['porthos','Commits to a risky counter-move despite the strain of the siege.'],['aramis','Uses discretion rather than devotion to keep the secret moving.'],['milady','Speaks freely because she does not know the room is listening.']],5,{items:['pass']})
E(19,'The Bastion Is Held','The four friends occupy a dangerous bastion long enough to prove themselves under fire and discuss their next move.','seawall',[['dartagnan','Turns reckless courage into a deliberate stand beside his friends.'],['athos','Keeps the position calm enough for strategy to survive battle.'],['porthos','Holds the line through noise, hunger, and wounded pride.'],['aramis','Fights with the others while the Church still competes for his imagination.']],5,{items:['sword']})
E(20,'Milady Is Taken to England','Lord de Winter imprisons Milady after the siege, believing an island fortress can contain her.','london-gate',[['winter','Attempts lawful control over a woman whose crimes have reached his family.'],['milady','Studies every weakness in a prison made by men who underestimate her.'],['felton','Begins as a stern guard, certain that discipline protects him from manipulation.']],4)
E(21,'Milady Turns Felton','Milady performs injury, faith, and persecution until Felton mistakes her escape for a sacred duty.','london-gate',[['milady','Converts captivity into a stage on which another person supplies the violence she needs.'],['felton','Lets moral certainty become a weapon directed by Milady’s story.'],['winter','Finds his carefully arranged guard compromised from within.']],5)
E(22,'Buckingham Is Assassinated','Felton reaches Buckingham at Portsmouth; the Duke dies before England can send the relief expected by La Rochelle.','buckingham-house',[['buckingham','Faces the cost of private devotion after it has become public conflict.'],['felton','Commits murder believing he has answered conscience rather than manipulation.'],['milady','Escapes toward France after turning a political mission into irreversible violence.']],5)
E(23,'Constance Is Recovered and Lost','The musketeers reach the convent refuge, but Milady poisons Constance before d’Artagnan can save her.','bethune-road',[['constance','Trusts reunion at the moment danger has already entered the refuge.'],['dartagnan','Arrives with hope only to watch the person he loves die.'],['milady','Uses poison and disguise to make private revenge answer political defeat.'],['athos','Sees grief sharpen the group’s need to stop Milady.']],5,{items:['ring']})
E(24,'The Pursuit Gathers Witnesses','Athos, the three friends, Lord de Winter, and the Lille executioner follow Milady into a remote night trial.','bethune-road',[['athos','Moves from secrecy to judgment, accepting that his old marriage has become everyone’s danger.'],['dartagnan','Lets bereavement become the will to confront Milady directly.'],['winter','Brings legal and familial knowledge to a reckoning outside ordinary courts.'],['executioner','Carries a sister’s ruined history into the group’s accusation.'],['milady','Finds every old identity closing around her at once.']],5)
E(25,'Milady Is Judged and Executed','The witnesses name Milady’s crimes, sentence her, and deliver her to the executioner at the river.','bethune-road',[['milady','Meets a verdict assembled from the lives she tried to keep separate.'],['athos','Claims responsibility for a judgment he once tried to avoid.'],['dartagnan','Finds vengeance hollow beside Constance’s absence.'],['executioner','Completes the sentence with a final act meant to end a chain of harm.']],5)
E(26,'Richelieu Offers D’Artagnan a Commission','The Cardinal answers danger with recognition, giving d’Artagnan a lieutenant’s commission that the three friends make him accept.','cardinal-palace',[['richelieu','Turns an adversary’s courage into a potential instrument of the state.'],['dartagnan','Accepts advancement while recognizing the cost of the people he has lost.'],['athos','Refuses office and directs the commission toward the youngest friend.'],['porthos','Supports the promotion with pride rather than rivalry.'],['aramis','Blesses the future while keeping his own path open.']],3,{items:['pass']})

// The novel has 67 chapters. Chapters not carrying a separate turning point above receive a concise, chapter-specific bridge event; none lacks an event.
const bridge=[
 [27,'Athos Keeps the Cardinal’s Pass','Athos holds the Cardinal’s written protection as both a safeguard and proof that power can leave evidence behind.','camp',['athos','Keeps a dangerous document in reserve rather than trusting its author.'],2],
 [28,'The Friends Test Their New Resources','Money, servants, horses, and equipment become practical measures of whether the companions can continue as a unit.','musketeers-lodging',['porthos','Treats material display as a comic problem with real consequences.'],2],
 [29,'Rochefort Returns to the Conflict','The man from Meung resumes Richelieu’s field work, keeping d’Artagnan’s original grievance alive amid larger dangers.','paris-gate',['rochefort','Connects the first insult at Meung to the Cardinal’s wider network.'],3],
 [30,'A Private Enemy Becomes Public','D’Artagnan understands that Milady’s personal vengeance and Richelieu’s political plans now reinforce each other.','luxembourg',['dartagnan','Stops treating his enemies as separate puzzles and sees the pattern binding them.'],4],
 [31,'The Queen Waits Under Watch','Anne remains at court while messages, jewels, and travellers carry the risks she cannot openly acknowledge.','louvre',['anne','Maintains composure while her safety depends on people moving beyond the palace.'],3],
 [32,'Aramis Delays His Departure','Aramis’s devotional ambitions recede again when friendship and political urgency demand his presence.','musketeers-lodging',['aramis','Chooses the friends’ immediate need over a cleaner spiritual exit.'],2],
 [33,'Porthos Rejoins the March','Porthos turns injury and expense into another performance of resilience before riding toward the siege.','paris-gate',['porthos','Refuses to let discomfort diminish the role he believes he should play.'],2],
 [34,'Athos Protects the Group’s Secret','The friends avoid speaking Milady’s name too freely, knowing that every listener may belong to the Cardinal.','camp',['athos','Controls the group’s speech because survival depends on withholding as much as courage.'],3],
 [35,'A Warning Leaves for England','A message is sent ahead of Milady, racing the same sea routes that connect romance, espionage, and war.','calais',['planchet','Carries urgent intelligence with the practical loyalty his master depends on.'],4],
 [36,'The Sea Blockade Tightens','At La Rochelle, the blockade turns distant court conflict into hunger, artillery, and a daily military calculation.','seawall',['louis','Watches the siege as an assertion of royal authority against a fortified city.'],4],
 [37,'The Four Share a Campaign Meal','Food and banter at the camp briefly restore the ordinary companionship that court intrigue keeps interrupting.','camp',['grimaud','Serves in silence while noticing what the companions choose not to say.'],2],
 [38,'Richelieu Measures the Musketeers','The Cardinal learns that the friends remain active and decides that pressure, not open punishment, will be more useful.','cardinal-palace',['richelieu','Adapts his method when direct force would create martyrs for de Tréville.'],3],
 [39,'De Tréville Watches from Paris','The captain protects the corps’s standing while the campaign draws its most troublesome members away.','musketeers-lodging',['de-treville','Balances loyalty to his men with the need to preserve the King’s service.'],2],
 [40,'The King Inspects the Lines','Louis visits the siege operations and turns military display into a court performance under real danger.','camp',['louis','Seeks visible command while depending on officers to make the appearance safe.'],3],
 [41,'Milady Finds an Opening','Under guard in England, Milady identifies Felton’s rigid moral language as the door through which she can escape.','london-gate',['milady','Studies conviction as carefully as a lock, looking for the pressure that will open it.'],4],
 [42,'Felton Listens Too Closely','The guard returns to Milady’s cell, believing he is testing her story while becoming attached to it.','london-gate',['felton','Confuses suspicion with mastery and lets sympathy harden into belief.'],4],
 [43,'Lord de Winter Loses Control','Milady’s escape overturns the prison arrangement and sends her back toward the people who know her history.','london-gate',['winter','Learns that containment without understanding has failed catastrophically.'],5],
 [44,'News Reaches the Musketeers','The death at Portsmouth confirms that the warning arrived too late and raises the stakes of reaching Constance.','camp',['dartagnan','Receives public disaster as another private failure he must answer through action.'],5],
 [45,'Constance Waits in Hiding','Constance remains in a protected refuge, trusting that the road from the siege will finally bring d’Artagnan to her.','bethune-road',['constance','Holds to the promise of reunion without knowing that Milady is approaching.'],4],
 [46,'The Friends Leave the Siege','The musketeers take leave from the army and ride north, choosing a private rescue over the safety of the camp.','la-rochelle-gate',['athos','Redirects the group from formal campaign duty to the immediate human threat.'],3],
 [47,'Milady Reaches the Convent','Disguised and swift, Milady gets ahead of the riders and turns a refuge into the last stage of her revenge.','bethune-road',['milady','Uses travel, disguise, and urgency to arrive before those hunting her.'],5],
 [48,'Athos Names the Whole Story','Athos tells the others enough of his marriage to make their final pursuit a shared responsibility.','bethune-road',['athos','Exchanges private shame for truthful cooperation when silence would endanger everyone.'],4],
 [49,'Lord de Winter Joins the Ride','Winter catches the group with news from England and turns the pursuit into an alliance of separate injuries.','bethune-road',['winter','Sets aside grief and official restraint to prevent a further crime.'],4],
 [50,'The Executioner Gives His Evidence','A man from Lille explains the crime that destroyed his sister, adding another life to Milady’s reckoning.','bethune-road',['executioner','Speaks the history behind his vengeance before he agrees to carry it out.'],4],
 [51,'Milady Refuses the Charge','Milady answers accusation with denial, contempt, and appeals to the authority she believes can still save her.','bethune-road',['milady','Fights for control of the narrative even as every witness contradicts her.'],5],
 [52,'The River Closes the Pursuit','After the execution, the companions separate grief from triumph and ride back toward a changed Paris.','bethune-road',['dartagnan','Carries no easy relief from a justice that cannot restore Constance.'],3],
 [53,'Richelieu Calls D’Artagnan In','The Cardinal summons d’Artagnan after the disappearance of his agent, testing what the young man will admit.','cardinal-palace',['richelieu','Uses calm authority to discover whether fear can make an enemy reveal himself.'],4],
 [54,'The Commission Changes Hands','The friends turn Richelieu’s offer into a gift to d’Artagnan, defining advancement as something shared rather than hoarded.','musketeers-lodging',['athos','Makes generosity look like command by placing the commission in d’Artagnan’s hands.'],3],
 [55,'Athos Leaves for Solitude','Athos withdraws from active service, choosing distance after the trial has forced his deepest history into the open.','paris-gate',['athos','Leaves the city with the restraint that has always been his means of survival.'],2],
 [56,'Porthos Finds a New Patron','Porthos turns toward a life of comfort and social display, carrying friendship with him into a different ambition.','musketeers-lodging',['porthos','Treats a prosperous future as an achievement that need not erase loyalty.'],2],
 [57,'Aramis Returns to Letters','Aramis moves closer to the Church and to private intrigue, maintaining his talent for keeping more than one future alive.','carmes',['aramis','Steps toward a spiritual vocation without becoming simple or transparent.'],2],
 [58,'D’Artagnan Takes Command','The young Gascon begins his new rank, now responsible for men rather than merely trying to impress them.','musketeers-lodging',['dartagnan','Receives authority with the memory of every friend and loss that made it possible.'],3],
 [59,'The Road from Meung Is Remembered','D’Artagnan measures his commission against the roadside humiliation that first set him moving toward Paris.','meung',['dartagnan','Recognizes how a stolen letter became the beginning of a far larger education.'],2],
 [60,'Rochefort Faces D’Artagnan Again','The enemies meet under altered circumstances, their old duel-shadow now bound to the Cardinal’s changing designs.','paris-gate',['rochefort','Finds that the young man from Meung has become a figure the court must reckon with.'],4],
 [61,'The Four Names Become a Legend','Paris remembers the musketeers’ shared feats even as their paths divide into private futures.','musketeers-lodging',['de-treville','Sees the corps renewed by stories that outlast any single campaign.'],2],
 [62,'The Queen’s Court Settles Uneasily','Anne remains at court, safer from the diamond trap but not free from the political forces that made it possible.','louvre',['anne','Returns to ceremonial composure with the memory of danger kept deliberately private.'],2],
 [63,'The Cardinal Keeps the State Moving','Richelieu absorbs the loss of Milady and continues to govern through patience, intelligence, and power.','cardinal-palace',['richelieu','Treats a failed agent as a cost rather than a reason to abandon his system.'],3],
 [64,'A Toast to the Friends','A final gathering makes room for grief, jokes, and the knowledge that no promotion can recreate the original four.','musketeers-lodging',['dartagnan','Honours the friendship that taught him to value more than his own advancement.'],3],
 [65,'The Musketeers Part','Athos, Porthos, and Aramis leave in separate directions, each carrying a different version of the shared adventure.','paris-gate',['athos','Parts without ceremony, trusting memory more than speeches.'],3],
 [66,'D’Artagnan Looks Forward','The new lieutenant remains in Paris, no longer a provincial petitioner but still defined by the bonds that made him.','musketeers-lodging',['dartagnan','Looks ahead without pretending that rank compensates for Constance or the friends now absent.'],2],
 [67,'The Story Closes on Service and Friendship','The final note gathers the separate careers into the enduring claim that courage mattered most when it was shared.','musketeers-lodging',['dartagnan','Carries the four friends’ code into a future where his own name now has weight.'],2],
]
for(const [ch,title,description,loc,[who,status],tension] of bridge) if(!eventDefs.some(e=>e.ch===ch)) E(ch,title,description,loc,[[who,status]],tension)
for(let ch=1;ch<=67;ch++) if(!eventDefs.some(e=>e.ch===ch)) E(ch,chapterTitles[ch-1],`This chapter advances the intertwined court, friendship, and campaign story of the four companions.`, 'musketeers-lodging', [['dartagnan','Keeps the companions’ shared purpose in view.']],2)
eventDefs.sort((a,b)=>a.ch-b.ch)
const events=[],characterSnapshots=[]
eventDefs.forEach((e,index)=>{
 const eid=id('event',String(index+1).padStart(3,'0')), when=day(4,Math.min(30,index+1),9+(index%8))
 const involved=e.cast.map(([s])=>C(s))
 events.push({...base,id:eid,chapterId:chId(e.ch),timelineId,title:e.title,description:e.description,locationMarkerId:locId(e.loc),involvedCharacterIds:involved,mentionedCharacterIds:[],involvedItemIds:(e.items??[]).map(itemId),tags:[`chapter-${e.ch}`],threadIds:[],motifIds:[],sortOrder:0,travelDays:index?Math.max(0,Math.round((when-day(4,Math.min(30,index),9+((index-1)%8)))*10)/10):0,inWorldTime:when,tension:e.tension,structureBeat:null,status:'final',povCharacterId:involved[0]??null,isFlashback:false})
 e.cast.forEach(([s,status],pos)=>characterSnapshots.push({...base,id:id('snapshot',`${String(index+1).padStart(3,'0')}-${s}`),characterId:C(s),eventId:eid,isAlive:!(s==='constance'&&e.ch>=23)&&!(s==='milady'&&e.ch>=25),currentLocationMarkerId:locId(e.loc),currentMapLayerId:mapId(locations.find(l=>l.id===locId(e.loc)).mapLayerId.replace(`${P}-map-`,'')),inventoryItemIds:(s==='dartagnan'&&e.items?.includes('sword'))?[itemId('sword')]:[],inventoryNotes:'',travelModeId:null,sortKey:pos,statusNotes:status}))
})

const plotThreads=[
 ['queen','The Queen’s Diamonds','A private English connection becomes Richelieu’s attempt to publicly compromise Anne of Austria.','#836145','resolved'],
 ['friendship','All for One','A chain of intended duels becomes an alliance whose loyalty repeatedly outweighs rank, money, and safety.','#596d74','resolved'],
 ['milady','Milady’s Counterattack','Milady’s private history and Cardinal’s commission turn political intrigue into a sequence of personal catastrophes.','#75505a','resolved'],
 ['conquest','The Siege of La Rochelle','The royal siege supplies the military pressure behind the novel’s court plots and English intervention.','#625e4e','resolved'],
].map(([s,name,description,color,status])=>({...base,id:id('thread',s),name,description,color,status,tags:[]}))
const motifs=[
 ['letters','Letters and Passes','Documents open doors, create obligations, and leave proof that power cannot fully erase.'],
 ['doors','Doors, Cells, and Convents','Private rooms are repeatedly turned into places of surveillance, confinement, and escape.'],
 ['duels','Duels and Codes','Formal honour gives way to a harder test: whether courage is used for one’s pride or another person.'],
].map(([s,name,description])=>({...base,id:id('motif',s),name,description,color:'#7a6554',tags:[]}))
const relationships=[
 ['dartagnan','athos','mentor and chosen brother',5,'positive','Athos tempers d’Artagnan’s impulse with judgment and eventually entrusts him with the friends’ future.'],
 ['dartagnan','porthos','comrades in arms',5,'positive','Their differences in temperament never weaken their willingness to fight for one another.'],
 ['dartagnan','aramis','comrades with competing loyalties',4,'positive','Aramis’s divided life complicates the friendship but not his response to danger.'],
 ['dartagnan','constance','lovers divided by court intrigue',5,'positive','Their hope of reunion is repeatedly made vulnerable by information others covet.'],
 ['dartagnan','milady','mutual enemies',5,'negative','Attraction turns to a private war when d’Artagnan enters the history Milady has concealed.'],
 ['athos','milady','former spouses and sworn enemies',5,'negative','A concealed marriage and Milady’s branded past make Athos the witness she most fears.'],
 ['richelieu','milady','patron and agent',5,'mixed','The Cardinal uses Milady’s capacity for action while retaining the distance of political deniability.'],
 ['anne','buckingham','dangerous devotion',4,'mixed','A private bond gives Richelieu the leverage to threaten the Queen’s public position.'],
 ['richelieu','de-treville','rival authorities',4,'negative','The Cardinal’s guards and the King’s Musketeers embody two competing centres of influence.'],
 ['winter','milady','brother-in-law and jailer',5,'negative','Winter’s knowledge of Milady’s danger makes him an active witness against her.'],
].map(([a,b,label,strength,sentiment,notes],i)=>({...base,id:id('relationship',String(i+1)),characterAId:C(a),characterBId:C(b),label,strength,sentiment,notes,isMutual:true,createdAtEventId:events[0].id}))
const factions=[
 ['musketeers','The King’s Musketeers','The royal company whose camaraderie and prestige make them a counterweight to the Cardinal’s guards.','#496b72','four'],
 ['cardinal','Richelieu’s Network','Guards, agents, informants, and documents coordinated through the Cardinal’s political intelligence.','#794e50','guards'],
 ['court','The Royal Court','The King, Queen, household, and public ceremony that turn private feeling into political risk.','#796145','louvre'],
 ['english','Buckingham’s Circle','The Duke’s English household, naval hopes, and exposed connection to the French Queen.','#52647b','diamond'],
].map(([s,name,description,color,img])=>({...base,id:id('faction',s),name,description,color,coverImageId:imageId(img),tags:[]}))
const member=[]
for(const [f,cs] of [['musketeers',['dartagnan','athos','porthos','aramis','de-treville']],['cardinal',['richelieu','milady','rochefort','jussac']],['court',['anne','louis','constance']],['english',['buckingham','winter','felton']]]) cs.forEach((c,i)=>member.push({...base,id:id('membership',`${f}-${i}`),factionId:id('faction',f),characterId:C(c),role:'member',startEventId:events[0].id,endEventId:null,notes:''}))
const loreCategories=[['sources','Sources and Visual Record','#6f604c',0],['setting','Places and Institutions','#536a73',1],['history','History and Invention','#6e5950',2],['themes','Themes','#66566b',3]].map(([s,name,color,sortOrder])=>({id:id('lore-category',s),worldId,name,color,sortOrder}))
const lorePages=[
 ['sources','Text, Maps, and Illustrations','The structure follows Alexandre Dumas’s 1844 public-domain novel. The linked visual record uses historical maps and nineteenth-century illustrations, especially work associated with Maurice Leloir; they are editorial aids rather than claims that every setting has an exact canonical plan.','cover',['world'],1],
 ['setting','Paris and the Two Guards','The novel’s Paris divides military prestige between the King’s Musketeers and the Cardinal’s guards. Inns, palaces, convents, and private lodgings make that political rivalry immediate and personal.','four',['map:paris','faction:musketeers'],2],
 ['setting','La Rochelle','The 1627–28 siege of the Protestant port is the historical campaign around which Dumas builds the novel’s invented missions, friendships, and private revenge.','ship',['map:la-rochelle','faction:court'],17],
 ['history','Fact and Romance','Dumas draws on historical names and conflicts but reshapes dates, relationships, and causality for romance. The d’Artagnan of the novel is not a biographical account of Charles de Batz de Castelmore.','dartagnan',['character:dartagnan'],1],
 ['themes','Friendship and Performance','Duels, clothing, rank, and public stories repeatedly test whether the four companions will treat honour as display or as care for one another.','four',['character:athos','character:porthos','character:aramis'],4],
 ['themes','Secrets as Political Currency','Letters, jewels, identity, and witnesses become tools of power because a court depends on who may speak, who must remain hidden, and who controls a document.','letter',['item:diamond','item:pass'],6],
].map(([cat,title,body,img,links,visible],i)=>({...base,id:id('lore-page',String(i+1)),categoryId:id('lore-category',cat),title,body,tags:[],coverImageId:imageId(img),linkedEntityIds:links.map(v=>{const [k,s]=v.split(':');return k==='map'?mapId(s):k==='character'?C(s):k==='faction'?id('faction',s):worldId}),visibleFromEventId:events.find(e=>e.chapterId===chId(visible))?.id??events[0].id}))
const facts=[
 ['meung','The scarred man at Meung works for Richelieu','The first roadside enemy is Rochefort, one of the Cardinal’s field agents.',2],
 ['diamonds','The Queen’s diamonds came from Buckingham','The court ball is designed to expose Anne’s English connection.',8],
 ['milady','Milady bears a fleur-de-lis brand','The mark connects Milady to Athos’s past and a concealed legal identity.',14],
 ['commission','Milady holds Richelieu’s written authority','The Cardinal’s pass explains why Milady can act with frightening confidence.',16],
 ['buckingham','Milady arranged Buckingham’s murder through Felton','Her escape from captivity makes the English assassination possible.',22],
 ['con​​stance','Milady poisoned Constance','The long-delayed reunion at the convent is turned into Milady’s final act of revenge.',23],
].map(([s,title,description,ch])=>({...base,id:id('fact',s),title,description,tags:[],readerLearnsAtEventId:events.find(e=>e.chapterId===chId(ch)).id,originEventId:events.find(e=>e.chapterId===chId(ch)).id}))
const reveals=[['meung','dartagnan',2],['diamonds','dartagnan',8],['milady','athos',14],['commission','dartagnan',16],['buckingham','dartagnan',22],['con​​stance','dartagnan',23]].map(([f,c,ch],i)=>({...base,id:id('reveal',String(i+1)),factId:id('fact',f),characterId:C(c),eventId:events.find(e=>e.chapterId===chId(ch)).id,note:'The event provides direct knowledge of this fact.'}))
const mapRoutes=[
 {...base,id:id('route','gascony-paris'),mapLayerId:mapId('france'),name:'D’Artagnan’s Arrival','routeType':'horse',waypoints:['gascony','meung','paris-gate'].map(locId),color:'#7a5948',notes:'The road from provincial ambition to the city and its first enemies.'},
 {...base,id:id('route','english-mission'),mapLayerId:mapId('france'),name:'The Diamond Mission','routeType':'horse-and-ship',waypoints:['paris-gate','calais','london-gate'].map(locId),color:'#566d79',notes:'The racing route that carries the musketeers toward Buckingham and back to the court ball.'},
 {...base,id:id('route','siege'),mapLayerId:mapId('france'),name:'The La Rochelle Campaign','routeType':'horse',waypoints:['paris-gate','la-rochelle-gate','bethune-road'].map(locId),color:'#74534a',notes:'The journey from court conspiracy to the siege and its aftermath.'},
]
const data={version:16,type:'worldbreaker-export',exportedAt:now,world:{id:worldId,name:'The Three Musketeers',description:'Alexandre Dumas’s historical adventure follows the young Gascon d’Artagnan as he reaches Paris, joins Athos, Porthos, and Aramis, and is drawn into the conflict between Queen Anne, Cardinal Richelieu, Milady de Winter, and the siege of La Rochelle. Friendship turns a series of duels into a shared code, while letters, jewels, disguises, and old crimes make private loyalty politically dangerous.',coverImageId:imageId('cover'),theme:'theme-fantasy',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1625,yearSuffix:'',months},wordTarget:null},mapLayers,locationMarkers:locations,characters,items,characterSnapshots,characterMovements:[],itemPlacements:[],locationSnapshots:[],itemSnapshots:[],relationships,relationshipSnapshots:[],timelines:[{id:timelineId,worldId,name:'France and England, 1625–1628',description:'A single reading chronology. Exact event dates are editorial approximations; sequence and elapsed time follow the novel’s order.',color:'#785646',dayOffset:0,createdAt:now}],chapters,events,blobs,travelModes:[],timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes,mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],loreCategories,lorePages,factions,factionMemberships:member,factionRelationships:[],knowledgeFacts:facts,knowledgeReveals:reveals,characterGoals:[],sceneTexts:[],plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[]}

const ids=new Set();for(const rows of Object.values(data))if(Array.isArray(rows))for(const r of rows)if(r.id){if(ids.has(r.id))throw new Error(`Duplicate id ${r.id}`);ids.add(r.id)}
for(const e of events){if(!chapters.some(c=>c.id===e.chapterId))throw new Error(`Bad chapter ${e.id}`);if(!locations.some(l=>l.id===e.locationMarkerId))throw new Error(`Bad location ${e.id}`);if(e.tension<1||e.tension>5)throw new Error(`Bad tension ${e.id}`);const sn=characterSnapshots.filter(s=>s.eventId===e.id);if(sn.length!==e.involvedCharacterIds.length)throw new Error(`Snapshot mismatch ${e.id}`);if(new Set(sn.map(s=>s.statusNotes.toLowerCase())).size!==sn.length)throw new Error(`Repeated status ${e.id}`)}
for(const child of mapLayers.filter(m=>m.parentMapId))if(locations.filter(l=>l.linkedMapLayerId===child.id).length!==1)throw new Error(`Map gateway ${child.id}`)
const verifiedLocationImages=new Set(Object.values(locationArtwork).map(imageId))
for(const location of locations)if(location.imageId&&!verifiedLocationImages.has(location.imageId))throw new Error(`Unvalidated location image: ${location.name}`)
if(new Set(characters.map(c=>c.portraitImageId)).size!==characters.length)throw new Error('Character portraits must be distinct')
if(new Set(items.map(i=>i.imageId)).size!==items.length)throw new Error('Item illustrations must be distinct')
const reviewedItemImages=new Set(['letter','diamond','sword','pass','fleur-de-lis','ring'].map(imageId))
for(const item of items)if(!reviewedItemImages.has(item.imageId))throw new Error(`Unreviewed item image: ${item.name}`)
if(!new Set(['theme-fantasy','theme-scifi','theme-cyberpunk','theme-horror','theme-western','theme-action','theme-noir','theme-romance']).has(data.world.theme))throw new Error(`Unsupported world theme: ${data.world.theme}`)
if(new Set(events.map(e=>e.chapterId)).size!==67)throw new Error('Every chapter needs an event')
const text=`${JSON.stringify(data,null,2)}\n`
fs.writeFileSync('example/The Three Musketeers.pwk',text)
fs.writeFileSync('public/library/the-three-musketeers.pwk',text)
const indexPath='public/library/index.json', index=JSON.parse(fs.readFileSync(indexPath,'utf8'))
index.entries=index.entries.filter(e=>e.id!=='the-three-musketeers')
index.entries.push({id:'the-three-musketeers',title:'The Three Musketeers',author:'Alexandre Dumas',blurb:'A young Gascon joins Athos, Porthos, and Aramis as court secrets, English diamonds, Milady de Winter, and the siege of La Rochelle turn friendship into a test of loyalty.',data:'the-three-musketeers.pwk',dataBytes:Buffer.byteLength(text),counts:{characters:characters.length,chapters:chapters.length,events:events.length,locations:locations.length},notice:'Unofficial reference for a public-domain novel. This example contains original structural summaries and editorial reconstruction, not the novel’s prose. Linked historical maps and public-domain illustrations are recorded in Lore.',worldId,cover:commons('Dartagnan-musketeers - Maurice Leloir.jpg',1200)})
fs.writeFileSync(indexPath,`${JSON.stringify(index,null,2)}\n`)
console.log(JSON.stringify({chapters:chapters.length,events:events.length,characters:characters.length,snapshots:characterSnapshots.length,locations:locations.length,maps:mapLayers.length,items:items.length,bytes:Buffer.byteLength(text)},null,2))
