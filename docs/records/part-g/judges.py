# Part G: the 24 blind judgements (pre-registration, "Blind pairwise judging").
# Usage: python3 -I judges.py <judge-prompt.md> <mapping.json> <books dir> <out dir> <prompts dir>
#
# App vs control: all 9 pairs, both orders (18). Control vs control: all 3 pairs, both orders (6).
# Each prompt is the run-10 judge prompt with the two books' paths, the output path, and the words
# FIRST and SECOND replaced by the pair's letters, as run 10 did. The prompts name letters only, and
# are written in a random order, which is the order they run in.
import itertools, json, os, random, re, sys

template, mapping_file, books, out, prompts = sys.argv[1:6]
mapping = json.load(open(mapping_file))['mapping']
app = sorted(l for l, b in mapping.items() if b.startswith('A'))
control = sorted(l for l, b in mapping.items() if b.startswith('C'))
pairs = [p for a, c in itertools.product(app, control) for p in ((a, c), (c, a))]
pairs += [p for a, b in itertools.combinations(control, 2) for p in ((a, b), (b, a))]
assert len(pairs) == 24 and len(set(pairs)) == 24
random.SystemRandom().shuffle(pairs)
text = open(template).read()
os.makedirs(prompts, exist_ok=True)
for n, (x, y) in enumerate(pairs, 1):
    p = (text.replace('{FIRST}', os.path.join(books, f'book-{x}.md'))
             .replace('{SECOND}', os.path.join(books, f'book-{y}.md'))
             .replace('{OUT}', os.path.join(out, f'judge-{x}{y}.md')))
    p = re.sub(r'\bFIRST\b', x, re.sub(r'\bSECOND\b', y, p))
    open(os.path.join(prompts, f'{n:02d}-judge-{x}{y}.md'), 'w').write(p)
print(len(pairs), 'prompts')
