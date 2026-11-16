#!/usr/bin/env python3
"""Word drafts in the shapes writers make them, for measuring Import Manuscript from .docx (issue #697).

    python3 scripts/docx-import-corpus.py <kathala-library>/library <out dir>

Each file is a Library book's opening chapters, written as a Word document in one of the ways a draft is
commonly formatted, beside a .truth.json of what it holds: the chapters' titles, the scenes in each, every
scene's words, and its italic spans. The shapes are written as Word's own XML (WordprocessingML) by hand,
so each convention is exactly the one named, including those LibreOffice cannot produce, such as Word's
localised style ids. One more, made by LibreOffice itself from HTML, is added by the probe.

A tool, not part of the app.
"""
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

LIB, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def book(slug, chapters):
    """The book's first `chapters` chapters, in order, each with its scenes' prose."""
    d = json.loads((LIB / f'{slug}.pwk').read_text())
    texts = {t['eventId']: t['text'] for t in d['sceneTexts']}
    chs = sorted(d['chapters'], key=lambda c: c['number'])[:chapters]
    out = []
    for c in chs:
        evs = sorted((e for e in d['events'] if e['chapterId'] == c['id']), key=lambda e: e['sortOrder'])
        scenes = [texts[e['id']] for e in evs if texts.get(e['id'], '').strip()]
        if scenes:
            out.append({'title': c['title'], 'scenes': scenes})
    return d['world']['name'], out


EMPH = re.compile(r'(?<![\w*_])([_*])(?=\S)(.+?)(?<=\S)\1(?![\w*_])')


def spans(text):
    """A paragraph as runs: (text, italic), from the book's `_…_` or `*…*` markup."""
    out, at = [], 0
    for m in EMPH.finditer(text):
        if m.start() > at:
            out.append((text[at:m.start()], False))
        out.append((m.group(2), True))
        at = m.end()
    if at < len(text):
        out.append((text[at:], False))
    return out


def plain(text):
    return ''.join(t for t, _ in spans(text))


def italics(text):
    return [t for t, i in spans(text) if i]


def paras(scene):
    return [p.strip() for p in re.split(r'\n\s*\n', scene) if p.strip()]


def run(text, italic=False, rstyle=None, bold=False):
    props = ''
    if rstyle:
        props += f'<w:rStyle w:val="{rstyle}"/>'
    if bold:
        props += '<w:b/>'
    if italic and not rstyle:
        props += '<w:i/>'
    rpr = f'<w:rPr>{props}</w:rPr>' if props else ''
    parts = text.split('\n')
    inner = '<w:br/>'.join(f'<w:t xml:space="preserve">{escape(x)}</w:t>' for x in parts)
    return f'<w:r>{rpr}{inner}</w:r>'


def para(text, style=None, center=False, page_break=False, italic_style=None, indent_tab=False, bold=False, runs=None):
    ppr = ''
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if page_break:
        ppr += '<w:pageBreakBefore/>'
    if center:
        ppr += '<w:jc w:val="center"/>'
    body = runs if runs is not None else ''.join(
        run(t, i, italic_style if i else None, bold) for t, i in spans(text))
    if indent_tab:
        body = '<w:r><w:tab/></w:r>' + body
    return f'<w:p>{f"<w:pPr>{ppr}</w:pPr>" if ppr else ""}{body}</w:p>'


def styles(extra=''):
    """styles.xml: Normal, Title and headings under Word's English ids and names, and any extra."""
    base = ''.join(
        f'<w:style w:type="paragraph" w:styleId="{i}"><w:name w:val="{n}"/>{o}</w:style>'
        for i, n, o in [
            ('Normal', 'Normal', ''),
            ('Title', 'Title', ''),
            ('Heading1', 'heading 1', '<w:pPr><w:outlineLvl w:val="0"/></w:pPr>'),
            ('Heading2', 'heading 2', '<w:pPr><w:outlineLvl w:val="1"/></w:pPr>'),
            ('Heading3', 'heading 3', '<w:pPr><w:outlineLvl w:val="2"/></w:pPr>'),
        ])
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles {W}>{base}{extra}</w:styles>'


