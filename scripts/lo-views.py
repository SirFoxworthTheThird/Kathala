#!/usr/bin/env python3
"""LibreOffice's own reading of a tracked file: its text with every change accepted, and with every one rejected.

    python3 scripts/lo-views.py <profile dir> <port> <file.docx>...

For each file it writes <file>.accepted.txt and <file>.rejected.txt beside it, as LibreOffice saves plain text:
one paragraph to a line. This is what an editor does to check a marked revision (round-trip-plan-3.md, T8.0), and
it is stricter than reading the file with the app's own reader, which `npm run probe:marked` did before.

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
    profile, port, files = sys.argv[1], sys.argv[2], sys.argv[3:]
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
    manager = ctx.ServiceManager
    desktop = manager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
    dispatch = manager.createInstanceWithContext('com.sun.star.frame.DispatchHelper', ctx)
    try:
        for path in files:
            for command, view in (('.uno:AcceptAllTrackedChanges', 'accepted'), ('.uno:RejectAllTrackedChanges', 'rejected')):
                doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(path), '_blank', 0, (prop('Hidden', True),))
                dispatch.executeDispatch(doc.getCurrentController().getFrame(), command, '', 0, ())
                doc.storeToURL(uno.systemPathToFileUrl('%s.%s.txt' % (path, view)), (prop('FilterName', 'Text (encoded)'), prop('FilterOptions', 'UTF8')))
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
