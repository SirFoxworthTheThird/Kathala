# Check every quote in an audit file appears in its book. Usage: python3 -I quotes.py <audit> <book>
import re, sys
audit, book = open(sys.argv[1]).read(), open(sys.argv[2]).read()
norm = lambda s: re.sub(r'\s+', ' ', s.replace('*', '').replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('—', '-').replace('–', '-')).strip().lower()
B = norm(book)
items = re.split(r'\n(?=\d+\. )', audit)
for it in items:
    m = re.match(r'(\d+)\. (.*)', it)
    if not m: continue
    quotes = re.findall(r'"([^"\n]{6,}?)"|“([^”\n]{6,}?)”', it)
    missing = []
    for q in quotes:
        q = q[0] or q[1]
        frags = [f for f in re.split(r'\.\.\.|…|\[[^\]]*\]', q) if len(f.strip()) > 5]
        for f in frags:
            if norm(f).strip(' .,;:!?-') not in B: missing.append(f.strip()[:70])
    print(f"{m.group(1):>3} {'OK ' if not missing else 'MISSING'} {m.group(2)[:70]}" + ('' if not missing else f"\n      {missing[:3]}"))