def save(name, body, styles_xml, truth, comments=None):
    doc = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {W}><w:body>{body}<w:sectPr/></w:body></w:document>'
    ct = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
          + ('<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' if comments else '')
          + '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    drels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
             '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
             + ('<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>' if comments else '')
             + '</Relationships>')
    with zipfile.ZipFile(OUT / f'{name}.docx', 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ct)
        z.writestr('_rels/.rels', rels)
        z.writestr('word/_rels/document.xml.rels', drels)
        z.writestr('word/document.xml', doc)
        z.writestr('word/styles.xml', styles_xml)
        if comments:
            z.writestr('word/comments.xml', f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments {W}>{comments}</w:comments>')
    (OUT / f'{name}.truth.json').write_text(json.dumps(truth, ensure_ascii=False, indent=1))
    print(name, len(truth['chapters']), 'chapters,', sum(len(c['scenes']) for c in truth['chapters']), 'scenes')


def truth_of(title, chapters, shape, chapter_titles=None):
    return {
        'book': title, 'shape': shape,
        'chapters': [{
            'title': (chapter_titles or [c['title'] for c in chapters])[k],
            'scenes': [{'words': len(plain('\n\n'.join(paras(s))).split()), 'italics': [x for p in paras(s) for x in italics(p)]} for s in c['scenes']],
        } for k, c in enumerate(chapters)],
    }


def scenes_body(c, brk, **pk):
    out = ''
    for k, s in enumerate(c['scenes']):
        if k:
            out += brk
        out += ''.join(para(p, **pk) for p in paras(s))
    return out


NUMBERS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']

# 1. Word's heading styles for chapters, `* * *` centred between scenes, a Title for the book.
t, chs = book('persuasion', 6)
body = para(t, style='Title') + ''.join(para(c['title'], style='Heading1') + scenes_body(c, para('* * *', center=True)) for c in chs)
save('01-heading-styles', body, styles(), truth_of(t, chs, 'Heading 1 chapters, * * * breaks, Title'))

# 2. No heading styles: a bold centred line, CHAPTER ONE, after a page break; `#` between scenes.
t, chs = book('carmilla', 6)
titles = [f'CHAPTER {NUMBERS[k].upper()}' for k in range(len(chs))]
body = ''.join(para(titles[k], center=True, page_break=k > 0, bold=True) + scenes_body(c, para('#', center=True)) for k, c in enumerate(chs))
save('02-bold-lines-page-breaks', body, styles(), truth_of(t, chs, 'bold CHAPTER ONE lines after page breaks, # breaks', titles))

# 3. Word in another language: heading styles by localised ids (Titre1), a Portuguese book.
t, chs = book('os-maias', 5)
loc = styles('<w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>')
body = ''.join(para(c['title'], style='Titre1') + scenes_body(c, para('***', center=True)) for c in chs)
save('03-localised-style-ids', body, loc, truth_of(t, chs, 'heading 1 under a localised id (Titre1), *** breaks'))

# 4. A style of the writer's own, Chapter Title, at outline level 1; scenes parted by two empty paragraphs.
t, chs = book('sign-of-the-four', 6)
own = styles('<w:style w:type="paragraph" w:customStyle="1" w:styleId="ChapterTitle"><w:name w:val="Chapter Title"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>')
body = ''.join(para(c['title'], style='ChapterTitle') + scenes_body(c, para('') + para('')) for c in chs)
save('04-own-style-blank-breaks', body, own, truth_of(t, chs, 'own Chapter Title style (outline level 1), two empty paragraphs between scenes'))

# 5. Parts and chapters: Heading 1 for parts, Heading 2 for chapters, ⁂ between scenes.
t, chs = book('frankenstein', 6)
body = ''
for k, c in enumerate(chs):
    if k % 3 == 0:
        body += para(f'Part {NUMBERS[k // 3]}', style='Heading1')
    body += para(c['title'], style='Heading2') + scenes_body(c, para('⁂', center=True))
tr = truth_of(t, chs, 'Heading 1 parts, Heading 2 chapters, ⁂ breaks')
tr['parts'] = ['Part One', 'Part Two']
save('05-parts-and-chapters', body, styles(), tr)

# 6. Standard manuscript format: contact lines, title, CHAPTER 1 in caps after page breaks, `#`, END.
t, chs = book('kidnapped', 5)
titles = [f'CHAPTER {k + 1}' for k in range(len(chs))]
body = para('Jane Writer') + para('12 Any Street') + para('About 9,000 words') + para(t.upper(), center=True) + para('by Jane Writer', center=True)
body += ''.join(para(titles[k], center=True, page_break=True) + scenes_body(c, para('#', center=True), indent_tab=True) for k, c in enumerate(chs))
body += para('END', center=True)
save('06-manuscript-format', body, styles(), truth_of(t, chs, 'standard manuscript format: contact lines, CHAPTER 1, # breaks, END', titles))

# 7. Italics by Word's Emphasis character style, paragraphs opening on a tab, verse with soft line breaks.
t, chs = book('alice-in-wonderland', 5)
emph = styles('<w:style w:type="character" w:styleId="Emphasis"><w:name w:val="Emphasis"/><w:rPr><w:i/></w:rPr></w:style>')
body = ''.join(para(c['title'], style='Heading1') + scenes_body(c, para('* * *', center=True), italic_style='Emphasis', indent_tab=True) for c in chs)
save('07-emphasis-style-tabs', body, emph, truth_of(t, chs, 'italics by the Emphasis character style, tab-indented paragraphs'))

# 8. A draft with tracked changes and comments still in it: an insertion, a deletion and a comment per chapter.
t, chs = book('pride-and-prejudice', 4)
body, comments, cid = '', '', 0
for c in chs:
    body += para(c['title'], style='Heading1')
    for k, s in enumerate(c['scenes']):
        if k:
            body += para('* * *', center=True)
        ps = paras(s)
        for j, p in enumerate(ps):
            if j == 0:
                cid += 1
                runs = ''.join(run(x, i) for x, i in spans(p))
                runs = (f'<w:commentRangeStart w:id="{cid}"/>' + runs + f'<w:commentRangeEnd w:id="{cid}"/>'
                        f'<w:r><w:commentReference w:id="{cid}"/></w:r>'
                        f'<w:ins w:id="{1000 + cid}" w:author="Jane Writer"><w:r><w:t xml:space="preserve"> Added later.</w:t></w:r></w:ins>'
                        f'<w:del w:id="{2000 + cid}" w:author="Jane Writer"><w:r><w:delText xml:space="preserve"> Cut since.</w:delText></w:r></w:del>')
                comments += f'<w:comment w:id="{cid}" w:author="Jane Writer"><w:p><w:r><w:t>Check this against chapter one.</w:t></w:r></w:p></w:comment>'
                body += para(p, runs=runs)
            else:
                body += para(p)
tr = truth_of(t, chs, 'Heading 1 chapters, tracked changes and comments left in')
tr['tracked'] = {'insertions': cid, 'deletions': cid, 'inserted': ' Added later.', 'deleted': ' Cut since.'}
tr['comments'] = cid
save('08-tracked-and-comments', body, styles(), tr, comments)
