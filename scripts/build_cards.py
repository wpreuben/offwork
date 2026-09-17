"""Rebuild supplied card scans as WebP assets. Requires Pillow; runtime does not.
Sheet identifiers are explicit: never rely on filesystem enumeration order.
Only OPS, printed CC markers and stage were transcribed. PDF terminology wins.
"""
import json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
SHEETS = [
 ('cp',1,'1891705397',[3,2,2,2,2,3,3,3]),
 ('cp',9,'19156111',[4,3,2,4,4,4,2,2]),
 ('cp',17,'19254914',[2,2,2,3,3,3,3,3]),
 ('cp',25,'193490A',[4,4,4,4,2,2,3,3]),
 ('cp',33,'194477C',[5,5,2,2,2,2,2,3]),
 ('cp',41,'19541055',[3,3,3,3,4,4,4,4]),
 ('cp',49,'196311D',[4,4,4,5,5,5,4]),
 ('ap',1,'0920374',[4,4,3,2,2,2,2,2]),
 ('ap',9,'18132845',[3,3,3,3,4,4,3,5]),
 ('ap',17,'1826371',[5,2,2,2,2,3,2,3]),
 ('ap',25,'183606C',[3,3,3,4,4,4,4,2]),
 ('ap',33,'18501277',[2,3,4,2,2,2,2,2]),
 ('ap',41,'18596160',[3,3,3,3,3,4,4,4]),
 ('ap',49,'1866569',[4,4,4,4,5,5,5]),
]
CC = {'cp':{2,4,15,16,18,19,26,30,31,35,40,43,44,49,50,51},
      'ap':{4,5,6,7,18,19,21,36,39,48}}
cards = {}
for side,start,fragment,ops_values in SHEETS:
 source = next(p for p in (ROOT/'images').glob('*.png') if fragment in p.name)
 im=Image.open(source);w,h=im.size
 for k,ops in enumerate(ops_values):
  number=start+k; cid=f'{side}-{number:02}'
  box=(round(k%4*w/4),round(k//4*h/2),round((k%4+1)*w/4),round((k//4+1)*h/2))
  crop=im.crop(box);crop.thumbnail((600,840));crop.save(ROOT/f'web/assets/cards/{cid}.webp',quality=84)
  cards[cid]={'id':cid,'side':side,'number':number,'name':f'전략 카드 #{number}',
    'ops':ops,'combat':number in CC[side],
    'stage':'mobilization' if number<=14 else 'limited' if number<=34 else 'total',
    'image':f'/assets/cards/{cid}.webp','sourceImage':source.name}
cards['cp-01']['name']='8월의 포성'
cards['cp-17']['name']='마타 하리'
cards['cp-17']['ruleCorrection']='PDF #22 → 카드 이미지 #17 (사용자 확인)'
cards['cp-22']['name']='독일군 증원 (#22)'
cards['ap-23']['name']='첩보 활동'
(ROOT/'cdg/games/pog_cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
print(f'Built {len(cards)} cards')
