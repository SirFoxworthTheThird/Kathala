#!/usr/bin/env python3
"""Open Word files in LibreOffice as an editor would, and say what each opens with.

    python3 scripts/lo-settings.py <profile dir> <port> [--default-language en-GB] <file.docx>...

For each file, one line of JSON: whether LibreOffice is recording changes as it opens (Edit > Track Changes >
Record), the language its text is in, and the title and author it says the file has. With --default-language,
LibreOffice's own default language for documents is set first, as an editor's would be where they work. What
`npm run probe:marked` asks of a file made for an editor (round-trip-plan-3.md, T10.4, T10.5).

A tool for the probe, not part of the app: it needs LibreOffice and its Python bridge (python3-uno).
"""
import json
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
    profile, port = sys.argv[1:3]
    files = sys.argv[3:]
    default = None
    if files[:1] == ['--default-language']:
        default, files = files[1], files[2:]
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
    if default:
        provider = ctx.ServiceManager.createInstanceWithContext('com.sun.star.configuration.ConfigurationProvider', ctx)
        access = provider.createInstanceWithArguments(
            'com.sun.star.configuration.ConfigurationUpdateAccess', (prop('nodepath', '/org.openoffice.Office.Linguistic/General'),))
        access.setPropertyValue('DefaultLocale', default)
        access.commitChanges()
    try:
        for path in files:
            doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(path), '_blank', 0, (prop('Hidden', True),))
            # The language of the body's first paragraph, as LibreOffice has it.
            first = doc.getText().createEnumeration().nextElement()
            locale = first.CharLocale
            info = doc.getDocumentProperties()
            print(json.dumps({
                'file': path.rsplit('/', 1)[-1],
                'recording': bool(doc.getPropertyValue('RecordChanges')),
                'language': '%s-%s' % (locale.Language, locale.Country) if locale.Language else '',
                'title': info.Title,
                'author': info.Author,
            }), flush=True)
            doc.close(True)
    finally:
        try:
            desktop.terminate()
        except Exception:
            pass
        office.wait(timeout=60)


if __name__ == '__main__':
    main()
