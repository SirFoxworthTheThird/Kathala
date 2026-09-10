import fs from 'node:fs'

const P = 'iliad', W = `${P}-world`, now = 1799539200000
const id = (kind, slug) => `${P}-${kind}-${slug}`
const base = { worldId: W, createdAt: now, updatedAt: now }
const charId = slug => id('char', slug)
const itemId = slug => id('item', slug)
const locId = slug => id('loc', slug)
const chapterId = n => id('chapter', String(n).padStart(2, '0'))
const eventId = n => id('event', String(n).padStart(3, '0'))
const mapId = id('map', 'troad')
const commons = (name, width = 1200) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}?width=${width}`

const mapImageId = id('image', 'map-troad')
const coverImageId = id('image', 'cover')
const artId = slug => id('image', `art-${slug}`)
const artPath = slug => `library/the-iliad/art/${slug}.jpg`
const locationArt = {
  olympus:'olympians', ida:'troad', troy:'troad', 'scaean-gates':'hector-family', walls:'trojan-house',
  'priam-palace':'trojan-house', 'athena-temple':'trojan-house', plain:'patroclus-battle', scamander:'troad',
  'achaean-camp':'troad', assembly:'achaean-command', 'agamemnon-tent':'achaean-command',
  'achilles-tent':'achilles', ships:'achilles', 'wall-ditch':'patroclus-battle',
  'patroclus-pyre':'patroclus-battle', 'hector-tomb':'hector-family',
}
const characterArt = {
  achilles:'achilles', patroclus:'patroclus-battle', automedon:'patroclus-battle', antilochus:'achaean-command',
  phoenix:'achilles', briseis:'achilles', xanthus:'achilles', thetis:'olympians',
  agamemnon:'achaean-command', menelaus:'achaean-command', odysseus:'achaean-command', diomedes:'achaean-command',
  ajax:'achaean-command', 'ajax-lesser':'achaean-command', nestor:'achaean-command', iphigenia:'achaean-command',
  chryses:'achaean-command', chryseis:'achaean-command', calchas:'achaean-command',
  hector:'hector-family', andromache:'hector-family', astyanax:'hector-family',
  priam:'trojan-house', hecuba:'trojan-house', paris:'trojan-house', helen:'trojan-house', deiphobus:'trojan-house',
  sarpedon:'patroclus-battle', glaucus:'patroclus-battle', aeneas:'patroclus-battle', polydamas:'trojan-house',
  dolon:'patroclus-battle', pandarus:'patroclus-battle', euphorbus:'patroclus-battle',
  apollo:'olympians', athena:'olympians', zeus:'olympians', hera:'olympians', poseidon:'olympians',
  aphrodite:'olympians', ares:'olympians', hephaestus:'olympians', hermes:'olympians', iris:'olympians',
  'scamander-god':'olympians',
}
const itemArt = {
  'achilles-armour':'achilles', 'new-armour':'objects', shield:'objects', 'agamemnon-sceptre':'objects',
  'achilles-spear':'objects', 'hector-helmet':'hector-family', 'chryses-ransom':'objects', belt:'objects',
  'palladium-robe':'objects', 'patroclus-body':'patroclus-battle', 'hector-body':'cover', 'funeral-prizes':'objects',
}
const mapLayers = [{ ...base, id: mapId, parentMapId: null, name: 'Troy and the Achaean Shore', description: 'An interpretive theatre map for the plain of Troy, the city, the Achaean camp, Mount Ida, and the surrounding coast.', imageId: mapImageId, imageWidth: 1200, imageHeight: 686, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '' }]

const locDefs = [
  ['olympus', 'Mount Olympus', 'The divine council from which the gods debate, restrain, and redirect the war.', 820, 105, 'landmark'],
  ['ida', 'Mount Ida', 'The height overlooking Troy where Zeus watches the armies and Hera distracts him.', 930, 185, 'mountain'],
  ['troy', 'Troy', 'Priam’s walled city, containing the royal household, temples, gates, towers, and streets.', 965, 345, 'city'],
  ['scaean-gates', 'Scaean Gates', 'Troy’s principal western gate and the threshold of Hector’s final return and death.', 905, 385, 'landmark'],
  ['walls', 'Walls of Troy', 'The battlements from which Priam, Helen, Andromache, and the Trojan elders watch the war.', 940, 320, 'landmark'],
  ['priam-palace', 'Palace of Priam', 'The royal household shared by Priam, Hecuba, their children, and their children’s families.', 1010, 300, 'building'],
  ['athena-temple', 'Temple of Athena', 'The Trojan sanctuary where Hecuba and the women petition a goddess committed to their defeat.', 1040, 350, 'building'],
  ['plain', 'Plain of Troy', 'The open ground between city and sea where most duels, routs, rescues, and mass battles occur.', 750, 430, 'region'],
  ['scamander', 'River Scamander', 'The divine river of the Trojan plain, choked by Achilles’ slaughter until it rises against him.', 800, 500, 'river'],
  ['achaean-camp', 'Achaean Camp', 'The fortified encampment beside the ships, divided among the contingents of the Greek coalition.', 420, 440, 'settlement'],
  ['assembly', 'Achaean Assembly', 'The meeting ground where kings contest authority before the gathered army.', 455, 395, 'landmark'],
  ['agamemnon-tent', 'Agamemnon’s Quarters', 'The high king’s command quarters and the centre of embassies, councils, and disputed prizes.', 390, 390, 'building'],
  ['achilles-tent', 'Achilles’ Camp', 'The Myrmidon sector beside Achilles’ ships, where withdrawal, embassy, grief, and reconciliation unfold.', 300, 470, 'building'],
  ['ships', 'Achaean Ships', 'The beached fleet whose preservation is the army’s final defensive necessity.', 270, 520, 'coast'],
  ['wall-ditch', 'Achaean Wall and Ditch', 'The improvised fortification protecting the camp and ships from Hector’s assault.', 520, 470, 'fortress'],
  ['patroclus-pyre', 'Patroclus’ Funeral Pyre', 'The ground where Achilles conducts the funeral and games for his companion.', 335, 415, 'landmark'],
  ['hector-tomb', 'Hector’s Tomb', 'The guarded grave raised by the Trojans after the ransom and funeral truce.', 1005, 400, 'landmark'],
]
const locationMarkers = locDefs.map(([slug, name, description, x, y, iconType]) => ({ ...base, id: locId(slug), mapLayerId: mapId, linkedMapLayerId: null, name, description, x, y, imageId: artId(locationArt[slug]), iconType, tags: [], factionId: null }))

const characterDefs = [
  ['achilles', 'Achilles', 'The greatest Achaean fighter, whose injured honour turns withdrawal into catastrophe and grief into annihilating rage.'],
  ['agamemnon', 'Agamemnon', 'High king of the Achaean coalition, powerful enough to command the expedition and proud enough to endanger it.'],
  ['hector', 'Hector', 'Troy’s foremost defender, husband and father, carrying the city’s survival as a personal obligation.'],
  ['patroclus', 'Patroclus', 'Achilles’ closest companion, whose compassion draws him into borrowed armour and a fatal excess of success.'],
  ['priam', 'Priam', 'Aged king of Troy who endures the deaths of his sons and crosses the enemy camp to recover Hector.'],
  ['hecuba', 'Hecuba', 'Queen of Troy and mother of Hector and Paris, fierce in grief and clear-eyed about the cost of war.'],
  ['andromache', 'Andromache', 'Hector’s wife, already bereaved by Achilles and terrified that Troy will make her a widow and captive.'],
  ['astyanax', 'Astyanax', 'Infant son of Hector and Andromache, symbol of Troy’s threatened future.'],
  ['paris', 'Paris', 'Trojan prince whose taking of Helen caused the expedition, beautiful and dangerous but repeatedly judged against Hector.'],
  ['helen', 'Helen', 'Spartan queen living in Troy, desired as a prize and painfully conscious of the destruction attached to her.'],
  ['menelaus', 'Menelaus', 'King of Sparta, Helen’s husband, and the warrior most personally invested in the war’s declared cause.'],
  ['odysseus', 'Odysseus', 'King of Ithaca and the coalition’s most adaptable speaker, planner, scout, and fighter.'],
  ['diomedes', 'Diomedes', 'Young Argive king whose battle fury carries him beyond mortal opponents to wound gods.'],
  ['ajax', 'Ajax the Great', 'Massive Salaminian defender who repeatedly holds the Achaean line when other champions fail.'],
  ['ajax-lesser', 'Ajax the Lesser', 'Swift Locrian commander who fights beside the greater Ajax.'],
  ['nestor', 'Nestor', 'Elder king of Pylos whose memory, counsel, and stories mediate among younger commanders.'],
  ['iphigenia', 'Iphigenia', 'Agamemnon’s absent daughter, whose sacrifice at Aulis shadows the expedition outside the poem’s immediate action.'],
  ['briseis', 'Briseis', 'Captive woman awarded to Achilles and seized by Agamemnon, treated publicly as the measure of male honour.'],
  ['chryses', 'Chryses', 'Priest of Apollo whose rejected ransom brings plague upon the Achaean camp.'],
  ['chryseis', 'Chryseis', 'Chryses’ captive daughter and Agamemnon’s disputed war prize.'],
  ['calchas', 'Calchas', 'Achaean seer who identifies Apollo’s grievance after Achilles guarantees his safety.'],
  ['phoenix', 'Phoenix', 'Achilles’ old tutor and foster-father, sent to recall him to affection, duty, and mercy.'],
  ['automedon', 'Automedon', 'Achilles’ charioteer, later driving the immortal horses for Patroclus.'],
  ['antilochus', 'Antilochus', 'Nestor’s swift son, a young fighter and the messenger who tells Achilles of Patroclus’ death.'],
  ['sarpedon', 'Sarpedon', 'Son of Zeus and Lycian king, whose death tests the boundary between divine love and mortal fate.'],
  ['glaucus', 'Glaucus', 'Lycian captain and Sarpedon’s comrade, bound to Diomedes by inherited guest-friendship.'],
  ['aeneas', 'Aeneas', 'Trojan ally and son of Aphrodite, repeatedly preserved for a destiny beyond the present city.'],
  ['deiphobus', 'Deiphobus', 'Trojan prince whose likeness Athena uses to deceive Hector before the final duel.'],
  ['polydamas', 'Polydamas', 'Trojan counsellor whose sound strategic warnings Hector repeatedly overrides.'],
  ['dolon', 'Dolon', 'Trojan scout captured during a night mission and compelled to disclose the enemy dispositions.'],
  ['pandarus', 'Pandarus', 'Trojan archer persuaded to break the truce by shooting Menelaus.'],
  ['euphorbus', 'Euphorbus', 'Trojan who wounds the disoriented Patroclus before Hector delivers the final blow.'],
  ['apollo', 'Apollo', 'Divine defender of Troy, sender of plague and the power that strips Patroclus of armour and sense.'],
  ['athena', 'Athena', 'Divine champion of the Achaeans, restraining Achilles at first and deceiving Hector at the end.'],
  ['zeus', 'Zeus', 'Supreme divine arbiter who honours Thetis’ request while ensuring that fate remains binding.'],
  ['hera', 'Hera', 'Relentless divine enemy of Troy who manipulates Zeus to restore Achaean advantage.'],
  ['poseidon', 'Poseidon', 'God who secretly rallies the Achaeans when Zeus forbids open divine intervention.'],
  ['aphrodite', 'Aphrodite', 'Paris’ protector and Helen’s coercive divine mistress, wounded while rescuing Aeneas.'],
  ['ares', 'Ares', 'God of battle who joins the Trojan attack and is wounded by Diomedes with Athena’s aid.'],
  ['thetis', 'Thetis', 'Sea goddess and Achilles’ mother, able to obtain divine honour for him but unable to prevent his early death.'],
  ['hephaestus', 'Hephaestus', 'Divine smith who forges Achilles’ replacement armour and combats the river with fire.'],
  ['hermes', 'Hermes', 'Divine guide who conducts Priam safely through the Achaean camp.'],
  ['iris', 'Iris', 'Divine messenger carrying commands between Olympus, Troy, and the battlefield.'],
  ['xanthus', 'Xanthus', 'Immortal horse of Achilles, briefly given speech to foretell his master’s death.'],
  ['scamander-god', 'Scamander', 'River god who rises against Achilles when corpses obstruct his waters.'],
]
const dead = new Set(['hector', 'patroclus', 'sarpedon', 'dolon', 'pandarus', 'euphorbus'])
const characters = characterDefs.map(([slug, name, description]) => ({ ...base, id: charId(slug), name, aliases: [], description, portraitImageId: artId(characterArt[slug]), color: '#7c6652', tags: [], isAlive: !dead.has(slug), birthDate: null }))

const itemDefs = [
  ['achilles-armour', 'First Armour of Achilles', 'Armour carried from Peleus, lent to Patroclus, taken by Hector, and destined to outlive each wearer.', 'shield'],
  ['new-armour', 'Armour Forged by Hephaestus', 'Divine replacement armour made for Achilles after Hector captures the first set.', 'shield'],
  ['shield', 'Shield of Achilles', 'Hephaestus’ cosmic shield depicting cities, labour, judgment, war, dance, and the encircling Ocean.', 'circle'],
  ['agamemnon-sceptre', 'Sceptre of Agamemnon', 'An inherited emblem of command passed from Zeus through the royal line.', 'wand'],
  ['achilles-spear', 'Spear of Peleus', 'The heavy Pelian-ash spear that Patroclus cannot wield and Achilles carries against Hector.', 'sword'],
  ['hector-helmet', 'Hector’s Horsehair-Crested Helmet', 'The frightening helmet removed when its nodding crest makes the infant Astyanax cry.', 'shield'],
  ['chryses-ransom', 'Ransom of Chryses', 'Rich payment offered for Chryseis and rejected before Apollo sends the plague.', 'gift'],
  ['belt', 'Ajax and Hector’s Gifts', 'A sword and belt exchanged after their inconclusive duel as tokens of mutual respect.', 'link'],
  ['palladium-robe', 'Hecuba’s Robe', 'The richest robe in Troy, offered to Athena in a rejected appeal for protection.', 'scroll'],
  ['patroclus-body', 'Body of Patroclus', 'The contested body around which Achaeans and Trojans fight after the armour is stripped.', 'heart'],
  ['hector-body', 'Body of Hector', 'Hector’s corpse, abused beside Patroclus’ tomb and ultimately ransomed to Priam.', 'heart'],
  ['funeral-prizes', 'Funeral Games Prizes', 'Tripods, horses, armour, women, metal, and crafted goods distributed in Patroclus’ honour.', 'trophy'],
]
const items = itemDefs.map(([slug, name, description, iconType]) => ({ ...base, id: itemId(slug), name, description, iconType, imageId: itemArt[slug] === 'cover' ? coverImageId : artId(itemArt[slug]), tags: [] }))

const books = [
  ['The Quarrel', 'Apollo’s plague exposes the conflict between public command and heroic honour; Agamemnon takes Briseis, and Achilles withdraws.'],
  ['The Dream and the Catalogue', 'Zeus sends a deceptive dream, the army nearly sails home, and the assembled forces of Achaea and Troy are named.'],
  ['The Duel for Helen', 'Paris and Menelaus agree to settle the war in single combat, but Aphrodite removes Paris from defeat.'],
  ['The Truce Is Broken', 'Athena engineers a broken oath; Agamemnon rallies the wounded coalition and general battle resumes.'],
  ['Diomedes’ Aristeia', 'Athena empowers Diomedes to distinguish gods from mortals; he wounds Aphrodite and Ares.'],
  ['Hector Returns to Troy', 'The battlefield pauses around acts of inherited friendship while Hector visits the city, Helen, Paris, Andromache, and Astyanax.'],
  ['Ajax Fights Hector', 'Divine pressure drives battle toward an inconclusive duel between the foremost available champions.'],
  ['The Trojans Reach the Camp', 'Zeus forbids divine aid and grants Hector a decisive advance that confines the Achaeans behind their wall.'],
  ['The Embassy to Achilles', 'Agamemnon offers restitution; Odysseus, Phoenix, and Ajax ask Achilles to return, but he refuses.'],
  ['The Night Raid', 'Diomedes and Odysseus capture Dolon, learn the Trojan dispositions, and raid the newly arrived Thracians.'],
  ['The Achaean Leaders Fall', 'Agamemnon’s offensive collapses as successive commanders are wounded and Hector drives toward the ships.'],
  ['The Battle at the Wall', 'Hector rejects Polydamas’ omen and smashes through the Achaean gate with a stone.'],
  ['The Battle at the Ships', 'Poseidon rallies the defenders while Zeus is distracted; Hector and Ajax contest the line before the fleet.'],
  ['Zeus Is Deceived', 'Hera seduces and sleeps Zeus, allowing Poseidon to help the Achaeans drive Hector back.'],
  ['The Fire at the Ships', 'Zeus restores Trojan momentum; Hector reaches the fleet and sets one ship ablaze.'],
  ['Patroclus Enters Battle', 'Patroclus borrows Achilles’ identity, saves the ships, kills Sarpedon, and exceeds the limit placed upon him.'],
  ['The Body of Patroclus', 'Menelaus, the Ajaxes, and their allies preserve Patroclus’ corpse while Hector takes Achilles’ armour.'],
  ['Achilles Learns the News', 'Grief ends Achilles’ withdrawal; Thetis promises new armour and his unarmed appearance terrifies the Trojans.'],
  ['Reconciliation', 'Achilles and Agamemnon settle their quarrel; Briseis mourns, the army eats, and the immortal horse foretells death.'],
  ['The Gods Return to Battle', 'Zeus releases the gods to fight while Achilles pursues Hector and nearly meets Aeneas.'],
  ['Achilles and the River', 'Achilles’ slaughter provokes Scamander, and a divine battle erupts around his escape from the flood.'],
  ['The Death of Hector', 'Apollo preserves Troy’s retreat; Athena deceives Hector, Achilles kills him, and the corpse is dragged away.'],
  ['The Funeral Games', 'Patroclus receives funeral rites and Achilles manages contests that expose rivalry, honour, skill, and reconciliation.'],
  ['Priam and Achilles', 'The gods compel ransom; Priam appeals to Achilles as a grieving father, and Troy buries Hector.'],
]

const E = (title, description, location, involved, mentioned = [], involvedItems = [], tension = 3, pov = involved[0]) => ({ title, description, location, involved, mentioned, involvedItems, tension, pov })
const eventBooks = [
  [E('The Priest Is Rejected', 'Agamemnon rejects Chryses’ ransom and humiliates Apollo’s priest before the army.', 'achaean-camp', ['agamemnon','chryses'], ['chryseis','apollo'], ['chryses-ransom'], 3), E('The Plague and the Assembly', 'After nine days of plague Achilles calls an assembly; Calchas identifies the offence and demands Chryseis’ return.', 'assembly', ['achilles','agamemnon','calchas'], ['apollo','chryses','chryseis'], [], 4), E('Briseis Is Taken', 'Agamemnon’s heralds remove Briseis; Achilles refuses battle while Thetis asks Zeus to honour him through Achaean suffering.', 'achilles-tent', ['achilles','briseis','thetis'], ['agamemnon','zeus'], [], 5)],
  [E('Zeus Sends the False Dream', 'Zeus instructs a dream to promise Agamemnon immediate victory, beginning the fulfilment of Thetis’ request.', 'agamemnon-tent', ['zeus','agamemnon'], ['thetis'], [], 3, 'zeus'), E('The Army Runs for the Ships', 'Agamemnon’s test of morale becomes a rout toward home until Athena sends Odysseus to restore the assembly.', 'ships', ['agamemnon','odysseus','athena'], ['hera'], ['agamemnon-sceptre'], 4, 'odysseus'), E('The Armies Are Counted', 'The poem surveys the Achaean contingents and Trojan allies as both coalitions prepare for battle.', 'plain', ['agamemnon','hector','menelaus','odysseus','ajax'], ['paris','aeneas','sarpedon'], [], 3)],
  [E('Paris Challenges the Achaeans', 'Paris steps before the Trojan line, recoils from Menelaus, and accepts Hector’s rebuke.', 'plain', ['paris','menelaus','hector'], ['helen'], [], 3, 'paris'), E('Helen Names the Achaean Kings', 'From the walls Helen identifies Agamemnon, Odysseus, Ajax, and other former guests for Priam.', 'walls', ['helen','priam'], ['agamemnon','odysseus','ajax','menelaus'], [], 2, 'helen'), E('Aphrodite Rescues Paris', 'Menelaus wins the duel in substance, but Aphrodite carries Paris to his chamber and compels Helen to join him.', 'troy', ['menelaus','paris','aphrodite','helen'], ['agamemnon'], [], 4, 'menelaus')],
  [E('Athena Tempts Pandarus', 'At Zeus’ direction Athena persuades Pandarus to shoot Menelaus and make the Trojans oath-breakers.', 'plain', ['athena','pandarus','menelaus'], ['zeus'], [], 4, 'pandarus'), E('Agamemnon Reviews the Line', 'Menelaus’ wound is treated while Agamemnon moves among the contingents, praising or provoking their leaders.', 'plain', ['agamemnon','menelaus','odysseus','diomedes','nestor'], ['pandarus'], [], 3, 'agamemnon'), E('The Armies Collide', 'The broken truce gives way to collective battle as gods and mortals push the two lines together.', 'plain', ['ajax','diomedes','hector','aeneas'], ['athena','apollo','ares'], [], 5, 'diomedes')],
  [E('Diomedes Is Empowered', 'Athena grants Diomedes extraordinary force and the sight needed to distinguish gods on the field.', 'plain', ['diomedes','athena'], ['ares','aphrodite','apollo'], [], 4, 'diomedes'), E('Aeneas and Pandarus Attack', 'Pandarus wounds Diomedes, but the Argive kills him and nearly kills Aeneas.', 'plain', ['diomedes','aeneas','pandarus'], ['aphrodite'], [], 5, 'diomedes'), E('Gods Are Wounded', 'Diomedes wounds Aphrodite while she rescues Aeneas, then strikes Ares with Athena guiding the spear.', 'plain', ['diomedes','athena','aphrodite','ares'], ['aeneas','zeus'], [], 5, 'diomedes')],
  [E('Diomedes and Glaucus', 'The enemies discover that their grandfathers exchanged hospitality and trade armour rather than fight.', 'plain', ['diomedes','glaucus'], ['sarpedon'], [], 2, 'diomedes'), E('The Trojan Women Petition Athena', 'Hector directs Hecuba to offer Troy’s richest robe, but Athena rejects the prayer.', 'athena-temple', ['hecuba','hector','athena'], ['diomedes'], ['palladium-robe'], 3, 'hecuba'), E('Hector Says Farewell', 'Hector meets Andromache and Astyanax at the gates, removes his frightening helmet, and refuses to abandon the city.', 'scaean-gates', ['hector','andromache','astyanax'], ['achilles'], ['hector-helmet'], 4, 'hector')],
  [E('Hector and Paris Return', 'The brothers rejoin the Trojan attack and force the Achaeans back across the plain.', 'plain', ['hector','paris'], ['apollo','athena'], [], 4, 'hector'), E('Hector Challenges a Champion', 'Nine Achaeans volunteer; the lot selects Ajax to meet Hector in single combat.', 'plain', ['hector','ajax','agamemnon','nestor'], [], [], 4, 'ajax'), E('The Duel Ends at Nightfall', 'Neither champion can win before heralds stop the fight; Hector and Ajax exchange gifts.', 'plain', ['hector','ajax'], ['priam','agamemnon'], ['belt'], 3, 'ajax')],
  [E('Zeus Forbids Divine Aid', 'Zeus threatens the Olympians and weighs the fates of the armies before sending the Achaeans into retreat.', 'olympus', ['zeus','athena','hera'], ['hector'], [], 3, 'zeus'), E('Hector Drives the Rout', 'A thunderbolt confirms Zeus’ will as Hector presses the Greeks toward their ditch and wall.', 'wall-ditch', ['hector','ajax','diomedes','odysseus'], ['zeus','nestor'], [], 5, 'hector'), E('Trojan Fires Fill the Plain', 'Hector refuses to withdraw into Troy; the Trojans camp beside hundreds of fires, waiting to attack the ships.', 'plain', ['hector','polydamas','paris'], ['achilles'], [], 4, 'hector')],
  [E('Agamemnon Offers Restitution', 'The shaken king lists gifts, cities, and Briseis herself as payment if Achilles returns.', 'agamemnon-tent', ['agamemnon','nestor','odysseus'], ['achilles','briseis'], [], 3, 'agamemnon'), E('The Embassy Appeals to Achilles', 'Odysseus reports the offer and Phoenix appeals through memory and story, but Achilles refuses to exchange life for honour.', 'achilles-tent', ['achilles','odysseus','phoenix','ajax'], ['agamemnon','patroclus'], [], 4, 'achilles'), E('Ajax Condemns the Refusal', 'Ajax accuses Achilles of rejecting the bonds that compensation should restore; the embassy returns without him.', 'achilles-tent', ['ajax','achilles','patroclus'], ['agamemnon'], [], 4, 'ajax')],
  [E('The Two Scouts Depart', 'Diomedes chooses Odysseus for a night reconnaissance while Hector sends Dolon toward the ships.', 'wall-ditch', ['diomedes','odysseus','dolon','hector'], ['athena'], [], 3, 'odysseus'), E('Dolon Is Captured', 'The Achaeans cut off Dolon’s retreat and compel him to reveal Trojan positions and the arrival of the Thracians.', 'plain', ['diomedes','odysseus','dolon'], ['hector'], [], 4, 'odysseus'), E('The Thracian Camp Is Raided', 'Diomedes kills the sleeping Thracians while Odysseus takes their king’s horses before Apollo raises the alarm.', 'plain', ['diomedes','odysseus','apollo'], ['hector'], [], 5, 'diomedes')],
  [E('Agamemnon’s Offensive', 'Agamemnon arms magnificently and drives deep into the Trojan ranks before he is wounded.', 'plain', ['agamemnon','hector'], ['zeus','iris'], [], 5, 'agamemnon'), E('The Champions Are Wounded', 'Diomedes, Odysseus, and the healer Machaon leave the fight, stripping the defence of its mobile leaders.', 'plain', ['diomedes','odysseus','ajax','hector'], ['nestor'], [], 5, 'odysseus'), E('Patroclus Leaves Achilles', 'Sent to learn who has been wounded, Patroclus hears Nestor’s proposal that he enter battle in Achilles’ armour.', 'achaean-camp', ['patroclus','nestor'], ['achilles'], ['achilles-armour'], 3, 'patroclus')],
  [E('The Omen of the Eagle', 'An eagle drops a bleeding snake among the Trojans; Polydamas urges retreat, but Hector rejects the warning.', 'wall-ditch', ['hector','polydamas'], ['zeus'], [], 4, 'polydamas'), E('Sarpedon Attacks the Wall', 'Sarpedon rebukes Glaucus into living up to the privileges of kingship and leads the Lycians against the fortification.', 'wall-ditch', ['sarpedon','glaucus','ajax'], ['zeus'], [], 5, 'sarpedon'), E('Hector Breaks the Gate', 'Hector lifts a huge stone and smashes the barred gate, opening the camp to the Trojan army.', 'wall-ditch', ['hector','polydamas','ajax'], ['zeus'], [], 5, 'hector')],
  [E('Poseidon Rallies the Achaeans', 'Disguised among the fighters, Poseidon restores confidence to the Ajaxes and the defensive line.', 'ships', ['poseidon','ajax','ajax-lesser'], ['zeus','hector'], [], 4, 'ajax'), E('Idomeneus Holds the Left', 'The Achaean defence stabilizes through a long counterattack while the gods sustain opposing sides.', 'plain', ['ajax','diomedes','aeneas'], ['poseidon','zeus'], [], 4, 'ajax'), E('Hector Meets the Shield Wall', 'Hector confronts the densest Achaean formation as missiles and close combat consume both sides.', 'ships', ['hector','ajax','polydamas'], ['poseidon'], [], 5, 'hector')],
  [E('Hera Borrows Aphrodite’s Power', 'Hera deceives Aphrodite into lending the force of desire, then recruits Sleep to overcome Zeus.', 'olympus', ['hera','aphrodite','zeus'], ['poseidon'], [], 3, 'hera'), E('Zeus Sleeps on Ida', 'Hera distracts Zeus on Mount Ida while Sleep carries word that Poseidon may openly aid the Greeks.', 'ida', ['hera','zeus','poseidon'], [], [], 4, 'hera'), E('Hector Is Struck Down', 'Ajax hits Hector with a boulder, and the reinvigorated Achaeans drive the Trojans away from the ships.', 'plain', ['ajax','hector','poseidon'], ['hera','zeus'], [], 5, 'ajax')],
  [E('Zeus Restores the Plan', 'Awaking in anger, Zeus sends Iris and Apollo to remove Poseidon and revive Hector.', 'ida', ['zeus','hera','iris','apollo'], ['poseidon','hector'], [], 4, 'zeus'), E('Apollo Destroys the Defences', 'Apollo carries terror before Hector, breaks the Achaean wall, and opens a level path to the fleet.', 'wall-ditch', ['apollo','hector','ajax'], ['zeus'], [], 5, 'hector'), E('Fire Reaches a Ship', 'Ajax defends the decks with a long pike, but Hector cuts down the resistance and calls for fire.', 'ships', ['hector','ajax'], ['patroclus','achilles'], [], 5, 'ajax')],
  [E('Patroclus Borrows the Armour', 'Weeping for the army, Patroclus receives Achilles’ armour and command of the Myrmidons, with strict orders to return after saving the ships.', 'achilles-tent', ['patroclus','achilles','automedon'], ['briseis'], ['achilles-armour'], 4, 'patroclus'), E('Sarpedon Falls', 'Patroclus kills Zeus’ mortal son; Glaucus rallies the Lycians, and Apollo preserves the body for burial.', 'plain', ['patroclus','sarpedon','glaucus','zeus','apollo'], ['hector'], ['achilles-armour'], 5, 'patroclus'), E('Patroclus Is Killed', 'Apollo stuns and strips Patroclus, Euphorbus wounds him, and Hector claims the final blow as Patroclus foretells his death.', 'plain', ['patroclus','apollo','euphorbus','hector'], ['achilles'], ['achilles-armour','patroclus-body'], 5, 'patroclus')],
  [E('Menelaus Guards the Body', 'Menelaus kills Euphorbus and calls Ajax to defend Patroclus while Hector puts on Achilles’ captured armour.', 'plain', ['menelaus','ajax','hector','euphorbus'], ['patroclus','achilles'], ['achilles-armour','patroclus-body'], 5, 'menelaus'), E('The Immortal Horses Mourn', 'Xanthus and Balius refuse to move for grief until Zeus gives them strength and Automedon returns to the fight.', 'plain', ['automedon','xanthus','zeus'], ['patroclus','achilles'], [], 3, 'automedon'), E('The Body Is Carried Away', 'The Ajaxes hold the Trojans while Menelaus and Meriones bear Patroclus toward the ships.', 'ships', ['ajax','ajax-lesser','menelaus','hector'], ['patroclus'], ['patroclus-body'], 5, 'ajax')],
  [E('Antilochus Brings the News', 'Antilochus tells Achilles that Patroclus is dead and the armour lost; Achilles collapses into public grief.', 'achilles-tent', ['antilochus','achilles'], ['patroclus','hector'], ['patroclus-body'], 5, 'achilles'), E('Thetis Promises New Armour', 'Thetis hears her son’s lament and agrees to seek armour from Hephaestus, knowing revenge will hasten his death.', 'achilles-tent', ['thetis','achilles'], ['hephaestus','hector'], [], 4, 'thetis'), E('Achilles Appears at the Ditch', 'Unarmed but crowned by Athena’s radiance, Achilles shouts three times and helps the Achaeans recover Patroclus.', 'wall-ditch', ['achilles','athena','iris','hector'], ['patroclus'], [], 5, 'achilles')],
  [E('Hephaestus Forges the Shield', 'At Thetis’ request Hephaestus makes armour whose shield contains an ordered world larger than the war.', 'olympus', ['hephaestus','thetis'], ['achilles'], ['new-armour','shield'], 3, 'hephaestus'), E('Achilles and Agamemnon Reconcile', 'Before the army Agamemnon blames delusion, returns Briseis and gifts, and Achilles subordinates the dispute to battle.', 'assembly', ['achilles','agamemnon','briseis','odysseus'], ['patroclus'], ['new-armour'], 4, 'achilles'), E('Xanthus Foretells Achilles’ Death', 'Hera gives the immortal horse speech; it denies responsibility for Patroclus and predicts Achilles’ approaching death.', 'ships', ['achilles','xanthus','hera'], ['patroclus','apollo'], ['new-armour','achilles-spear'], 4, 'achilles')],
  [E('Zeus Releases the Gods', 'Zeus allows every god to enter battle so Achilles cannot destroy Troy before its appointed time.', 'olympus', ['zeus','athena','hera','poseidon','apollo','ares','aphrodite'], ['achilles','hector'], [], 4, 'zeus'), E('Aeneas Faces Achilles', 'Apollo urges Aeneas to stand, but Poseidon rescues him because his future must survive Troy.', 'plain', ['achilles','aeneas','apollo','poseidon'], ['zeus'], ['achilles-spear','new-armour'], 5, 'achilles'), E('Achilles Hunts Hector', 'Achilles kills Trojan fighters and searches through the collapsing line for Hector, whom Apollo repeatedly protects.', 'plain', ['achilles','hector','apollo'], ['priam'], ['achilles-spear'], 5, 'achilles')],
  [E('Achilles Fills the River', 'Achilles divides the Trojans and kills so many in Scamander that the river complains of obstruction.', 'scamander', ['achilles','scamander-god'], ['apollo'], ['achilles-spear'], 5, 'achilles'), E('Scamander Attacks Achilles', 'The river overwhelms the plain and nearly drowns Achilles until Hera orders Hephaestus to answer water with fire.', 'scamander', ['achilles','scamander-god','hera','hephaestus'], ['zeus'], [], 5, 'achilles'), E('The Gods Fight', 'Athena defeats Ares and Aphrodite while Hera humiliates Artemis; Apollo refuses to fight Poseidon over mortals.', 'plain', ['athena','ares','aphrodite','hera','poseidon','apollo'], ['zeus'], [], 4, 'athena')],
  [E('Apollo Saves the Trojan Army', 'Apollo impersonates Agenor and draws Achilles away long enough for the Trojans to enter the city.', 'scaean-gates', ['apollo','achilles','hector'], ['priam'], [], 4, 'apollo'), E('Athena Deceives Hector', 'Hector remains outside the gates, runs three circuits from Achilles, and finally stops when Athena appears as Deiphobus.', 'walls', ['hector','achilles','athena','deiphobus'], ['priam','hecuba','andromache'], ['new-armour','achilles-spear'], 5, 'hector'), E('Achilles Kills Hector', 'Athena returns Achilles’ spear; Hector realizes the deception, fights alone, and dies after foretelling Achilles’ fate.', 'scaean-gates', ['achilles','hector','athena'], ['apollo','patroclus'], ['hector-body','new-armour','achilles-spear'], 5, 'hector')],
  [E('Patroclus Appears in a Dream', 'The unburied shade asks Achilles for immediate rites and reminds him that their ashes should rest together.', 'achilles-tent', ['achilles','patroclus'], ['hector'], ['patroclus-body'], 4, 'achilles'), E('Patroclus Is Burned', 'The Myrmidons mourn, sacrifices are made, and Achilles prays to the winds to consume the pyre.', 'patroclus-pyre', ['achilles','thetis','agamemnon'], ['patroclus'], ['patroclus-body'], 4, 'achilles'), E('The Funeral Games', 'Chariot racing, boxing, wrestling, running, combat, weight throwing, archery, and spear casting redistribute honour under Achilles’ judgment.', 'patroclus-pyre', ['achilles','diomedes','ajax','odysseus','antilochus','menelaus'], ['nestor'], ['funeral-prizes'], 3, 'achilles')],
  [E('The Gods Demand Ransom', 'Apollo condemns the abuse of Hector’s body; Zeus sends Thetis to Achilles and Iris to Priam.', 'olympus', ['apollo','zeus','thetis','iris'], ['achilles','priam','hector'], ['hector-body'], 3, 'zeus'), E('Priam Enters Achilles’ Tent', 'Guided by Hermes, Priam kisses the hands that killed his sons and asks Achilles to remember his own father.', 'achilles-tent', ['priam','hermes','achilles'], ['hector','thetis'], ['hector-body'], 5, 'priam'), E('Troy Buries Hector', 'Achilles grants a truce; Andromache, Hecuba, and Helen lament Hector before the Trojans burn and entomb him.', 'hector-tomb', ['andromache','hecuba','helen','priam'], ['hector','achilles','astyanax'], ['hector-body'], 4, 'andromache')],
]

const timelines = [{ id: id('timeline', 'wrath'), worldId: W, name: 'The Wrath of Achilles', description: 'The continuous action from Apollo’s plague through Hector’s burial in the tenth year of the war.', color: '#9b4d3f', dayOffset: 0, createdAt: now }]
const chapters = books.map(([title, synopsis], i) => ({ ...base, id: chapterId(i + 1), timelineId: timelines[0].id, number: i + 1, title, synopsis, notes: `Book ${i + 1} of the epic.`, wordGoal: null }))
let n = 0
const events = eventBooks.flatMap((group, bi) => group.map((e, ei) => ({ ...base, id: eventId(++n), chapterId: chapterId(bi + 1), timelineId: timelines[0].id, title: e.title, description: e.description, locationMarkerId: locId(e.location), involvedCharacterIds: e.involved.map(charId), mentionedCharacterIds: e.mentioned.map(charId), involvedItemIds: e.involvedItems.map(itemId), tags: [], threadIds: [], motifIds: [], sortOrder: ei, travelDays: 0, inWorldTime: bi * 3 + ei, tension: e.tension, structureBeat: null, status: 'complete', povCharacterId: charId(e.pov), isFlashback: false, elapsedTime: ei === 0 ? 'Hours' : 'Moments', importance: e.tension >= 5 ? 3 : e.tension >= 3 ? 2 : 1, sequence: ei, notes: '' })))
const chapterFirst = book => events.find(e => e.chapterId === chapterId(book)).id
const chapterLast = book => [...events].reverse().find(e => e.chapterId === chapterId(book)).id

const locMap = new Map(locationMarkers.map(l => [l.id, l]))
const characterSnapshots = events.flatMap((event, eventIndex) => event.involvedCharacterIds.map((characterId, j) => ({ ...base, id: id('snapshot', `${eventIndex + 1}-${j + 1}`), characterId, eventId: event.id, isAlive: !(dead.has(characterId.replace('iliad-char-', '')) && event.id > chapterLast(characterId.endsWith('patroclus') ? 16 : characterId.endsWith('hector') ? 22 : 24)), currentLocationMarkerId: event.locationMarkerId, currentMapLayerId: locMap.get(event.locationMarkerId).mapLayerId, locationMarkerId: event.locationMarkerId, inventoryItemIds: event.involvedItemIds, inventoryNotes: '', travelModeId: null, sortKey: eventIndex + j / 100, statusNotes: `Present and consequential during “${event.title}”.` })))
const itemPlacements = events.flatMap((event, eventIndex) => event.involvedItemIds.map((iid, j) => ({ ...base, id: id('placement', `${eventIndex + 1}-${j + 1}`), itemId: iid, eventId: event.id, locationMarkerId: event.locationMarkerId, sortKey: j, notes: `Active in “${event.title}”.` })))

const relationshipDefs = [
  ['achilles','agamemnon','rival claimants to honour',5,'negative','Their quarrel separates supreme command from supreme fighting ability and structures the entire poem.'],
  ['achilles','patroclus','beloved companions',5,'positive','Patroclus can move Achilles through affection when public obligation and compensation fail.'],
  ['achilles','thetis','mortal son and divine mother',5,'positive','Thetis can secure honour and armour but cannot cancel the early death Achilles accepts.'],
  ['achilles','hector','avenger and doomed defender',5,'negative','Patroclus’ death turns Hector into the single object of Achilles’ grief and rage.'],
  ['hector','andromache','husband and wife',5,'positive','Their tenderness is inseparable from the civic duty that will destroy their household.'],
  ['hector','priam','son and father',5,'positive','Hector carries Priam’s city in battle; Priam later crosses the enemy camp to recover him.'],
  ['hector','paris','brothers under unequal burdens',4,'mixed','Hector depends upon and condemns the brother whose choices brought the war.'],
  ['paris','helen','lovers bound by war and divine coercion',4,'mixed','Desire, resentment, shame, and Aphrodite’s power bind them inside Troy.'],
  ['menelaus','helen','estranged husband and wife',4,'mixed','The war claims to restore their marriage while treating Helen as both person and prize.'],
  ['agamemnon','menelaus','brothers and allied kings',4,'positive','Agamemnon’s coalition fights for Menelaus’ grievance, though command expands beyond it.'],
  ['diomedes','athena','favoured fighter and patron',5,'positive','Athena sharpens his sight, guides his spear, and permits him to wound gods.'],
  ['sarpedon','zeus','mortal son and divine father',5,'positive','Zeus grieves yet submits his son to the fate binding other mortals.'],
  ['sarpedon','glaucus','kings and comrades',5,'positive','Their shared Lycian leadership continues beyond Sarpedon through Glaucus’ defence of his body.'],
  ['achilles','priam','killer and bereaved father',5,'mixed','Shared grief briefly allows enemies to recognize each other’s humanity and suspend violence.'],
  ['zeus','hera','divine spouses and strategic opponents',5,'mixed','Marriage, deception, desire, and political rivalry extend the war into Olympus.'],
  ['apollo','hector','divine protector and mortal defender',5,'positive','Apollo sustains Hector and Troy until fate permits Athena and Achilles to close in.'],
  ['athena','hector','hostile goddess and doomed mortal',5,'negative','Athena’s final deception removes Hector’s last possibility of escape.'],
  ['ajax','hector','opposing champions',4,'mixed','They fight fiercely, respect one another, and exchange gifts after an inconclusive duel.'],
  ['diomedes','glaucus','hereditary guest-friends',3,'positive','An old bond between households interrupts present hostility.'],
  ['hecuba','hector','mother and son',5,'positive','Her appeals cannot keep him within the city, and her final public identity is as mourner.'],
]
const relationships = relationshipDefs.map(([a,b,label,strength,sentiment,description], i) => ({ ...base, id: id('relationship', i + 1), characterAId: charId(a), characterBId: charId(b), label, strength, sentiment, description, isBidirectional: true, startEventId: null }))

const threadDefs = [
  ['wrath','The Wrath of Achilles','#a4493f','Injury, withdrawal, consequence, grief, vengeance, and the first return to mercy.'],
  ['honour','Honour and Command','#9a7447','Prizes, speeches, rank, restitution, and contests measure unstable claims to public worth.'],
  ['troy','The Defence of Troy','#76534a','Hector and the Trojan household hold together a city already shadowed by destruction.'],
  ['gods','The War on Olympus','#7a668d','Divine favour and rivalry alter the field without releasing mortals from fate.'],
  ['patroclus','The Fate of Patroclus','#4e7580','Compassion and borrowed identity bring Patroclus glory, overreach, and death.'],
  ['bodies','Bodies and Burial','#69615b','The treatment of Sarpedon, Patroclus, and Hector tests the limit between victory and desecration.'],
  ['fate','Fate and Foreknowledge','#81723f','Gods and mortals know pieces of what must happen but remain responsible for how they meet it.'],
]
const plotThreads = threadDefs.map(([slug,name,color,description]) => ({ ...base, id: id('thread',slug), name,color,description }))
for (const e of events) {
  const b = Number(e.chapterId.slice(-2))
  e.threadIds = [id('thread','wrath'), id('thread','honour'), id('thread','troy'), id('thread','gods'), ...(b >= 11 && b <= 19 ? [id('thread','patroclus')] : []), ...(b >= 16 ? [id('thread','bodies')] : []), id('thread','fate')]
}

const motifDefs = [
  ['fire','Fire','#a74f32','Fire appears as plague pyres, battle pressure, divine weapon, funeral medium, and the threat to the ships.'],
  ['armour','Armour and Identity','#536f83','Borrowed, captured, divinely forged, and stripped armour makes identity visible and transferable.'],
  ['walls','Walls and Thresholds','#77705a','Troy’s walls and the Achaean fortification divide household from battlefield and safety from exposure.'],
  ['fathers','Fathers and Sons','#866650','Priam and Hector, Peleus and Achilles, Zeus and Sarpedon expose war across generations.'],
  ['hands','Hands','#8f6f60','Hands supplicate, fight, strip, embrace, and finally become the object of Priam’s impossible appeal.'],
  ['lament','Lamentation','#685d7c','Formal and private grief preserve the human cost that martial fame tries to absorb.'],
]
const motifs = motifDefs.map(([slug,name,color,description]) => ({ ...base, id: id('motif',slug), name,color,description }))
for (const e of events) { const t = `${e.title} ${e.description}`.toLowerCase(); e.motifIds = [t.includes('armour')||t.includes('shield')?id('motif','armour'):null,t.includes('wall')||t.includes('gate')?id('motif','walls'):null,t.includes('fire')||t.includes('pyre')?id('motif','fire'):null,t.includes('father')||t.includes('son')?id('motif','fathers'):null,t.includes('grief')||t.includes('mourn')||t.includes('lament')?id('motif','lament'):null].filter(Boolean) }

const factions = [
  ['achaeans','Achaean Coalition','#526f86','The expeditionary alliance led by Agamemnon and composed of many independently ruled contingents.'],
  ['trojans','Trojans and Allies','#9a5146','The defenders of Troy together with Dardanians, Lycians, and other allied peoples.'],
  ['myrmidons','Myrmidons','#394f61','Achilles’ elite contingent, withdrawn with him and returned under Patroclus.'],
  ['achaean-gods','Gods Favouring Achaea','#77709a','Hera, Athena, Poseidon, and allies committed to Troy’s defeat.'],
  ['trojan-gods','Gods Favouring Troy','#a57d45','Apollo, Aphrodite, Ares, and allies protecting Trojan lives and momentum.'],
  ['house-priam','House of Priam','#805b50','Troy’s royal household, where the public war becomes private bereavement.'],
].map(([slug,name,color,description]) => ({ ...base, id:id('faction',slug), name,description,color,coverImageId:artId({achaeans:'achaean-command',trojans:'trojan-house',myrmidons:'achilles','achaean-gods':'olympians','trojan-gods':'olympians','house-priam':'trojan-house'}[slug]),tags:[] }))
const memberDefs = [
  ['achaeans','agamemnon','High king'],['achaeans','menelaus','Spartan king'],['achaeans','odysseus','Ithacan king'],['achaeans','diomedes','Argive king'],['achaeans','ajax','Salaminian king'],['achaeans','ajax-lesser','Locrian commander'],['achaeans','nestor','Pylian king and counsellor'],['achaeans','achilles','Myrmidon commander'],['achaeans','patroclus','Myrmidon captain'],
  ['trojans','hector','Supreme field commander'],['trojans','paris','Prince'],['trojans','aeneas','Dardanian commander'],['trojans','deiphobus','Prince'],['trojans','polydamas','Captain and counsellor'],['trojans','sarpedon','Lycian king'],['trojans','glaucus','Lycian captain'],['trojans','pandarus','Archer'],
  ['myrmidons','achilles','Commander'],['myrmidons','patroclus','Acting commander'],['myrmidons','automedon','Charioteer'],
  ['achaean-gods','hera','Principal enemy of Troy'],['achaean-gods','athena','Battle patron'],['achaean-gods','poseidon','Battle patron'],['trojan-gods','apollo','Principal defender'],['trojan-gods','aphrodite','Protector of Paris and Aeneas'],['trojan-gods','ares','Battle ally'],
  ['house-priam','priam','King'],['house-priam','hecuba','Queen'],['house-priam','hector','Crown prince'],['house-priam','andromache','Princess'],['house-priam','astyanax','Heir'],['house-priam','paris','Prince'],['house-priam','helen','Princess by marriage'],['house-priam','deiphobus','Prince'],
]
const factionMemberships = memberDefs.map(([f,c,role],i) => ({ ...base,id:id('membership',i+1),factionId:id('faction',f),characterId:charId(c),role,startEventId:null,endEventId:null,notes:'' }))
const factionRelationships = [
  ['achaeans','trojans','hostile','The two coalitions contest Troy and Helen in the war’s tenth year.'],['achaeans','myrmidons','mixed','The Myrmidons belong to the coalition but withdraw with Achilles.'],['achaean-gods','trojan-gods','hostile','Divine rivalries reproduce and intensify the mortal war.'],['house-priam','trojans','allied','The coalition defends the city and dynasty of Priam.'],['myrmidons','trojans','hostile','Patroclus and Achilles each drive the Trojans from the ships.'],
].map(([a,b,stance,notes],i) => ({ ...base,id:id('faction-rel',i+1),factionAId:id('faction',a),factionBId:id('faction',b),stance,notes }))

const loreCategories = [['epic','Epic and Structure'],['custom','Honour and Society'],['gods','Gods and Fate'],['war','War and Burial'],['sources','Sources and Editorial Method']].map(([slug,name],i)=>({...base,id:id('lore-category',slug),name,description:`Reference context for ${name.toLowerCase()}.`,sortOrder:i}))
const loreDefs = [
  ['epic','The Poem’s Scope','The action covers only a short period in the tenth year of the Trojan War. The fall of Troy, the wooden horse, and Achilles’ own death lie outside the poem.'],
  ['epic','Wrath as Structure','Achilles’ anger begins as a dispute over honour, expands through Achaean suffering, changes object after Patroclus’ death, and finally loosens before Priam.'],
  ['custom','Timē and Geras','Honour is publicly measured through esteem and material prizes. Agamemnon’s seizure of Briseis therefore declares that Achilles’ contribution can be subordinated without compensation.'],
  ['custom','Supplication','A suppliant grasps knees or chin and asks protection from a stronger person. Failed and successful supplications organize the movement from Chryses to Priam.'],
  ['gods','Fate and Divine Action','The gods know, delay, accelerate, or shape events, but even Zeus does not simply abolish the deaths allotted to Sarpedon and Hector.'],
  ['gods','The Divine Coalitions','Hera, Athena, and Poseidon favour the Achaeans; Apollo, Aphrodite, and Ares favour Troy. Zeus alternates enforcement and permission while guarding the larger sequence.'],
  ['war','Aristeia','An aristeia is an extended sequence of exceptional battlefield achievement. Diomedes, Agamemnon, Patroclus, and Achilles each receive one with a distinct moral shape.'],
  ['war','The Right to Burial','Possession of a body extends combat beyond death. Sarpedon is divinely removed, Patroclus is collectively defended, and Hector is abused until gods and mortals restore funeral order.'],
  ['sources','Textual Basis','This PlotWeave entry follows the twenty-four-book structure and broadly shared narrative of Homer’s Iliad. Every synopsis and description is newly written and contains no copied translation.'],
  ['sources','Chronology','Scene order follows the poem. Relative times are editorial navigation aids; the epic does not supply a complete modern calendar for every event.'],
]
const loreArt = ['troad','achilles','objects','trojan-house','olympians','olympians','patroclus-battle','hector-family','objects','troad']
const lorePages = loreDefs.map(([cat,title,body],i)=>({...base,id:id('lore',i+1),categoryId:id('lore-category',cat),title,body,tags:[],coverImageId:artId(loreArt[i]),linkedEntityIds:[],visibleFromEventId:null}))

const factDefs = [
  ['plague-cause','Apollo sent the plague because Agamemnon dishonoured Chryses',1,'calchas'],
  ['zeus-plan','Zeus is granting Thetis’ request by allowing Achaean losses',2,'zeus'],
  ['paris-rescued','Aphrodite removed Paris from the duel',3,'helen'],
  ['guest-friends','Diomedes and Glaucus inherit guest-friendship',6,'diomedes'],
  ['achilles-refusal','Achilles will not accept Agamemnon’s first restitution offer',9,'agamemnon'],
  ['armour-plan','Patroclus will enter battle wearing Achilles’ armour',11,'patroclus'],
  ['sarpedon-fated','Zeus will allow Sarpedon to die despite loving him',16,'hera'],
  ['patroclus-dead','Patroclus has been killed and Achilles’ first armour taken',18,'achilles'],
  ['achilles-doomed','Killing Hector will bring Achilles’ own death near',18,'achilles'],
  ['deiphobus-false','The apparent Deiphobus beside Hector is Athena',22,'hector'],
  ['ransom-command','The gods require Achilles to accept ransom for Hector',24,'achilles'],
]
const knowledgeFacts = factDefs.map(([slug,title,book])=>({...base,id:id('fact',slug),title,description:title,tags:[],readerLearnsAtEventId:chapterFirst(book),originEventId:chapterFirst(book)}))
const knowledgeReveals = factDefs.map(([slug,,book,c],i)=>({...base,id:id('reveal',i+1),factId:id('fact',slug),characterId:charId(c),eventId:chapterLast(book),note:'Learned or confirmed during this book.'}))

const goalDefs = [
  ['achilles',1,24,'need','Defend his honour without letting rage erase every human bond and limit.'],['agamemnon',1,19,'want','Preserve supreme command over a coalition of independent kings.'],['hector',3,22,'want','Keep Troy and its households alive by holding the field against the Achaeans.'],['patroclus',11,16,'want','Save the ships and the suffering army by acting through Achilles’ borrowed identity.'],['priam',3,24,'need','Remain king and father through cumulative loss, then recover Hector for burial.'],['andromache',6,24,'want','Keep Hector within the household and preserve a future for Astyanax.'],['thetis',1,24,'want','Secure honour and dignity for the short life she cannot lengthen.'],
]
const characterGoals = goalDefs.map(([c,s,e,type,text],i)=>({...base,id:id('goal',i+1),characterId:charId(c),startEventId:chapterFirst(s),endEventId:chapterLast(e),type,text}))

const blobs = [
  { id: mapImageId, worldId: W, mimeType: 'image/png', url: commons('Odyssey (Butler) Map.png', 1920), createdAt: now },
  { ...base, id: coverImageId, mimeType: 'image/jpeg', url: 'library/the-iliad/art/cover.jpg' },
  ...['achilles','hector-family','achaean-command','trojan-house','olympians','patroclus-battle','troad','objects'].map(slug => ({ ...base, id: artId(slug), mimeType: 'image/jpeg', url: artPath(slug) })),
]
const data = { version:16,type:'world-export',exportedAt:now,world:{id:W,name:'The Iliad',description:'Homer’s epic traces the wrath of Achilles through plague, quarrel, withdrawal, battlefield collapse, the death of Patroclus, vengeance against Hector, and a final encounter between two grieving enemies.',coverImageId,theme:'theme-mythic',readingMode:true,createdAt:now,updatedAt:now,continuityStaleThreshold:5,calendar:{startYear:10,yearSuffix:' of the War',months:Array.from({length:12},(_,i)=>({name:`War Moon ${i+1}`,days:30}))},wordTarget:null},mapLayers,locationMarkers,characters,items,characterSnapshots,itemPlacements,relationships,timelines,chapters,events,blobs,loreCategories,lorePages,factions,factionMemberships,factionRelationships,knowledgeFacts,knowledgeReveals,characterGoals,plotThreads,motifs,characterMovements:[],locationSnapshots:[],itemSnapshots:[],relationshipSnapshots:[],travelModes:[],timelineRelationships:[],crossTimelineArtifacts:[],mapRoutes:[],mapRegions:[],mapRegionSnapshots:[],mapAnnotations:[],sceneTexts:[],continuitySuppressions:[],writingLogs:[],sceneRevisions:[] }

const characterSet = new Set(characters.map(c=>c.id)), locationSet = new Set(locationMarkers.map(l=>l.id)), itemSet = new Set(items.map(i=>i.id))
if (characters.some(c=>!c.portraitImageId) || locationMarkers.some(l=>!l.imageId) || items.some(i=>!i.imageId)) throw Error('Every character, location, and item must have an image')
const imageSet = new Set(blobs.map(b=>b.id))
for (const imageId of [...characters.map(c=>c.portraitImageId),...locationMarkers.map(l=>l.imageId),...items.map(i=>i.imageId)]) if (!imageSet.has(imageId)) throw Error(`Missing image blob ${imageId}`)
for (const event of events) {
  if (!locationSet.has(event.locationMarkerId)) throw Error(`Unknown location in ${event.title}`)
  for (const cid of [...event.involvedCharacterIds,...event.mentionedCharacterIds]) if (!characterSet.has(cid)) throw Error(`Unknown character ${cid} in ${event.title}`)
  for (const iid of event.involvedItemIds) if (!itemSet.has(iid)) throw Error(`Unknown item ${iid} in ${event.title}`)
}
if (chapters.length !== 24 || events.length !== 72) throw Error('Expected 24 books and 72 events')
if (new Set(characterSnapshots.map(s=>`${s.characterId}:${s.eventId}`)).size !== characterSnapshots.length) throw Error('Duplicate character snapshot')
if (events.some(e=>e.tension<1||e.tension>5)) throw Error('Tension outside 1–5')

const text = `${JSON.stringify(data,null,2)}\n`
fs.writeFileSync('example/The Iliad.pwk',text)
fs.writeFileSync('public/library/the-iliad.pwk',text)
const index = JSON.parse(fs.readFileSync('public/library/index.json','utf8'))
const entry = {id:'the-iliad',title:'The Iliad',author:'Homer',blurb:'The wrath of Achilles withdraws the Achaeans’ greatest fighter, destroys Patroclus and Hector, and ends in a meeting between enemies joined by grief.',data:'the-iliad.pwk',dataBytes:Buffer.byteLength(text),counts:{characters:characters.length,chapters:chapters.length,events:events.length,locations:locationMarkers.length},notice:'Unofficial reference for a public-domain ancient epic. This example contains original structural summaries and editorial chronology, not the prose of any translation. The cover is an original AI-generated interpretation created for PlotWeave; map sourcing and editorial method are recorded in Lore.',worldId:W,cover:'library/the-iliad/art/cover.jpg'}
const at = index.entries.findIndex(e=>e.id===entry.id); if(at>=0) index.entries[at]=entry; else index.entries.push(entry)
fs.writeFileSync('public/library/index.json',`${JSON.stringify(index,null,2)}\n`)
console.log(JSON.stringify({bytes:Buffer.byteLength(text),characters:characters.length,chapters:chapters.length,events:events.length,locations:locationMarkers.length,items:items.length,snapshots:characterSnapshots.length,relationships:relationships.length,factions:factions.length,knowledge:knowledgeFacts.length},null,2))
