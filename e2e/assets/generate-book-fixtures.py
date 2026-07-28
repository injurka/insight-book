#!/usr/bin/env python3
"""Генерирует минимальные валидные фикстуры книг для e2e-тестов аплоада.

EPUB: zip с mimetype (первым, без сжатия), META-INF/container.xml,
OEBPS/content.opf (dc:title/dc:creator/dc:language + cover), две xhtml-главы.
Структура соответствует парсеру apps/server/src/services/epub.service.ts (epub2):
обязательны container.xml -> OPF с manifest/spine; обложка через
<meta name="cover" content="cover-image"/>.

FB2: минимальный FictionBook под парсер apps/server/src/services/fb2.service.ts.
"""
import base64
import zipfile
from pathlib import Path

OUT = Path(__file__).parent

TITLE = 'E2E Upload Autotest Book'
AUTHOR = 'E2E Author'

# 1x1 синий PNG (валидный, достаточно для extractCover)
PNG_1PX = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
)

CONTAINER = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
'''

OPF = f'''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{TITLE}</dc:title>
    <dc:creator>{AUTHOR}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">urn:uuid:e2e-upload-autotest-0001</dc:identifier>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-image" href="cover.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>
'''


def chapter(heading: str, body: str) -> str:
    paragraphs = ''.join(
        f'<p>{body} Sentence number {i} of the autotest chapter.</p>'
        for i in range(1, 12)
    )
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>{heading}</title></head>
<body>
<h1>{heading}</h1>
{paragraphs}
</body>
</html>
'''


FB2 = f'''<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"
             xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info>
      <genre>prose</genre>
      <author>
        <first-name>E2E</first-name>
        <last-name>FB2 Author</last-name>
      </author>
      <book-title>E2E Upload Autotest FB2</book-title>
      <lang>en</lang>
    </title-info>
    <document-info>
      <author><nickname>e2e</nickname></author>
      <program-used>generate-book-fixtures.py</program-used>
      <date value="2026-01-01">2026-01-01</date>
      <id>e2e-fb2-autotest-0001</id>
      <version>1.0</version>
    </document-info>
  </description>
  <body>
    <section>
      <title><p>Chapter One</p></title>
      <p>This is the first paragraph of the FB2 autotest book.</p>
      <p>Second paragraph with some more words for the parser to process.</p>
      <p>Third paragraph keeps the text flowing for page generation.</p>
    </section>
    <section>
      <title><p>Chapter Two</p></title>
      <p>Another section with content for the second part of the book.</p>
      <p>Final paragraph of the minimal FB2 fixture.</p>
    </section>
  </body>
</FictionBook>
'''


def main() -> None:
    epub_path = OUT / 'upload-book-e2e.epub'
    with zipfile.ZipFile(epub_path, 'w') as z:
        # mimetype первым и без сжатия — по спецификации EPUB
        z.writestr(
            zipfile.ZipInfo('mimetype', date_time=(2026, 1, 1, 0, 0, 0)),
            'application/epub+zip',
            compress_type=zipfile.ZIP_STORED,
        )
        z.writestr('META-INF/container.xml', CONTAINER, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr('OEBPS/content.opf', OPF, compress_type=zipfile.ZIP_DEFLATED)
        z.writestr(
            'OEBPS/chapter1.xhtml',
            chapter('Chapter One', 'The quick brown fox jumps over the lazy dog.'),
            compress_type=zipfile.ZIP_DEFLATED,
        )
        z.writestr(
            'OEBPS/chapter2.xhtml',
            chapter('Chapter Two', 'Reading books expands the vocabulary.'),
            compress_type=zipfile.ZIP_DEFLATED,
        )
        z.writestr('OEBPS/cover.png', PNG_1PX, compress_type=zipfile.ZIP_DEFLATED)

    (OUT / 'upload-book-e2e.fb2').write_text(FB2, encoding='utf-8')
    print(f'written: {epub_path} ({epub_path.stat().st_size} bytes)')
    print(f'written: {OUT / "upload-book-e2e.fb2"}')


if __name__ == '__main__':
    main()
