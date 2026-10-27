import re,glob,difflib,sys
D='/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/partg/A1/'
def norm(t):
    t=re.sub(r'\n\[\n(?:  .*\n)+\]\n','\n\n',t)
    t=re.sub(r'^(#{1,2} .*)$',r'\n\1\n',t,flags=re.M)
    paras=[p.strip() for p in re.split(r'\n\s*\n',t) if p.strip()]
    return [p for p in paras if not p.startswith('# ')]
ex=open(D+'export.md').read()
dr=''.join('\n\n'+open(f).read() for f in sorted(glob.glob(D+'drafts/ch*.md')))
a=norm(dr); b=norm(ex)
print(len(a),len(b))
diff=list(difflib.unified_diff(a,b,lineterm='',n=0))
print(len(diff)); print('\n'.join(x[:300] for x in diff[:60]))
