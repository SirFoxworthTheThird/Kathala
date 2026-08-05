import fs from 'node:fs';

const ROOT = new URL('../', import.meta.url);

const tolkienDescriptions = {
  'Amon Dîn': 'The first of Gondor’s northern warning beacons, raised on a wooded hill east of the White Mountains.',
  'Anórien': 'The northern fief of Gondor, lying between the White Mountains, the Anduin, and the border of Rohan.',
  Archet: 'A small woodland village in Bree-land, north-east of Bree.',
  'Bag End': 'The comfortable smial beneath the Hill in Hobbiton, with round rooms, gardens, and a west-facing door.',
  'Barad-dûr': 'Sauron’s vast fortress in northern Mordor, standing beyond the ash plain of Gorgoroth.',
  'Barrow-downs': 'Grass-covered ancient burial hills east of the Old Forest, filled with stone chambers and old memories.',
  'Bindbale Woods': 'Woodland in the Northfarthing of the Shire near the village of Long Cleeve.',
  'Brandy Hall': 'The many-roomed ancestral home of the Brandybucks, tunneled into Buck Hill beside the Brandywine.',
  Bree: 'The chief village of Bree-land, where Men and Hobbits share a walled settlement at the meeting of roads.',
  'Bree-land': 'A small settled country around Bree, Staddle, Combe, and Archet, surrounded by otherwise empty lands.',
  'Bridge of Khazad-dûm': 'A narrow stone span crossing a deep chasm near Moria’s eastern gate.',
  Calenhad: 'The sixth of Gondor’s northern warning beacons, set on a green hill west of Min-Rimmon.',
  'Cerin Amroth': 'A flower-covered hill in Lothlórien crowned by white trees and high watch platforms.',
  'Chamber of Mazarbul': 'A records chamber in Moria, built around a stone tomb and the remnants of a Dwarven colony.',
  'Cirith Ungol': 'A high, guarded pass through the Mountains of Shadow above Minas Morgul.',
  Citadel: 'The fortified seventh level of Minas Tirith, containing the Tower of Ecthelion and the White Tree.',
  Combe: 'A quiet village in a deep valley east of Bree, beneath the wooded slopes of Bree-hill.',
  Crickhollow: 'A secluded house in Buckland, close to the hedge separating the settled land from the Old Forest.',
  Dale: 'A rebuilt city of Men in the valley between Erebor and the River Running.',
  Derndingle: 'A broad, bowl-shaped meeting place of the Ents, hidden within Fangorn Forest.',
  'Dol Amroth': 'A fortified coastal city and princely seat on the Bay of Belfalas in southern Gondor.',
  'Dol Guldur': 'A dark fortress on Amon Lanc in the southern reaches of Mirkwood.',
  Dunharrow: 'An ancient mountain refuge above Harrowdale, approached by a steep switchback road lined with standing stones.',
  'Durin’s Tower': 'A solitary stone tower on the snowbound peak of Zirakzigil, reached from Moria by the Endless Stair.',
  Edoras: 'The hilltop capital of Rohan, enclosed by a timber wall beneath the White Mountains.',
  Eilenach: 'The second of Gondor’s northern warning beacons, standing on a steep, wooded height.',
  'Endless Stair': 'An ancient stairway rising from the deepest passages of Moria to Durin’s Tower on Zirakzigil.',
  Entwash: 'A river flowing out of Fangorn across Rohan before dividing into wetlands near the Anduin.',
  Erelas: 'The fourth of Gondor’s northern warning beacons, set among the long foothills west of Nardol.',
  Esgaroth: 'A trading town built on wooden piles above the waters of the Long Lake.',
  'Gladden Fields': 'Marshy ground where the Gladden River enters the Anduin, bordered by reeds and low islands.',
  Gondor: 'The southern realm of the Dúnedain, extending from the White Mountains to the coast and the borders of Mordor.',
  Halifirien: 'The last and westernmost of Gondor’s northern warning beacons, close to the border of Rohan.',
  'Helm’s Deep': 'A narrow valley in the White Mountains fortified by the Hornburg and the Deeping Wall.',
  'Henneth Annûn': 'A hidden refuge in northern Ithilien, concealed behind a waterfall above a clear pool.',
  'High Pass': 'An old road crossing the Misty Mountains east of Rivendell.',
  Hobbiton: 'A Westfarthing village of lanes, gardens, mills, and hobbit-holes clustered around the Hill.',
  Hornburg: 'The ancient stone keep guarding the entrance to Helm’s Deep.',
  Isengard: 'A circular stronghold at the southern end of the Misty Mountains, enclosed by a great ring-wall.',
  Lebennin: 'A populous fief of southern Gondor between the White Mountains and the lower Anduin.',
  'Long Cleeve': 'A village in the northern Shire near the Bindbale Wood.',
  Longbottom: 'A Southfarthing district of the Shire known for sheltered farmland and pipe-weed fields.',
  Lossarnach: 'A fertile, flower-rich valley and fief immediately south-west of Minas Tirith.',
  Meduseld: 'The Golden Hall of the kings of Rohan, standing at the summit of Edoras.',
  'Michel Delving': 'The chief township of the Shire and seat of its mayor, built among the White Downs.',
  'Minas Morgul': 'A fortified city in the Morgul Vale, commanding the western approach to Cirith Ungol.',
  'Minas Tirith': 'Gondor’s seven-tiered capital, built against Mount Mindolluin and encircled by white walls.',
  'Min-Rimmon': 'The fifth of Gondor’s northern warning beacons, positioned between Erelas and Calenhad.',
  Mordor: 'A harsh, enclosed land beyond the Mountains of Shadow and the Ash Mountains.',
  Moria: 'The ancient Dwarven realm of Khazad-dûm, a vast network of halls and mines beneath the Misty Mountains.',
  'Mount Doom': 'The active volcano Orodruin, rising from the ash plain of Gorgoroth in central Mordor.',
  'Nan Curunír': 'The sheltered valley at the southern end of the Misty Mountains that contains Isengard.',
  Nardol: 'The third of Gondor’s northern warning beacons, raised on a ridge rich in timber.',
  Nimrodel: 'A clear woodland stream descending from the Misty Mountains through Lothlórien.',
  Orthanc: 'An unyielding black stone tower standing at the center of the ring of Isengard.',
  'Paths of the Dead': 'An underground road beneath the White Mountains, entered from the shadowed valley of the Dimholt.',
  Pelargir: 'An ancient river-port of Gondor on the lower Anduin, near its meeting with the sea.',
  'Pelennor Fields': 'The farmland surrounding Minas Tirith, enclosed by the defensive wall called the Rammas Echor.',
  'Rath Dínen': 'The silent, enclosed street of tombs on the upper levels of Minas Tirith.',
  'Redhorn Pass': 'A high mountain route beside Caradhras, crossing the Misty Mountains above Moria.',
  Rivendell: 'A hidden Elven valley beside the Bruinen, sheltered beneath the western slopes of the Misty Mountains.',
  Rohan: 'A broad grassland kingdom between the Misty Mountains, the White Mountains, and the Anduin.',
  'Sammath Naur': 'The Chambers of Fire within Mount Doom, reached by a road across the mountain’s flank.',
  'Sarn Ford': 'A stony crossing of the Brandywine south of the Shire.',
  'Shelob’s Lair': 'A maze of lightless tunnels beneath Cirith Ungol, connecting the high pass to Mordor.',
  Shire: 'The green homeland of the Hobbits, divided into four farthings west of the Brandywine.',
  Staddle: 'A village on the south-eastern side of Bree-hill, inhabited mainly by Hobbits.',
  'The Black Gate': 'The fortified Morannon, closing the main northern entrance into Mordor.',
  'The Bruinen Ford': 'A shallow crossing of the River Bruinen on the road east of Rivendell.',
  'The Carrock': 'A tall, flat-topped rock rising from the upper Anduin, reached by stone steps.',
  'The Cross-roads': 'An ancient road junction in Ithilien marked by the weathered statue of a king.',
  'The Deeping Wall': 'A stone rampart stretching across Helm’s Deep from the Hornburg to the mountain cliff.',
  'The Dimholt': 'A dark fir wood above Dunharrow that shelters the entrance to the Paths of the Dead.',
  'The Forbidden Pool': 'A concealed pool beneath the waterfall of Henneth Annûn in northern Ithilien.',
  'The Gate of Moria': 'The western entrance to Moria, sealed by the hidden Doors of Durin beside a dark pool.',
  'The Last Homely House': 'Elrond’s house in Rivendell, a place of counsel, learning, refuge, and song.',
  'The Long Lake': 'A broad freshwater lake south of Erebor, fed by the Forest River and drained by the River Running.',
  'The Old Forest': 'An ancient, close-grown woodland immediately east of Buckland and the High Hay.',
  'The Party Tree': 'A great tree on the Party Field below Bag End, serving as a familiar Hobbiton landmark.',
  'The Prancing Pony': 'A large inn at Bree’s crossroads, serving both local people and travelers on the East Road.',
  'Thranduil’s Hall': 'The cavern palace of the Woodland Realm, built beneath a wooded hill in northern Mirkwood.',
  Tuckborough: 'The principal settlement of Tookland in the Westfarthing, near the Great Smials.',
  'Twenty-first Hall': 'A vast pillared chamber in Moria’s eastern levels, close to the Chamber of Mazarbul.',
  Udûn: 'The enclosed northern valley of Mordor immediately behind the Black Gate.',
  Waymeet: 'A Shire village where the East Road meets the north–south road through the Westfarthing.',
  'Weather Hills': 'A line of bare uplands east of Bree-land, crowned by the ruins of ancient watchtowers.',
  Weathertop: 'The summit of Amon Sûl, where the ruined watchtower overlooks the Great East Road.',
  Wellinghall: 'Treebeard’s leafy dwelling beside a clear spring in the southern part of Fangorn Forest.',
};

