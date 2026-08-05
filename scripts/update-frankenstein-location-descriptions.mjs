import fs from 'node:fs'

const descriptions = {
  'st-petersburg': 'Russia’s imperial Baltic capital and the departure point for expeditions travelling toward the far north.',
  'archangel-portal': 'A gateway to the White Sea port of Archangel and the Arctic waters beyond it.',
  'geneva-portal': 'The Alpine region surrounding Geneva and its lake, bordered by the Jura and the Savoy mountains.',
  'ingolstadt-portal': 'A Bavarian university town on the Danube, presented through its streets, lodgings, and scholarly institutions.',
  'montblanc-portal': 'The high Alpine country of the Arve valley, Chamonix, Montanvert, and the glaciers beneath Mont Blanc.',
  'britain-portal': 'The British journey through England and Scotland, from London and Oxford to Edinburgh and the northern islands.',
  'rhine': 'A broad river corridor of wooded banks, old towns, vineyards, and castles linking Switzerland with the German lands.',
  'black-forest': 'A densely wooded upland region in southwestern Germany, crossed by secluded roads and deep valleys.',
  'continental-road': 'An editorial route joining the novel’s widely separated European settings across roads, rivers, and mountain passes.',
  'geneva-city-portal': 'A closer view of Geneva’s streets, family residences, civic buildings, and nearby Plainpalais.',
  'belrive': 'A country house on the shore of Lake Geneva, offering quiet rooms, gardens, and open views across the water.',
  'lake-geneva': 'The long crescent-shaped Alpine lake shared by Switzerland and Savoy, surrounded by towns, vineyards, and mountains.',
  'mont-saleve': 'A prominent limestone mountain overlooking Geneva and the southern end of the lake.',
  'evian': 'The Savoyard shore opposite Lausanne, where lakeside settlements sit below the rising Alpine country.',
  'lausanne': 'A steeply built city on the northern shore of Lake Geneva, looking south toward Savoy and the Alps.',
  'geneva-city': 'The compact republic on the Rhône, combining fortified streets, civic institutions, prosperous homes, and lakeside walks.',
  'frankenstein-home': 'The Geneva residence of the Frankenstein family, a cultivated household centred on shared rooms and close domestic ties.',
  'plainpalais': 'An open area beyond Geneva’s historic walls, used for public recreation and crossed by roads leading into the countryside.',
  'geneva-prison': 'Geneva’s civic setting for confinement, legal examination, and formal judgment.',
  'cemetery': 'A burial ground near Geneva, enclosed from the city and quiet beneath the surrounding Alpine landscape.',
  'city-gate': 'The threshold between Ingolstadt’s enclosed streets and the roads leading into the Bavarian countryside.',
  'university': 'The historic Bavarian university whose lecture rooms and professors represent contemporary natural philosophy, chemistry, and medicine.',
  'victor-rooms': 'Private student lodgings in Ingolstadt, combining living quarters with books, instruments, and space for solitary study.',
  'laboratory': 'A secluded workroom fitted for chemical, anatomical, and electrical experimentation away from the university’s public rooms.',
  'clerval-lodging': 'Modest rooms used by Henry Clerval during his stay in Ingolstadt, more sociable and orderly than Victor’s workspaces.',
  'graveyard': 'A liminal area of burial grounds and anatomical study associated with the period’s medical investigation of the human body.',
  'cottage-portal': 'A modest rural dwelling occupied by the De Lacey family, with a shared room, garden plot, and adjoining shelter.',
  'country-road': 'A rural Bavarian road passing fields, villages, and woodland beyond Ingolstadt.',
  'chamonix': 'An Alpine settlement in the upper Arve valley beneath the glaciers and peaks of the Mont Blanc massif.',
  'arve-valley': 'A steep Alpine valley followed by the River Arve between wooded slopes, rock walls, villages, and glaciers.',
  'montanvert': 'A high mountain viewpoint above Chamonix reached by a demanding ascent through forest and exposed Alpine ground.',
  'mer-de-glace': 'A vast river of ice descending through the Mont Blanc massif, broken by crevasses and bordered by bare rock.',
  'mountain-hut': 'A simple Alpine shelter offering temporary protection from wind, cold, and rapidly changing mountain weather.',
  'mont-blanc': 'The highest massif in the Alps, dominating the surrounding valleys with snowfields, aiguilles, and glaciers.',
  'london': 'Britain’s immense commercial and intellectual capital, filled with crowded streets, institutions, theatres, and travellers’ lodgings.',
  'oxford': 'A university city of colleges, libraries, chapels, and riverside walks shaped by centuries of scholarship.',
  'matlock': 'A Derbyshire spa district set among wooded limestone valleys, rivers, and rocky heights.',
  'cumberland': 'The mountainous northwestern county of lakes, valleys, and remote roads later celebrated as the English Lake District.',
  'edinburgh': 'Scotland’s capital, where the medieval Old Town and newer Georgian streets rise above the Firth of Forth.',
  'perth': 'A Scottish town on the River Tay and a natural stopping point on the road toward the Highlands.',
  'orkney-portal': 'The remote archipelago north of mainland Scotland, exposed to Atlantic weather and surrounded by difficult tidal waters.',
  'ireland-portal': 'The Irish coastline and its nearby settlements, courts, harbours, and roads.',
  'english-channel': 'The busy but changeable sea passage separating southern England from continental Europe.',
  'remote-island': 'A sparsely inhabited Orkney island of low fields, stone shores, peat, wind, and scattered cottages.',
  'island-hut': 'A rough, isolated hut adapted as a private workroom, with few comforts and the sea close on every side.',
  'rocky-shore': 'An exposed island shoreline of dark rock, shingle, tide pools, and strong northern surf.',
  'northern-sea': 'Cold open water between Orkney, mainland Scotland, and the North Atlantic, subject to fog, currents, and sudden storms.',
  'irish-coast': 'A rugged stretch of Irish shoreline approached from the Atlantic through rough water and uncertain weather.',
  'irish-village': 'A small coastal community organised around cottages, local roads, fishing, and the nearby harbour.',
  'kirwin-court': 'The local magistrate’s civic rooms and adjoining place of confinement in an Irish coastal district.',
  'harbor': 'A sheltered Irish landing place serving fishing boats and vessels travelling along the Atlantic coast.',
  'archangel': 'A northern Russian port on the White Sea, historically used by merchants, sailors, and Arctic expeditions.',
  'open-sea': 'The high-latitude waters beyond the White Sea, where navigation depends on weather, visibility, and shifting ice.',
  'walton-ship': 'Robert Walton’s expedition vessel, a compact wooden world of decks, cabins, crew quarters, and scientific equipment.',
  'sled-route': 'A reconstructed overland course across snow and sea ice, travelled by sledge where no permanent road exists.',
  'ice-field': 'A mobile Arctic expanse of pressure ridges, cracks, fog, and floes that can close around a vessel without warning.',
  'ice-raft': 'A detached fragment of sea ice carried through open Arctic water by wind and current.',
  'hovel': 'A concealed lean-to adjoining the cottage, cramped and unheated but offering a narrow view into the family’s shared room.',
  'de-lacey-room': 'The cottage room associated with the elder De Lacey, furnished simply and shaped by conversation, music, and domestic routine.',
  'family-room': 'The De Laceys’ principal shared room, where work, meals, reading, music, and evening companionship take place.',
  'cottage-door': 'The cottage’s modest entrance, opening from the family’s interior onto the garden and surrounding countryside.',
}

for (const file of ['example/Frankenstein.pwk', 'public/library/frankenstein.pwk']) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const location of data.locationMarkers) {
    const slug = location.id.replace('frankenstein-loc-', '')
    const description = descriptions[slug]
    if (!description) throw new Error(`Missing description for ${location.id}`)
    location.description = description
  }
  if (Object.keys(descriptions).length !== data.locationMarkers.length) {
    throw new Error(`${file}: description count does not match location count`)
  }
  fs.writeFileSync(file, JSON.stringify(data))
}

console.log(`Updated ${Object.keys(descriptions).length} spoiler-safe Frankenstein location descriptions.`)
