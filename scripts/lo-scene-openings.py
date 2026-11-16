#!/usr/bin/env python3
"""Edits at a scene's opening, and across a scene break, made in LibreOffice, with tracking on and off.

    python3 scripts/lo-scene-openings.py <file.docx> <out dir> <port>

Made the fixtures in src/lib/__tests__/fixtures/docx/s10-scene-openings/ (round-trip-plan-4.md, T21.3, S10) from the
third loop's round-1 file: the second scene's first sentence taken out, its first paragraph taken out, its first
sentence moved to the end of its second paragraph, the scene break taken out, the paragraphs either side of the break
joined, and the break taken out with the next scene's first sentence. Each saved as Word, as the editor's LibreOffice
saves it. With tracking off, LibreOffice drops the scene's bookmark with its opening words.

A tool, not part of the app: it needs LibreOffice and its Python bridge (python3-uno).
"""
import subprocess, sys, time, shutil, os
import uno
from com.sun.star.beans import PropertyValue
def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p
src, out, port = sys.argv[1], sys.argv[2], sys.argv[3]
profile = out + '/profile'
office = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore', '-env:UserInstallation=file://' + profile, '--accept=socket,host=127.0.0.1,port=%s;urp;' % port])
local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
ctx = None
for _ in range(240):
    try:
        ctx = resolver.resolve('uno:socket,host=127.0.0.1,port=%s;urp;StarOffice.ComponentContext' % port); break
    except Exception: time.sleep(0.5)
desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)

def paras(doc):
    e = doc.Text.createEnumeration(); r = []
    while e.hasMoreElements():
        p = e.nextElement()
        if p.supportsService('com.sun.star.text.Paragraph'): r.append(p)
    return r

def breaks(ps):
    return [i for i, p in enumerate(ps) if p.ParaStyleName in ('SceneBreak', 'Scene Break') or p.getString().strip() == '#']

def edit(name, tracked, fn):
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), '_blank', 0, (prop('Hidden', True),))
    doc.RecordChanges = tracked
    ps = paras(doc)
    note = fn(doc, ps, breaks(ps))
    doc.storeToURL(uno.systemPathToFileUrl('%s/%s.docx' % (out, name)), (prop('FilterName', 'MS Word 2007 XML'),))
    doc.close(True)
    print(name, 'tracked' if tracked else 'plain', note)

def first_sentence(doc, ps, bs):
    p = ps[bs[0] + 1]; t = p.getString(); k = t.index('. ') + 2
    c = doc.Text.createTextCursorByRange(p.getStart()); c.goRight(k, True); c.setString('')
    return repr(t[:k])
def first_paragraph(doc, ps, bs):
    p = ps[bs[0] + 1]; c = doc.Text.createTextCursorByRange(p.getStart()); c.gotoRange(ps[bs[0] + 2].getStart(), True); s = c.getString(); c.setString('')
    return repr(s[:60])
def opening_moved(doc, ps, bs):
    p = ps[bs[0] + 1]; t = p.getString(); k = t.index('. ') + 2
    c = doc.Text.createTextCursorByRange(p.getStart()); c.goRight(k, True); c.setString('')
    q = ps[bs[0] + 2]; e = doc.Text.createTextCursorByRange(q.getEnd()); e.setString(' ' + t[:k].strip())
    return repr(t[:k])
def break_out(doc, ps, bs):
    b = ps[bs[0]]; c = doc.Text.createTextCursorByRange(ps[bs[0] - 1].getEnd()); c.gotoRange(b.getEnd(), True); c.setString('')
    return repr(b.getString())
def join_across(doc, ps, bs):
    c = doc.Text.createTextCursorByRange(ps[bs[0] - 1].getEnd()); c.gotoRange(ps[bs[0] + 1].getStart(), True); s = c.getString(); c.setString(' ')
    return repr(s)
def opening_and_break(doc, ps, bs):
    # The break taken out and the next scene's first sentence with it.
    t = ps[bs[0] + 1].getString(); k = t.index('. ') + 2
    c = doc.Text.createTextCursorByRange(ps[bs[0] - 1].getEnd()); c.gotoRange(ps[bs[0] + 1].getStart(), False)
    c = doc.Text.createTextCursorByRange(ps[bs[0] - 1].getEnd()); c.gotoRange(ps[bs[0] + 1].getStart(), True); c.goRight(k, True); s = c.getString(); c.setString(' ')
    return repr(s)

try:
    for tracked in (True, False):
        tag = 'tracked' if tracked else 'plain'
        edit('first-sentence-' + tag, tracked, first_sentence)
        edit('first-paragraph-' + tag, tracked, first_paragraph)
        edit('opening-moved-' + tag, tracked, opening_moved)
        edit('break-out-' + tag, tracked, break_out)
        edit('join-across-' + tag, tracked, join_across)
        edit('opening-and-break-' + tag, tracked, opening_and_break)
finally:
    try: desktop.terminate()
    except Exception: pass
    try: office.wait(timeout=60)
    except Exception: office.kill()
