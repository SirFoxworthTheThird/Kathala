import fs from 'node:fs'

const P='pp', worldId='pride-prejudice-world', timelineId='pp-timeline-main', now=1785672000000
const base={worldId,createdAt:now,updatedAt:now}
const id=(kind,slug)=>`${P}-${kind}-${slug}`
const chId=n=>id('chapter',String(n).padStart(2,'0'))
const charId=s=>id('char',s), itemId=s=>id('item',s), locId=s=>id('loc',s), mapId=s=>id('map',s)
const threadId=s=>id('thread',s), motifId=s=>id('motif',s)
const months=[['January',31],['February',28],['March',31],['April',30],['May',31],['June',30],['July',31],['August',31],['September',30],['October',31],['November',30],['December',31]].map(([name,days])=>({name,days}))
const commons=(name,width=960)=>`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}?width=${width}`
const blob=(slug,url,mimeType='image/jpeg')=>({id:id('image',slug),worldId,mimeType,url,createdAt:now})

const blobs=[
 blob('cover',commons('AUSTEN(1894) Pride and prejudice (15811958311).jpg',960)),
 blob('map-england',commons('British Isles location map.svg',960),'image/png'),
 blob('map-hertfordshire',commons('Hertford Shire - By H. Moll Geographer - btv1b530569867.jpg',1280)),
 blob('map-london',commons("Smith's New Map of London (1816).jpg",1280)),
 blob('map-kent',commons('Kent UK location map.svg',1280),'image/png'),
 blob('map-derbyshire',commons('John Cary - Map of Derbyshire - 1787 - 001.jpg',1280)),
 blob('map-sussex',commons('Sussex UK location map.svg',1280),'image/png'),
]
const artFiles={
 elizabeth:'Elisabeth Bennet (détail).jpg',darcy:'Thompson-Darcy.jpg',wickham:'Thompson-PP-Wickham.jpg',
 'mrs-bennet':'Mrs Bennet.jpg','lady-catherine':'Lady Catherine de Bourg.jpg',lydia:'Lydia showing her ring CH51.jpg',
 jane:'Bingley&Jane CH 55.jpg',collins:"Mr Collins didn't read novels.gif",caroline:'P&P10-Miss Bingley.JPG',
 bennet:'Thomson-PP01.jpg',mary:'Thomson-PP02.jpg',kitty:'Thomson-PP03.jpg',bingley:'Thomson-PP04.jpg',
 charlotte:'Thomson-PP05.jpg','sir-william':'Thomson-PP06.jpg','lady-lucas':'Thomson-PP07.jpg',maria:'Thomson-PP08.jpg',
 gardiner:'Thomson-PP09.jpg','mrs-gardiner':'Thomson-PP10.jpg',georgiana:'Thomson-PP11.jpg','colonel-fitzwilliam':'Thomson-PP12.jpg',
 'mr-philips':'Thomson-PP13.jpg','mrs-philips':'P&P-Mrs Bennet et Philips.JPG',denny:'Thomson-PP14.jpg',forster:'Thomson-PP15.jpg',
 'mrs-forster':'Thomson-PP16.jpg','mr-hurst':'Thomson-PP17.jpg','mrs-hurst':'Thomson-PP18.jpg','miss-king':'Thomson-PP19.jpg',
 'mrs-reynolds':'Thomson-PP20.jpg','mrs-younge':'Thomson-PP21.jpg','anne-de-bourgh':'Thomson-PP22.jpg',jenkinson:'P&P ch 28.jpg',
 hill:'Thomson-PP-Ch51.JPG',peacock:'Thomson-P&P-Incipit.jpg',proposal:'P&P34-Déclaration de Darcy (BrockNB).JPG',
 letter:'P&P35-la lettre.JPG',pemberley:'P&P43-Devant le portrait de Darcy (BrockNB).JPG',ring:'Lydia showing her ring CH51.jpg',
 dance:'PrideandPrejudiceCH3.jpg',netherfield:'P&P10-Netherfield (NB).JPG',sermons:'P&P14-Collins lit Fordice.JPG',
 carriage:'P&P27 (a troop of boys & girls).JPG',visiting:'P&P44-Visiting Lambton.JPG',reconciliation:'P&P52-Do not let us quarrel about the past.JPG',
}
for(const [slug,file] of Object.entries(artFiles)) blobs.push(blob(`art-${slug}`,commons(file,720),file.toLowerCase().endsWith('.png')?'image/png':file.toLowerCase().endsWith('.gif')?'image/gif':'image/jpeg'))

