# Part G: the books as the evaluators read them (events.md, "Normalisation").
# Usage: python3 -I prepare.py <books dir> <evaluator dir> <sealed dir>
#
# Each book's copy has `_x_` italics written `*x*` and a backslash at the end of a line
# removed; nothing else changes. The six books get shuffled letters, and which is which
# goes only to the sealed folder.
import json, os, random, re, sys

books, out, sealed = sys.argv[1:4]
IDS = ['A1', 'A2', 'A3', 'C1', 'C2', 'C3']
LETTERS = ['P', 'Q', 'R', 'S', 'T', 'U']

def normalise(text):
    italics = re.compile(r'(?<![\w*])_([^_\n]+)_(?![\w*])')
    n_it = len(italics.findall(text))
    text = italics.sub(r'*\1*', text)
    n_bs = len(re.findall(r'\\$', text, flags=re.M))
    text = re.sub(r'\\$', '', text, flags=re.M)
    return text, {'italics': n_it, 'backslashes': n_bs}

os.makedirs(out, exist_ok=True)
os.makedirs(sealed, exist_ok=True)
letters = LETTERS[:]
random.SystemRandom().shuffle(letters)
mapping, counts = {}, {}
for book, letter in zip(IDS, letters):
    text, n = normalise(open(os.path.join(books, book, 'book.md')).read())
    open(os.path.join(out, f'book-{letter}.md'), 'w').write(text)
    mapping[letter] = book
    counts[book] = n
json.dump({'mapping': dict(sorted(mapping.items())), 'normalised': counts},
          open(os.path.join(sealed, 'mapping.json'), 'w'), indent=2)
print('wrote', ', '.join(f'book-{l}.md' for l in sorted(mapping)))
