import fs from 'node:fs'
import { createHash } from 'node:crypto'

const P = 'woman-in-white'
const worldId = `${P}-world`
const now = 1786838400000
const base = { worldId, createdAt: now, updatedAt: now }
const id = (kind, slug) => `${P}-${kind}-${slug}`
const I = slug => id('image', slug)
const C = slug => id('character', slug)
const L = slug => id('location', slug)
const M = slug => id('map', slug)
const Ch = n => id('chapter', String(n).padStart(2, '0'))
const T = slug => id('thread', slug)
const O = slug => id('motif', slug)
const F = slug => id('faction', slug)
const K = slug => id('fact', slug)
const R = slug => id('relationship', slug)
const Item = slug => id('item', slug)
const commons = name => {
  const normalized = name.replaceAll(' ', '_')
  const hash = createHash('md5').update(normalized).digest('hex')
  return `https://upload.wikimedia.org/wikipedia/commons/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(normalized)}`
}
const polo = n => commons(`La Femme en blanc-1875-Polo-${String(n).padStart(2, '0')}.jpg`)
const macklin = n => commons(`Illustration by Thomas Eyre Macklin for The Woman in White (${n}).jpg`)
const image = (slug, url, mimeType = 'image/jpeg') => ({ id: I(slug), worldId, mimeType, url, createdAt: now })

const mapUrls = {
  england: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Collins%27Railway_map_of_England_and_Wales_and_part_of_Scotland..._-_btv1b530637300.jpg/1920px-Collins%27Railway_map_of_England_and_Wales_and_part_of_Scotland..._-_btv1b530637300.jpg',
  london: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/1855_Colton_Map_of_London%2C_England_-_Geographicus_-_London-cbl-1855.jpg/1280px-1855_Colton_Map_of_London%2C_England_-_Geographicus_-_London-cbl-1855.jpg',
  cumberland: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Pigot_and_Co_%281842%29_p2.042_-_Map_of_Cumberland.jpg/1280px-Pigot_and_Co_%281842%29_p2.042_-_Map_of_Cumberland.jpg',
  hampshire: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Pigot_and_Co_%281842%29_p1.248_-_Map_of_Hampshire.jpg/1280px-Pigot_and_Co_%281842%29_p1.248_-_Map_of_Hampshire.jpg',
  paris: commons('Map of Paris, 1855 Wellcome L0013020.jpg'),
}

const blobs = [
  image('cover', commons('The woman in white Cover 1890.jpg', 1200)),
  ...Object.entries(mapUrls).map(([slug, url]) => image(`${slug}-map`, url)),
  image('confession-document', commons('Guy Fawkes confession.png'), 'image/png'),
  image('carbonari-emblem', commons('Masonic emblem of the Carboneria.svg'), 'image/svg+xml'),
  image('marian-writing', 'https://victorianweb.org/victorian/art/illustration/mclenan/wiw/8b.jpg'),
  image('vestry-key-engraving', commons('Vintage key illustration (39820339253).jpg')),
  image('parish-register-lettering', commons('Some quaint letters from old parish registers.png'), 'image/png'),
  ...Array.from({ length: 46 }, (_, i) => image(`polo-${String(i + 1).padStart(2, '0')}`, polo(i + 1))),
  ...Array.from({ length: 8 }, (_, i) => image(`macklin-${i + 1}`, macklin(i + 1))),
]

const reviewedArt = {}
const review = (slug, rationale) => { reviewedArt[slug] = rationale; return slug }