const mapLayers=[
 {...base,id:mapId('england'),parentMapId:null,name:'England in the Regency Era',description:'The novel’s journeys between Hertfordshire, London, Kent, Derbyshire, Sussex, and the north.',imageId:id('image','map-england'),imageWidth:960,imageHeight:1483,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
 {...base,id:mapId('hertfordshire'),parentMapId:mapId('england'),name:'Hertfordshire and the Meryton Neighbourhood',description:'Editorial placements for Longbourn, Netherfield, Lucas Lodge, and Meryton on a historical county map.',imageId:id('image','map-hertfordshire'),imageWidth:1280,imageHeight:944,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
 {...base,id:mapId('london'),parentMapId:mapId('england'),name:'London, 1816 Map',description:'Gracechurch Street, Darcy’s London house, and the streets involved in the Wickham search.',imageId:id('image','map-london'),imageWidth:1280,imageHeight:911,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
 {...base,id:mapId('kent'),parentMapId:mapId('england'),name:'Kent: Hunsford and Rosings',description:'Editorial placements for Hunsford Parsonage and Rosings Park on a regional map.',imageId:id('image','map-kent'),imageWidth:1280,imageHeight:898,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
 {...base,id:mapId('derbyshire'),parentMapId:mapId('england'),name:'Derbyshire: Pemberley and Lambton',description:'Editorial placements for Pemberley and Lambton on John Cary’s 1787 Derbyshire map.',imageId:id('image','map-derbyshire'),imageWidth:1280,imageHeight:1619,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
 {...base,id:mapId('sussex'),parentMapId:mapId('england'),name:'Sussex and Brighton',description:'The militia’s Brighton encampment and Lydia’s departure point.',imageId:id('image','map-sussex'),imageWidth:1280,imageHeight:899,scalePixelsPerUnit:null,scaleUnit:null,levelGroupId:null,levelIndex:0,levelLabel:''},
]

const locationMarkers=[]
function loc(slug,map,name,description,x,y,iconType='building',linked=null){locationMarkers.push({...base,id:locId(slug),mapLayerId:mapId(map),linkedMapLayerId:linked?mapId(linked):null,name,description,x,y,iconType,tags:[],factionId:null})}
loc('hertfordshire-portal','england','Hertfordshire','The rural county containing Longbourn, Meryton, and Netherfield, where neighboring estates form a close social world.',720,430,'region','hertfordshire')
loc('london-portal','england','London','The capital’s network of fashionable streets, commercial districts, lodgings, shops, and family homes.',710,350,'city','london')
loc('kent-portal','england','Kent','The south-eastern county containing Hunsford parsonage and the great Rosings Park estate.',770,290,'region','kent')
loc('derbyshire-portal','england','Derbyshire','A northern county of market towns, wooded valleys, rocky heights, and the Pemberley estate.',650,650,'region','derbyshire')
loc('brighton-portal','england','Brighton, Sussex','A fashionable Sussex seaside resort and seasonal military station on the English Channel.',680,210,'city','sussex')
loc('newcastle','england','Newcastle','The Wickhams’ post-marriage military posting.',630,1040,'city')
loc('longbourn','hertfordshire','Longbourn','The Bennet family home and emotional centre of the novel.',535,410,'building')
loc('meryton','hertfordshire','Meryton','Market town for assemblies, officers, shopping, and gossip.',590,360,'town')
loc('assembly','hertfordshire','Meryton Assembly Rooms','The first public meeting of the Bennets, Bingley, and Darcy.',610,345,'building')
loc('netherfield','hertfordshire','Netherfield Park','Bingley’s leased estate and the site of Jane’s illness and the Netherfield ball.',760,520,'building')
loc('lucas-lodge','hertfordshire','Lucas Lodge','Home of Sir William, Lady Lucas, Charlotte, and Maria.',390,500,'building')
loc('philips-house','hertfordshire','The Philipses’ House','Meryton home where Wickham tells Elizabeth his history.',580,380,'building')
loc('oakham-mount','hertfordshire','Oakham Mount','A quiet walking route used for the final proposal and explanations.',480,590,'landmark')
loc('gardiner-house','london','Gracechurch Street','The Gardiners’ respectable commercial London home.',755,320,'building')
loc('darcy-london','london','Darcy’s London House','Darcy’s metropolitan residence and Georgiana’s usual home.',560,590,'building')
loc('wickham-lodgings','london','Wickham and Lydia’s Lodgings','The hidden London lodging found through Mrs Younge.',830,420,'building')
loc('hunsford','kent','Hunsford Parsonage','The Collins household where Elizabeth stays with Charlotte.',450,520,'building')
loc('rosings','kent','Rosings Park','Lady Catherine’s estate, near the parsonage.',760,610,'castle')
loc('rosings-grove','kent','Rosings Grove','Walks where Darcy encounters Elizabeth and delivers his letter.',630,540,'landmark')
loc('pemberley','derbyshire','Pemberley','Darcy’s Derbyshire estate, seen through its grounds, household, and portrait gallery.',620,1000,'castle')
loc('lambton','derbyshire','Lambton','The town where Elizabeth and the Gardiners lodge near Pemberley.',760,850,'town')
loc('lambton-inn','derbyshire','Lambton Inn','Elizabeth receives Jane’s letters and tells Darcy of Lydia’s elopement.',780,825,'building')
loc('brighton-camp','sussex','Brighton Militia Camp','The Forsters’ station where Lydia follows the regiment.',740,250,'building')
loc('brighton-town','sussex','Brighton','The seaside town from which Lydia and Wickham disappear.',700,225,'town')

const charSpecs=[
 ['elizabeth','Elizabeth Bennet','Intelligent and independent second Bennet daughter whose judgments of Darcy and Wickham must be revised.','elizabeth','#8f6d78',true],
 ['darcy','Fitzwilliam Darcy','Wealthy master of Pemberley whose reserve, pride, loyalty, and capacity for change shape the central courtship.','darcy','#556b78',true],
 ['jane','Jane Bennet','The eldest Bennet daughter, generous in judgment and quietly in love with Bingley.','jane','#9a7a82',true],
 ['bingley','Charles Bingley','Good-humoured tenant of Netherfield who falls readily in love with Jane.','bingley','#718297',true],
 ['bennet','Mr Bennet','Witty but withdrawn father whose amusement often substitutes for responsible action.','bennet','#756a5b',true],
 ['mrs-bennet','Mrs Bennet','Anxious and indiscreet mother determined to marry her five daughters advantageously.','mrs-bennet','#a06c70',true],
 ['mary','Mary Bennet','Bookish third Bennet daughter given to moral observations and public performance.','mary','#74677b',true],
 ['kitty','Catherine “Kitty” Bennet','Impressionable fourth Bennet daughter who follows Lydia until separation improves her.','kitty','#a17c8c',true],
 ['lydia','Lydia Bennet','Impulsive youngest Bennet daughter whose elopement with Wickham threatens the family.','lydia','#b36c76',true],
 ['wickham','George Wickham','Charming militia officer who conceals debts, attempted exploitation, and bad faith.','wickham','#76685c',true],
 ['collins','Mr William Collins','Obsequious clergyman and Longbourn heir who proposes first to Elizabeth and then Charlotte.','collins','#847853',true],
 ['charlotte','Charlotte Lucas','Elizabeth’s pragmatic friend, who secures stability by marrying Mr Collins.','charlotte','#74806c',true],
 ['caroline','Caroline Bingley','Bingley’s status-conscious sister, hostile to Jane and Elizabeth and attentive to Darcy.','caroline','#876885',true],
 ['mrs-hurst','Louisa Hurst','Bingley’s married sister and Caroline’s ally in social exclusion.','mrs-hurst','#7f7188',true],
 ['mr-hurst','Mr Hurst','Louisa’s indolent husband, chiefly interested in cards, food, and comfort.','mr-hurst','#756b63',true],
 ['georgiana','Georgiana Darcy','Darcy’s shy younger sister, once targeted by Wickham and later befriended by Elizabeth.','georgiana','#8c8296',true],
 ['colonel-fitzwilliam','Colonel Fitzwilliam','Darcy’s sociable cousin, Georgiana’s co-guardian, and Elizabeth’s companion at Hunsford.','colonel-fitzwilliam','#687889',true],
 ['lady-catherine','Lady Catherine de Bourgh','Darcy’s domineering aunt, patroness of Collins, and defender of inherited rank.','lady-catherine','#815a64',true],
 ['anne-de-bourgh','Anne de Bourgh','Lady Catherine’s sickly daughter and imagined future wife for Darcy.','anne-de-bourgh','#8a7c83',true],
 ['jenkinson','Mrs Jenkinson','Anne de Bourgh’s attentive companion.','jenkinson','#77716c',true],
 ['sir-william','Sir William Lucas','Courteous former mayor who delights in ceremony and social distinction.','sir-william','#8a744f',true],
 ['lady-lucas','Lady Lucas','Charlotte’s mother and Mrs Bennet’s neighbourly rival.','lady-lucas','#917360',true],
 ['maria','Maria Lucas','Charlotte’s younger sister and Elizabeth’s fellow traveller to Hunsford.','maria','#8d7f72',true],
 ['gardiner','Mr Edward Gardiner','Mrs Bennet’s sensible brother, a London merchant and responsible uncle.','gardiner','#65766c',true],
 ['mrs-gardiner','Mrs Gardiner','Elizabeth’s perceptive aunt, trusted confidante, and companion at Pemberley.','mrs-gardiner','#7e7770',true],
 ['mr-philips','Mr Philips','Meryton attorney and Mrs Bennet’s brother-in-law.','mr-philips','#6f7069',true],
 ['mrs-philips','Mrs Philips','Mrs Bennet’s gossip-loving sister in Meryton.','mrs-philips','#9a716d',true],
 ['denny','Mr Denny','Militia officer who introduces Wickham to the Bennet circle.','denny','#65717b',true],
 ['forster','Colonel Forster','Commander of the militia regiment and host responsible for Lydia in Brighton.','forster','#5f7181',true],
 ['mrs-forster','Mrs Forster','Young wife of Colonel Forster and Lydia’s friend, who invites her to Brighton.','mrs-forster','#a17f8a',true],
 ['miss-king','Miss Mary King','A young heiress briefly courted by Wickham.','miss-king','#8a7a65',true],
 ['mrs-reynolds','Mrs Reynolds','Pemberley housekeeper whose testimony challenges Elizabeth’s view of Darcy.','mrs-reynolds','#737b70',true],
 ['mrs-younge','Mrs Younge','Former Georgiana companion whose connection to Wickham helps Darcy locate Lydia.','mrs-younge','#6f646b',true],
 ['hill','Mrs Hill','Longbourn housekeeper who witnesses Lydia’s triumphal return.','hill','#776e65',true],
]
const characters=charSpecs.map(([slug,name,description,img,color,isAlive])=>({...base,id:charId(slug),name,aliases:[],description,portraitImageId:id('image',`art-${img}`),color,tags:[],isAlive,birthDate:null}))

const itemSpecs=[
 ['netherfield-news','Netherfield Lease News','The neighbourhood intelligence that a wealthy single man has taken Netherfield.','newspaper','netherfield'],
 ['dance-card','Assembly Dance Card','The social record of partners, refusals, and public preference.','notebook','dance'],
 ['jane-letter','Jane’s Netherfield Letter','Jane’s note asking Elizabeth to come when illness confines her at Netherfield.','mail','letter'],
 ['caroline-letter','Caroline Bingley’s London Letter','The letter announcing the Netherfield party’s departure and implying Bingley’s future with Georgiana.','mail','letter'],
 ['fordyce','Fordyce’s Sermons','Mr Collins’s chosen evening reading, rejected by Lydia.','book-open','sermons'],
 ['ball-invitation','Netherfield Ball Invitation','The long-awaited invitation that brings every rivalry into one room.','mail','dance'],
 ['darcy-letter','Darcy’s Hunsford Letter','Darcy’s written account of Bingley, Wickham, and Georgiana that overturns Elizabeth’s certainty.','mail','letter'],
 ['gardiner-carriage','Gardiners’ Travelling Carriage','The vehicle carrying Elizabeth through Derbyshire and later rapidly home.','car','carriage'],
 ['pemberley-portrait','Darcy’s Pemberley Portrait','The portrait before which Elizabeth considers Darcy in the context of home and responsibility.','image-frame','pemberley'],
 ['georgiana-invitation','Georgiana’s Dinner Invitation','The invitation bringing Elizabeth into Darcy’s family circle.','mail','visiting'],
 ['jane-elopement-letters','Jane’s Elopement Letters','Two delayed letters revealing Lydia’s flight with Wickham.','mail-warning','letter'],
 ['lydia-note','Lydia’s Note to Mrs Forster','A careless farewell note treating elopement as a joke.','mail-warning','letter'],
 ['gardiner-express','Mr Gardiner’s Express','The message announcing that Lydia and Wickham have been found and can marry.','send','letter'],
 ['settlement','Wickham Marriage Settlement','The financial arrangement presented as Mr Gardiner’s work but secretly funded by Darcy.','file','reconciliation'],
 ['wedding-ring','Lydia’s Wedding Ring','The visible proof Lydia displays without shame at Longbourn.','circle','ring'],
 ['aunt-letter','Mrs Gardiner’s Explanatory Letter','The account revealing Darcy’s search, payment, and presence at Lydia’s wedding.','mail','reconciliation'],
 ['collins-letter','Mr Collins’s Warning Letter','A letter predicting disgrace and later reporting Lady Catherine’s alarm.','mail-warning','letter'],
]
const items=itemSpecs.map(([slug,name,description,iconType,img])=>({...base,id:itemId(slug),name,description,iconType,imageId:id('image',`art-${img}`),tags:[]}))

const chapterSynopses=[
 'Netherfield’s new tenant turns marriage into urgent neighbourhood business.','Mr Bennet reveals that he has already visited Bingley.','At the Meryton assembly Bingley admires Jane while Darcy insults Elizabeth.','Jane and Elizabeth compare Bingley’s openness with Darcy’s reserve.','The Lucases and Bennets debate pride, vanity, and the assembly.','Darcy’s interest in Elizabeth grows while she remains amused by him.','The militia arrives; Jane rides to Netherfield, falls ill, and summons Elizabeth.','Elizabeth’s muddy arrival exposes class judgments at Netherfield.','Mrs Bennet’s visit embarrasses Elizabeth and encourages Lydia.','Darcy and Elizabeth spar while Caroline tries to command his attention.','The Netherfield party debates accomplished women, defects, and resentment.','Jane recovers and the Bennet sisters return home.','Mr Collins writes and arrives as the male heir to Longbourn.','Collins praises Rosings and fails to improve the family evening.','In Meryton, Wickham meets Elizabeth and exchanges a charged look with Darcy.','Wickham gives Elizabeth his persuasive account of Darcy’s injustice.','Elizabeth tells Jane; a Netherfield ball is announced.','The Netherfield ball magnifies every attraction, error, and embarrassment.','Collins proposes to Elizabeth and refuses to believe her refusal.','Mrs Bennet pressures Elizabeth; Mr Bennet supports her decision.','Collins withdraws while Caroline’s letter announces Bingley’s departure.','Collins proposes to Charlotte, who accepts for practical security.','The Lucas engagement shocks Elizabeth and enrages Mrs Bennet.','Jane suffers quietly while Elizabeth condemns Bingley’s friends and Darcy.','The Gardiners arrive and Mrs Gardiner observes Jane and Wickham.','Jane’s London hopes fade; Elizabeth maintains correspondence with Charlotte.','Elizabeth travels toward Hunsford through London and the Gardiner household.','Elizabeth reaches the Collinses’ parsonage and sees Rosings.','Lady Catherine interrogates the visitors at dinner.','Darcy and Colonel Fitzwilliam arrive at Rosings.','Elizabeth and Darcy contend over music and social confidence.','Darcy’s awkward parsonage visit puzzles Elizabeth and Charlotte.','Repeated walks and Fitzwilliam’s disclosure connect Darcy to Jane’s separation.','Darcy proposes; Elizabeth rejects him for Jane and Wickham.','Darcy delivers a letter answering both accusations.','Elizabeth rereads the letter and recognises her own prejudice.','Darcy leaves; Elizabeth conceals the proposal from the Collinses.','Elizabeth departs Hunsford with a revised understanding of Darcy.','Lydia and Kitty bring news of Brighton and the regiment.','Elizabeth tells Jane about the proposal and letter.','Lydia receives a Brighton invitation; Elizabeth warns her father and parts from Wickham.','The summer journey changes from the Lakes to Derbyshire.','At Pemberley, testimony and Darcy’s altered conduct overturn expectations.','Darcy introduces Georgiana and Bingley to Elizabeth at Lambton.','Elizabeth visits Pemberley; Caroline attacks while Darcy remains attentive.','Jane’s letters announce Lydia’s elopement; Elizabeth tells Darcy and leaves.','The Gardiners and Elizabeth hurry to a distressed Longbourn.','The search exposes Wickham’s debts and produces no immediate result.','Mr Gardiner reports that Lydia and Wickham have been found and can marry.','The settlement provokes Mr Bennet’s shame and Mrs Bennet’s delight.','The Wickhams visit; Lydia carelessly reveals Darcy’s presence at the wedding.','Mrs Gardiner explains Darcy’s decisive intervention.','Bingley and Darcy return to Netherfield and visit Longbourn.','At dinner, Bingley and Jane reconnect while Darcy remains difficult to read.','Bingley proposes to Jane and receives the family’s joyful consent.','Lady Catherine demands that Elizabeth renounce Darcy and is refused.','Mr Collins’s letter and Lady Catherine’s visit leave Elizabeth uncertain.','Darcy and Elizabeth walk together and accept one another.','Jane and Mr Bennet learn of Elizabeth’s engagement.','Elizabeth and Darcy explain the growth of their love and write to family.','The marriages reshape both families while affection outlasts social opposition.'
]
const chapters=chapterSynopses.map((synopsis,i)=>({...base,id:chId(i+1),timelineId,number:i+1,title:`Chapter ${i+1}`,synopsis,notes:'',wordGoal:null}))

const events=[]
function E(ch,title,description,location,states,itemSlugs=[],tension=2,day=250,opts={}){
 const n=events.length+1
 events.push({...base,id:id('event',String(n)),chapterId:chId(ch),timelineId,title,description,locationMarkerId:location?locId(location):null,
  involvedCharacterIds:Object.keys(states).map(charId),mentionedCharacterIds:(opts.mentioned||[]).map(charId),involvedItemIds:itemSlugs.map(itemId),tags:[`chapter-${ch}`],
  sortOrder:events.filter(e=>e.chapterId===chId(ch)).length*10,travelDays:opts.travelDays??0,inWorldTime:day,tension,structureBeat:opts.beat??null,
  threadIds:(opts.threads||['darcy-elizabeth']).map(threadId),motifIds:(opts.motifs||['manners']).map(motifId),status:'final',povCharacterId:opts.pov?charId(opts.pov):(Object.hasOwn(states,'elizabeth')?charId('elizabeth'):null),isFlashback:false,_states:states})
}
E(1,'Netherfield Is Let','Mrs Bennet presses her husband to visit the wealthy new tenant as a prospective husband for one of their daughters.','longbourn',{
 bennet:'Teasing his wife by withholding whether he will call on Bingley.','mrs-bennet':'Treating Bingley’s arrival as an urgent opportunity for her daughters.',elizabeth:'Listening with amused familiarity to her parents’ unequal contest.'},['netherfield-news'],1,250,{beat:'opening_image',threads:['bennet-fortunes'],motifs:['property','marriage-market']})
E(2,'Mr Bennet Has Already Called','After prolonging the joke, Mr Bennet reveals that he has made the required visit to Netherfield.','longbourn',{
 bennet:'Enjoying the surprise produced by his secret visit.','mrs-bennet':'Transforming irritation into triumph as access to Bingley becomes possible.',lydia:'Boasting noisily while her father calls her the silliest of the sisters.',kitty:'Coughing and reacting to the family excitement.'},['netherfield-news'],2,252,{threads:['bennet-fortunes','bingley-jane'],motifs:['manners','marriage-market']})
E(3,'Bingley Enters the Assembly','Bingley dances readily and singles Jane out for a second dance.','assembly',{
 bingley:'Delighted by the company and openly attracted to Jane.',jane:'Pleased by Bingley’s attention while remaining composed.','mrs-bennet':'Counting Bingley’s dances with Jane as evidence of a match.',elizabeth:'Observing Jane’s happiness and Bingley’s easy sociability.'},['dance-card'],2,260,{threads:['bingley-jane'],motifs:['dancing','marriage-market']})
E(3,'Darcy Refuses Elizabeth','Darcy declines Bingley’s suggestion that he dance with Elizabeth, and she overhears the insult.','assembly',{
 darcy:'Withdrawing behind rank and reserve, dismissing Elizabeth as merely tolerable.',bingley:'Urging Darcy to join the dance and enjoy the company.',elizabeth:'Turning a public slight into a story she can laugh about.',jane:'Remaining occupied with Bingley and unaware of the full exchange.'},['dance-card'],3,260,{beat:'inciting_incident',threads:['darcy-elizabeth','first-impressions'],motifs:['dancing','pride']})
E(4,'The Sisters Compare the Gentlemen','Jane praises Bingley while Elizabeth questions the superiority of his sisters and Darcy.','longbourn',{
 jane:'Confiding genuine admiration while searching for charitable explanations of everyone else.',elizabeth:'Protecting Jane’s happiness but judging Darcy and the Bingley sisters sharply.'},[],1,261,{threads:['bingley-jane','first-impressions'],motifs:['sisterhood','judgment']})
E(4,'Bingley and Darcy Compare the Assembly','Bingley celebrates the evening while Darcy acknowledges only Jane’s beauty.','netherfield',{
 bingley:'Replaying the assembly as an uncomplicated success.',darcy:'Admitting Jane is handsome while criticising the neighbourhood’s manners.',caroline:'Supporting Darcy’s social disdain while remaining alert to his approval.','mrs-hurst':'Joining Caroline in dismissing local society.', 'mr-hurst':'Detached from the social analysis once the evening is over.'},[],1,261,{threads:['bingley-jane','class-rank'],motifs:['pride','manners']})
E(5,'Pride and Vanity at Lucas Lodge','The neighbours debate Darcy’s pride and the distinctions created by rank and self-regard.','lucas-lodge',{
 elizabeth:'Retelling Darcy’s slight with wit while treating her resentment as justified.',charlotte:'Distinguishing pride from vanity and reading Darcy more coolly.',mary:'Offering a studied definition to display her learning.','mrs-bennet':'Condemning Darcy with the confidence of personal grievance.','lady-lucas':'Comparing the assembly through neighbourhood rivalry.'},[],2,263,{threads:['first-impressions','class-rank'],motifs:['pride','judgment']})
E(6,'Darcy Begins to Observe Elizabeth','Darcy notices Elizabeth’s intelligence and expression after initially dismissing her.','lucas-lodge',{
 darcy:'Studying Elizabeth with growing interest he has not admitted to himself.',elizabeth:'Treating Darcy’s attention as another opportunity for amused resistance.',charlotte:'Watching both of them and recognising more interest than Elizabeth allows.'},[],2,266,{threads:['darcy-elizabeth','first-impressions'],motifs:['judgment','pride']})
E(6,'Elizabeth Refuses Darcy’s Dance','Sir William tries to pair them, but Elizabeth declines Darcy’s offered hand.','lucas-lodge',{
 elizabeth:'Refusing to become a spectacle and pleased to reverse the assembly rejection.',darcy:'Surprised and increasingly attracted by her self-possession.','sir-william':'Trying to manufacture harmony through the civilising power of dancing.',caroline:'Seeing Darcy’s interest and responding with jealous mockery.'},['dance-card'],2,266,{threads:['darcy-elizabeth','caroline-jealousy'],motifs:['dancing','pride']})
E(7,'The Militia Enlivens Meryton','Lydia and Kitty organise their days around the newly arrived officers.','meryton',{
 lydia:'Pursuing officers, gossip, and amusement without restraint.',kitty:'Following Lydia’s enthusiasm and opinions.',bennet:'Mocking his younger daughters without correcting their behaviour.','mrs-bennet':'Indulging the militia fascination as harmless social opportunity.'},[],1,300,{threads:['lydia-wickham','bennet-fortunes'],motifs:['manners','marriage-market']})
E(7,'Jane Rides into the Rain','Mrs Bennet sends Jane on horseback to Netherfield, where illness forces her to remain.','netherfield',{
 jane:'Arriving wet and feverish after obeying her mother’s plan.',bingley:'Concerned for Jane and determined that she receive proper care.',caroline:'Offering socially correct hospitality without sharing Bingley’s anxiety.'},['jane-letter'],2,302,{mentioned:['mrs-bennet'],threads:['bingley-jane'],motifs:['letters','marriage-market']})
E(7,'Elizabeth Walks to Netherfield','Elizabeth crosses fields alone to reach her sick sister.','netherfield',{
 elizabeth:'Muddy and tired but indifferent to appearance beside Jane’s welfare.',jane:'Ill and relieved by Elizabeth’s arrival.',bingley:'Admiring Elizabeth’s devotion despite the unconventional walk.',caroline:'Offended by Elizabeth’s muddy petticoat and lack of fashionable restraint.','mrs-hurst':'Sharing Caroline’s contempt for the country walk.'},['jane-letter'],2,302,{threads:['sisterhood','class-rank'],motifs:['sisterhood','manners']})
E(8,'Netherfield Judges the Muddy Petticoat','The Bingley sisters ridicule Elizabeth after she leaves Jane’s room.','netherfield',{
 caroline:'Using Elizabeth’s appearance to lower her in Darcy’s estimation.','mrs-hurst':'Treating mud as proof of inferior breeding.',darcy:'Acknowledging the walk’s impropriety while admiring Elizabeth’s bright eyes.',bingley:'Remaining focused on the sisterly loyalty that brought Elizabeth.'},[],2,303,{threads:['darcy-elizabeth','caroline-jealousy','class-rank'],motifs:['manners','judgment']})
E(8,'Cards, Reading, and Accomplishment','Elizabeth reads rather than play cards, prompting debate about accomplished women.','netherfield',{
 elizabeth:'Choosing independence from the card table and challenging inflated standards.',darcy:'Describing an ideal of female accomplishment while attending closely to Elizabeth.',caroline:'Performing refinement and trying to align herself with Darcy.',bingley:'Laughing at Darcy’s exacting standards and keeping the evening easy.','mr-hurst':'Interested in Elizabeth only if she will join the card game.'},[],2,303,{threads:['darcy-elizabeth','caroline-jealousy'],motifs:['pride','manners']})
E(9,'Mrs Bennet Visits Netherfield','Mrs Bennet insists Jane is too ill to move and publicly praises country society.','netherfield',{
 'mrs-bennet':'Extending Jane’s stay while contradicting Darcy and exposing family ambitions.',elizabeth:'Trying unsuccessfully to limit her mother’s boasts and incivility.',jane:'Embarrassed but too unwell to redirect the visit.',bingley:'Responding kindly despite transparent matchmaking.',darcy:'Watching the Bennet family’s indiscretion confirm his social reservations.',caroline:'Privately delighted by every embarrassing remark.'},[],3,304,{threads:['bingley-jane','class-rank','bennet-fortunes'],motifs:['manners','marriage-market']})
E(9,'Lydia Demands a Ball','Lydia reminds Bingley of his promise to give a ball at Netherfield.','netherfield',{
 lydia:'Speaking with fearless familiarity to secure another public amusement.',bingley:'Promising a ball once Jane is recovered, amused rather than offended.',elizabeth:'Mortified by Lydia’s boldness in the same visit as her mother’s display.'},['ball-invitation'],2,304,{threads:['lydia-wickham'],motifs:['dancing','manners']})
E(10,'Caroline Interrupts Darcy’s Letter','Caroline praises Darcy’s handwriting and sends attention toward Georgiana.','netherfield',{
 darcy:'Writing steadily to Georgiana while resisting Caroline’s relentless interruptions.',caroline:'Turning every detail of the letter into an opportunity for intimacy.',elizabeth:'Observing Caroline’s pursuit with ironic detachment.',bingley:'Teasing Darcy’s deliberate style and enjoying the exchange.'},[],1,305,{threads:['caroline-jealousy','darcy-elizabeth'],motifs:['letters','manners']})
E(10,'Darcy and Elizabeth Debate Humility','A discussion of Bingley’s easy compliance becomes a contest between Darcy and Elizabeth.','netherfield',{
 elizabeth:'Testing Darcy’s seriousness through playful argument.',darcy:'Defending reasoned firmness while recognising Elizabeth as an intellectual equal.',bingley:'Allowing his pliability to become the friendly subject of debate.',caroline:'Trying to participate while the real attention passes between Darcy and Elizabeth.'},[],2,305,{threads:['darcy-elizabeth'],motifs:['pride','judgment']})
E(11,'Defects and Resentment','Elizabeth and Darcy identify vanity, pride, and resentment as personal vulnerabilities.','netherfield',{
 elizabeth:'Claiming laughter as protection against intimidating superiority.',darcy:'Admitting a resentful temper while accusing Elizabeth of deliberate misunderstanding.',caroline:'Attempting to turn the conversation away when intimacy grows too visible.'},[],2,306,{threads:['darcy-elizabeth','first-impressions'],motifs:['pride','judgment']})
E(12,'Jane and Elizabeth Leave Netherfield','Jane recovers enough to return to Longbourn despite Bingley’s reluctance.','netherfield',{
 jane:'Leaving grateful for Bingley’s care and more attached than before.',elizabeth:'Glad to remove Jane and herself from Caroline’s scrutiny.',bingley:'Regretting Jane’s departure and arranging every comfort for the journey.',caroline:'Relieved to end Elizabeth’s influence over Darcy.'},[],1,308,{mentioned:['mrs-bennet'],threads:['bingley-jane','caroline-jealousy'],motifs:['sisterhood','manners']})
E(13,'Mr Collins Announces Himself','A letter from the Longbourn heir proposes a visit and reconciliation.','longbourn',{
 bennet:'Reading Collins’s pompous letter as a promised source of amusement.','mrs-bennet':'Resenting the man who will inherit the house while considering his visit useful.',elizabeth:'Hearing legal insecurity translated into absurdly formal prose.',jane:'Hoping Collins’s conciliatory intention is sincere.'},[],2,318,{threads:['collins-charlotte','bennet-fortunes'],motifs:['letters','property']})
E(13,'Collins Arrives at Longbourn','Collins admires the house he expects to inherit and explains Lady Catherine’s patronage.','longbourn',{
 collins:'Displaying rehearsed humility while inspecting his future property.',bennet:'Encouraging Collins to speak because every answer rewards his curiosity.',elizabeth:'Recognising vanity beneath the visitor’s submission.','mrs-bennet':'Temporarily suppressing hostility when Collins admires the daughters.'},[],2,319,{threads:['collins-charlotte','bennet-fortunes'],motifs:['property','manners']})
E(14,'Collins Reads Fordyce','Collins rejects a novel and selects Fordyce’s sermons until Lydia interrupts him.','longbourn',{
 collins:'Attempting solemn moral instruction and becoming offended by interruption.',lydia:'Abandoning the sermon for urgent militia gossip.',kitty:'Following Lydia’s attention away from the reading.',bennet:'Enjoying the failure of Collins’s chosen improvement.',elizabeth:'Observing the mismatch between Collins’s authority and the household.'},['fordyce'],2,320,{threads:['collins-charlotte','lydia-wickham'],motifs:['manners','judgment']})
E(15,'Collins Selects Elizabeth','After learning Jane may soon be engaged, Collins transfers his marital plan to Elizabeth.','longbourn',{
 collins:'Revising his choice of cousin with complete confidence in eventual acceptance.','mrs-bennet':'Directing Collins away from Jane and toward Elizabeth without consulting either.'},[],2,321,{mentioned:['elizabeth','jane'],threads:['collins-charlotte','bennet-fortunes'],motifs:['marriage-market','property']})
E(15,'Wickham Meets the Bennet Sisters','Denny introduces Wickham in Meryton; Darcy and Wickham react visibly on meeting.','meryton',{
 wickham:'Deploying charm while the sight of Darcy produces a moment of alarm.',denny:'Presenting a newly commissioned friend to the Bennet party.',elizabeth:'Immediately attracted by Wickham’s appearance and intrigued by the silent confrontation.',lydia:'Welcoming another handsome officer into the Meryton circle.',kitty:'Sharing Lydia’s eager interest in the officers.',darcy:'Passing under control while recognising Wickham as a dangerous past connection.',bingley:'Greeting the group without understanding the hostility.'},[],3,321,{threads:['wickham-deception','darcy-elizabeth','lydia-wickham'],motifs:['judgment','uniforms']})
E(16,'Wickham Tells His Story','At the Philipses’, Wickham claims Darcy denied him the living intended by Darcy’s father.','philips-house',{
 wickham:'Constructing a persuasive grievance while presenting discretion as virtue.',elizabeth:'Believing the account because it confirms her existing opinion of Darcy.',collins:'Attending the party while treating Lady Catherine’s name as the highest authority.','mr-philips':'Hosting the officers and neighbourhood card party.','mrs-philips':'Encouraging sociable intimacy and local gossip.',lydia:'Occupied with games and officers rather than the history being disclosed.'},[],3,322,{threads:['wickham-deception','first-impressions'],motifs:['judgment','storytelling']})
E(17,'Jane Questions Wickham’s Account','Elizabeth repeats the story, but Jane searches for an innocent misunderstanding.','longbourn',{
 elizabeth:'Treating Wickham’s narrative as final proof of Darcy’s character.',jane:'Refusing to condemn either man without evidence and imagining mutual error.'},[],2,323,{threads:['wickham-deception','first-impressions'],motifs:['sisterhood','judgment']})
E(17,'The Netherfield Ball Is Announced','Bingley personally invites the family, and Elizabeth anticipates dancing with Wickham.','longbourn',{
 bingley:'Extending the long-promised invitation with special warmth toward Jane.',jane:'Quietly delighted by renewed attention from Bingley.',elizabeth:'Planning an evening around Wickham and underestimating every other complication.',collins:'Securing Elizabeth’s first dances without sensing her disappointment.',lydia:'Celebrating an entire evening with the officers.'},['ball-invitation'],2,323,{threads:['bingley-jane','wickham-deception','collins-charlotte'],motifs:['dancing','marriage-market']})
E(18,'Wickham Avoids the Ball','Denny reports Wickham has gone to town to avoid Darcy.','netherfield',{
 elizabeth:'Interpreting Wickham’s absence as proof of Darcy’s oppressive power.',denny:'Delivering Wickham’s convenient explanation.',darcy:'Present at the ball without knowing how fully Wickham has shaped Elizabeth’s view.'},['ball-invitation'],3,326,{threads:['wickham-deception','first-impressions'],motifs:['dancing','judgment']})
E(18,'Elizabeth Dances with Darcy','Darcy and Elizabeth dance while guarded conversation exposes their mutual suspicion.','netherfield',{
 elizabeth:'Using the dance to test Darcy about Wickham while resisting her own awareness of him.',darcy:'Trying to sustain conversation despite Elizabeth’s hostile implications.',caroline:'Watching the pair and preparing to attack Wickham’s credibility.',bingley:'Absorbed in Jane and unaware of the contest on the floor.'},['dance-card'],4,326,{threads:['darcy-elizabeth','wickham-deception','caroline-jealousy'],motifs:['dancing','pride']})
E(18,'The Bennets Embarrass Elizabeth','Collins introduces himself to Darcy, Mrs Bennet boasts, Mary performs too long, and the family departs conspicuously.','netherfield',{
 elizabeth:'Enduring escalating family embarrassment while recognising Darcy’s disapproval.','mrs-bennet':'Publicly predicting Jane’s marriage and praising its advantages.',collins:'Addressing Darcy without introduction because Lady Catherine supplies confidence.',mary:'Continuing to sing until her father stops her.',bennet:'Ending Mary’s performance with a joke rather than protecting her dignity.',lydia:'Participating loudly in the evening without sensing restraint.',kitty:'Following Lydia’s conspicuous excitement.',darcy:'Seeing the social objections to Jane and Elizabeth assembled in public.',jane:'Happy with Bingley but distressed by her family’s display.',bingley:'Remaining openly devoted to Jane despite the room’s judgments.'},['dance-card'],4,326,{threads:['bingley-jane','darcy-elizabeth','class-rank','bennet-fortunes'],motifs:['manners','marriage-market']})
E(19,'Collins Proposes to Elizabeth','Collins presents marriage as duty, desire, and obedience to Lady Catherine.','longbourn',{
 collins:'Delivering a rehearsed proposal and assuming refusal is fashionable encouragement.',elizabeth:'Refusing plainly while struggling to make Collins recognise her seriousness.'},[],4,328,{threads:['collins-charlotte','bennet-fortunes'],motifs:['marriage-market','property']})
E(20,'Mrs Bennet Demands Obedience','Mrs Bennet recruits Mr Bennet to force Elizabeth to accept Collins.','longbourn',{
 'mrs-bennet':'Panicking that Elizabeth has rejected the security of Longbourn.',elizabeth:'Standing by her refusal despite maternal pressure.',bennet:'Making clear that marrying Collins would cost Elizabeth her father’s respect.',collins:'Waiting with injured dignity for the family to reverse Elizabeth’s answer.'},[],4,328,{threads:['collins-charlotte','bennet-fortunes'],motifs:['marriage-market','family']})
E(21,'Caroline Announces the London Departure','Jane receives Caroline’s letter saying the Netherfield party has left and praising Georgiana as Bingley’s intended match.','longbourn',{
 jane:'Reading disappointment as friendly information and trying to suppress hope.',elizabeth:'Recognising Caroline’s design and insisting Bingley’s affection was real.'},['caroline-letter'],3,330,{mentioned:['caroline','bingley','georgiana'],threads:['bingley-jane','caroline-jealousy'],motifs:['letters','judgment']})
E(22,'Collins Proposes to Charlotte','Charlotte accepts Collins after giving him deliberate opportunities to address her.','lucas-lodge',{
 collins:'Restoring his pride through a second proposal made within days of the first.',charlotte:'Choosing household security with clear eyes and no romantic illusion.','sir-william':'Delighted by a match connecting the Lucases to Lady Catherine’s patronage.','lady-lucas':'Celebrating a practical advancement for her eldest daughter.'},[],3,331,{threads:['collins-charlotte'],motifs:['marriage-market','property']})
E(23,'Charlotte Tells Elizabeth','Charlotte asks Elizabeth to accept the decision that best secures her future.','lucas-lodge',{
 charlotte:'Defending a pragmatic marriage while valuing Elizabeth’s friendship.',elizabeth:'Shocked that intimacy and respect can be traded for security.'},[],3,332,{threads:['collins-charlotte'],motifs:['marriage-market','judgment']})
E(23,'Mrs Bennet Receives the Engagement','The Lucas engagement turns inheritance anxiety into personal rivalry.','longbourn',{
 'mrs-bennet':'Furious that Charlotte will someday displace her family at Longbourn.','lady-lucas':'Enjoying the social and material success Mrs Bennet rejected.',collins:'Speaking of future happiness and the eventual estate with insensitive confidence.',bennet:'Treating the domestic outrage as another source of comedy.'},[],3,333,{threads:['collins-charlotte','bennet-fortunes'],motifs:['property','family']})
E(24,'Jane Accepts Bingley’s Absence','Jane tries to believe Caroline’s friendship and relinquish expectations.','longbourn',{
 jane:'Containing real grief beneath charitable explanations.',elizabeth:'Blaming Darcy and Caroline while growing cynical about Bingley’s independence.'},['caroline-letter'],2,340,{threads:['bingley-jane','first-impressions'],motifs:['sisterhood','judgment']})
E(25,'The Gardiners Arrive for Christmas','Mrs Gardiner notices Jane’s unhappiness and Wickham’s attention to Elizabeth.','longbourn',{
 gardiner:'Bringing steady affection and urban perspective into the Bennet household.','mrs-gardiner':'Assessing Jane’s disappointment and Elizabeth’s risky attachment with tact.',jane:'Grateful for her aunt’s sympathy without speaking bitterly.',elizabeth:'Confiding in the aunt whose judgment she respects.','mrs-bennet':'Recounting every disappointment at length.'},[],1,350,{threads:['gardiners','bingley-jane','wickham-deception'],motifs:['family','judgment']})
E(25,'Mrs Gardiner Warns Elizabeth','Mrs Gardiner cautions that Wickham has no fortune and Elizabeth should not encourage an imprudent attachment.','longbourn',{
 'mrs-gardiner':'Offering practical warning without denying Elizabeth’s intelligence.',elizabeth:'Promising caution while insisting her feelings are not yet serious.'},[],2,351,{threads:['gardiners','wickham-deception'],motifs:['marriage-market','judgment']})
E(26,'Jane Finds Caroline Cold in London','Jane’s visit receives delayed and formal attention rather than friendship.','gardiner-house',{
 jane:'Confronting Caroline’s indifference while finally abandoning the illusion of friendship.',caroline:'Keeping Jane at a social distance to protect the Georgiana plan.','mrs-gardiner':'Providing Jane a stable home while observing the rejection clearly.'},['caroline-letter'],2,380,{threads:['bingley-jane','caroline-jealousy','gardiners'],motifs:['manners','letters']})
E(26,'Wickham Turns to Miss King','Elizabeth accepts Wickham’s pursuit of a newly wealthy young woman more readily than she accepted Charlotte’s choice.','meryton',{
 elizabeth:'Explaining Wickham’s mercenary shift as prudence and failing to see her inconsistency.',wickham:'Redirecting charm toward Miss King as soon as her inheritance becomes known.','miss-king':'Receiving sudden attention after acquiring money.'},[],2,390,{mentioned:['mrs-gardiner'],threads:['wickham-deception','first-impressions'],motifs:['marriage-market','judgment']})
E(27,'Elizabeth Travels through Gracechurch Street','Elizabeth joins Sir William and Maria on the journey to visit Charlotte.','gardiner-house',{
 elizabeth:'Enjoying the Gardiner household before confronting Charlotte’s married life.','sir-william':'Treating the journey as another opportunity for ceremonial sociability.',maria:'Excited by travel, Rosings, and her sister’s new establishment.',gardiner:'Welcoming the travellers during their London stop.','mrs-gardiner':'Planning the summer tour that will later redirect Elizabeth toward Derbyshire.'},['gardiner-carriage'],1,438,{travelDays:2,threads:['collins-charlotte','gardiners'],motifs:['travel','family']})
E(28,'The Travellers Reach Hunsford','Collins displays the parsonage and points repeatedly toward Rosings.','hunsford',{
 elizabeth:'Assessing whether Charlotte has created contentment within an unequal marriage.',charlotte:'Receiving her friend warmly and directing daily life to minimise her husband’s presence.',collins:'Exhibiting rooms, shelves, roads, and views as evidence of Lady Catherine’s favour.','sir-william':'Admiring the establishment as confirmation of Charlotte’s advancement.',maria:'Overwhelmed by the prospect of Rosings.'},[],2,440,{threads:['collins-charlotte','class-rank'],motifs:['property','manners']})
E(29,'Lady Catherine Interrogates the Visitors','At Rosings, Lady Catherine questions Elizabeth’s upbringing, education, sisters, and governess.','rosings',{
 'lady-catherine':'Treating private family choices as deficiencies requiring her correction.',elizabeth:'Answering without submission and withholding the deference Lady Catherine expects.',collins:'Monitoring every answer for conformity with his patroness.',charlotte:'Managing the visit with practised restraint.','anne-de-bourgh':'Present but physically withdrawn from the conversation.',jenkinson:'Attending closely to Anne’s comfort.','sir-william':'Impressed into near silence by Rosings rank.',maria:'Awed and anxious under Lady Catherine’s scrutiny.'},[],3,442,{threads:['class-rank','darcy-elizabeth'],motifs:['manners','pride']})
E(30,'Darcy and Fitzwilliam Arrive','The cousins come to Rosings for Easter, changing the parsonage social circle.','rosings',{
 darcy:'Returning to Elizabeth’s company while still guarding his growing attachment.','colonel-fitzwilliam':'Entering sociably and finding Elizabeth an intelligent companion.','lady-catherine':'Receiving the nephews as members of her family hierarchy.',elizabeth:'Surprised to meet Darcy again and pleased by Fitzwilliam’s ease.',collins:'Magnifying the importance of every Rosings arrival.'},[],2,450,{threads:['darcy-elizabeth','class-rank'],motifs:['manners','pride']})
E(31,'Elizabeth Plays at Rosings','Darcy approaches the piano while Elizabeth jokes about his intimidating manner.','rosings',{
 elizabeth:'Using wit to resist intimidation and expose Darcy’s social reserve.',darcy:'Admitting he lacks easy address while remaining drawn to her challenge.','colonel-fitzwilliam':'Enjoying their contest and serving as an easier conversational bridge.','lady-catherine':'Interrupting with authoritative judgments about music and practice.','anne-de-bourgh':'Listening from the family group.',jenkinson:'Remaining beside Anne.'},[],2,452,{threads:['darcy-elizabeth','class-rank'],motifs:['music','pride']})
E(32,'Darcy Visits the Parsonage Alone','Darcy calls when Elizabeth is alone and struggles to explain his presence.','hunsford',{
 darcy:'Seeking Elizabeth’s company but unable to convert feeling into easy conversation.',elizabeth:'Interpreting the awkward visit as inexplicable rather than affectionate.'},[],2,454,{threads:['darcy-elizabeth'],motifs:['manners','judgment']})
E(33,'Fitzwilliam Reveals Darcy’s Intervention','On a walk, Fitzwilliam mentions that Darcy recently saved a friend from an imprudent marriage.','rosings-grove',{
 'colonel-fitzwilliam':'Sharing an anecdote without realising the woman concerned is Jane.',elizabeth:'Recognising Bingley and Jane in the story and becoming furious with Darcy.'},[],4,460,{threads:['bingley-jane','darcy-elizabeth'],motifs:['judgment','marriage-market']})
E(33,'Darcy Repeatedly Finds Elizabeth Walking','Elizabeth encounters Darcy on paths she has told him she prefers.','rosings-grove',{
 elizabeth:'Treating repeated meetings as coincidence while her opinion remains hostile.',darcy:'Seeking contact under the disguise of accidental walks and asking about her future.'},[],2,459,{threads:['darcy-elizabeth'],motifs:['travel','judgment']})
E(34,'Darcy’s First Proposal','Darcy declares love while emphasising the inferiority of Elizabeth’s connections.','hunsford',{
 darcy:'Confident of acceptance, divided between intense love and unmastered class pride.',elizabeth:'Shocked by the proposal and angered by its insults and by Jane’s separation.'},[],5,462,{beat:'midpoint',threads:['darcy-elizabeth','bingley-jane','class-rank'],motifs:['pride','marriage-market']})
E(34,'Elizabeth Rejects Darcy','Elizabeth accuses Darcy of ruining Jane’s happiness and mistreating Wickham.','hunsford',{
 elizabeth:'Speaking from moral certainty that combines valid anger with false evidence.',darcy:'Wounded and astonished as Elizabeth rejects both his manner and character.'},[],5,462,{threads:['darcy-elizabeth','wickham-deception','bingley-jane'],motifs:['judgment','pride']})
E(35,'Darcy Delivers His Letter','Darcy meets Elizabeth in the grove and gives her a written answer before leaving.','rosings-grove',{
 darcy:'Offering evidence he cannot communicate through another argument.',elizabeth:'Accepting the letter in agitation and beginning to read against her will.'},['darcy-letter'],4,463,{threads:['darcy-elizabeth','wickham-deception','bingley-jane'],motifs:['letters','judgment']})
E(36,'Elizabeth Reassesses Wickham','Repeated reading exposes inconsistencies in Wickham’s story and reveals the Georgiana elopement plot.','rosings-grove',{
 elizabeth:'Moving from disbelief through shame to recognition that vanity shaped her judgment.'},['darcy-letter'],4,464,{mentioned:['darcy','wickham','georgiana'],threads:['first-impressions','wickham-deception','darcy-elizabeth'],motifs:['letters','judgment']})
E(36,'Elizabeth Reassesses Jane’s Separation','Darcy’s account forces Elizabeth to acknowledge Jane concealed her feelings and the Bennet family behaved badly.','hunsford',{
 elizabeth:'Accepting that Darcy had evidence for his mistake even while regretting its consequences.'},['darcy-letter'],3,464,{mentioned:['jane','darcy','bingley'],threads:['bingley-jane','darcy-elizabeth'],motifs:['letters','family']})
E(37,'Darcy Leaves Rosings','The cousins depart while Elizabeth keeps the proposal and letter secret from Charlotte.','hunsford',{
 elizabeth:'Carrying a transformed private understanding while performing ordinary farewell.',darcy:'Leaving after rejection with Elizabeth’s accusations as a demand for change.',charlotte:'Noticing Elizabeth’s altered spirits without learning their cause.',collins:'Returning attention to Rosings routines after the important guests depart.'},['darcy-letter'],2,466,{threads:['darcy-elizabeth','collins-charlotte'],motifs:['secrets','manners']})
E(38,'Elizabeth Leaves Hunsford','Lady Catherine offers travel advice and Collins enumerates the advantages of the visit.','hunsford',{
 elizabeth:'Departing eager to see Jane and test her revised judgment at home.',charlotte:'Parting affectionately while remaining committed to the life she has arranged.',collins:'Concluding the visit with gratitude to himself and Lady Catherine.',maria:'Leaving Rosings society full of stories.'},['gardiner-carriage'],1,470,{travelDays:2,mentioned:['lady-catherine'],threads:['collins-charlotte','darcy-elizabeth'],motifs:['travel','manners']})
E(39,'Lydia and Kitty Meet the Travellers','The younger sisters bring lunch, bonnet gossip, and news that the regiment will leave for Brighton.','meryton',{
 lydia:'Dominating the reunion with officers, Brighton, and a cheaply altered bonnet.',kitty:'Echoing Lydia’s excitement and resentment at possible exclusion.',elizabeth:'Returning with grave knowledge that makes the militia chatter newly alarming.',jane:'Welcoming Elizabeth and listening to Lydia without sharing her excitement.'},[],2,475,{threads:['lydia-wickham','sisterhood'],motifs:['uniforms','manners']})
E(40,'Elizabeth Tells Jane About Darcy','Elizabeth recounts the proposal and Wickham revelations while withholding Darcy’s role in Jane’s separation at first.','longbourn',{
 elizabeth:'Seeking Jane’s moral response while ashamed of her former certainty.',jane:'Distressed by Wickham’s conduct and compassionate even toward Darcy’s pain.'},['darcy-letter'],3,477,{threads:['darcy-elizabeth','wickham-deception','sisterhood'],motifs:['sisterhood','secrets']})
E(41,'Lydia Is Invited to Brighton','Mrs Forster invites Lydia to accompany her when the regiment moves.','longbourn',{
 lydia:'Triumphant at gaining the freedom, officers, and spectacle of Brighton.',kitty:'Crying from envy and exclusion.','mrs-forster':'Offering companionship without the maturity needed to supervise Lydia.','mrs-bennet':'Delighted by Lydia’s social opportunity.',elizabeth:'Seeing a predictable danger in Lydia’s unchecked behaviour.'},[],4,480,{mentioned:['forster'],threads:['lydia-wickham','bennet-fortunes'],motifs:['uniforms','family']})
E(41,'Mr Bennet Dismisses Elizabeth’s Warning','Elizabeth asks her father to restrain Lydia, but he prefers temporary peace.','longbourn',{
 elizabeth:'Arguing that Lydia’s public conduct can damage every sister.',bennet:'Choosing ease and ridicule over the sustained work of parental authority.'},[],4,480,{mentioned:['lydia'],threads:['lydia-wickham','bennet-fortunes'],motifs:['family','judgment']})
E(41,'Elizabeth and Wickham Part','Elizabeth hints that she knows more of Darcy, and Wickham recognises his influence has weakened.','meryton',{
 elizabeth:'Speaking with controlled knowledge rather than former admiration.',wickham:'Detecting changed belief and retreating behind charm.'},[],2,481,{threads:['wickham-deception','first-impressions'],motifs:['secrets','judgment']})
E(42,'The Lakes Tour Becomes Derbyshire','Mr Gardiner’s business shortens the route, bringing Pemberley within reach.','gardiner-house',{
 elizabeth:'Agreeing to Derbyshire only after learning Darcy is believed absent.',gardiner:'Adjusting the itinerary pragmatically while preserving the holiday.','mrs-gardiner':'Proposing Pemberley from affection for the area and curiosity about Darcy.'},['gardiner-carriage'],2,550,{travelDays:4,threads:['gardiners','darcy-elizabeth'],motifs:['travel','property']})
E(43,'Mrs Reynolds Praises Darcy','The Pemberley housekeeper describes Darcy as generous, responsible, and beloved by dependants.','pemberley',{
 elizabeth:'Hearing independent testimony that contradicts the man she once condemned.','mrs-reynolds':'Speaking from long service about Darcy’s character as master and brother.',gardiner:'Impressed by the estate’s management and the housekeeper’s sincerity.','mrs-gardiner':'Watching Elizabeth respond to a more domestic portrait of Darcy.'},['pemberley-portrait'],3,560,{threads:['darcy-elizabeth','first-impressions','gardiners'],motifs:['property','judgment']})
E(43,'Elizabeth Studies Darcy’s Portrait','Elizabeth stands before Darcy’s painted likeness as Pemberley reshapes her imagination of him.','pemberley',{
 elizabeth:'Considering Darcy with gratitude, regret, and a new sense of the life surrounding him.',gardiner:'Continuing the house tour without knowing the portrait’s private importance.','mrs-gardiner':'Noticing Elizabeth’s sustained attention to Darcy’s likeness.'},['pemberley-portrait'],3,560,{threads:['darcy-elizabeth'],motifs:['portraits','property']})
E(43,'Darcy Returns Unexpectedly','Darcy meets Elizabeth in the grounds and treats her and the Gardiners with marked civility.','pemberley',{
 darcy:'Overcoming surprise and demonstrating the change Elizabeth demanded at Hunsford.',elizabeth:'Embarrassed by the encounter but astonished by Darcy’s gentleness.',gardiner:'Receiving Darcy’s courtesy despite expecting aristocratic distance.','mrs-gardiner':'Revising her understanding of Darcy through his attention to them.'},[],4,560,{threads:['darcy-elizabeth','gardiners','class-rank'],motifs:['manners','judgment']})
E(44,'Darcy Introduces Georgiana','Darcy brings Georgiana and Bingley to call on Elizabeth at Lambton.','lambton-inn',{
 darcy:'Trusting Elizabeth with his shy sister and making his intentions visible through family introduction.',georgiana:'Meeting Elizabeth with nervous warmth and none of Caroline’s hauteur.',elizabeth:'Receiving proof of Darcy’s confidence while trying to put Georgiana at ease.',bingley:'Greeting Elizabeth eagerly and asking precise questions about Jane.',gardiner:'Recognising Darcy’s serious attention to his niece.','mrs-gardiner':'Observing the reunion and Bingley’s unchanged interest.'},['georgiana-invitation'],3,562,{threads:['darcy-elizabeth','bingley-jane','gardiners'],motifs:['family','manners']})
E(45,'Elizabeth Visits Pemberley','Georgiana receives the Gardiner party while Caroline scrutinises Elizabeth.','pemberley',{
 elizabeth:'Protecting shy Georgiana through conversation while alert to Caroline’s hostility.',georgiana:'Trying earnestly to host Elizabeth despite social anxiety.',darcy:'Watching Elizabeth and Georgiana with visible hope.',caroline:'Searching for ways to humiliate Elizabeth and recover Darcy’s attention.','mrs-hurst':'Supporting Caroline’s cold reception.','mrs-gardiner':'Participating with composure in an unexpectedly elevated circle.',gardiner:'Meeting Darcy’s household without pretension.'},['georgiana-invitation'],3,563,{threads:['darcy-elizabeth','caroline-jealousy','gardiners'],motifs:['manners','family']})
E(45,'Caroline Mentions Wickham','Caroline invokes the militia and Wickham, but Darcy defends Elizabeth’s beauty after she leaves.','pemberley',{
 caroline:'Using Wickham and Elizabeth’s family connections as weapons of jealousy.',elizabeth:'Absorbing the attack without exposing Georgiana’s history.',darcy:'Rejecting Caroline’s criticism and affirming how long he has found Elizabeth beautiful.',georgiana:'Distressed by Wickham’s name but supported by Elizabeth’s restraint.'},[],3,563,{threads:['caroline-jealousy','wickham-deception','darcy-elizabeth'],motifs:['secrets','pride']})
E(46,'Jane’s Letters Reveal the Elopement','Delayed letters report that Lydia has fled Brighton with Wickham and they may not intend marriage.','lambton-inn',{
 elizabeth:'Moving from shock to self-blame because she kept Wickham’s history private.','mrs-gardiner':'Preparing to abandon the tour and support the Bennets.',gardiner:'Taking immediate responsibility for the journey and London search.'},['jane-elopement-letters'],5,570,{mentioned:['jane','lydia','wickham'],threads:['lydia-wickham','wickham-deception','bennet-fortunes','gardiners'],motifs:['letters','secrets']})
E(46,'Elizabeth Tells Darcy','Darcy arrives during the crisis; Elizabeth explains Lydia’s flight and assumes it ends their renewed connection.','lambton-inn',{
 elizabeth:'Confiding the disgrace because she needs help thinking, then reading Darcy’s gravity as rejection.',darcy:'Learning the danger, blaming himself for Wickham’s freedom, and silently deciding to act.',gardiner:'Returning to find Darcy departing and the tour abruptly ended.','mrs-gardiner':'Seeing that Darcy has been trusted with the family crisis.'},['jane-elopement-letters'],5,570,{threads:['darcy-elizabeth','lydia-wickham','gardiners'],motifs:['secrets','family']})
E(47,'The Party Returns to Longbourn','Elizabeth and the Gardiners find Mrs Bennet confined upstairs and the household overwhelmed.','longbourn',{
 elizabeth:'Rejoining Jane while fearing the elopement has destroyed every sister’s prospects.',jane:'Holding the family together and sharing incomplete information.','mrs-bennet':'Prostrate with blame and fear while demanding others recover Lydia.',mary:'Offering moral reflections that increase rather than relieve pain.',kitty:'Frightened by the scandal and defensive about what Lydia told her.',gardiner:'Preparing to join the practical search.','mrs-gardiner':'Supporting Jane and Elizabeth amid domestic confusion.',hill:'Managing the distressed household.'},['lydia-note'],4,573,{travelDays:3,mentioned:['bennet'],threads:['lydia-wickham','bennet-fortunes','gardiners'],motifs:['family','letters']})
E(47,'Lydia’s Note Is Read','The farewell note to Mrs Forster reveals Lydia’s thoughtlessness and expectation of marriage.','longbourn',{
 elizabeth:'Reading childish excitement as evidence Lydia never understood the danger.',jane:'Searching even the careless note for grounds to hope they mean to marry.'},['lydia-note'],4,573,{mentioned:['mrs-forster','forster','lydia'],threads:['lydia-wickham','bennet-fortunes'],motifs:['letters','judgment']})
E(48,'The London Search Fails','Wickham’s debts and abandoned obligations emerge while no address is found.','gardiner-house',{
 gardiner:'Coordinating inquiries and learning the scale of Wickham’s financial disorder.',bennet:'Searching without useful connections and confronting his own helplessness.',forster:'Supplying military information and evidence of Wickham’s debts.'},[],4,578,{mentioned:['wickham','lydia','mrs-younge'],threads:['lydia-wickham','wickham-deception','gardiners'],motifs:['money','secrets']})
E(48,'Mr Bennet Returns Defeated','Mr Bennet comes home and admits Elizabeth was right about Lydia.','longbourn',{
 bennet:'Ashamed, exhausted, and briefly resolved to take responsibility.',elizabeth:'Unable to take satisfaction in a warning proved by disaster.',jane:'Receiving her father with relief while the crisis remains unresolved.','mrs-bennet':'Still blaming the Forsters and everyone except Lydia.'},[],4,580,{threads:['lydia-wickham','bennet-fortunes'],motifs:['family','judgment']})
E(49,'Mr Gardiner’s Express Arrives','The family learns Lydia and Wickham have been found and will marry if financial terms are accepted.','longbourn',{
 jane:'Reading the message with relief that social ruin may be contained.',elizabeth:'Relieved for Lydia but suspicious that the stated settlement cannot have persuaded Wickham.',bennet:'Accepting the terms while recognising his brother-in-law must be sacrificing heavily.','mrs-bennet':'Recovering instantly once marriage replaces disgrace in the story.'},['gardiner-express','settlement'],4,585,{mentioned:['gardiner'],threads:['lydia-wickham','gardiners','bennet-fortunes'],motifs:['letters','money']})
E(50,'Mr Bennet Calculates the Cost','Mr Bennet recognises his failure to save for his daughters and assumes Gardiner paid heavily.','longbourn',{
 bennet:'Confronting years of financial negligence and planning repayment.',elizabeth:'Certain the settlement hides a much larger intervention.',jane:'Focusing on the marriage’s moral necessity rather than its cost.'},['settlement'],3,586,{threads:['gardiners','bennet-fortunes'],motifs:['money','property']})
E(50,'Mrs Bennet Plans the Wedding Future','Mrs Bennet moves from illness to clothes, houses, and public celebration.','longbourn',{
 'mrs-bennet':'Treating marriage as complete vindication and ignoring Wickham’s character.',kitty:'Listening to renewed plans with a more chastened awareness of Lydia’s conduct.',hill:'Receiving rapid household instructions as celebration replaces crisis.'},['settlement'],2,586,{threads:['lydia-wickham','bennet-fortunes'],motifs:['marriage-market','manners']})
E(51,'Lydia Returns Married','Lydia displays her ring and takes precedence over her elder sisters without shame.','longbourn',{
 lydia:'Boasting of marriage as victory and treating the elopement as comic adventure.',wickham:'Performing easy family charm after receiving financial rescue.','mrs-bennet':'Welcoming the couple with pride and extravagant affection.',bennet:'Receiving them coldly and refusing to celebrate.',elizabeth:'Watching Lydia’s confidence with pain and moral disgust.',jane:'Trying to preserve civility without approving the conduct.',kitty:'Envious of Lydia’s status despite the scandal.',mary:'Remaining outside Lydia’s triumph.',hill:'Shown the ring as one of Lydia’s first Longbourn audiences.'},['wedding-ring'],3,595,{threads:['lydia-wickham','bennet-fortunes'],motifs:['marriage-market','money']})
E(51,'Lydia Mentions Darcy at the Wedding','A careless remark reveals that Darcy was present during the marriage.','longbourn',{
 lydia:'Letting out a secret because display matters more to her than discretion.',elizabeth:'Immediately recognising that Darcy’s role may explain the impossible settlement.',wickham:'Trying to close the subject before Lydia reveals more.',jane:'Hearing the name without yet understanding Darcy’s involvement.'},['wedding-ring'],4,595,{threads:['darcy-elizabeth','lydia-wickham'],motifs:['secrets','judgment']})
E(52,'Mrs Gardiner Reveals Darcy’s Intervention','Elizabeth learns Darcy found the couple, paid debts, arranged the settlement, and attended the wedding.','longbourn',{
 elizabeth:'Overwhelmed by gratitude and hope, unsure whether love or duty motivated Darcy.'},['aunt-letter','settlement'],4,600,{mentioned:['mrs-gardiner','darcy','gardiner','mrs-younge','wickham'],threads:['darcy-elizabeth','gardiners','lydia-wickham'],motifs:['letters','money']})
E(53,'Bingley and Darcy Return to Netherfield','The gentlemen call at Longbourn after Bingley retakes the estate.','longbourn',{
 bingley:'Returning with renewed freedom and obvious pleasure in Jane’s company.',jane:'Trying to remain calm while hope returns.',darcy:'Seeing Elizabeth again after the Lydia intervention but uncertain of her feelings.',elizabeth:'Searching Darcy’s reserve for evidence that Pemberley or Lydia changed everything.','mrs-bennet':'Welcoming Bingley extravagantly while treating Darcy with comparative coldness.',bennet:'Observing the renewed courtship without interfering.'},[],3,620,{threads:['bingley-jane','darcy-elizabeth'],motifs:['manners','marriage-market']})
E(54,'Dinner at Longbourn','Bingley sits near Jane, while seating and conversation keep Darcy from Elizabeth.','longbourn',{
 bingley:'Directing nearly all attention toward Jane and rebuilding easy intimacy.',jane:'Allowing visible happiness while still uncertain of his intentions.',darcy:'Maintaining formal restraint in a room where past embarrassment and new hope coexist.',elizabeth:'Frustrated by distance and unable to thank Darcy privately.','mrs-bennet':'Displaying Bingley’s preference as a public family success.'},[],2,622,{mentioned:['caroline'],threads:['bingley-jane','darcy-elizabeth'],motifs:['manners','marriage-market']})
E(55,'Bingley Proposes to Jane','Bingley returns alone, speaks privately with Jane, and secures her acceptance.','longbourn',{
 bingley:'Acting on unchanged affection without further submission to Darcy or his sisters.',jane:'Accepting with deep happiness and forgiving the long separation.','mrs-bennet':'Celebrating the match as the fulfilment of her campaign.',bennet:'Giving consent with genuine confidence in Jane’s character.',elizabeth:'Rejoicing for Jane while seeing one old injury finally repaired.'},[],3,625,{threads:['bingley-jane','bennet-fortunes'],motifs:['marriage-market','family']})
E(55,'Jane Confides Her Happiness','Jane tells Elizabeth that Bingley had never known she was in London.','longbourn',{
 jane:'Understanding the separation without surrendering her generous view of Bingley.',elizabeth:'Confirming Caroline’s deception and Darcy’s earlier influence while protecting the present happiness.'},[],2,625,{threads:['bingley-jane','sisterhood'],motifs:['sisterhood','judgment']})
E(56,'Lady Catherine Confronts Elizabeth','Lady Catherine demands a promise that Elizabeth will never marry Darcy.','longbourn',{
 'lady-catherine':'Using rank, family intention, and insult to enforce Darcy’s imagined engagement to Anne.',elizabeth:'Refusing to surrender a possible future or accept Lady Catherine’s authority over her choice.','mrs-bennet':'Flattered by the visit without grasping its hostile purpose.'},[],5,635,{mentioned:['anne-de-bourgh'],threads:['darcy-elizabeth','class-rank'],motifs:['pride','marriage-market']})
E(56,'Elizabeth Refuses the Demand','Elizabeth states that duty to Lady Catherine cannot determine her own happiness.','longbourn',{
 elizabeth:'Defending personal choice without claiming an engagement that does not yet exist.','lady-catherine':'Leaving enraged after discovering intimidation cannot produce obedience.'},[],5,635,{threads:['darcy-elizabeth','class-rank'],motifs:['pride','judgment']})
E(57,'Mr Collins Warns of a Rumoured Match','A letter congratulates the Bennets while warning that Lady Catherine considers Elizabeth and Darcy impossible.','longbourn',{
 bennet:'Reading the rumour as an excellent absurdity because he still believes Elizabeth dislikes Darcy.',elizabeth:'Unable to share the joke because the rumour touches her strongest private hope.'},['collins-letter'],3,638,{mentioned:['collins','lady-catherine','darcy'],threads:['darcy-elizabeth','class-rank'],motifs:['letters','secrets']})
E(58,'Darcy and Elizabeth Walk Together','Elizabeth thanks Darcy for saving Lydia, breaking the silence around his intervention.','oakham-mount',{
 elizabeth:'Speaking gratitude that also signals her transformed judgment and affection.',darcy:'Explaining that the rescue was done for her and daring to renew the question of love.'},['aunt-letter'],4,640,{threads:['darcy-elizabeth','lydia-wickham'],motifs:['secrets','travel']})
E(58,'Darcy’s Second Proposal Is Accepted','Darcy learns Elizabeth’s feelings have changed, and they become engaged.','oakham-mount',{
 darcy:'Receiving acceptance with gratitude, humility, and relief rather than entitlement.',elizabeth:'Choosing Darcy with full knowledge after revising both prejudice and hope.'},[],5,640,{beat:'climax',threads:['darcy-elizabeth'],motifs:['pride','judgment']})
E(58,'Darcy Explains Lady Catherine’s Effect','Lady Catherine’s report of Elizabeth’s refusal gave Darcy reason to hope.','oakham-mount',{
 darcy:'Admitting his aunt unintentionally encouraged the second proposal.',elizabeth:'Understanding that her resistance at Longbourn communicated possibility rather than rejection.'},[],2,640,{mentioned:['lady-catherine'],threads:['darcy-elizabeth','class-rank'],motifs:['judgment','manners']})
E(59,'Elizabeth Tells Jane','Jane initially cannot believe Elizabeth loves the man she once disliked.','longbourn',{
 elizabeth:'Convincing Jane that gratitude, understanding, and love replaced former dislike.',jane:'Moving from disbelief to wholehearted joy for her sister.'},[],3,641,{threads:['darcy-elizabeth','sisterhood'],motifs:['sisterhood','judgment']})
E(59,'Mr Bennet Gives Consent','Mr Bennet warns Elizabeth against marrying without respect, then accepts her account of Darcy.','longbourn',{
 elizabeth:'Explaining her changed feelings and Darcy’s intervention with unusual seriousness.',bennet:'Testing whether Elizabeth can esteem Darcy before giving emotional consent.',darcy:'Waiting outside the father-daughter conversation with less confidence than at Hunsford.'},[],3,641,{threads:['darcy-elizabeth','bennet-fortunes'],motifs:['family','judgment']})
E(60,'Elizabeth and Darcy Compare Their Changes','The engaged couple discuss first impressions, the letter, Pemberley, and Lady Catherine.','longbourn',{
 elizabeth:'Revisiting her mistakes with humour while asking when Darcy’s affection began.',darcy:'Acknowledging that rejection exposed his selfish pride and changed his conduct.'},['darcy-letter'],2,645,{threads:['darcy-elizabeth','first-impressions'],motifs:['letters','pride']})
E(60,'The Engagement Letters Are Written','Darcy writes Lady Catherine while Elizabeth informs Mrs Gardiner.','longbourn',{
 darcy:'Informing his aunt directly despite knowing the engagement opposes her design.',elizabeth:'Sharing happiness and gratitude with the aunt who understood Darcy at Pemberley.'},['aunt-letter'],2,646,{mentioned:['mrs-gardiner','lady-catherine'],threads:['darcy-elizabeth','gardiners','class-rank'],motifs:['letters','family']})
E(61,'Jane and Elizabeth Marry','The two elder Bennet sisters leave Longbourn for marriages founded on affection.','longbourn',{
 elizabeth:'Entering life at Pemberley with Darcy as an equal in wit, trust, and affection.',darcy:'Marrying after learning to place Elizabeth above class expectation.',jane:'Marrying Bingley with her constancy finally rewarded.',bingley:'Beginning married life still generous and sociable but more independent.',bennet:'Missing Elizabeth while pleased that both elder daughters are secure.','mrs-bennet':'Achieving two brilliant marriages and repeating their importance indefinitely.'},[],3,660,{beat:'resolution',threads:['darcy-elizabeth','bingley-jane','bennet-fortunes'],motifs:['marriage-market','family']})
E(61,'Life at Pemberley','Elizabeth and Darcy make Pemberley a home in which affection matters more than inherited rank.','pemberley',{
 elizabeth:'Building a generous household while remaining closely connected to the relatives who supported her.',darcy:'Welcoming the Gardiners and learning to enjoy family ties beyond the boundaries of rank.',georgiana:'Growing close to Elizabeth and gaining confidence through her lively affection.',gardiner:'Visiting Pemberley without deference and enjoying Darcy’s sincere friendship.','mrs-gardiner':'Returning to Derbyshire as a beloved relation rather than a socially inconvenient aunt.'},[],2,665,{threads:['darcy-elizabeth','gardiners'],motifs:['family','property']})
E(61,'The Bennet Sisters After Marriage','Kitty improves away from Lydia, Mary remains at home, and the Wickhams continue to ask their sisters for help.','longbourn',{
 kitty:'Spending more time with Jane and Elizabeth and becoming less irritable and ignorant.',mary:'Remaining at Longbourn and gaining more ordinary society as the only unmarried daughter at home.',bennet:'Visiting his married daughters when he wants escape and intelligent company.','mrs-bennet':'Continuing to celebrate the status of Jane and Elizabeth while indulging Lydia from a distance.'},[],2,666,{mentioned:['lydia','wickham','jane','elizabeth'],threads:['lydia-wickham','bennet-fortunes'],motifs:['family','money']})

const plotThreads=[
 ['darcy-elizabeth','Elizabeth and Darcy','#845f72','Mutual misjudgment becomes self-knowledge, changed conduct, and love.'],
 ['first-impressions','First Impressions','#6f7486','Elizabeth and Darcy learn how vanity, reserve, testimony, and context distort judgment.'],
 ['bingley-jane','Jane and Bingley','#a27883','A gentle courtship is interrupted by social interference and restored through greater independence.'],
 ['class-rank','Class and Rank','#75644e','Land, trade, manners, and family connections shape how every courtship is judged.'],
 ['bennet-fortunes','The Bennet Fortunes','#8b6d56','The entail and five daughters make marriage an economic as well as emotional pressure.'],
 ['caroline-jealousy','Caroline’s Jealousy','#80647d','Caroline attempts to separate Jane and Bingley and discredit Elizabeth before Darcy.'],
 ['sisterhood','The Bennet Sisters','#a66f7c','Jane and Elizabeth’s confidence contrasts with Kitty and Lydia’s imitation and risk.'],
 ['lydia-wickham','Lydia and Wickham','#9c594f','Impulsive attraction and predatory opportunism threaten the entire family.'],
 ['collins-charlotte','Collins and Charlotte','#797557','Charlotte chooses security through a marriage Elizabeth cannot admire.'],
 ['wickham-deception','Wickham’s Deception','#675d58','Charm, selective storytelling, debt, and secrecy conceal Wickham’s conduct.'],
 ['gardiners','The Gardiners','#61786f','Elizabeth’s aunt and uncle provide judgment, practical aid, and a bridge to Pemberley.'],
].map(([slug,name,color,description])=>({...base,id:threadId(slug),name,color,description}))

const motifs=[
 ['manners','Manners','#7c6f75','Courtesy can express character, conceal hostility, or bridge social distance.'],
 ['property','Property and Home','#796a52','Longbourn, Netherfield, Rosings, and Pemberley reveal economic and moral structures.'],
 ['marriage-market','The Marriage Market','#9d6d70','Courtship is evaluated through affection, income, security, family, and reputation.'],
 ['dancing','Dancing','#9a7958','Balls turn attraction, refusal, rank, and embarrassment into public movement.'],
 ['pride','Pride','#745d68','Self-respect, vanity, family honour, and inherited rank repeatedly collide.'],
 ['judgment','Judgment and Misreading','#637683','Characters interpret looks, letters, stories, houses, and silences with uneven accuracy.'],
 ['sisterhood','Sisterhood','#9c7586','Sisters confide, imitate, protect, embarrass, and learn from one another.'],
 ['letters','Letters','#6f7890','Written accounts separate action from knowledge and repeatedly revise the plot.'],
 ['family','Family','#806d60','Affection and embarrassment coexist with duty, inheritance, and influence.'],
 ['uniforms','Officers and Uniforms','#687788','Military display gives Wickham status and Lydia a dangerous fantasy of romance.'],
 ['storytelling','Competing Stories','#7c697f','The person who tells a history first often controls its moral meaning.'],
 ['music','Music and Performance','#8a6e84','Public performance exposes vanity, confidence, and social pressure.'],
 ['secrets','Secrets','#695f70','Concealed motives, histories, interventions, and hopes determine what others can judge.'],
 ['travel','Journeys','#60766e','Movement beyond Longbourn creates new evidence, independence, and crisis.'],
 ['portraits','Portraits and Appearances','#766a5d','Faces, painted likenesses, and outward polish are tested against conduct.'],
 ['money','Money and Settlement','#80714f','Income, debts, dowries, inheritance, and rescue shape the possible marriages.'],
].map(([slug,name,color,description])=>({...base,id:motifId(slug),name,color,description}))

const locById=new Map(locationMarkers.map(l=>[l.id,l]))
const characterSnapshots=[]
for(const [eventIndex,event] of events.entries()){
 for(const [i,characterId] of event.involvedCharacterIds.entries()){
  const slug=characterId.replace(`${P}-char-`,'')
  const statusNotes=event._states[slug]
  if(!statusNotes) throw new Error(`Missing event-specific status for ${slug} in “${event.title}”`)
  characterSnapshots.push({...base,id:id('snapshot',`${eventIndex+1}-${slug}`),characterId,eventId:event.id,isAlive:true,
   currentLocationMarkerId:event.locationMarkerId,currentMapLayerId:event.locationMarkerId?locById.get(event.locationMarkerId).mapLayerId:null,
   inventoryItemIds:[],inventoryNotes:'',travelModeId:null,sortKey:eventIndex*10+i,statusNotes})
 }
 delete event._states
}

const itemPlacements=[]
for(const event of events) event.involvedItemIds.forEach((item,i)=>itemPlacements.push({...base,id:id('placement',`${events.indexOf(event)+1}-${i+1}`),itemId:item,eventId:event.id,locationMarkerId:event.locationMarkerId,sortKey:events.indexOf(event)*10+i,notes:`Present during “${event.title}”.`}))

const relationshipSpecs=[
 ['elizabeth','darcy','Love through self-knowledge','strong','positive','Their mutual attraction becomes durable only after both correct pride and prejudice.'],
 ['jane','bingley','Devoted courtship','strong','positive','Their open affection survives separation, persuasion, and misunderstanding.'],
 ['elizabeth','jane','Confidante sisters','strong','positive','They test one another’s judgments with trust, affection, and different temperaments.'],
 ['elizabeth','bennet','Favourite daughter and father','strong','positive','Shared wit creates intimacy, though Elizabeth sees the cost of his detachment.'],
 ['elizabeth','mrs-bennet','Embarrassed daughter and anxious mother','medium','negative','Elizabeth resists her mother’s pressure and public indiscretion.'],
 ['bennet','mrs-bennet','Unequal marriage','medium','negative','His contempt and withdrawal worsen the disorder created by her anxiety and folly.'],
 ['lydia','wickham','Reckless marriage','strong','negative','Lydia’s infatuation and Wickham’s opportunism require financial rescue.'],
 ['collins','charlotte','Practical marriage','medium','neutral','Charlotte exchanges romantic expectation for a manageable home and security.'],
 ['caroline','bingley','Interfering siblings','strong','neutral','Caroline tries to govern Bingley’s friendships and marriage through status.'],
 ['caroline','darcy','Unreturned pursuit','medium','negative','Caroline seeks Darcy’s approval while he grows interested in Elizabeth.'],
 ['darcy','georgiana','Protective siblings','strong','positive','Darcy’s guardianship protects Georgiana after Wickham’s attempted exploitation.'],
 ['darcy','wickham','Former companions and enemies','strong','negative','Childhood proximity gives way to debt, resentment, exposure, and reluctant rescue.'],
 ['darcy','bingley','Influential friends','strong','positive','Darcy’s judgment first separates Bingley from Jane and later helps repair the harm.'],
 ['elizabeth','mrs-gardiner','Niece and confidante','strong','positive','Mrs Gardiner offers affection, caution, and insight without control.'],
 ['gardiner','mrs-gardiner','Capable partners','strong','positive','They combine practical responsibility, observation, and hospitality.'],
 ['elizabeth','charlotte','Friends divided by marriage','strong','neutral','Their affection persists despite a profound disagreement over Collins.'],
 ['lady-catherine','darcy','Aunt and resistant nephew','medium','neutral','She treats family expectation as authority; Darcy ultimately rejects it.'],
 ['lady-catherine','collins','Patroness and dependent','strong','neutral','Collins converts Lady Catherine’s patronage into constant deference.'],
 ['lady-catherine','elizabeth','Social adversaries','strong','negative','Lady Catherine’s intimidation strengthens Elizabeth’s defence of choice.'],
 ['kitty','lydia','Imitative sisters','strong','negative','Kitty follows Lydia until separation creates room for improvement.'],
 ['bennet','lydia','Neglectful father and reckless daughter','medium','negative','His refusal to set limits helps leave Lydia exposed to Wickham.'],
 ['forster','lydia','Failed guardianship','medium','negative','The Brighton invitation grants freedom without adequate supervision.'],
 ['wickham','georgiana','Predator and former target','strong','negative','Wickham once planned to elope with Georgiana for her fortune.'],
 ['elizabeth','wickham','Deceived listener','strong','negative','Elizabeth’s wounded vanity makes Wickham’s false history attractive.'],
 ['jane','caroline','False friendship','medium','negative','Jane offers sincerity while Caroline uses intimacy to separate her from Bingley.'],
]
const relationships=relationshipSpecs.map(([a,b,label,strength,sentiment,description],i)=>({...base,id:id('relationship',String(i+1)),characterAId:charId(a),characterBId:charId(b),label,strength,sentiment,description,isBidirectional:true,startEventId:null}))

const loreCategories=[['property','Property and Inheritance','#7d6a52'],['courtship','Courtship and Reputation','#966b76'],['society','Rank and Manners','#68778a'],['knowledge','Letters and Knowledge','#706581'],['sources','Sources and Editorial Notes','#85775e']].map(([slug,name,color],i)=>({id:id('lore-category',slug),worldId,name,color,sortOrder:i+1}))
const lorePageSpecs=[
 ['property','The Longbourn Entail','Longbourn is entailed in the male line to Mr Collins. Mrs Bennet’s anxiety is comic in expression but grounded in the real insecurity facing five daughters with limited fortunes.'],
 ['property','Marriage Settlements and Income','Annual income, dowries, debts, property, and settlements define what characters call prudence, advantage, or rescue. The novel never reduces marriage to money, but never permits money to disappear from it.'],
 ['courtship','Balls and Dancing','Assemblies and private balls make preference public. A second dance signals attention; a refusal can humiliate; a partner forces conversation within a strict social form.'],
 ['courtship','Elopement and Reputation','Lydia’s unmarried flight with Wickham threatens not only her position but the marriage prospects of every Bennet sister. The settlement contains the scandal without reforming the couple.'],
 ['society','The Meryton Militia','The regiment supplies Meryton with uniforms, gossip, and mobile young men. It also gives Wickham borrowed prestige and leads Lydia from local flirtation to Brighton.'],
 ['society','Trade, Land, and Gentility','The Gardiners’ trade connections expose Darcy’s early snobbery, yet their conduct repeatedly exceeds that of wealthier characters. Pemberley ultimately welcomes character rather than pedigree.'],
 ['knowledge','Darcy and Wickham’s History','Darcy’s letter explains Wickham’s exchanged living, debts, and attempted elopement with Georgiana. Later conduct and independent testimony confirm the account.'],
 ['knowledge','The Hunsford Letter','Darcy’s letter is the novel’s epistemic hinge: a private document that requires Elizabeth to reread both the page and herself.'],
 ['knowledge','Pemberley as Testimony','The estate, Mrs Reynolds, Georgiana, and Darcy’s hospitality reveal responsibility through a network of conduct rather than a single self-defence.'],
 ['sources','Editorial Calendar','The event dates form a coherent reading calendar anchored broadly to the novel’s autumn-to-autumn sequence. Exact days are an editorial reconstruction where Austen supplies only relative time.'],
 ['sources','Fictional Geography','Longbourn, Meryton, Netherfield, Rosings, and Pemberley are fictional. Their markers preserve narrative relationships on historical or regional maps rather than claiming canonical coordinates.'],
 ['sources','Text, Illustration, and Map Sources','Chapter checking follows the public-domain Project Gutenberg edition (ebook 1342). Illustration links use Hugh Thomson and C. E. Brock images on Wikimedia Commons; maps link to historical and locator maps there. Summaries and status notes are newly written.'],
]
const lorePages=lorePageSpecs.map(([cat,title,body],i)=>({...base,id:id('lore',String(i+1)),categoryId:id('lore-category',cat),title,body,tags:[],coverImageId:null,linkedEntityIds:[],visibleFromEventId:null}))

const factions=[
 ['bennets','The Bennet Household','#8b6771','The Longbourn family, whose affection and disorder drive every marriage plot.'],
 ['netherfield','The Netherfield Party','#63788b','Bingley’s household, including sisters who attempt to manage his social future.'],
 ['lucases','The Lucas and Collins Household','#74765f','The Lucas family and Charlotte’s practical Hunsford establishment.'],
 ['pemberley','The Pemberley Family','#5f7180','Darcy, Georgiana, and the household shaped by responsibility and inheritance.'],
 ['rosings','The Rosings Circle','#765b68','Lady Catherine’s household and dependants, organised around rank and patronage.'],
 ['militia','The Meryton Militia','#687786','Officers whose arrival transforms local social life and enables Wickham.'],
 ['gardiners','The Gardiner Household','#62786d','The capable London relations who support the Bennets in travel and crisis.'],
].map(([slug,name,color,description])=>({...base,id:id('faction',slug),name,description,color,coverImageId:null,tags:[]}))
const membershipSpecs=[
 ['bennets','bennet','Father'],['bennets','mrs-bennet','Mother'],['bennets','jane','Daughter'],['bennets','elizabeth','Daughter'],['bennets','mary','Daughter'],['bennets','kitty','Daughter'],['bennets','lydia','Daughter'],['bennets','hill','Housekeeper'],
 ['netherfield','bingley','Tenant and host'],['netherfield','caroline','Sister and hostess'],['netherfield','mrs-hurst','Sister'],['netherfield','mr-hurst','Brother-in-law'],
 ['lucases','sir-william','Father'],['lucases','lady-lucas','Mother'],['lucases','charlotte','Daughter and later Hunsford mistress'],['lucases','maria','Daughter'],['lucases','collins','Son-in-law'],
 ['pemberley','darcy','Master'],['pemberley','georgiana','Sister'],['pemberley','mrs-reynolds','Housekeeper'],
 ['rosings','lady-catherine','Mistress'],['rosings','anne-de-bourgh','Daughter'],['rosings','jenkinson','Companion'],['rosings','collins','Clerical dependent'],
 ['militia','forster','Colonel'],['militia','denny','Officer'],['militia','wickham','Officer'],['gardiners','gardiner','Father and merchant'],['gardiners','mrs-gardiner','Mother'],
]
const factionMemberships=membershipSpecs.map(([f,c,role],i)=>({...base,id:id('membership',String(i+1)),factionId:id('faction',f),characterId:charId(c),role,startEventId:null,endEventId:null,notes:''}))
const factionRelationships=[
 ['bennets','netherfield','allied','Two courtships connect the households despite Caroline’s resistance.'],['bennets','militia','hostile','The regiment’s glamour culminates in Lydia’s flight and family crisis.'],['pemberley','rosings','strained','Family ties remain, but Darcy rejects Lady Catherine’s marriage design.'],['pemberley','gardiners','allied','Pemberley ultimately values the Gardiners’ character over their commercial connections.'],['lucases','rosings','dependent','The Hunsford household depends upon Lady Catherine’s patronage.'],
].map(([a,b,stance,notes],i)=>({...base,id:id('faction-rel',String(i+1)),factionAId:id('faction',a),factionBId:id('faction',b),stance,notes}))

const findEvent=title=>{const event=events.find(e=>e.title===title);if(!event)throw new Error(`Unknown event “${title}”`);return event.id}
const factSpecs=[
 ['slight','Darcy insulted Elizabeth at the assembly','Elizabeth overheard Darcy call her merely tolerable.','Darcy Refuses Elizabeth'],
 ['wickham-story','Wickham claims Darcy denied him a living','Wickham presents himself as the victim of Darcy’s jealousy and injustice.','Wickham Tells His Story'],
 ['caroline-design','Caroline intends to separate Jane and Bingley','Her London letter disguises active interference as friendly information.','Caroline Announces the London Departure'],
 ['charlotte-choice','Charlotte accepted Collins','Charlotte chooses financial security and household independence.','Collins Proposes to Charlotte'],
 ['darcy-separated','Darcy separated Bingley from Jane','Colonel Fitzwilliam’s disclosure connects Darcy to Jane’s disappointment.','Fitzwilliam Reveals Darcy’s Intervention'],
 ['georgiana','Wickham attempted to elope with Georgiana','Darcy’s letter reveals Wickham targeted his fifteen-year-old sister and her fortune.','Elizabeth Reassesses Wickham'],
 ['misjudgment','Elizabeth misjudged Darcy and Wickham','Rereading the letter exposes how vanity shaped her certainty.','Elizabeth Reassesses Wickham'],
 ['elopement','Lydia fled without a secured marriage','Jane’s delayed letters reveal the full risk of the Brighton flight.','Jane’s Letters Reveal the Elopement'],
 ['darcy-rescue','Darcy funded Lydia’s marriage','Mrs Gardiner reveals Darcy found the couple, paid debts, and arranged the settlement.','Mrs Gardiner Reveals Darcy’s Intervention'],
 ['catherine-hope','Lady Catherine gave Darcy hope','Elizabeth’s refusal to renounce him suggested her feelings had changed.','Darcy Explains Lady Catherine’s Effect'],
 ['elizabeth-love','Elizabeth loves Darcy','Elizabeth confirms that esteem, gratitude, and understanding have become love.','Elizabeth Tells Jane'],
]
const knowledgeFacts=factSpecs.map(([slug,title,description,eventTitle])=>({...base,id:id('fact',slug),title,description,tags:[],readerLearnsAtEventId:findEvent(eventTitle),originEventId:findEvent(eventTitle)}))
const reveals=[]
function reveal(fact,character,eventTitle,note){reveals.push({...base,id:id('reveal',String(reveals.length+1)),factId:id('fact',fact),characterId:charId(character),eventId:findEvent(eventTitle),note})}
reveal('slight','elizabeth','Darcy Refuses Elizabeth','Elizabeth hears the dismissal directly.')
reveal('wickham-story','elizabeth','Wickham Tells His Story','Wickham wins Elizabeth’s initial trust.')
reveal('caroline-design','elizabeth','Caroline Announces the London Departure','Elizabeth recognises strategy where Jane sees friendship.')
reveal('charlotte-choice','elizabeth','Collins Proposes to Charlotte','Elizabeth learns how differently Charlotte values marriage.')
reveal('darcy-separated','elizabeth','Fitzwilliam Reveals Darcy’s Intervention','The colonel unknowingly identifies Darcy’s role.')
reveal('georgiana','elizabeth','Elizabeth Reassesses Wickham','Darcy entrusts Elizabeth with his sister’s secret history.')
reveal('misjudgment','elizabeth','Elizabeth Reassesses Wickham','Elizabeth corrects her own account rather than merely replacing one man’s story with another.')
reveal('elopement','elizabeth','Jane’s Letters Reveal the Elopement','Elizabeth receives the delayed family news.')
reveal('darcy-rescue','elizabeth','Mrs Gardiner Reveals Darcy’s Intervention','Her aunt supplies the hidden history of the settlement.')
reveal('catherine-hope','elizabeth','Darcy Explains Lady Catherine’s Effect','Darcy explains why he dared propose again.')
reveal('elizabeth-love','jane','Elizabeth Tells Jane','Jane becomes the first family member to know Elizabeth’s feelings.')

const characterGoals=[
 ['elizabeth','Darcy Refuses Elizabeth','Darcy’s Second Proposal Is Accepted','want','Preserve independence while judging character for herself.'],
 ['elizabeth','Wickham Tells His Story','Elizabeth Reassesses Wickham','need','Learn to test appealing stories against conduct and self-knowledge.'],
 ['darcy','Darcy Begins to Observe Elizabeth','Darcy’s Second Proposal Is Accepted','want','Win Elizabeth without initially understanding why rank and manner estrange her.'],
 ['darcy','Darcy’s First Proposal','Darcy Returns Unexpectedly','need','Replace entitlement and reserve with humility, civility, and accountable action.'],
 ['jane','Bingley Enters the Assembly','Bingley Proposes to Jane','want','Sustain hope in Bingley without sacrificing generosity or composure.'],
 ['bingley','Bingley Enters the Assembly','Bingley Proposes to Jane','want','Marry Jane and become independent of stronger personalities.'],
 ['mrs-bennet','Netherfield Is Let','Jane and Elizabeth Marry','want','Secure advantageous marriages for her daughters before the entail takes effect.'],
 ['charlotte','Collins Proposes to Charlotte','The Travellers Reach Hunsford','want','Gain a stable household through a practical marriage.'],
 ['lydia','The Militia Enlivens Meryton','Lydia Returns Married','want','Turn officers, attention, and escape into the status of marriage.'],
 ['wickham','Wickham Tells His Story','The London Search Fails','want','Use charm, credit, and advantageous matches to escape consequences.'],
 ['gardiner','The Party Returns to Longbourn','Mr Gardiner’s Express Arrives','want','Protect Lydia and contain the Bennet family crisis through practical action.'],
 ['caroline','Darcy Begins to Observe Elizabeth','Bingley and Darcy Return to Netherfield','want','Separate Jane from Bingley and prevent Darcy’s attachment to Elizabeth.'],
].map(([c,start,end,type,text],i)=>({...base,id:id('goal',String(i+1)),characterId:charId(c),startEventId:findEvent(start),endEventId:findEvent(end),type,text}))

const mapRoutes=[
 {...base,id:id('route','meryton-circuit'),mapLayerId:mapId('hertfordshire'),name:'The Meryton Social Circuit',routeType:'foot',waypoints:[locId('longbourn'),locId('meryton'),locId('assembly'),locId('lucas-lodge'),locId('netherfield')],color:'#8e6f75',notes:'The local movement through which first impressions, gossip, and courtship develop.'},
 {...base,id:id('route','london-visits'),mapLayerId:mapId('london'),name:'London Visits and Search',routeType:'carriage',waypoints:[locId('gardiner-house'),locId('darcy-london'),locId('wickham-lodgings')],color:'#65798a',notes:'Editorially combines Jane’s visit, Darcy’s metropolitan connections, and the search for Lydia.'},
 {...base,id:id('route','hunsford'),mapLayerId:mapId('kent'),name:'Hunsford and Rosings Walks',routeType:'foot',waypoints:[locId('hunsford'),locId('rosings'),locId('rosings-grove')],color:'#7d6d55',notes:'Elizabeth’s repeated movement between the parsonage, Rosings, and the grove where the letter is delivered.'},
 {...base,id:id('route','pemberley'),mapLayerId:mapId('derbyshire'),name:'The Derbyshire Tour',routeType:'carriage',waypoints:[locId('lambton'),locId('lambton-inn'),locId('pemberley')],color:'#64766d',notes:'The Gardiners and Elizabeth approach Pemberley from Lambton and move between inn, house, and grounds.'},
]

const data={
 version:16,type:'worldbreaker-export',exportedAt:now,
 world:{id:worldId,name:'Pride and Prejudice',description:'Jane Austen’s novel follows Elizabeth Bennet and Fitzwilliam Darcy through attraction, error, social pressure, family crisis, and the difficult revision of first impressions, alongside the contrasting courtships of the Bennet sisters.',coverImageId:id('image','cover'),theme:'theme-romance',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:1811,yearSuffix:' (editorial reconstruction)',months},wordTarget:null},
 mapLayers,locationMarkers,characters,items,characterSnapshots,characterMovements:[],itemPlacements,locationSnapshots:[],itemSnapshots:[],relationships,relationshipSnapshots:[],
 timelines:[{id:timelineId,worldId,name:'Pride and Prejudice — Master Chronology',description:'A single reading-order timeline from the Netherfield lease to the marriages and their aftermath.',color:'#845f72',dayOffset:0,createdAt:now}],chapters,events,blobs,travelModes:[],timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes,mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],
 loreCategories,lorePages,factions,factionMemberships,factionRelationships,knowledgeFacts,knowledgeReveals:reveals,characterGoals,sceneTexts:[],plotThreads,motifs,continuitySuppressions:[],writingLogs:[],sceneRevisions:[]
}

const ids=new Map()
for(const [key,value] of Object.entries(data)) if(Array.isArray(value)) for(const row of value) if(row.id){if(ids.has(row.id))throw new Error(`Duplicate id ${row.id}`);ids.set(row.id,key)}
const assertRef=(value,collection,label)=>{if(value!=null&&!new Set(collection.map(x=>x.id)).has(value))throw new Error(`${label}: missing ${value}`)}
events.forEach(event=>{assertRef(event.chapterId,chapters,`${event.id}.chapter`);assertRef(event.locationMarkerId,locationMarkers,`${event.id}.location`);event.involvedCharacterIds.forEach(v=>assertRef(v,characters,`${event.id}.character`));event.mentionedCharacterIds.forEach(v=>assertRef(v,characters,`${event.id}.mentioned`));event.involvedItemIds.forEach(v=>assertRef(v,items,`${event.id}.item`));event.threadIds.forEach(v=>assertRef(v,plotThreads,`${event.id}.thread`));event.motifIds.forEach(v=>assertRef(v,motifs,`${event.id}.motif`));if(event.tension<1||event.tension>5)throw new Error(`${event.id}: tension outside 1–5`)})
characterSnapshots.forEach(snapshot=>{assertRef(snapshot.characterId,characters,`${snapshot.id}.character`);assertRef(snapshot.eventId,events,`${snapshot.id}.event`);assertRef(snapshot.currentLocationMarkerId,locationMarkers,`${snapshot.id}.location`)})
if(chapters.length!==61||new Set(events.map(e=>e.chapterId)).size!==61)throw new Error('Every one of the 61 chapters must contain events')
if(characterSnapshots.some(s=>!events.find(e=>e.id===s.eventId).involvedCharacterIds.includes(s.characterId)))throw new Error('Snapshot for absent character')
if(new Set(characterSnapshots.map(s=>s.statusNotes)).size!==characterSnapshots.length)throw new Error('Character statuses must be event-specific, not reused')
if(events.some(e=>e.involvedCharacterIds.some(c=>e.mentionedCharacterIds.includes(c))))throw new Error('A character cannot be both present and mentioned')

const text=JSON.stringify(data,null,2)+'\n'
fs.writeFileSync('example/Pride and Prejudice.pwk',text)
fs.writeFileSync('public/library/pride-and-prejudice.pwk',text)
console.log(JSON.stringify({chapters:chapters.length,events:events.length,characters:characters.length,locations:locationMarkers.length,maps:mapLayers.length,snapshots:characterSnapshots.length,items:items.length,threads:plotThreads.length,motifs:motifs.length},null,2))