const storyDescriptions = {
  'Dracula.pwk': {
    'dracula-loc-london-portal': 'The immense Victorian metropolis linking legal offices, railway termini, hospitals, docks, homes, and crowded streets.',
    'dracula-loc-whitby-portal': 'A Yorkshire port beneath ruined abbey cliffs, with a harbour, churchyard, winding streets, and views over the North Sea.',
    'dracula-loc-demeter-portal': 'The Black Sea, Mediterranean, and Atlantic sea passage from Varna to the Yorkshire coast.',
    'dracula-loc-transylvania-portal': 'The mountainous eastern European region of forests, passes, scattered villages, and old estates surrounding the Borgo road.',
    'dracula-loc-castle-portal': 'An ancient, isolated fortress of towers, courtyards, stairways, and neglected chambers in the Carpathian Mountains.',
    'dracula-loc-purfleet': 'A Thames-side district east of London, combining old estates, river access, roads, and nearby institutions.',
    'dracula-loc-asylum-portal': 'Dr Seward’s private psychiatric institution at Purfleet, arranged around wards, offices, grounds, and staff quarters.',
    'dracula-loc-bermondsey': 'A modest property south of the Thames in a dense district of warehouses, yards, and working streets.',
    'dracula-loc-mile-end': 'An East End property reached through crowded roads and mixed residential districts beyond the City.',
    'dracula-loc-galatz-regional': 'The overland road leaving the Danube port of Galatz toward the river valleys and mountain approaches of Transylvania.',
  },
  'Pride and Prejudice.pwk': {
    'pp-loc-hertfordshire-portal': 'The rural county containing Longbourn, Meryton, and Netherfield, where neighboring estates form a close social world.',
    'pp-loc-london-portal': 'The capital’s network of fashionable streets, commercial districts, lodgings, shops, and family homes.',
    'pp-loc-kent-portal': 'The south-eastern county containing Hunsford parsonage and the great Rosings Park estate.',
    'pp-loc-derbyshire-portal': 'A northern county of market towns, wooded valleys, rocky heights, and the Pemberley estate.',
    'pp-loc-brighton-portal': 'A fashionable Sussex seaside resort and seasonal military station on the English Channel.',
  },
  'Strange Case of Dr Jekyll and Mr Hyde.pwk': {
    'jekyll-hyde-loc-soho-portal': 'A densely built district of narrow streets, lodging houses, shops, and shadowed courts west of the City.',
    'jekyll-hyde-loc-jekyll-portal': 'A prosperous London house whose respectable front rooms connect to a secluded courtyard and rear laboratory wing.',
    'jekyll-hyde-loc-lab-portal': 'A former dissecting theatre and laboratory reached from the courtyard, with a private cabinet above.',
  },
  'The Hound of the Baskervilles.pwk': {
    'hound-loc-london-portal': 'The metropolitan center of the investigation, from Baker Street to hotels, offices, stations, and crowded thoroughfares.',
    'hound-loc-dartmoor-portal': 'A high Devon moorland of tors, bogs, stone circles, isolated farms, and scattered country houses.',
  },
  'The Picture of Dorian Gray.pwk': {
    'dorian-gray-loc-london-portal': 'A late-Victorian metropolis of Mayfair houses, artists’ studios, theatres, clubs, crowded streets, and eastern docks.',
    'dorian-gray-loc-soho-portal': 'A nocturnal route through Soho and the poorer eastern districts toward riverside streets and the docks.',
    'dorian-gray-loc-attic-portal': 'A little-used staircase leading to the locked former schoolroom in the upper part of the house.',
  },
  "The Wise Man's Fear.pwk": {
    'wmf-portal-severen': 'The steeply divided capital of Vintas, with the wealthy upper city of Severen-High overlooking Severen-Low.',
    'wmf-portal-maer-estate': 'Maer Alveron’s guarded residence and court, containing formal rooms, gardens, guest quarters, and service passages.',
    'wmf-portal-eld': 'An old, extensive forest in Vintas crossed by narrow roads, streams, ridges, and isolated clearings.',
    'wmf-portal-fae': 'A realm beyond the mortal world where distance, direction, light, and time obey unfamiliar rules.',
    'wmf-portal-ademre': 'The mountainous homeland of the Adem, including the quiet settlement and training schools of Haert.',
    'wmf-portal-levinshir': 'The rural road running through Pennysworth and the surrounding countryside toward the village of Levinshir.',
  },
};

