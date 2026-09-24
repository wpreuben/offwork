"""Build the visible CC: BOT Korean-to-English glossary from the supplied CSVs."""

import csv
from html import escape
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'web' / 'combat-commander'
SOURCES = BASE / 'glossary'
PAGE = BASE / 'index.html'
START = '<!-- GLOSSARY_ROWS_START -->'
END = '<!-- GLOSSARY_ROWS_END -->'


def pairs(filename):
    with (SOURCES / filename).open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.reader(handle)
        next(reader)
        for row in reader:
            if len(row) < 2:
                raise ValueError(f'{filename}: incomplete glossary row')
            english, korean = row[:2]
            if not english.strip() or not korean.strip():
                raise ValueError(f'{filename}: empty glossary term')
            yield korean.strip(), english.strip()


bot = list(dict.fromkeys(pairs('CC_Bot_Solo_3.1_용어집.csv')))
seen = set(bot)
general = []
for filename in ('통일_용어집.csv', '목록표_용어대조.csv'):
    for pair in pairs(filename):
        if pair not in seen:
            seen.add(pair)
            general.append(pair)
general.sort(key=lambda pair: (pair[0], pair[1]))

lines = []
for label, entries in (('CC: BOT 진행 용어', bot), ('기본 게임·목록표 용어', general)):
    lines.append(f'<tr class="glossary-group"><th scope="rowgroup" colspan="2">{label} · {len(entries)}개</th></tr>')
    lines.extend(f'<tr><td>{escape(korean)}</td><td lang="en">{escape(english)}</td></tr>' for korean, english in entries)
body = '\n'.join(lines)
page = PAGE.read_text(encoding='utf-8')
if page.count(START) != 1 or page.count(END) != 1:
    raise ValueError('glossary markers missing or duplicated')
before, remainder = page.split(START, 1)
_, after = remainder.split(END, 1)
updated = before + START + '\n' + body + '\n' + END + after
if '--check' in sys.argv:
    if page != updated:
        raise SystemExit('CC: BOT glossary HTML is out of date')
else:
    PAGE.write_text(updated, encoding='utf-8')
print(f'CC: BOT glossary: {len(bot)} bot terms + {len(general)} general terms')
