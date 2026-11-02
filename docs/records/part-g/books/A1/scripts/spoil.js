const W = {
 'Hesper Vane was the First Warden': ['First Warden Vane','Warden Vane','Hesper Vane, First Warden'],
 "The Founder's Fork was Ambrose's": ["Lyle's fork",'For Clare, not'],
 'The Narrowing passes on its own': ['two rhythms','long tide','it breathes','breathing'],
 'The Keeping makes the scar': ['layers','scar','something stayed'],
 'The Draw is rigged': ['half-thickness','sleeve name','weighted'],
 'Mor chose Pell': ['sleeve'],
 'The High Wardens inherit the lie': ['Inheritance','Testament'],
 'Teo flew to cross, not to keep': ['not a Keeper','not going in to feed'],
 'The Keeping is an instrument of governance': ['Memorandum','governance','covenant'],
 'The throat is choked with glass': ['choking','choked'],
 'The Bell can ring the throat': ['ring the throat','ring it'],
 'Ambrose was murdered': ['murdered'],
 'The oldest harp records were cut': ['Blank Year'],
 "The Hunger Tone is not the Fork's note": ['wah'],
};
const out=[];
await page.goto('http://localhost:5211/#/worlds/os-ym7EwunyTMDieuRMb1/knowledge'); await page.waitForTimeout(2000);
for (const [title, words] of Object.entries(W)) {
  await page.locator('main').getByText(title, {exact:true}).first().click(); await page.waitForTimeout(1200);
  const inp = page.getByLabel('Add a spoiler word');
  for (const w of words) { await inp.fill(w); await inp.press('Enter'); await page.waitForTimeout(300); }
  out.push(title+' ok');
}
return out.join('\n');
