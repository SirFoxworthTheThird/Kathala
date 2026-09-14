/**
 * Editorial event metadata audited against Emily Brontë's 34 source chapters.
 * `states` is deliberately authoritative for presence: a character receives a
 * snapshot only when named here, and every note describes that character's
 * condition or action at the end of the chapter event.
 */
export const eventLedger = [
  {
    location: "heights-gate",
    tension: 2,
    year: 1801,
    states: {
      lockwood:
        "Has made an awkward first call on his unsociable landlord and resolves to return.",
      heathcliff:
        "Receives his new tenant with guarded hostility at the Heights.",
      joseph: "Admits Lockwood grudgingly and tends the household's dogs.",
    },
  },
  {
    location: "house",
    tension: 3,
    year: 1801,
    states: {
      lockwood:
        "Is snowbound at the Heights after misreading the household and failing to secure a guide.",
      heathcliff:
        "Refuses to risk a servant in the storm and reacts fiercely when Lockwood tries to leave.",
      cathy:
        "Treats the intrusive visitor with cold amusement while remaining trapped in Heathcliff's household.",
      hareton:
        "Bridges servant and master in Lockwood's confused eyes, defending the house without courtesy.",
      joseph:
        "Prevents Lockwood from taking the lantern and sets the dogs on him.",
      zillah:
        "Brings the injured, stranded Lockwood inside and secretly gives him a bed.",
    },
  },
  {
    location: "oak-chamber",
    tension: 5,
    year: 1801,
    states: {
      lockwood:
        "Wakes terrified after reading Catherine's diary and dreaming of a child-ghost at the window.",
      heathcliff:
        "Is devastated by Catherine's name and begs her spirit to enter the chamber.",
      cathy:
        "Remains resentful at the breakfast hearth after Lockwood's night in the forbidden room.",
      hareton:
        "Keeps his rough reserve while the household begins its morning.",
      joseph: "Conducts the household's severe morning devotions.",
      zillah:
        "Has unknowingly placed Lockwood in the chamber Heathcliff keeps emotionally forbidden.",
    },
  },
  {
    location: "grange-parlour",
    tension: 2,
    year: 1771,
    states: {
      lockwood:
        "Recovers at the Grange and asks Nelly to explain the strange household at the Heights.",
      nelly:
        "Begins her eyewitness history with Mr Earnshaw's return from Liverpool.",
      earnshaw:
        "Brings the orphan Heathcliff home and orders the family to accept him.",
      "mrs-earnshaw":
        "Objects to the dirty foundling being brought into her household.",
      catherine: "Quickly turns from anger to intimacy with the newcomer.",
      hindley: "Resents the newcomer who receives his father's protection.",
      heathcliff:
        "Endures rejection, receives Catherine's friendship, and is given the dead Earnshaw son's name.",
    },
  },
  {
    location: "house",
    tension: 4,
    year: 1777,
    states: {
      nelly:
        "Witnesses the old master's decline and keeps the children as orderly as she can.",
      earnshaw:
        "Dies peacefully by the hearth after increasingly favouring Heathcliff and quarrelling with Hindley.",
      catherine:
        "Shares a last quiet evening with her father, then grieves with Heathcliff.",
      hindley:
        "Has been sent away to college and is absent when his father dies.",
      heathcliff: "Loses his protector and mourns beside Catherine.",
      joseph:
        "Uses religious severity to control the children during Mr Earnshaw's decline.",
    },
  },
  {
    location: "grange-park",
    tension: 3,
    year: 1777,
    states: {
      nelly:
        "Describes Hindley's return and the children's forbidden excursion to the Grange.",
      hindley:
        "Returns as master with Frances and reduces Heathcliff to a farm labourer.",
      frances: "Arrives as Hindley's lively but physically fragile wife.",
      catherine:
        "Is bitten by the Lintons' dog after spying through the Grange window and must remain there.",
      heathcliff:
        "Is turned away from the Grange as a rough servant after carrying the injured Catherine there.",
      edgar:
        "Sees Catherine brought inside and begins treating her as a social equal.",
      isabella:
        "Shares the pampered Grange childhood Catherine observes from outside.",
    },
  },
  {
    location: "house",
    tension: 4,
    year: 1777,
    states: {
      nelly:
        "Prepares Catherine's Christmas return and tries to clean Heathcliff for the Lintons' visit.",
      catherine:
        "Returns refined from the Grange but tries to preserve her intimacy with Heathcliff.",
      heathcliff:
        "Is humiliated by Edgar's laughter and vows revenge on Hindley.",
      hindley: "Keeps Heathcliff excluded from the family's Christmas company.",
      frances: "Supports Hindley's new social order at the Heights.",
      edgar: "Visits Catherine and recoils from Heathcliff's rough appearance.",
      isabella: "Accompanies Edgar to the Heights for Christmas.",
    },
  },
  {
    location: "house",
    tension: 5,
    year: 1778,
    states: {
      nelly:
        "Challenges Catherine's cruelty and observes her acceptance of Edgar.",
      hindley: "Becomes violently reckless after Frances gives birth and dies.",
      frances: "Dies of consumption shortly after Hareton's birth.",
      catherine:
        "Strikes Nelly, pinches Hareton, and accepts Edgar after testing his devotion.",
      edgar:
        "Proposes to Catherine despite witnessing her uncontrolled temper.",
      hareton:
        "Is born and left dependent on Nelly amid his father's collapse.",
      kenneth:
        "Warns that Frances cannot survive childbirth and attends her fatal illness.",
    },
  },
  {
    location: "house",
    tension: 5,
    year: 1780,
    states: {
      nelly:
        "Hears Catherine confess that marrying Heathcliff would degrade her and that she nevertheless is Heathcliff.",
      catherine:
        "Accepts Edgar for status while declaring her identity inseparable from Heathcliff's.",
      heathcliff:
        "Overhears only Catherine's rejection of marriage to him and disappears into the storm.",
      hindley: "Drops Hareton over the banister during a drunken rage.",
      hareton: "Is caught and saved by Heathcliff after Hindley drops him.",
      joseph:
        "Remains part of the disordered Heights household while Heathcliff vanishes.",
    },
  },
  {
    location: "grange-parlour",
    tension: 4,
    year: 1783,
    states: {
      nelly:
        "Recognizes the danger behind Heathcliff's polished return and Isabella's infatuation.",
      catherine:
        "Is ecstatic at Heathcliff's return and encourages his visits despite Edgar's discomfort.",
      heathcliff:
        "Returns wealthy and transformed, lodges with Hindley, and begins pursuing revenge.",
      edgar: "Tolerates his wife's reunion with Heathcliff but distrusts him.",
      isabella:
        "Falls romantically in love with Heathcliff despite Catherine's warning.",
      hindley:
        "Welcomes Heathcliff's gambling money without seeing how it will ruin him.",
    },
  },
  {
    location: "grange-parlour",
    tension: 5,
    year: 1783,
    states: {
      nelly:
        "Tries to prevent a confrontation between Catherine, Edgar, and Heathcliff.",
      catherine:
        "Manipulates Edgar and Heathcliff until their rivalry erupts openly.",
      heathcliff:
        "Embraces Isabella, defies Edgar, and leaves promising retaliation.",
      edgar: "Asserts authority in his house and orders Heathcliff away.",
      isabella:
        "Persists in her infatuation after being used to provoke Catherine.",
      hindley:
        "Plots to murder Heathcliff while remaining financially dependent on him.",
    },
  },
  {
    location: "catherine-room",
    tension: 5,
    year: 1783,
    states: {
      nelly:
        "Attends Catherine through self-starvation and delirium while reporting Isabella's flight.",
      catherine:
        "Falls dangerously ill after locking herself away and longs for her childhood on the moors.",
      edgar:
        "Returns to nurse Catherine and breaks with Isabella after her elopement.",
      isabella: "Elopes with Heathcliff despite Edgar's warning.",
      heathcliff: "Takes Isabella away and remains barred from the Grange.",
      kenneth:
        "Diagnoses brain fever and warns that Catherine's recovery is uncertain.",
    },
  },
  {
    location: "house",
    tension: 4,
    year: 1783,
    states: {
      isabella:
        "Writes from the Heights, disillusioned and trapped in a brutal marriage.",
      heathcliff:
        "Treats Isabella with contempt while using the marriage against Edgar.",
      hindley:
        "Lives in drunken ruin and nourishes a murderous hatred of Heathcliff.",
      hareton: "Grows neglected amid the adults' violence.",
      joseph:
        "Maintains the hostile household routine and offers Isabella no comfort.",
    },
  },
  {
    location: "house",
    tension: 4,
    year: 1783,
    states: {
      nelly:
        "Visits Isabella and reluctantly carries Heathcliff's demand for access to Catherine.",
      isabella:
        "Confesses her hatred and describes the degradation of her married life.",
      heathcliff: "Forces Nelly to promise delivery of a letter to Catherine.",
      hindley:
        "Has lost practical control of his house and debts to Heathcliff.",
      hareton: "Remains an unprotected child in the Heights household.",
      joseph:
        "Continues serving Hindley while accepting Heathcliff's growing dominance.",
    },
  },
  {
    location: "catherine-room",
    tension: 5,
    year: 1784,
    states: {
      nelly:
        "Admits Heathcliff to Catherine's room and witnesses their anguished reunion.",
      catherine:
        "Clings to Heathcliff, accuses him of abandoning her, and collapses as Edgar returns.",
      heathcliff:
        "Blames Catherine for choosing Edgar yet cannot release her during their last conscious meeting.",
      edgar:
        "Returns to find Heathcliff with his dying wife and turns first to Catherine's crisis.",
    },
  },
  {
    location: "catherine-room",
    tension: 5,
    year: 1784,
    states: {
      nelly:
        "Attends Catherine's premature childbirth and death, then carries the news to Heathcliff.",
      catherine:
        "Gives birth to Cathy and dies without recovering full consciousness.",
      heathcliff:
        "Begs Catherine's spirit to haunt him rather than leave him in peace.",
      edgar:
        "Keeps vigil beside Catherine's body and is left to raise their infant daughter.",
      cathy: "Is born prematurely at the Grange and survives her mother's fatal confinement.",
      kenneth: "Attends Catherine's premature confinement and can do nothing to prevent her death.",
    },
  },
  {
    location: "house",
    tension: 5,
    year: 1784,
    states: {
      nelly:
        "Helps Isabella after her escape and later records Hindley's death and Heathcliff's possession of the Heights.",
      isabella:
        "Escapes after Hindley's failed attack on Heathcliff and settles near London with her unborn child.",
      heathcliff:
        "Defeats Hindley, inherits his debts, and takes control of Hareton and Wuthering Heights.",
      hindley:
        "Fails to kill Heathcliff and later dies in debt and degradation.",
      hareton: "Becomes Heathcliff's dependent after his father's death.",
      edgar:
        "Refuses reconciliation with Isabella but arranges Catherine's burial.",
      kenneth: "Confirms Hindley's death and the estate's ruin.",
    },
  },
  {
    location: "penistone-crags",
    tension: 3,
    year: 1797,
    states: {
      nelly:
        "Accompanies young Cathy beyond the Grange and discovers Hareton's identity at the Heights.",
      cathy:
        "At thirteen, explores toward Penistone Crags and unknowingly meets her cousin Hareton.",
      hareton:
        "Is insulted as a servant by Cathy and angrily reveals that he belongs to the family.",
    },
  },
  {
    location: "grange-parlour",
    tension: 3,
    year: 1800,
    states: {
      nelly:
        "Helps Edgar receive the orphaned Linton and fears Heathcliff's claim.",
      cathy:
        "Welcomes her delicate cousin at the Grange and expects him to remain.",
      edgar: "Fetches Isabella's dying son and briefly shelters him.",
      linton: "Arrives frail, peevish, and grieving after his mother's death.",
    },
  },
  {
    location: "house",
    tension: 3,
    year: 1800,
    states: {
      nelly:
        "Delivers Linton to the Heights under protest and sees his terror of Heathcliff.",
      linton:
        "Learns that the forbidding stranger is his father and begs not to be left.",
      heathcliff:
        "Takes possession of the son he despises because Linton can inherit the Grange.",
      joseph: "Receives another dependent into the Heights household.",
    },
  },
  {
    location: "house",
    tension: 4,
    year: 1800,
    states: {
      nelly:
        "Discovers Cathy's renewed contact with the Heights and destroys the cousins' letters.",
      cathy:
        "Meets Heathcliff, Hareton, and Linton, then secretly corresponds with Linton.",
      hareton:
        "Attempts to impress Cathy but is shamed for his lack of education.",
      linton: "Courts Cathy by letter under Heathcliff's encouragement.",
      heathcliff:
        "Introduces Cathy to Linton while concealing his inheritance scheme.",
    },
  },
  {
    location: "moor-road",
    tension: 4,
    year: 1801,
    states: {
      nelly:
        "Follows Cathy over the wall and fails to persuade her that Heathcliff is manipulating them.",
      cathy:
        "Visits Linton after Heathcliff claims he is dying of her neglect.",
      edgar:
        "Is seriously ill at the Grange and unaware of the renewed visits.",
      heathcliff:
        "Uses Cathy's pity and Edgar's illness to draw her toward Linton.",
    },
  },
  {
    location: "house",
    tension: 4,
    year: 1801,
    states: {
      nelly:
        "Witnesses Linton's selfish demands and then becomes bedridden after the cold journey.",
      cathy:
        "Nurses the weak Linton but quarrels when he blames her for his distress.",
      linton:
        "Reveals both genuine illness and fear-driven obedience to his father.",
      heathcliff: "Keeps pressure on Linton to secure Cathy's attachment.",
    },
  },
  {
    location: "house",
    tension: 3,
    year: 1801,
    states: {
      nelly:
        "Learns that Cathy deceived her during her illness and obtains a promise to stop visiting.",
      cathy:
        "Confesses her secret rides to see Linton and her quarrel with Hareton.",
      linton:
        "Continues the clandestine courtship while presenting himself as a victim.",
      hareton:
        "Shows Cathy his efforts to learn, then burns his books after her ridicule.",
      heathcliff: "Remains the coercive power behind Linton's courtship.",
    },
  },
  {
    location: "grange-parlour",
    tension: 3,
    year: 1801,
    states: {
      nelly:
        "Reflects on Edgar's declining health and mediates a cautious renewal of letters.",
      cathy:
        "Stays near her dying father and resumes corresponding with Linton under restrictions.",
      edgar:
        "Considers Cathy's future and permits Linton to meet her on Grange land.",
    },
  },
  {
    location: "moor-road",
    tension: 4,
    year: 1801,
    states: {
      nelly:
        "Accompanies Cathy to a meeting and recognizes that Linton is acting under terror.",
      cathy:
        "Finds Linton desperately ill but is persuaded to promise another visit.",
      linton:
        "Begs Cathy to return because he fears what Heathcliff will do if the plan fails.",
      heathcliff:
        "Controls the meeting from the Heights through threats to his son.",
    },
  },
  {
    location: "house",
    tension: 5,
    year: 1801,
    states: {
      nelly: "Is imprisoned with Cathy at the Heights while Edgar lies dying.",
      cathy:
        "Is abducted, confined, and forced to marry Linton to reach her father again.",
      linton:
        "Assists his father by holding the key and accepts the coerced marriage.",
      heathcliff:
        "Kidnaps Cathy and Nelly and compels the marriage that advances his property claim.",
      hareton:
        "Remains in the house but does not challenge Heathcliff's control.",
      joseph: "Continues household business while the women are confined.",
    },
  },
  {
    location: "catherine-room",
    tension: 5,
    year: 1801,
    states: {
      nelly: "Escapes confinement and reaches the Grange before Edgar's death.",
      cathy:
        "Escapes long enough to reconcile with her father, then is taken back as Linton's wife.",
      edgar:
        "Dies peacefully after seeing Cathy again and entrusts her to Nelly.",
      linton: "Is forced to sign away his property and cannot protect Cathy.",
      heathcliff: "Secures the will and sends for Cathy after Edgar's funeral.",
    },
  },
  {
    location: "churchyard",
    tension: 5,
    year: 1801,
    states: {
      nelly:
        "Meets Heathcliff at the Grange after the funeral and hears his confession about Catherine's grave.",
      heathcliff:
        "Removes the side of Catherine's coffin, anticipates burial beside her, and claims years of haunting.",
    },
  },
  {
    location: "house",
    tension: 4,
    year: 1801,
    states: {
      nelly:
        "Hears Zillah's account of Cathy's return, Linton's death, and her isolation at the Heights.",
      zillah:
        "Describes tending the household while refusing Cathy's later appeals for companionship.",
      cathy:
        "Nurses Linton without help, is widowed, and withdraws behind open hostility.",
      linton: "Dies after transferring his property to Heathcliff.",
      heathcliff:
        "Takes both estates and denies his sick son and widowed daughter-in-law comfort.",
      hareton: "Attempts clumsy kindness toward Cathy but is rejected.",
    },
  },
  {
    location: "house",
    tension: 2,
    year: 1801,
    states: {
      lockwood:
        "Pays a farewell visit, gives Cathy Nelly's note, and tells Heathcliff he will surrender the Grange tenancy.",
      heathcliff:
        "Receives the departing tenant while maintaining harsh control of the household.",
      cathy:
        "Reads Nelly's hidden note and remains contemptuous of Hareton's attempts to improve.",
      hareton:
        "Tries to study and please Cathy but destroys the books she mocks.",
    },
  },
  {
    location: "house",
    tension: 2,
    year: 1802,
    states: {
      lockwood:
        "Returns after months away and asks Nelly how the household changed.",
      nelly:
        "Has moved back to the Heights and explains Cathy and Hareton's reconciliation.",
      cathy: "Apologizes for mocking Hareton and begins teaching him to read.",
      hareton: "Accepts Cathy's instruction and grows openly devoted to her.",
      heathcliff:
        "Still owns both houses but has withdrawn from ordinary household life.",
      joseph: "Disapproves of the new companionship and altered household.",
    },
  },
  {
    location: "heights-garden",
    tension: 4,
    year: 1802,
    states: {
      nelly:
        "Observes Heathcliff abandon an opportunity to punish Cathy and Hareton.",
      cathy: "Makes peace with Hareton and plans improvements to the garden.",
      hareton:
        "Defends Cathy, studies with her, and becomes the living image that unsettles Heathcliff.",
      heathcliff:
        "Loses the will to continue revenge as memories of Catherine overwhelm every object.",
      joseph:
        "Resents Cathy and Hareton's books, plants, and growing authority.",
    },
  },
  {
    location: "churchyard",
    tension: 2,
    year: 1802,
    states: {
      lockwood:
        "Hears the end of Nelly's history and visits the three graves before leaving the moors.",
      nelly:
        "Reports Heathcliff's sleepless visions, fasting, death, and burial beside Catherine.",
      cathy: "Prepares to marry Hareton and move to the Grange.",
      hareton:
        "Mourns Heathcliff sincerely while anticipating a new life with Cathy.",
      heathcliff:
        "Dies alone by the open window and is buried beside Catherine.",
      joseph:
        "Finds Heathcliff dead and remains the old servant of the altered Heights.",
    },
  },
];

if (eventLedger.length !== 34)
  throw new Error(`Expected 34 chapter events, got ${eventLedger.length}`);
