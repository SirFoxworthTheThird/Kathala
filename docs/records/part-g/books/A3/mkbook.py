import re,sys
d='/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/partg/A3/'
src=open(d+'export.md').read().replace('\r','')
era={0:'The Closing · 2387 CE',1:'The Owing · 311 AC',2:'The Healing · 3089 CE'}
out=[]; chap=None; first_scene=True
for line in src.split('\n'):
    m=re.match(r'^# Ch\. (\d+) — (.*)$',line)
    if m:
        n=int(m.group(1)); chap=n
        if out and out[-1]!='': out.append('')
        out.append(f'# Chapter {n}: {m.group(2).strip()}'); out.append('')
        out.append(f'*{era[(n-1)%3]}*'); out.append('')
        first_scene=True; continue
    if re.match(r'^## ',line):
        if not first_scene:
            while out and out[-1]=='': out.pop()
            out.append(''); out.append('* * *'); out.append('')
        first_scene=False; continue
    out.append(line)
txt='\n'.join(out)
txt=re.sub(r'\n{3,}','\n\n',txt).strip()+'\n'
open(d+'book.md','w').write(txt)
print(len(txt.split()))
