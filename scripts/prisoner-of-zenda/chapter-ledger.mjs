import { sourceChapters } from "./source-text.mjs";

const synopses = [
  "Rudolf Rassendyll's family resemblance to the royal house of Ruritania and his taste for idleness set him on the road to Strelsau.",
  "Rudolf travels through Paris and Dresden, meets Antoinette de Mauban, and crosses into a kingdom divided between its King and Duke Michael.",
  "Near Zenda, Rudolf meets his royal double, Colonel Sapt, and Fritz von Tarlenheim; a convivial supper ends with the King drugged.",
  "With the coronation hours away, Sapt persuades Rudolf to impersonate the unconscious King and ride for Strelsau.",
  "Rudolf enters the capital, wins the old town's goodwill, is crowned, and meets Princess Flavia.",
  "After the coronation Rudolf, Sapt, and Fritz return to the hunting lodge, where Josef is dead and the King has vanished.",
  "The conspirators conceal the disaster and maintain Rudolf's impersonation while concluding that Michael holds the true King.",
  "Rudolf learns the burdens of counterfeit kingship, receives Michael and his allies, and grows close to Flavia.",
  "Antoinette warns Rudolf of an ambush; in the summerhouse he survives three assassins with nerve, furniture, and gunfire.",
  "A police report exposes the cost of secrecy, while Rudolf confesses to Sapt that duty and love are pulling him apart.",
  "Rudolf publicly binds himself to Flavia, then leaves Strelsau to hunt for the imprisoned King at Zenda.",
  "From Tarlenheim's chateau the rescuers meet Antoinette and ensnare Johann, gaining their first intelligence from inside the castle.",
  "Rupert offers Rudolf a treacherous bargain and wounds him; Johann's knowledge nevertheless reveals a narrow path to rescue.",
  "Flavia visits the wounded Rudolf before he secretly reconnoitres the castle moat and hears the captive King.",
  "Rudolf returns publicly to Zenda, rejects Rupert's private bargain, and recognises Antoinette's danger inside Michael's household.",
  "Johann explains the King's guards and murder signal; Rudolf fixes the hour of attack and says farewell to Flavia.",
  "Rudolf swims the moat and overhears the quarrel among Michael, Antoinette, and Rupert as rival plots converge.",
  "Michael's death throws the castle into chaos, giving Rudolf the opening to enter the keep and fight toward the King's cell.",
  "Rudolf faces Rupert across the drawbridge, pursues him through water and forest, and learns that the King survives.",
  "Sapt constructs a public explanation while Flavia reaches Zenda and discovers the wounded man who wears the King's face.",
  "Rudolf and Flavia confront the duty that forbids their love and part so that the restored King may rule.",
  "Back in England, Rudolf protects the secret and preserves his bond with Flavia through one private meeting each year.",
];

export const chapterLedger = sourceChapters.map((chapter, index) => ({
  number: chapter.number,
  title: chapter.title,
  synopsis: synopses[index],
}));
