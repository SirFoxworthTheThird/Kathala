#!/usr/bin/env python3
"""Make a comment in a Word file as an editor would in LibreOffice, and save it as Word.

    python3 scripts/lo-comment.py <profile dir> <port> <in.docx> <out.docx> <words> <comment> [point]

The comment goes on <words>, the first place they are found. With `point` it is made with nothing selected, the
cursor just before them: which is what `npm run probe:marked` asks about (round-trip-plan-3.md, T9.1), since
LibreOffice saves such a comment without the range Word gives every comment.

A tool for the probe, not part of the app: it needs LibreOffice and its Python bridge (python3-uno).
"""
import subprocess
import sys
import time

import uno
from com.sun.star.beans import PropertyValue


def prop(name, value):
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


def main():
    profile, port, src, dst, words, comment = sys.argv[1:7]
    point = len(sys.argv) > 7 and sys.argv[7] == 'point'
    office = subprocess.Popen([
        'soffice', '--headless', '--invisible', '--norestore', '-env:UserInstallation=file://' + profile,
        '--accept=socket,host=127.0.0.1,port=%s;urp;' % port,
    ])
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    ctx = None
    for _ in range(240):
        try:
            ctx = resolver.resolve('uno:socket,host=127.0.0.1,port=%s;urp;StarOffice.ComponentContext' % port)
            break
        except Exception:
            time.sleep(0.5)
    if ctx is None:
        office.kill()
        sys.exit('LibreOffice did not answer on port %s' % port)
    desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
    try:
        doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), '_blank', 0, (prop('Hidden', True),))
        search = doc.createSearchDescriptor()
        search.SearchString = words
        search.SearchCaseSensitive = True
        found = doc.findFirst(search)
        if found is None:
            sys.exit('not in the file: %s' % words)
        where = found.getText().createTextCursorByRange(found.getStart() if point else found)
        note = doc.createInstance('com.sun.star.text.textfield.Annotation')
        note.Author = 'Ines Marlowe'
        note.Initials = 'IM'
        note.Content = comment
        found.getText().insertTextContent(where, note, not point)
        doc.storeToURL(uno.systemPathToFileUrl(dst), (prop('FilterName', 'MS Word 2007 XML'),))
        doc.close(True)
    finally:
        try:
            desktop.terminate()
        except Exception:
            pass
        try:
            office.wait(timeout=60)
        except Exception:
            office.kill()


if __name__ == '__main__':
    main()