const maps = [
  ['england', null, 'England and the Case', 'The English journeys connecting Walter Hartright’s London home, Limmeridge in Cumberland, Blackwater Park in Hampshire, and the ports and country houses between them.', 1920, 2634, 'england-map'],
  ['london', 'england', 'London and Its Environs, 1855', 'The streets, offices, lodgings, institutions, theatres, and suburban houses used throughout the narrative.', 1280, 1050, 'london-map'],
  ['cumberland', 'england', 'Cumberland and Limmeridge', 'The north-western county around the Fairlie estate, its village school, churchyard, and coast.', 1024, 1687, 'cumberland-map'],
  ['hampshire', 'england', 'Hampshire and Blackwater Park', 'The county surrounding Sir Percival Glyde’s secluded estate and the nearby village of Old Welmingham.', 1024, 1720, 'hampshire-map'],
  ['paris', null, 'Paris, 1855', 'The French capital, its dense central streets, the Île de la Cité, and the Seine.', 1490, 1232, 'paris-map'],
].map(([slug, parent, name, description, imageWidth, imageHeight, imageSlug]) => ({ ...base, id: M(slug), parentMapId: parent ? M(parent) : null, name, description, imageId: I(imageSlug), imageWidth, imageHeight, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' }))

const locationRows = [
  ['cumberland-gate','england','Cumberland and Limmeridge','The north-western county of lakes, fells, market towns, and a long Irish Sea coast.','cumberland',690,860,'region',1],
  ['london-gate','england','London','Britain’s capital, with dense legal quarters, theatres, institutions, and expanding northern and western suburbs.','london',1380,1875,'city',36],
  ['hampshire-gate','england','Hampshire and Blackwater Park','The southern county containing Sir Percival’s country estate and the village of Old Welmingham.','hampshire',1170,2015,'region',44],
  ['polesdean','england','Polesdean Lodge, Yorkshire','The country house where Professor Pesca recommends Walter for the position at Limmeridge. ',null,1230,1130,'building',40],
  ['liverpool','england','Liverpool Docks','The busy western port linking Atlantic voyages with Britain’s railway network.',null,765,1225,'city',38],
  ['limmeridge-house','cumberland','Limmeridge House','The Fairlie family seat, an old Cumberland house with quiet galleries, drawing rooms, and grounds near the coast.',null,285,720,'building',7],
  ['limmeridge-churchyard','cumberland','Limmeridge Churchyard','The parish burial ground beside Limmeridge Church and close to the Fairlie family estate.',null,295,742,'landmark',8],
  ['limmeridge-school','cumberland','Limmeridge Village School','A small local school associated with Mrs Fairlie’s charitable interest in the village.',null,275,755,'building',6],
  ['cumberland-coast','cumberland','Cumberland Coast','The exposed coastal country near Limmeridge, with open views across the Irish Sea.',null,230,700,'landmark',16],
  ['hampstead','london','Hampstead Cottage','The modest home of Walter’s mother and sister, offering a familial refuge at the beginning of the case.',null,520,305,'building',10],
  ['finchley-road','london','Finchley Road','The moonlit northern road where Walter meets a distressed woman dressed entirely in white.',null,545,390,'road',5],
  ['clements-inn','london','Clement’s Inn','Walter’s compact chambers in one of the legal enclaves between the Strand and the Inns of Court.',null,660,590,'building',34],
  ['gilmore-kyrle','london','Gilmore and Kyrle, Chancery Lane','The solicitors’ Chancery Lane offices serving the Fairlie family and handling its formal settlements.',null,690,570,'building',35],
  ['asylum','london','Private Asylum','A privately run institution on London’s northern outskirts, enclosed from ordinary public scrutiny.',null,600,410,'building',37],
  ['st-johns-wood','london','Forest Road, St John’s Wood','A substantial suburban residence on the western side of Regent’s Park.',null,490,470,'building',41],
  ['gowers-walk','london','Gower’s Walk, Fulham','Modest lodgings in Fulham, on the north bank of the Thames west of central London.',null,455,665,'building',29],
  ['opera','london','Opera House','A fashionable central London theatre crowded with patrons, boxes, and public promenades.',null,625,610,'building',39],
  ['blackwater-house','hampshire','Blackwater Park House','Sir Percival’s decaying Hampshire seat, surrounded by damp ground and strained domestic formality.',null,655,675,'building',13],
  ['blackwater-lake','hampshire','Lake and Boathouse','The ornamental water and neglected boathouse within the Blackwater Park grounds.',null,672,705,'landmark',24],
  ['east-drive','hampshire','East Drive and Plantation','The wooded eastern approach connecting Blackwater Park house with the surrounding roads.',null,680,645,'road',22],
  ['old-welmingham','hampshire','Old Welmingham Church and Vestry','An old parish church and vestry where the village’s marriage and baptism records are kept.',null,750,600,'building',42],
  ['paris-seine','paris','The Seine','The river crossing Paris in broad bends between quays, bridges, and densely built neighbourhoods.',null,745,655,'landmark',45],
  ['paris-morgue','paris','Paris Morgue','The public mortuary beside the Seine on the Île de la Cité, near Notre-Dame.',null,835,705,'building',46],
]
const locations = locationRows.map(([slug,mapSlug,name,description,linkedMap,x,displayY,iconType,artNo]) => {
  const art = review(`polo-${String(artNo).padStart(2,'0')}`, `a period book engraving selected for ${name}: ${description}`)
  const layer = maps.find(map => map.id === M(mapSlug))
  return { ...base, id: L(slug), mapLayerId: M(mapSlug), linkedMapLayerId: linkedMap ? M(linkedMap) : null, name, description: description.trim(), x, y: layer.imageHeight - displayY, imageId: I(art), iconType, tags: [], factionId: null }
})

const characterRows = [
  ['walter','Walter Hartright',[],'A young drawing master whose chance meeting with Anne Catherick draws him into the Fairlie family’s secret and makes him the case’s patient investigator.',2],
  ['laura','Laura Fairlie',['Lady Glyde'],'The gentle heiress of Limmeridge, bound by a promise to marry Sir Percival despite loving Walter and relying deeply on Marian.',9],
  ['marian','Marian Halcombe',[],'Laura’s intelligent and resolute half-sister, whose diary, courage, and vigilance make her the strongest early opponent of the conspiracy.',20],
  ['anne','Anne Catherick',['The Woman in White'],'A vulnerable woman whose white clothes, resemblance to Laura, and knowledge of Sir Percival’s secret connect every part of the mystery.',4],
  ['percival','Sir Percival Glyde',[],'A baronet under financial pressure whose authority depends on a concealed irregularity and whose marriage to Laura becomes coercive.',23],
  ['fosco','Count Fosco',[],'A charismatic, observant Italian count whose courtesy, appetites, and mastery of people conceal the conspiracy’s calculating mind.',43],
  ['madame-fosco','Madame Fosco',['Eleanor Fosco'],'Laura’s aunt, once outspoken but now entirely devoted to her husband’s judgments and instructions.',27],
  ['fairlie','Frederick Fairlie',[],'Laura’s wealthy, self-absorbed uncle, who avoids noise, conflict, and responsibility while controlling Limmeridge and Laura’s guardianship.',3],
  ['pesca','Professor Pesca',[],'Walter’s exuberant Italian friend, whose gratitude wins Walter the Limmeridge post and whose past association later exposes Fosco.',12],
  ['gilmore','Vincent Gilmore',[],'The Fairlie family solicitor, a cautious professional who distrusts the proposed settlement and tries to protect Laura’s interests.',28],
  ['mrs-catherick','Mrs Catherick',[],'Anne’s proud and socially isolated mother, keeper of the history behind Sir Percival’s secret.',32],
  ['mrs-clements','Mrs Clements',[],'Anne’s loyal companion and protector, who provides Walter with the human history that official records omit.',21],
  ['michelson','Eliza Michelson',[],'The Blackwater Park housekeeper, conscientious and observant, whose testimony records the household’s final rearrangement.',18],
  ['fanny','Fanny',[],'Laura’s maid, loyal to her mistress and alert enough to carry Marian’s warning when the household becomes dangerous.',14],
  ['kyrle','Mr Kyrle',[],'Gilmore’s legal partner, who explains why sympathy alone cannot overturn the documentary evidence of Laura’s death.',33],
  ['hester','Hester Pinhorn',[],'A domestic servant whose brief testimony fixes Anne Catherick’s final illness in the London chronology.',30],
  ['goodricke','Doctor Goodricke',[],'The physician whose record supplies the medical timing of the death attributed to Lady Glyde.',11],
  ['jane','Jane Gould',[],'A witness connected with the preparation of the body and the chain of evidence used to establish the burial.',26],
]
const characters = characterRows.map(([slug,name,aliases,description,artNo]) => {
  const art = review(`polo-${String(artNo).padStart(2,'0')}`, `a sober 1875 book engraving selected as the portrait for ${name}`)
  return { ...base, id:C(slug), name, aliases, description, portraitImageId:I(art), color:'#596b72', tags:[], isAlive:true, birthDate:null }
})

const itemRows = [
  ['white-dress','Anne’s White Dress','The distinctive plain white clothing associated with Anne and with Walter’s first recognition of her.','clothing',1],
  ['warning-letter','Anonymous Warning Letter','A letter sent to Laura before the marriage, warning her against Sir Percival without fully disclosing his secret.','document',2],
  ['settlement','Laura’s Marriage Settlement','The legal instrument that places Laura’s fortune at the centre of Gilmore’s objections and Percival’s pressure.','document',3],
  ['marian-diary','Marian’s Diary','A close record of Blackwater Park that preserves conversations, suspicions, illness, and the conspiracy’s approach.','book',4],
  ['vestry-key','Vestry Key','The key that gives access to the old church register and the documentary proof hidden at Old Welmingham.','key',5],
  ['church-register','Old Welmingham Marriage Register','The parish volume whose altered entry conceals the defect in Sir Percival’s birth and title.','book',6],
  ['death-certificate','Lady Glyde’s Death Certificate','The official record that makes Laura legally dead before Walter can prove the recorded date impossible.','document',7],
  ['grave-marker','Laura’s Grave Marker','The stone at Limmeridge that gives a public, physical form to the false identity assigned to the dead woman.','artifact',31],
  ['fosco-confession','Fosco’s Written Confession','A detailed signed account of the identity exchange, obtained as the price of allowing Fosco to leave England.','document',17],
  ['brotherhood-mark','Brotherhood Mark','The sign by which Pesca recognizes Fosco as a condemned member of an Italian political brotherhood.','symbol',18],
]
const items = itemRows.map(([slug,name,description,iconType,artNo]) => {
  const art = slug === 'fosco-confession'
    ? review('confession-document', 'a public-domain British handwritten confession, used to represent Fosco’s signed written evidence rather than an unrelated landscape')
    : slug === 'brotherhood-mark'
      ? review('carbonari-emblem', 'the historical emblem of the Carbonari, the Italian political brotherhood that provides the model for Fosco and Pesca’s association')
      : slug === 'marian-diary'
        ? review('marian-writing', 'John McLenan’s 1860 Woman in White engraving of Marian writing, selected as direct visual context for her documentary record')
        : slug === 'vestry-key'
          ? review('vestry-key-engraving', 'a Victorian-style public-domain key engraving, showing the object itself rather than an unrelated narrative scene')
          : slug === 'church-register'
            ? review('parish-register-lettering', 'a public-domain illustration of lettering from old English parish registers, selected for the forged marriage entry')
      : artNo <= 8
        ? review(`macklin-${artNo}`, `a book-specific Thomas Eyre Macklin illustration selected for ${name}`)
        : review(`polo-${String(artNo).padStart(2,'0')}`, `a period book engraving showing the narrative context of ${name}`)
  return { ...base, id:Item(slug), name, description, iconType, imageId:I(art), tags:[] }
})

const plotThreads = [
  ['identity','The Identity Exchange','#8b6070','Anne and Laura’s resemblance is exploited until testimony and dates can separate the two women again.'],
  ['secret','Sir Percival’s Secret','#695b4f','Anne’s warning points toward a hidden defect in Percival’s family record and social position.'],
  ['inheritance','Laura’s Fortune','#9b7c49','The marriage settlement and Laura’s money provide the conspiracy’s financial motive.'],
  ['love','Walter and Laura','#8a6f82','Affection, separation, protection, and the restoration of a shared future form the emotional through-line.'],
  ['evidence','Reconstructing the Evidence','#4f7382','Diaries, testimony, timetables, registers, and confession gradually replace an apparently perfect official story.'],
  ['brotherhood','Fosco and the Brotherhood','#6c596f','Pesca’s past and Fosco’s political betrayal create a second system of judgment beyond English law.'],
].map(([slug,name,color,description]) => ({...base,id:T(slug),name,color,description}))
const motifs = [
  ['white','White Clothing and Apparitions','#d5d2c7','White clothing makes Anne memorable, links her visually to Laura, and gives the story its haunting first impression.'],
  ['documents','Documents and Testimony','#8a765e','Written narratives and official papers compete to determine which version of a life becomes legally real.'],
  ['doubles','Resemblance and Doubles','#786a7c','Physical resemblance exposes the fragility of identity when witnesses see only what they expect.'],
  ['confinement','Institutions and Confinement','#596774','Marriage, guardianship, law, asylum, and household authority all limit who may speak and be believed.'],
  ['thresholds','Night, Weather, and Thresholds','#526977','Roads, windows, rain, doors, and overheard spaces mark transitions between safety and danger.'],
].map(([slug,name,color,description]) => ({...base,id:O(slug),name,color,description}))

const sceneRows = [
  ['walter-1','First Epoch — Walter I: A Case Outside the Law','Walter frames the following documents as testimony assembled for a wrong that ordinary legal process could not repair.','clements-inn',{walter:'Begins arranging the case as a sequence of first-hand narratives rather than a conventional memoir.'},[],['evidence'],['documents'],211.10,1,'walter'],
  ['walter-2','Walter II: The Last Day of July','On the last day of July 1849, Walter returns from Hampstead toward London after visiting his mother and sister.','hampstead',{walter:'Leaves his family unsettled about his prospects and walks back toward his London rooms.'},[],['love'],['thresholds'],211.72,1,'walter'],
  ['walter-3','Walter III: Pesca’s Proposal','Professor Pesca brings Walter an offer to teach drawing to two young women at Limmeridge House.','hampstead',{walter:'Accepts the Cumberland position as a welcome change from uncertain London work.',pesca:'Enthusiastically repays Walter’s past rescue by securing him the Limmeridge appointment.'},[],['love'],[],211.76,2,'walter'],
  ['walter-4','Walter IV: The Woman on Finchley Road','Walking home by moonlight, Walter meets a frightened woman in white and helps her find a cab into London.','finchley-road',{walter:'Helps the stranger despite her agitation and is struck by her knowledge of Limmeridge.',anne:'Escapes along the road in white, intent on reaching London without being detained.'},['white-dress'],['identity','secret'],['white','thresholds'],211.96,4,'walter'],
  ['walter-5','Walter V: Escape from the Asylum','Men searching the road reveal that the woman Walter assisted has escaped from a private asylum.','finchley-road',{walter:'Realizes the stranger concealed both her confinement and the urgency of her flight.',anne:'Reaches the cab before the pursuers can reclaim her.'},['white-dress'],['identity'],['confinement','thresholds'],212.02,4,'walter'],
  ['walter-6','Walter VI: Arrival at Limmeridge','Walter travels north and is welcomed at Limmeridge by Marian Halcombe.','limmeridge-house',{walter:'Arrives curious about the house’s connection to the woman in white.',marian:'Receives the new drawing master with frank intelligence and practical warmth.'},[],['love','identity'],['thresholds'],215.70,2,'walter'],
  ['walter-7','Walter VII: Mr Fairlie’s Drawings','Frederick Fairlie interviews Walter amid his collections and carefully managed invalid comforts.','limmeridge-house',{walter:'Endures Fairlie’s self-absorption to confirm the terms of his post.',fairlie:'Delegates responsibility while protecting himself from noise, exertion, and inconvenience.'},[],['inheritance'],['confinement'],216.20,1,'walter'],
  ['walter-8','Walter VIII: Laura and the Likeness','Walter meets Laura and is startled by her resemblance to the woman he encountered outside London.','limmeridge-house',{walter:'Recognizes Anne’s features in Laura and becomes emotionally alert to the mystery.',laura:'Welcomes the new drawing master with quiet reserve.',marian:'Observes Walter’s reaction and begins comparing what he knows with family history.'},[],['identity','love'],['doubles'],216.55,3,'walter'],
  ['walter-9','Walter IX: Three Months at Limmeridge','Lessons, walks, and shared days draw Walter and Laura together while Marian sees the attachment grow.','cumberland-coast',{walter:'Falls in love while trying to preserve the boundaries of his employment.',laura:'Finds happiness in Walter’s company but does not disclose the promise governing her future.',marian:'Recognizes the mutual attachment and worries about the pain it will cause.'},[],['love'],['thresholds'],275.50,2,'walter'],
  ['walter-10','Walter X: Laura’s Engagement','Marian tells Walter that Laura is already promised to Sir Percival Glyde.','limmeridge-house',{walter:'Learns that hope of marrying Laura conflicts with an existing family promise.',marian:'Explains the engagement compassionately but insists Walter face its consequences.'},[],['love','inheritance'],['confinement'],303.30,4,'walter'],
  ['walter-11','Walter XI: Walter Must Leave','Walter agrees that remaining at Limmeridge would deepen Laura’s distress and prepares to resign.','limmeridge-house',{walter:'Chooses departure over placing Laura in open conflict with her promise.',laura:'Understands that Walter is leaving because their attachment can no longer remain unspoken.',marian:'Manages the painful separation in the hope of protecting both of them.'},[],['love'],['confinement'],304.10,4,'walter'],
  ['walter-12','Walter XII: The Warning Letter','An anonymous letter warns Laura not to marry Sir Percival and associates him with cruelty and confinement.','limmeridge-house',{laura:'Receives a warning that intensifies her fear without releasing her from her promise.',marian:'Examines the letter and commits herself to finding its author.',walter:'Connects the letter’s language and appearance with the woman in white.'},['warning-letter'],['secret','identity'],['documents','confinement'],304.55,4,'walter'],
  ['walter-13','Walter XIII: Anne at the Churchyard','Walter finds Anne Catherick beside Mrs Fairlie’s grave and confirms her bond with Limmeridge.','limmeridge-churchyard',{walter:'Questions Anne gently, seeking the basis of her warning against Percival.',anne:'Tends Mrs Fairlie’s grave and speaks from gratitude, fear, and incomplete knowledge.'},['white-dress'],['secret','identity'],['white','doubles'],305.40,4,'walter'],
  ['walter-14','Walter XIV: The Secret and the Farewell','Anne cannot fully disclose Percival’s secret; Walter leaves Limmeridge after a final painful meeting with Laura.','limmeridge-house',{walter:'Departs with the mystery unresolved and his love for Laura unchanged.',laura:'Says farewell while remaining bound to her father’s promise.',marian:'Supports Laura and preserves Walter’s account of Anne’s warning.'},[],['love','secret'],['documents','confinement'],306.20,5,'walter'],
  ['walter-15','Walter XV: Gilmore Arrives','Walter’s first narrative closes as Vincent Gilmore reaches Limmeridge to consider the marriage arrangements.','limmeridge-house',{walter:'Withdraws from the household before the legal negotiations begin.',gilmore:'Arrives as the family solicitor, prepared to inspect the proposed marriage settlement.',marian:'Transfers attention from Walter’s departure to Laura’s approaching legal danger.'},[],['inheritance','evidence'],['documents'],307.00,2,'walter'],
  ['gilmore-1','Gilmore I: Sir Percival’s Explanation','Percival answers questions about Anne by presenting himself as the responsible party who arranged her confinement.','limmeridge-house',{gilmore:'Listens professionally but remains alert to gaps between explanation and evidence.',percival:'Portrays Anne as deluded and his own actions as protective.',laura:'Hears an account designed to neutralize the anonymous warning.',marian:'Distrusts the smoothness of Percival’s explanation.'},[],['secret','identity'],['confinement','documents'],308.20,3,'gilmore'],
  ['gilmore-2','Gilmore II: The Settlement Begins','Gilmore examines Laura’s property and the financial terms proposed for the marriage.','gilmore-kyrle',{gilmore:'Identifies provisions that would expose Laura’s fortune to Percival after her death.',fairlie:'Resists any legal discussion that requires effort or confrontation.',percival:'Presses for terms favorable to his financial interests.'},['settlement'],['inheritance'],['documents','confinement'],315.50,3,'gilmore'],
  ['gilmore-3','Gilmore III: Laura Accepts the Marriage','Laura refuses to break the promise made to her father, even after Gilmore explains the settlement’s danger.','limmeridge-house',{laura:'Treats her promise as binding despite unhappiness and legal risk.',gilmore:'Urges caution but cannot substitute his judgment for Laura’s decision.',marian:'Supports Laura emotionally while opposing the conditions surrounding the marriage.'},['settlement'],['inheritance','love'],['documents','confinement'],320.40,4,'gilmore'],
  ['gilmore-4','Gilmore IV: The Settlement Is Signed','Fairlie declines to fight the terms, and the marriage settlement is completed over Gilmore’s objections.','limmeridge-house',{gilmore:'Records formal objections before carrying out the family’s instructions.',fairlie:'Chooses convenience over a sustained defense of Laura’s interests.',percival:'Secures the financial arrangement he sought.',laura:'Signs within the limits set by guardianship and promise.'},['settlement'],['inheritance'],['documents','confinement'],326.80,4,'gilmore'],
  ['marian-1','Marian I: November 8','Marian begins her record of Laura’s final weeks before marriage and the household’s subdued preparations.','limmeridge-house',{marian:'Takes up the documentary record and watches Laura closely.',laura:'Moves through preparations with resignation rather than anticipation.'},['marian-diary'],['love','evidence'],['documents'],311.40,2,'marian'],
  ['marian-2','Marian II: December 22','Laura marries Sir Percival and leaves Limmeridge, while Marian prepares to join her after the wedding journey.','limmeridge-house',{laura:'Completes the marriage ceremony and leaves the home attached to her mother’s memory.',percival:'Becomes Laura’s husband and gains the authority the settlement anticipates.',marian:'Witnesses the marriage with foreboding and resolves not to abandon Laura.'},['settlement'],['inheritance','love'],['confinement'],355.55,4,'marian'],
  ['blackwater-1','Second Epoch — Marian I: Blackwater Park','In June 1850 Marian records her arrival at Blackwater Park and the oppressive condition of Percival’s estate.','blackwater-house',{marian:'Surveys the house and household for Laura’s safety.',laura:'Returns from the wedding journey subdued and increasingly dependent on Marian.',percival:'Maintains formal control of a house strained by money and neglect.',fosco:'Arrives as an attentive guest whose influence is not yet fully measured.','madame-fosco':'Follows her husband’s preferences with disciplined devotion.'},['marian-diary'],['inheritance','identity'],['documents','confinement'],526.30,3,'marian'],
  ['blackwater-2','Marian II: Count Fosco Observes','Fosco fascinates and unsettles Marian while winning influence over Percival and the household.','blackwater-house',{marian:'Studies Fosco’s contradictions and refuses to mistake charm for safety.',fosco:'Reads each member of the household and cultivates the appearance of benevolent control.',percival:'Relies increasingly on Fosco’s composure and planning.','madame-fosco':'Demonstrates complete obedience to the Count.'},[],['inheritance'],['confinement'],528.10,3,'marian'],
  ['blackwater-3','Marian III: Anne Appears Near the Park','Signs that Anne Catherick is nearby revive the warning and Percival’s fear of exposure.','east-drive',{marian:'Searches for Anne before Percival can find her.',anne:'Approaches Blackwater hoping to communicate the secret to Laura.',percival:'Reacts to news of Anne with anger sharpened by fear.'},['white-dress'],['secret','identity'],['white','thresholds'],529.40,4,'marian'],
  ['blackwater-4','Marian IV: Pressure for Laura’s Signature','Percival attempts to make Laura sign a document without explaining its effect on her money.','blackwater-house',{laura:'Refuses to sign a document she is not allowed to read.',percival:'Uses marital authority and intimidation to force access to Laura’s funds.',marian:'Intervenes openly and strengthens Laura’s refusal.',fosco:'Calms the confrontation while preserving Percival’s larger objective.'},['settlement'],['inheritance'],['documents','confinement'],530.20,5,'marian'],
  ['blackwater-5','Marian V: A Message for Anne','Marian and Laura arrange a cautious meeting with Anne near the lake.','blackwater-lake',{marian:'Plans the meeting to protect both women from surveillance.',laura:'Hopes Anne can explain the danger surrounding her marriage.',anne:'Waits nearby, frightened but determined to warn Laura.'},['warning-letter'],['secret','identity'],['white','thresholds'],531.35,4,'marian'],
  ['blackwater-6','Marian VI: Anne’s Fear','Anne reveals that Percival’s secret could ruin him, but illness and terror keep her explanation incomplete.','blackwater-lake',{anne:'Tries to disclose what Mrs Catherick told her but cannot produce the decisive proof.',marian:'Extracts the usable details while protecting Anne’s escape.',laura:'Confronts evidence that her husband’s hostility rests on more than money.'},[],['secret','identity'],['doubles','confinement'],531.55,5,'marian'],
  ['blackwater-7','Marian VII: The Household Is Divided','Percival dismisses servants and isolates Laura while Fosco manages appearances and practical arrangements.','blackwater-house',{marian:'Recognizes the dismissals as preparation rather than household economy.',laura:'Becomes more isolated as familiar servants are removed.',percival:'Narrows Laura’s support inside the house.',fosco:'Coordinates the household changes without exposing the plan.',michelson:'Carries out orders while growing uneasy about their purpose.',fanny:'Remains loyal to Laura despite pressure on the servants.'},['marian-diary'],['inheritance','identity'],['confinement','documents'],532.70,4,'marian'],
  ['blackwater-8','Marian VIII: The Conversation at the Boathouse','From the rain outside the library, Marian overhears Percival and Fosco planning to secure Laura’s fortune and exploit Anne’s resemblance.','blackwater-lake',{marian:'Risks exposure in the storm to record the conspiracy’s design.',percival:'Agrees to a plan that removes Laura as a legal obstacle.',fosco:'Defines the identity exchange and the timing needed to make it credible.'},['marian-diary'],['identity','inheritance'],['documents','doubles','thresholds'],533.95,5,'marian'],
  ['blackwater-9','Marian IX: Fever','The exposure leaves Marian dangerously ill, removing Laura’s strongest defender at the moment the plan advances.','blackwater-house',{marian:'Falls into fever after preserving what she overheard in her diary.',laura:'Tries to care for Marian while receiving conflicting instructions from the household.',fosco:'Takes charge of Marian’s treatment and access to her diary.','madame-fosco':'Assists her husband and controls the sickroom.'},['marian-diary'],['identity','evidence'],['documents','confinement'],534.60,5,'marian'],
  ['blackwater-10','Marian X: The Diary Changes Hands','Marian’s narrative breaks as Fosco reads and annotates the diary, proving how completely the conspirators control the house.','blackwater-house',{marian:'Remains unconscious and unable to protect Laura or her written record.',fosco:'Reads Marian’s account, adds his admiring note, and adjusts the plan to what she knows.','madame-fosco':'Guards access to Marian while the diary is examined.'},['marian-diary'],['identity','evidence'],['documents','confinement'],535.20,5,'marian'],
  ['fairlie-account','Fairlie: The Summons from Blackwater','Fairlie explains how Fosco’s correspondence persuaded him to receive Laura at Limmeridge while Marian was supposedly too ill to travel.','limmeridge-house',{fairlie:'Accepts the least troublesome version of events and authorizes arrangements without investigation.',fosco:'Uses courteous letters to make Fairlie an unwitting part of the plan.'},[],['identity','inheritance'],['documents','confinement'],543.20,3,'fairlie'],
  ['michelson-1','Michelson I: The House Is Emptied','Mrs Michelson records servants departing and Laura being told that Marian has already left Blackwater.','blackwater-house',{michelson:'Observes the inconsistent departures but trusts Fosco’s formal assurances.',laura:'Believes she must travel to rejoin Marian.',percival:'Leaves the final arrangements in Fosco’s hands.',fosco:'Creates a credible appearance that the household is merely dispersing.',fanny:'Is sent away before she can remain with Laura.'},[],['identity'],['confinement','documents'],544.15,4,'michelson'],
  ['michelson-2','Michelson II: Laura Leaves Blackwater','Laura departs under Madame Fosco’s escort, while Marian is secretly moved after her.','east-drive',{laura:'Leaves Blackwater expecting to meet Marian in London.','madame-fosco':'Escorts Laura according to the Count’s plan.',michelson:'Watches the departure without knowing the destination has been falsified.',marian:'Is transported separately while still too ill to intervene.'},[],['identity'],['doubles','confinement','thresholds'],545.05,5,'michelson'],
  ['pinhorn','Hester Pinhorn: The Sick Woman','Hester Pinhorn’s testimony places Anne, gravely ill, in Fosco’s London house before the death announced as Laura’s.','st-johns-wood',{hester:'Attends a sick woman whose identity she knows only through the household’s instructions.',anne:'Declines rapidly while kept inside Fosco’s controlled London residence.',fosco:'Controls the sickroom, names, and outside contacts.','madame-fosco':'Supports the false identity presented to the servant.'},[],['identity','evidence'],['doubles','documents','confinement'],560.20,4,'hester'],
  ['goodricke','Doctor Goodricke: The Medical Record','Doctor Goodricke records the final illness and death of the woman presented to him as Lady Glyde.','st-johns-wood',{goodricke:'Treats the patient and supplies a medically credible time of death without knowing her true name.',anne:'Dies under Laura’s name before she can give formal testimony.',fosco:'Ensures that the physician sees a plausible patient and receives a false identity.'},['death-certificate'],['identity','evidence'],['documents','doubles'],570.10,5,'goodricke'],
  ['jane-gould','Jane Gould: Preparing the Burial','Jane Gould’s evidence helps complete the official chain from the London death to the coffin sent north.','st-johns-wood',{jane:'Performs her limited role in preparing the body identified to her as Lady Glyde.','madame-fosco':'Maintains the household’s account of the dead woman’s identity.'},[],['identity','evidence'],['documents','doubles'],570.40,4,'jane'],
  ['tombstone','The Tombstone at Limmeridge','A formal record states that Laura, Lady Glyde, died on July 25, 1850, and was buried beside her mother.','limmeridge-churchyard',{fairlie:'Accepts the official notification and burial without reopening the circumstances.',gilmore:'Receives a death supported by certificate, witnesses, and family recognition.'},['death-certificate','grave-marker'],['identity','evidence','inheritance'],['documents','doubles'],573.50,5,'gilmore'],
  ['return','Walter: Return to England','Walter lands at Liverpool on October 13 and learns that Laura is officially dead.','liverpool',{walter:'Returns from Central America to grief and a case that appears already closed by law.'},['death-certificate'],['love','identity'],['documents','thresholds'],650.60,5,'walter'],
  ['third-1','Third Epoch — Walter I: Laura at Her Own Grave','At Limmeridge Churchyard, Walter sees Marian with a living woman he recognizes as Laura beside Laura’s own tombstone.','limmeridge-churchyard',{walter:'Confronts the impossible sight and commits himself to protecting the living Laura.',laura:'Stands before the grave carrying her name but cannot yet fully explain what happened.',marian:'Reunites Walter with Laura and brings him into the hidden struggle.'},['grave-marker'],['identity','love','evidence'],['doubles','documents'],651.20,5,'walter'],
  ['third-2','Walter II: Marian’s Account','Marian explains how she found Laura confined under Anne Catherick’s name and removed her from the asylum.','gowers-walk',{walter:'Learns the immediate facts of Laura’s confinement and accepts Marian’s account.',marian:'Recounts locating Laura, recognizing her, and organizing the escape.',laura:'Lives in hiding, traumatized and only partly able to recover her memories.'},[],['identity','evidence','love'],['documents','confinement','doubles'],652.10,5,'walter'],
  ['third-3','Walter III: The Conspiracy Takes Shape','Walter combines Marian’s diary, the burial record, and Laura’s fragments of memory into a working theory of exchanged identities.','gowers-walk',{walter:'Builds a testable sequence from testimony rather than relying on resemblance alone.',marian:'Supplies her diary and challenges every weak inference.',laura:'Recalls isolated details without being pressed beyond her strength.'},['marian-diary','death-certificate'],['identity','evidence'],['documents','doubles'],653.00,4,'walter'],
  ['third-4','Walter IV: The Law Refuses the Case','Mr Kyrle explains that Laura’s appearance and private testimony cannot overcome the certificate, burial, and witnesses.','gilmore-kyrle',{walter:'Seeks a lawful restoration of Laura’s identity and learns what evidence is missing.',kyrle:'Defines the documentary obstacles and advises Walter to prove a date that cannot be reconciled.',marian:'Accepts that investigation must precede any public claim.',laura:'Remains legally powerless while the record names her dead.'},['death-certificate'],['evidence','identity'],['documents','confinement'],655.20,4,'walter'],
  ['third-5','Walter V: Hampshire Inquiry','Walter returns to Hampshire to trace Anne’s history and the witnesses around Blackwater Park.','blackwater-house',{walter:'Questions the remaining household evidence without alerting Fosco to every line of inquiry.',michelson:'Gives a conscientious account of the departures from Blackwater.',fanny:'Confirms Laura’s fear and the effort to keep her separated from Marian.'},['marian-diary'],['evidence','identity'],['documents'],662.40,3,'walter'],
  ['third-6','Walter VI: Mrs Clements','Mrs Clements tells Walter about Anne’s childhood, her devotion to Mrs Fairlie, and Mrs Catherick’s dealings with Percival.','clements-inn',{walter:'Listens for facts linking Anne’s past to Percival’s secret.','mrs-clements':'Gives Anne’s history with loyalty and grief, separating what she witnessed from what she inferred.'},[],['secret','evidence','identity'],['documents','white'],669.20,3,'walter'],
  ['third-7','Walter VII: Anne’s Parentage','Walter discovers that Anne and Laura shared a father, explaining their resemblance without making them interchangeable.','clements-inn',{walter:'Recognizes the family connection as the physical premise exploited by the conspiracy.','mrs-clements':'Confirms the circumstances surrounding Anne’s resemblance and Mrs Fairlie’s kindness.'},[],['identity','evidence'],['doubles'],669.60,4,'walter'],
  ['third-8','Walter VIII: Laura’s Memory','In the safety of Gower’s Walk, Laura gradually recalls the London journey and the moment her identity was taken from her.','gowers-walk',{laura:'Recovers fragments of the journey, drugging, and awakening under Anne’s name.',walter:'Records Laura’s memories without treating gaps as failures.',marian:'Supports Laura’s recovery and tests each recollection against the diary.'},[],['identity','love','evidence'],['documents','confinement','doubles'],676.30,4,'laura'],
  ['third-9','Walter IX: Mrs Catherick at Welmingham','Walter confronts Mrs Catherick and learns that Percival’s terror centres on the old parish register.','old-welmingham',{walter:'Uses Anne’s history and Percival’s behavior to press toward the hidden record.','mrs-catherick':'Defends her pride and bargains with what she knows about Percival’s origins.'},['vestry-key'],['secret','evidence'],['documents','confinement'],684.20,5,'walter'],
  ['third-10','Walter X: The Vestry Fire','Percival breaks into the vestry to destroy the register, accidentally sets the building alight, and is trapped.','old-welmingham',{walter:'Tries to reach Percival but sees the secret’s destruction become fatal.',percival:'Attempts to erase the forged entry and dies inside the burning vestry.','mrs-catherick':'Watches the social power built on the false record collapse.'},['church-register','vestry-key'],['secret','evidence'],['documents','thresholds'],684.78,5,'walter'],
  ['third-11','Walter XI: The Inquest','The inquest confirms Percival’s accidental death but cannot replace the destroyed register as evidence in Laura’s case.','old-welmingham',{walter:'Separates the proof of Percival’s secret from the still-unproved identity exchange.','mrs-catherick':'Retains the only complete personal account of how the false entry was created.'},[],['secret','evidence'],['documents'],686.20,3,'walter'],
  ['catherick-account','Mrs Catherick: Her Written Account','Mrs Catherick writes the history of Percival’s illegitimate birth, the forged marriage entry, and Anne’s accidental knowledge.','old-welmingham',{'mrs-catherick':'Sets down the truth to preserve her own version of events and settle her account with Percival.',walter:'Receives the narrative that closes one mystery but not yet Laura’s legal identity.'},['church-register'],['secret','evidence'],['documents'],688.00,4,'mrs-catherick'],
  ['final-1','Walter I: The Register’s Secret','Walter verifies Mrs Catherick’s account and distinguishes Percival’s motive from Fosco’s execution of the identity exchange.','clements-inn',{walter:'Reorganizes the evidence around two connected crimes with different purposes.'},['church-register'],['secret','evidence','identity'],['documents'],690.20,3,'walter'],
  ['final-2','Walter II: Home at Gower’s Walk','Walter returns to Laura and Marian, preserving their concealed household while the final investigation continues.','gowers-walk',{walter:'Balances the case with daily care for Laura and shared planning with Marian.',laura:'Recovers confidence through ordinary work and trusted companionship.',marian:'Maintains the household and insists that Laura’s person matters beyond the legal case.'},[],['love','evidence'],['confinement'],700.20,2,'walter'],
  ['final-3','Walter III: Marriage and Recovery','Walter and Laura marry privately, choosing a shared life before public restoration of her name is complete.','gowers-walk',{walter:'Commits to Laura without making marriage conditional on fortune or legal recognition.',laura:'Chooses Walter with growing confidence and accepts a future outside her former status.',marian:'Witnesses the marriage and remains part of their household.'},[],['love'],['documents'],730.40,3,'walter'],
  ['final-4','Walter IV: Watch on Fosco','Walter watches Fosco’s St John’s Wood house and studies its visitors, routines, and vulnerabilities.','st-johns-wood',{walter:'Conducts patient surveillance without exposing Laura’s hiding place.',fosco:'Prepares to leave England while assuming the documentary case remains secure.','madame-fosco':'Organizes the household according to Fosco’s plans.'},[],['identity','evidence','brotherhood'],['thresholds'],742.60,4,'walter'],
  ['final-5','Walter V: Pesca Recognises Fosco','At the opera, Pesca sees Fosco and reacts with fear and recognition that contradicts the Count’s public identity.','opera',{walter:'Notices Pesca’s reaction and asks for the political history behind it.',pesca:'Recognizes Fosco as a member who betrayed an Italian brotherhood.',fosco:'Realizes that his concealed past has been seen in a public crowd.'},['brotherhood-mark'],['brotherhood','evidence'],['doubles','thresholds'],744.80,5,'walter'],
  ['final-6','Walter VI: The Brotherhood’s Mark','Pesca explains the brotherhood’s discipline and gives Walter leverage more immediate than English legal proceedings.','clements-inn',{walter:'Understands that Fosco fears judgment from his former political associates.',pesca:'Reveals only the information necessary to identify Fosco’s betrayal and danger.'},['brotherhood-mark'],['brotherhood','evidence'],['documents'],745.30,4,'walter'],
  ['final-7','Walter VII: Confronting Fosco','Walter confronts Fosco at Forest Road and demands a complete written confession in exchange for time to leave England.','st-johns-wood',{walter:'Uses verified evidence and the brotherhood threat without surrendering control of the encounter.',fosco:'Calculates that confession and flight offer his only survivable bargain.','madame-fosco':'Follows the Count’s decision and prepares their departure.'},['brotherhood-mark','fosco-confession'],['identity','evidence','brotherhood'],['documents','confinement'],746.10,5,'walter'],
  ['fosco-confession','Fosco: The Confession','Fosco writes how Anne died under Laura’s name and Laura was committed as Anne, fixing the dates and responsibilities.','st-johns-wood',{fosco:'Records the conspiracy with pride in its design while conceding the facts Walter needs.',walter:'Receives and secures the signed account before allowing Fosco to depart.','madame-fosco':'Remains with Fosco as the household closes.'},['fosco-confession','death-certificate'],['identity','evidence','inheritance'],['documents','doubles'],746.60,5,'fosco'],
  ['conclusion-1','Conclusion I: Laura’s Identity Restored','Fosco’s confession and the corrected chronology allow Laura’s name to be restored publicly at Limmeridge.','limmeridge-house',{laura:'Returns to her own name and family place without losing the life built during concealment.',walter:'Presents the evidence that replaces the false death record.',marian:'Sees the documentary victory complete the rescue she began.'},['fosco-confession','grave-marker'],['identity','evidence','love'],['documents'],760.20,4,'walter'],
  ['conclusion-2','Conclusion II: Fosco’s Death in Paris','While working in Paris, Walter and Pesca identify Fosco after his body is recovered from the Seine and displayed at the Morgue.','paris-morgue',{walter:'Identifies Fosco from the body displayed at the Paris Morgue and records only what the visible evidence supports.',pesca:'Recognizes the signs by which the brotherhood marked its judgment on betrayal.',fosco:'Is found dead in Paris after fleeing England.'},['brotherhood-mark'],['brotherhood'],['documents','thresholds'],820.40,4,'walter'],
  ['conclusion-3','Conclusion III: Heir of Limmeridge','Walter, Laura, and Marian return to Limmeridge with Walter and Laura’s son, now heir to the estate.','limmeridge-house',{walter:'Returns as Laura’s husband and father of the Fairlie heir.',laura:'Re-enters Limmeridge with her identity, family, and future restored.',marian:'Shares the household’s final joy and remains central to the family she protected.',fairlie:'Accepts the succession that places Laura’s child after him.'},[],['love','inheritance'],['documents'],1185.50,2,'walter'],
]

const timelineId = id('timeline','main')
const chapters = sceneRows.map((row,index) => ({ ...base, id:Ch(index+1), timelineId, number:index+1, title:row[1], summary:row[2], status:'final', targetWordCount:null }))
const EV = key => id('event',key)
const events = sceneRows.map((row,index) => {
  const [key,title,description,loc,cast,itemSlugs,threads,motifs,time,tension,pov] = row
  const previousTime = index ? sceneRows[index-1][8] : time
  const day = Math.floor(time)
  const previousDay = Math.floor(previousTime)
  return { ...base, id:EV(key), chapterId:Ch(index+1), timelineId, title, description, locationMarkerId:L(loc), involvedCharacterIds:Object.keys(cast).map(C), mentionedCharacterIds:[], involvedItemIds:itemSlugs.map(Item), tags:[], sortOrder:0, travelDays:Math.max(0,day-previousDay), inWorldTime:day, tension, structureBeat:null, threadIds:threads.map(T), motifIds:motifs.map(O), status:'final', povCharacterId:pov?C(pov):null, isFlashback:false }
})
const characterSnapshots = sceneRows.flatMap((row,sceneIndex) => Object.entries(row[4]).map(([character,statusNotes],castIndex) => {
  const loc = locations.find(marker => marker.id===L(row[3]))
  const diesHere = (character === 'anne' && row[0] === 'goodricke') || (character === 'percival' && row[0] === 'third-10') || (character === 'fosco' && row[0] === 'conclusion-2')
  return { ...base, id:id('snapshot',`${String(sceneIndex+1).padStart(3,'0')}-${character}`), characterId:C(character), eventId:EV(row[0]), sortKey:(sceneIndex+1)*10000+castIndex, isAlive:!diesHere, currentLocationMarkerId:L(row[3]), currentMapLayerId:loc.mapLayerId, inventoryItemIds:[], inventoryNotes:'', statusNotes, travelModeId:null }
}))
const travelModes = [['rail','Railway',180],['coach','Coach',75],['foot','On Foot',25],['ship','Steamship',140]].map(([slug,name,speedPerDay]) => ({...base,id:id('travel-mode',slug),name,speedPerDay}))
const characterMovements=[]
for (const character of characters) {
  const slug=character.id.replace(`${P}-character-`,''); let previous=null
  for (const row of sceneRows.filter(candidate=>Object.hasOwn(candidate[4],slug))) {
    if(previous&&previous[3]!==row[3]) characterMovements.push({...base,id:id('movement',`${slug}-${row[0]}`),characterId:character.id,eventId:EV(row[0]),waypoints:[L(previous[3]),L(row[3])],travelModeId:null,sortKey:sceneRows.indexOf(row)*10000,notes:`${character.name} moves from ${locations.find(x=>x.id===L(previous[3])).name} to ${locations.find(x=>x.id===L(row[3])).name}.`})
    previous=row
  }
}
const itemPlacements = sceneRows.flatMap((row,i)=>row[5].map((item,j)=>({...base,id:id('placement',`${row[0]}-${item}`),itemId:Item(item),eventId:EV(row[0]),locationMarkerId:L(row[3]),sortKey:(i+1)*10000+j,notes:`${items.find(x=>x.id===Item(item)).name} is present in “${row[1]}”.`})))
const itemSnapshots = [
  ['warning-letter','walter-12','delivered','The anonymous warning has reached Laura before the marriage.'],
  ['settlement','gilmore-4','executed','The settlement is signed despite Gilmore’s objection.'],
  ['marian-diary','blackwater-10','read by Fosco','Fosco has read and annotated Marian’s private record.'],
  ['church-register','third-10','destroyed','The forged register burns in the vestry fire.'],
  ['fosco-confession','fosco-confession','signed and secured','Walter holds Fosco’s complete signed account.'],
].map(([item,event,condition,notes],i)=>({...base,id:id('item-snapshot',`${item}-${event}`),itemId:Item(item),eventId:EV(event),sortKey:i*100,condition,notes}))

const relationshipRows = [
  ['walter-laura','walter','laura','drawing master and pupil; later spouses','bond','positive','Their restrained affection survives separation, concealment, and the work of restoring Laura’s identity.','walter-8'],
  ['laura-marian','laura','marian','devoted half-sisters','bond','positive','Marian protects Laura practically and emotionally without treating her vulnerability as passivity.','walter-8'],
  ['laura-anne','laura','anne','paternal half-sisters and doubles','strong','complex','Their resemblance and shared father connect two unequal lives and make the identity exchange possible.','third-7'],
  ['laura-percival','laura','percival','wife and coercive husband','strong','negative','A promise and legal authority bind Laura to a man who pursues her fortune and silence.','marian-2'],
  ['percival-fosco','percival','fosco','conspiratorial allies','strong','negative','Percival supplies motive and fear; Fosco supplies patience, timing, and method.','blackwater-1'],
  ['marian-fosco','marian','fosco','intellectual adversaries','strong','complex','Fosco admires Marian’s ability while working to neutralize it; Marian recognizes his charm as danger.','blackwater-2'],
  ['fosco-madame','fosco','madame-fosco','husband and controlling authority','bond','complex','Madame Fosco’s former independence has narrowed into absolute obedience to her husband.','blackwater-1'],
  ['anne-clements','anne','mrs-clements','companions','bond','positive','Mrs Clements shelters Anne with loyalty that contrasts with institutional custody.','third-6'],
  ['anne-catherick','anne','mrs-catherick','estranged mother and daughter','strong','negative','Mrs Catherick treats Anne’s vulnerability and accidental knowledge as threats to her own position.','catherick-account'],
  ['percival-catherick','percival','mrs-catherick','keepers of a shared secret','strong','negative','Their history centres on the false register entry and the leverage each believes the other holds.','third-9'],
  ['walter-marian','walter','marian','allies and family','bond','positive','They combine investigation, care, and mutual trust in protecting Laura.','third-1'],
  ['walter-pesca','walter','pesca','close friends','strong','positive','Their friendship begins in gratitude and later connects Walter to Fosco’s political past.','walter-3'],
  ['laura-fairlie','laura','fairlie','niece and guardian','moderate','complex','Fairlie controls Laura’s family position but repeatedly chooses comfort over protective responsibility.','walter-7'],
  ['laura-gilmore','laura','gilmore','client and family solicitor','moderate','positive','Gilmore respects Laura and objects to settlement terms he considers unsafe.','gilmore-2'],
  ['gilmore-kyrle','gilmore','kyrle','legal partners','strong','positive','The two solicitors preserve a professional record of the family’s legal position.','third-4'],
  ['fosco-pesca','fosco','pesca','brotherhood traitor and witness','strong','negative','Pesca’s recognition exposes the political judgment Fosco escaped but never ceased to fear.','final-5'],
  ['laura-fanny','laura','fanny','mistress and loyal maid','moderate','positive','Fanny tries to remain with Laura and carry warning when the Blackwater household is divided.','blackwater-7'],
].map(([slug,a,b,label,strength,sentiment,description,start])=>({...base,id:R(slug),characterAId:C(a),characterBId:C(b),label,strength,sentiment,description,isBidirectional:true,startEventId:EV(start)}))
const relationshipSnapshots = [
  ['walter-laura','walter-9','teacher and pupil in love','bond','positive','Daily companionship has become mutual attachment.'],
  ['walter-laura','walter-14','separated by promise','strong','complex','They part because Laura believes herself bound to Percival.'],
  ['walter-laura','final-3','married partners','bond','positive','They choose marriage before wealth or public recognition is restored.'],
  ['laura-percival','blackwater-4','coercive spouses','strong','negative','Percival tries to force Laura’s signature by withholding explanation.'],
  ['marian-fosco','blackwater-8','watcher and conspirator','strong','negative','Marian overhears the plan Fosco designed.'],
  ['percival-fosco','third-10','alliance ended by death','none','negative','Percival dies with the register he meant to destroy.'],
].map(([relationship,event,label,strength,sentiment,description],i)=>({...base,id:id('relationship-snapshot',`${relationship}-${event}`),relationshipId:R(relationship),eventId:EV(event),sortKey:i*100,label,strength,sentiment,description,isActive:strength!=='none'}))

const factions = [
  ['investigators','The Limmeridge Investigators','Walter, Marian, Laura, and their legal allies work from testimony toward proof that can restore Laura’s identity.','#54717b',11],
  ['conspiracy','The Blackwater Conspiracy','Percival and the Foscos coordinate financial coercion, false identity, confinement, and documentary substitution.','#76545c',24],
  ['brotherhood','The Italian Brotherhood','A secret political association whose discipline follows Fosco after his betrayal and exile.','#6b5a48',35],
].map(([slug,name,description,color,artNo])=>{const art=review(`polo-${String(artNo).padStart(2,'0')}`,`a period group engraving used for ${name}`);return{...base,id:F(slug),name,description,color,coverImageId:I(art),tags:[]}})
const factionMemberships = [
  ['investigators','walter','Investigator','third-1'],['investigators','marian','Investigator and protector','third-1'],['investigators','laura','Witness and claimant','third-1'],['investigators','gilmore','Solicitor','third-4'],['investigators','kyrle','Solicitor','third-4'],
  ['conspiracy','percival','Principal beneficiary','blackwater-1'],['conspiracy','fosco','Planner','blackwater-1'],['conspiracy','madame-fosco','Accomplice','blackwater-1'],
  ['brotherhood','pesca','Member','final-5'],['brotherhood','fosco','Condemned former member','final-5'],
].map(([faction,character,role,start])=>({...base,id:id('membership',`${faction}-${character}`),factionId:F(faction),characterId:C(character),role,startEventId:EV(start),endEventId:null,notes:''}))
const factionRelationships = [
  {...base,id:id('faction-relationship','investigators-conspiracy'),factionAId:F('investigators'),factionBId:F('conspiracy'),stance:'hostile',notes:'The investigators reconstruct and expose the conspiracy.'},
  {...base,id:id('faction-relationship','brotherhood-conspiracy'),factionAId:F('brotherhood'),factionBId:F('conspiracy'),stance:'hostile',notes:'Fosco’s fear of the brotherhood gives Walter leverage over the conspiracy’s surviving architect.'},
]

const loreCategories = [
  {id:id('lore-category','form'),worldId,name:'Narrative Form',color:'#6b7079',sortOrder:0},
  {id:id('lore-category','law'),worldId,name:'Law and Institutions',color:'#7d6758',sortOrder:1},
  {id:id('lore-category','setting'),worldId,name:'Places and Society',color:'#586f68',sortOrder:2},
  {id:id('lore-category','sources'),worldId,name:'Sources and Visual Record',color:'#6c6278',sortOrder:3},
]
const lorePages = [
  ['testimony','form','A Novel Made of Testimony','The story presents itself as a case assembled from narrators who record only what they witnessed or can document. Changes of voice do not create separate timelines; they add evidence to one chronology.',['walter','marian','gilmore'],'walter-1',5],
  ['coverture','law','Marriage, Property, and Authority','Laura’s vulnerability is shaped by nineteenth-century marriage and property arrangements. The settlement negotiations make money, guardianship, and legal personhood part of the suspense.',['laura','inheritance'],'gilmore-2',15],
  ['asylum-law','law','Private Confinement and Identity','The asylum plot depends on institutional records and the credibility granted to male relatives over a distressed woman’s own account.',['asylum','identity'],'walter-5',22],
  ['limmeridge','setting','Limmeridge and Family Memory','Limmeridge joins house, village, school, and churchyard into a landscape shaped by Mrs Fairlie’s memory and the unequal childhoods of Laura and Anne.',['cumberland-gate','laura','anne'],'walter-8',29],
  ['blackwater','setting','Blackwater Park','The neglected Hampshire estate reflects financial pressure and domestic control: rooms are closed, servants dismissed, and routes managed as the conspiracy advances.',['hampshire-gate','percival'],'blackwater-1',38],
  ['sources','sources','Text, Maps, and Illustrations','Structure and chronology follow Wilkie Collins’s public-domain novel and a scholarly chronology. Linked illustrations come from the 1875 Polo edition and Thomas Eyre Macklin; map layers are historical editorial aids, not exact plans of fictional estates.',[],'walter-1',46],
].map(([slug,category,title,body,links,visible,artNo])=>{const art=review(`polo-${String(artNo).padStart(2,'0')}`,`a period book engraving selected for the lore page ${title}`);return{...base,id:id('lore',slug),categoryId:id('lore-category',category),title,body,tags:[],coverImageId:I(art),linkedEntityIds:links.map(link=>['inheritance','identity'].includes(link)?T(link):['asylum','cumberland-gate','hampshire-gate'].includes(link)?L(link):C(link)),visibleFromEventId:EV(visible)}})

const knowledgeFacts = [
  ['anne-escaped','Anne escaped from a private asylum','The woman Walter met was being pursued after leaving institutional confinement.','walter-5'],
  ['resemblance','Anne resembles Laura','Walter recognizes the likeness on meeting Laura; its family cause is learned later.','walter-8'],
  ['percival-confined-anne','Percival arranged Anne’s confinement','Percival admits the act while presenting it as protection from delusion.','gilmore-1'],
  ['percival-secret','Anne knows a secret that could ruin Percival','Her warning points to a fact more dangerous to him than scandal.','blackwater-6'],
  ['conspiracy-plan','The conspirators plan to exchange Laura and Anne’s identities','Marian overhears the design at Blackwater.','blackwater-8'],
  ['laura-alive','Laura is alive under Anne’s name','Marian recognizes and removes Laura from the asylum.','third-2'],
  ['shared-father','Anne and Laura share a father','Their kinship explains the resemblance the conspiracy exploits.','third-7'],
  ['register-secret','Percival’s title rests on a forged register entry','The old parish register falsely records his parents’ marriage.','catherick-account'],
  ['date-error','The recorded death date conflicts with Laura’s movements','Walter’s reconstruction shows that the official chronology cannot be true.','fosco-confession'],
  ['fosco-brotherhood','Fosco betrayed an Italian brotherhood','Pesca’s recognition exposes a threat Fosco cannot dismiss.','final-5'],
  ['full-confession','Fosco directed the identity exchange','His signed confession supplies the complete sequence and names the participants.','fosco-confession'],
].map(([slug,title,description,event])=>({...base,id:K(slug),title,description,tags:[],readerLearnsAtEventId:EV(event),originEventId:EV(event)}))
const knowledgeReveals = [
  ['anne-escaped','walter','walter-5'],['resemblance','walter','walter-8'],['resemblance','marian','walter-8'],['percival-confined-anne','gilmore','gilmore-1'],['percival-confined-anne','laura','gilmore-1'],['percival-secret','marian','blackwater-6'],['conspiracy-plan','marian','blackwater-8'],['laura-alive','walter','third-2'],['shared-father','walter','third-7'],['register-secret','walter','catherick-account'],['fosco-brotherhood','walter','final-5'],['fosco-brotherhood','pesca','final-5'],['full-confession','walter','fosco-confession'],['full-confession','laura','conclusion-1'],['full-confession','marian','conclusion-1'],
].map(([fact,character,event])=>({...base,id:id('reveal',`${fact}-${character}`),factId:K(fact),characterId:C(character),eventId:EV(event),note:`${characters.find(x=>x.id===C(character)).name} learns: ${knowledgeFacts.find(x=>x.id===K(fact)).title}.`}))
const characterGoals = [
  ['walter-truth','walter','want','Prove the identity exchange and restore Laura’s name.','third-1','conclusion-1'],
  ['walter-care','walter','need','Build a life with Laura that does not depend on recovering her fortune.','third-2','final-3'],
  ['laura-freedom','laura','want','Recover safety, agency, and recognition after confinement.','third-1','conclusion-1'],
  ['marian-protect','marian','want','Protect Laura from Percival and Fosco.','walter-10','conclusion-1'],
  ['percival-secret','percival','want','Keep the forged register and his illegitimacy concealed.','gilmore-1','third-10'],
  ['percival-money','percival','want','Gain control of Laura’s fortune.','gilmore-2','third-10'],
  ['fosco-control','fosco','want','Execute the identity exchange without leaving proof.','blackwater-1','fosco-confession'],
  ['anne-warning','anne','want','Warn Laura about Percival before he can silence her.','walter-4','goodricke'],
  ['gilmore-protect','gilmore','want','Secure settlement terms that protect Laura’s property.','gilmore-2','gilmore-4'],
].map(([slug,character,type,text,start,end])=>({...base,id:id('goal',slug),characterId:C(character),type,text,startEventId:EV(start),endEventId:EV(end)}))

const locationSnapshots = [
  {...base,id:id('location-snapshot','blackwater-isolated'),locationMarkerId:L('blackwater-house'),eventId:EV('blackwater-7'),sortKey:1,status:'household reduced',notes:'Servants are dismissed and Laura’s support is deliberately narrowed.'},
  {...base,id:id('location-snapshot','vestry-burned'),locationMarkerId:L('old-welmingham'),eventId:EV('third-10'),sortKey:2,status:'vestry destroyed by fire',notes:'The register and vestry burn during Percival’s attempt to remove the evidence.'},
  {...base,id:id('location-snapshot','limmeridge-restored'),locationMarkerId:L('limmeridge-house'),eventId:EV('conclusion-3'),sortKey:3,status:'family restored',notes:'Laura returns with Walter, Marian, and the new heir.'},
]
const mapRoutes = [
  {...base,id:id('route','north'),mapLayerId:M('england'),name:'London to Limmeridge',routeType:'rail',waypoints:[L('london-gate'),L('cumberland-gate')],color:'#58717a',notes:'Walter’s first journey north and later return to the churchyard.'},
  {...base,id:id('route','blackwater'),mapLayerId:M('england'),name:'Limmeridge to Blackwater Park',routeType:'road',waypoints:[L('cumberland-gate'),L('hampshire-gate')],color:'#76545c',notes:'Laura’s marriage moves the principal household from Cumberland to Hampshire.'},
  {...base,id:id('route','investigation'),mapLayerId:M('england'),name:'Walter’s Investigation',routeType:'rail',waypoints:[L('london-gate'),L('hampshire-gate'),L('cumberland-gate')],color:'#8b754b',notes:'The later inquiry connects London testimony, Hampshire evidence, and Limmeridge’s public record.'},
]

const data = {
  version:16,type:'worldbreaker-export',exportedAt:now,
  world:{id:worldId,name:'The Woman in White',description:'Wilkie Collins’s mystery follows drawing master Walter Hartright, sisters Laura Fairlie and Marian Halcombe, and the haunting figure of Anne Catherick through a struggle over identity, marriage, confinement, inheritance, and the authority of written evidence.',coverImageId:I('cover'),theme:'theme-noir',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1849,yearSuffix:' (editorial chronology)',months:[['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],['July',31],['August',31],['September',30],['October',31],['November',30],['December',31]].map(([name,days])=>({name,days}))},wordTarget:null},
  mapLayers:maps,locationMarkers:locations,characters,items,characterSnapshots,characterMovements,itemPlacements,locationSnapshots,itemSnapshots,relationships:relationshipRows,relationshipSnapshots,
  timelines:[{id:timelineId,worldId,name:'The Case, 1849–1852',description:'One chronology assembled from successive narrators and documentary witnesses.',color:'#65727a',dayOffset:0,createdAt:now}],chapters,events,blobs,travelModes,timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes,mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],loreCategories,lorePages,factions,factionMemberships,factionRelationships,knowledgeFacts,knowledgeReveals,characterGoals,sceneTexts:[],plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[],
}

for(const child of maps.filter(map=>map.parentMapId)) if(locations.filter(location=>location.linkedMapLayerId===child.id).length!==1) throw new Error(`Expected exactly one gateway for ${child.name}`)
if(chapters.length!==62||new Set(events.map(event=>event.chapterId)).size!==chapters.length) throw new Error('All 62 sections need an event')
if(characterSnapshots.length!==events.reduce((sum,event)=>sum+event.involvedCharacterIds.length,0)) throw new Error('Snapshot coverage mismatch')
if(new Set(characterSnapshots.map(x=>`${x.eventId}:${x.characterId}`)).size!==characterSnapshots.length) throw new Error('Duplicate snapshot')
const portraits=characters.map(x=>x.portraitImageId).filter(Boolean)
if(portraits.length!==characters.length||new Set(portraits).size!==portraits.length) throw new Error('Every character needs distinct portrait art')
if(new Set(items.map(x=>x.imageId)).size!==items.length) throw new Error('Item art must be distinct')
const entityImages=[...characters.map(x=>x.portraitImageId),...items.map(x=>x.imageId),...locations.map(x=>x.imageId)]
if(new Set(entityImages).size!==entityImages.length) throw new Error('Entity illustrations must not be recycled')
const mapImageIds=new Set(maps.map(x=>x.imageId))
for(const imageId of entityImages){if(mapImageIds.has(imageId))throw new Error('Map used as entity art');const slug=imageId.replace(`${P}-image-`,'');if(!reviewedArt[slug])throw new Error(`${slug} lacks visual rationale`)}
const refs={characters:new Set(characters.map(x=>x.id)),locations:new Set(locations.map(x=>x.id)),items:new Set(items.map(x=>x.id)),threads:new Set(plotThreads.map(x=>x.id)),motifs:new Set(motifs.map(x=>x.id))}
for(const event of events){if(!refs.locations.has(event.locationMarkerId))throw new Error(`${event.title}: invalid location`);if(event.involvedCharacterIds.some(x=>!refs.characters.has(x)))throw new Error(`${event.title}: invalid character`);if(event.involvedItemIds.some(x=>!refs.items.has(x)))throw new Error(`${event.title}: invalid item`);if(event.threadIds.some(x=>!refs.threads.has(x)))throw new Error(`${event.title}: invalid thread`);if(event.motifIds.some(x=>!refs.motifs.has(x)))throw new Error(`${event.title}: invalid motif`);if(!Number.isInteger(event.inWorldTime)||!Number.isInteger(event.travelDays)||event.travelDays<0||event.tension<1||event.tension>5)throw new Error(`${event.title}: invalid calendar/tension`)}
for(const [eventKey,expectedDay] of [['walter-2',211],['marian-1',311],['marian-2',355],['blackwater-1',526],['goodricke',570],['return',650]]) if(events.find(event=>event.id===EV(eventKey))?.inWorldTime!==expectedDay) throw new Error(`${eventKey} is not pinned to its documented calendar day`)

const text=`${JSON.stringify(data,null,2)}\n`
fs.writeFileSync('example/The Woman in White.pwk',text)
fs.writeFileSync('public/library/the-woman-in-white.pwk',text)
const index=JSON.parse(fs.readFileSync('public/library/index.json','utf8'))
const entry={id:'the-woman-in-white',title:'The Woman in White',author:'Wilkie Collins',blurb:'A drawing master, two half-sisters, and a woman escaped from confinement assemble the evidence behind a conspiracy of identity, inheritance, and law.',data:'the-woman-in-white.pwk',dataBytes:Buffer.byteLength(text),counts:{characters:characters.length,chapters:chapters.length,events:events.length,locations:locations.length},notice:'Unofficial reference for a public-domain novel. This example contains original structural summaries and editorial chronology, not the novel’s prose. Historical maps and public-domain book illustrations are linked in the file.',worldId,cover:commons('The woman in white Cover 1890.jpg')}
const at=index.entries.findIndex(book=>book.id===entry.id);if(at>=0)index.entries[at]=entry;else index.entries.push(entry)
fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)
console.log(JSON.stringify({chapters:chapters.length,events:events.length,characters:characters.length,relationships:relationshipRows.length,locations:locations.length,maps:maps.length,items:items.length,threads:plotThreads.length,lore:lorePages.length,factions:factions.length,facts:knowledgeFacts.length,goals:characterGoals.length,bytes:Buffer.byteLength(text)},null,2))
