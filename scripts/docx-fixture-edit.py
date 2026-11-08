"""
Edit a Word file as an editor would, in LibreOffice, to make R4's fixture
(src/lib/__tests__/fixtures/docx/edited-libreoffice.docx) from the marked
export beside it:

    python3 scripts/docx-fixture-edit.py marked.docx edited-libreoffice.docx

As "Ana Editor": one edit with tracking off ("He had" -> "He held"), then
tracking on: " in the rain" inserted after "at dawn", "twice, and " deleted,
and a comment ("Which boy? Name him.") across "The boy waited on the quay".
Needs LibreOffice and its Python (uno).
"""
import sys, time, subprocess, uno
from com.sun.star.beans import PropertyValue
src, dst = sys.argv[1], sys.argv[2]
proc = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore', '--accept=socket,host=127.0.0.1,port=2002;urp;'])
local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
for _ in range(60):
    try:
        ctx = resolver.resolve('uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext'); break
    except Exception: time.sleep(0.5)
smgr = ctx.ServiceManager
def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p
# The editor's name, as LibreOffice signs changes and comments with it.
cfg = smgr.createInstanceWithContext('com.sun.star.configuration.ConfigurationProvider', ctx)
access = cfg.createInstanceWithArguments('com.sun.star.configuration.ConfigurationUpdateAccess', (prop('nodepath', '/org.openoffice.UserProfile/Data'),))
access.setPropertyValue('givenname', 'Ana'); access.setPropertyValue('sn', 'Editor'); access.commitChanges()
desktop = smgr.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), '_blank', 0, (prop('Hidden', True),))
text = doc.getText()
def find(s):
    d = doc.createSearchDescriptor(); d.SearchString = s; r = doc.findFirst(d)
    assert r is not None, s
    return r
# Tracking off: an edit the editor made without recording it.
doc.RecordChanges = False
find('He had a ledger').setString('He held a ledger')
# Tracking on: an insertion and a deletion.
doc.RecordChanges = True
r = find('at dawn'); text.insertString(r.getEnd(), ' in the rain', False)
find('twice, and ').setString('')
# A comment across a phrase.
ann = doc.createInstance('com.sun.star.text.textfield.Annotation')
ann.Author = 'Ana Editor'; ann.Content = 'Which boy? Name him.'
text.insertTextContent(find('The boy waited on the quay'), ann, True)
doc.storeToURL(uno.systemPathToFileUrl(dst), (prop('FilterName', 'MS Word 2007 XML'),))
doc.close(True)
try: desktop.terminate()
except Exception: pass
proc.wait(timeout=30)
print('saved', dst)
