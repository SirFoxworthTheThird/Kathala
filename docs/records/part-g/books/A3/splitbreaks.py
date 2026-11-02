import sys, json
# usage: splitbreaks.py file '<json list of header strings>'
p=sys.argv[1]; heads=json.loads(open(sys.argv[2]).read())
s=open(p).read(); parts=s.split('\n* * *\n')
assert len(parts)==len(heads)+1, (len(parts), len(heads))
out=parts[0]
for h,pt in zip(heads,parts[1:]): out+='\n'+h.strip()+'\n'+pt
open(p,'w').write(out)