const filePairs = {
  'Dracula.pwk': 'dracula.pwk',
  'Pride and Prejudice.pwk': 'pride-and-prejudice.pwk',
  'Strange Case of Dr Jekyll and Mr Hyde.pwk': 'strange-case-of-dr-jekyll-and-mr-hyde.pwk',
  'The Hound of the Baskervilles.pwk': 'the-hound-of-the-baskervilles.pwk',
  'The Picture of Dorian Gray.pwk': 'the-picture-of-dorian-gray.pwk',
  "The Wise Man's Fear.pwk": 'the-wise-man-s-fear.pwk',
  'The Fellowship of the Ring.pwk': 'the-fellowship-of-the-ring.pwk',
  'The Two Towers.pwk': 'the-two-towers.pwk',
};

function updateFile(relativePath, descriptions, { byName = false, pretty = false } = {}) {
  const url = new URL(relativePath, ROOT);
  const data = JSON.parse(fs.readFileSync(url, 'utf8'));
  const markers = data.locationMarkers ?? [];
  const seen = new Set();

  for (const marker of markers) {
    const key = byName ? marker.name : marker.id;
    if (Object.hasOwn(descriptions, key)) {
      marker.description = descriptions[key];
      seen.add(key);
    }
  }

  const missing = Object.keys(descriptions).filter((key) => !seen.has(key));
  if (missing.length) throw new Error(`${relativePath}: missing markers: ${missing.join(', ')}`);
  fs.writeFileSync(url, pretty ? `${JSON.stringify(data, null, 2)}\n` : JSON.stringify(data), 'utf8');
  return seen.size;
}

for (const [exampleName, libraryName] of Object.entries(filePairs)) {
  const isTolkien = exampleName === 'The Fellowship of the Ring.pwk' || exampleName === 'The Two Towers.pwk';
  const descriptions = isTolkien ? tolkienDescriptions : storyDescriptions[exampleName];
  const pretty = exampleName === 'Pride and Prejudice.pwk' || exampleName === 'The Hound of the Baskervilles.pwk';
  const options = { byName: isTolkien, pretty };
  const exampleCount = updateFile(`example/${exampleName}`, descriptions, options);
  const libraryCount = updateFile(`public/library/${libraryName}`, descriptions, options);
  if (exampleCount !== libraryCount) throw new Error(`${exampleName}: example/library update count differs`);
  console.log(`${exampleName}: updated ${exampleCount} locations in both copies`);
}
