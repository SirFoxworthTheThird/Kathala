import re,json,sys
D='/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/partg/A1/'
src=sys.argv[1] if len(sys.argv)>1 else D+'export.md'
chs=json.load(open(D+'bible/chapters.json'))
era={'The Concession':'The Concession · 2291','The Severance':'The Severance · 2608','The Ebb':'The Ebb · 2937'}
meta={c[0]:(c[1],c[2]) for c in chs}
t=open(src).read()
lines=t.split('\n')
out=[]; first=False; seen=set()
for ln in lines:
    m=re.match(r'^# Ch\. (\d+) — (.*)$',ln)
    if m:
        n=int(m.group(1)); title=m.group(2).strip()
        assert title==meta[n][1],(n,title)
        while out and out[-1]=='': out.pop()
        if out: out.append('')
        out.append(f'# Chapter {n}: {title}'); out.append(''); out.append(f'*{era[meta[n][0]]}*'); out.append('')
        first=True; seen.add(n); continue
    if re.match(r'^## ',ln):
        if first: first=False; continue
        while out and out[-1]=='': out.pop()
        out+=['','* * *','']; continue
    if re.match(r'^#',ln): raise SystemExit('unexpected heading: '+ln)
    out.append(ln)
assert seen==set(range(1,22)),seen
s='\n'.join(out)
s=re.sub(r'\n{3,}','\n\n',s).strip()+'\n'
s=s.replace('\\\n','\n')
open(D+'book.md','w').write(s)
print(len(re.findall(r"[A-Za-z0-9'’-]+",re.sub(r'^(#|\*[A-Z]).*$','',s,flags=re.M))))
