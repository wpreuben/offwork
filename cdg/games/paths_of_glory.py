"""Rules adapter for the two supplied PDFs (both p.1).
Rule references use common § or pog headings. See docs/RULES.md for boundaries.
C is ALWAYS deck[0], never a sixth card or a separately dealt slot.
"""
import copy
import json
import secrets
from pathlib import Path

ID = 'paths-of-glory'
NAME = '패스 오브 글로리'
CARDS = json.loads(Path(__file__).with_name('pog_cards.json').read_text())
SIDES = ('cp', 'ap')
SLOTS = 'ABCDE'
STAGES = ('mobilization', 'limited', 'total')
DICE = [
 {'value':1, 'title':'C 또는 최저 작전값', 'detail':'C를 공개합니다. C 또는 A/B/D/E의 앞면 최저 작전값 카드를 선택합니다. 빈 슬롯은 앞면으로 채웁니다. !!는 효과가 없습니다.'},
 {'value':2, 'title':'앞면 이벤트 또는 최저 작전값', 'detail':'앞면이 2장 미만이면 2장이 될 때까지 직접 공개할 슬롯을 고릅니다. 사용 가능한 앞면 이벤트 또는 최저 작전값 카드의 작전 사용을 선택합니다.'},
 {'value':3, 'title':'A · B · C', 'detail':'A/B/C를 공개하고 한 장을 선택합니다. A/B는 현재 면 상태로 보충합니다.'},
 {'value':4, 'title':'A · B', 'detail':'A/B를 공개하고 한 장을 선택합니다. A/B는 현재 면 상태로 보충합니다.'},
 {'value':5, 'title':'C · D · E', 'detail':'C/D/E를 공개하고 한 장을 선택합니다. D/E는 현재 면 상태로 보충합니다.'},
 {'value':6, 'title':'D · E', 'detail':'D/E를 공개하고 한 장을 선택합니다. D/E는 현재 면 상태로 보충합니다.'},
]
class RuleError(ValueError): pass

def require(condition, message):
 if not condition: raise RuleError(message)

def other(side): return 'ap' if side=='cp' else 'cp'

def card(state, side, slot):
 p=state['sides'][side]
 if slot=='C': return {'id':p['deck'][0], 'face_up':p['c_face_up']} if p['deck'] else None
 return p['slots'].get(slot)

def visible(state, side):
 return {s:c for s in SLOTS if (c:=card(state,side,s)) and c['face_up']}

def reveal(state, side, slot):
 c=card(state,side,slot)
 if c:
  if slot=='C': state['sides'][side]['c_face_up']=True
  else: c['face_up']=True;state['sides'][side]['faces'][slot]=True

def clamp(state, side):
 p=state['sides'][side]
 if not p['deck']:
  p['remaining']=min(p['remaining'],4)
  p['c_face_up']=False

def fill(state,side,slot,face_up):
 p=state['sides'][side]
 if slot=='C':
  p['c_face_up']=bool(p['deck']) and face_up
 elif not p['slots'][slot] and p['deck']:
  p['slots'][slot]={'id':p['deck'].pop(0),'face_up':face_up}
  p['faces'][slot]=face_up
  p['c_face_up']=False
 clamp(state,side)

def take(state,side,slot):
 p=state['sides'][side];c=card(state,side,slot)
 require(c is not None,'빈 슬롯입니다.')
 c=copy.deepcopy(c)
 if slot=='C': p['deck'].pop(0);p['c_face_up']=False
 else: p['slots'][slot]=None
 clamp(state,side)
 return c

def shuffled(ids):
 result=list(ids);secrets.SystemRandom().shuffle(result);return result

def create(options):
 require(options.get('max_hand',7) in (7,8),'최대 핸드는 7 또는 8입니다.')
 state={'game':ID,'turn':1,'phase':'action','active':'cp','max_hand':options.get('max_hand',7),
  'rounds':{'cp':0,'ap':0},'pending':None,'battle':None,'notes':[],
  'guns':bool(options.get('guns',True)), 'mata_hari_number':17,
  'draw_discards':{'cp':0,'ap':0},'draw_allowance':{'cp':0,'ap':0},'sides':{}}
 # User correction: the supplied card image identifies Mata Hari as CP #17.
 for side in SIDES:
  ids=[c['id'] for c in CARDS.values() if c['side']==side and c['stage']=='mobilization']
  if side=='cp' and state['guns']: ids.remove('cp-01')
  state['sides'][side]={'deck':shuffled(ids),'slots':dict.fromkeys('ABDE'),'c_face_up':False,
    'faces':{s:s in 'AB' for s in 'ABDE'},
    'remaining':state['max_hand'],'discard':[],'removed':[], 'stage':'mobilization'}
  for slot in 'ABDE': fill(state,side,slot,slot in 'AB')
  if side=='cp' and state['guns']:
   state['sides'][side]['deck'].insert(0,'cp-01');state['sides'][side]['c_face_up']=True
 if state['guns']: state['pending']={'die':None,'forced':'guns','status':'select'}
 return state

def event_allowed(state, side, cid):
 c=CARDS[cid]
 if c['combat']: return False
 if cid=='cp-01': return state['turn']==1 and state['rounds']['cp']==0
 return True  # Other original-game prerequisites require explicit user attestation.

def candidates(state):
 if state['phase']!='action' or not state['pending'] or state['pending']['status']!='select' or state['battle']: return []
 side=state['active'];p=state['pending'];v=visible(state,side)
 if p.get('forced')=='guns': return [{'slot':'C','card':'cp-01','modes':['event']}]
 die=p['die'];result=[]
 if die==1:
  alternatives={s:c for s,c in v.items() if s!='C'}
  low=min((CARDS[c['id']]['ops'] for c in alternatives.values()),default=None)
  chosen=[s for s,c in v.items() if s=='C' or CARDS[c['id']]['ops']==low]
 elif die==2: chosen=list(v)
 else: chosen=[s for s in {3:'ABC',4:'AB',5:'CDE',6:'DE'}[die] if s in v]
 low=min((CARDS[c['id']]['ops'] for c in v.values()),default=None)
 for slot in chosen:
  cid=v[slot]['id']
  modes=(['ops'] if CARDS[cid]['ops']==low else []) if die==2 else ['ops','sr','rp']
  if event_allowed(state,side,cid): modes.append('event')
  if modes: result.append({'slot':slot,'card':cid,'modes':modes})
 return result

def next_action(state):
 side=state['active'];state['rounds'][side]+=1;state['pending']=None
 if all(n>=6 for n in state['rounds'].values()) or all(p['remaining']==0 for p in state['sides'].values()):
  state['phase']='draw';state['draw_discards']={'cp':0,'ap':0}
  state['draw_allowance']={s:state['sides'][s]['remaining'] for s in SIDES}
 else:
  state['active']=other(side) if state['rounds'][other(side)]<6 else side

def available_actions(state):
 """JSON action protocol. UI and LLM share this authoritative list."""
 actions=[]
 def add(kind,**kw): actions.append({'type':kind,**kw})
 if state['battle']:
  b=state['battle'];side=b['side'];p=state['sides'][side]
  for slot,c in visible(state,side).items():
   if CARDS[c['id']]['combat'] and p['remaining']>0:
    for destination in ('discard','removed'): add('combat_play',slot=slot,destination=destination,base_legal=True)
  add('combat_pass')
  return actions
 if state['phase']=='resolve':
  add('resolve');add('battle_start',attacker='cp');add('battle_start',attacker='ap')
 elif state['phase']=='draw':
  for side in SIDES:
   if state['draw_discards'][side]<state['draw_allowance'][side]:
    for slot,c in visible(state,side).items():
     if CARDS[c['id']]['combat']: add('draw_discard',side=side,slot=slot)
  add('next_turn',base_phases_done=True)
 elif not state['pending']:
  if state['sides'][state['active']]['remaining']>0: add('roll')
  else: add('skip')
 else:
  p=state['pending']
  if p['status']=='reveal':
   for slot in SLOTS:
    c=card(state,state['active'],slot)
    if c and not c['face_up']: add('reveal',slot=slot)
  else:
   for c in candidates(state):
    for mode in c['modes']:
     add('play',slot=c['slot'],mode=mode,base_legal=True,destination='removed' if c['card']=='cp-01' and mode=='event' else 'discard',grants_cards=False)
   if not candidates(state) and not state['sides'][state['active']]['deck']: add('auto_ops')
 if state['phase'] in ('draw','resolve'):
  for side in SIDES:
   p=state['sides'][side]
   if not p['deck'] and (p['discard'] or any(c and not c['face_up'] for c in p['slots'].values())):
    add('reshuffle',side=side,reason='exhaustion')
   if state['phase']=='draw' and p['stage']!='total': add('reshuffle',side=side,reason='war',stage=STAGES[STAGES.index(p['stage'])+1],base_legal=True)
 return actions

def apply(state, action):
 """Mutates a private copy; callers commit only after validation succeeds."""
 kind=action.get('type');side=state['active'];p=state['sides'][side]
 if kind=='note':
  note=action.get('text','')
  require(isinstance(note,str) and 0<len(note.strip())<=4000,'메모는 1~4000자로 입력하세요.')
  state['notes'].append({'turn':state['turn'],'side':side,'text':note.strip()})
  return '상황 메모를 기록했습니다.'
 legal=available_actions(state)
 require(any(a['type']==kind for a in legal),'현재 단계에서 할 수 없는 행동입니다.')
 if kind=='roll':
  die=action.get('value')
  if die is None: die=secrets.randbelow(6)+1
  require(type(die) is int and 1<=die<=6,'운명 주사위는 1~6입니다.')
  state['pending']={'die':die,'status':'select'}
  for slot in {1:'C',2:'',3:'ABC',4:'AB',5:'CDE',6:'DE'}[die]: reveal(state,side,slot)
  if die==2 and len(visible(state,side))<2 and any(card(state,side,s) and not card(state,side,s)['face_up'] for s in SLOTS): state['pending']['status']='reveal'
  return f'운명 주사위 {die}: {DICE[die-1]["title"]}'
 if kind=='reveal':
  slot=action.get('slot');require(any(a.get('slot')==slot for a in legal),'공개할 수 없는 슬롯입니다.')
  reveal(state,side,slot)
  if len(visible(state,side))>=2 or not any(card(state,side,s) and not card(state,side,s)['face_up'] for s in SLOTS): state['pending']['status']='select'
  return f'{slot} 슬롯을 공개했습니다.'
 if kind=='skip': next_action(state);return '남은 카드가 없어 행동 라운드를 넘겼습니다.'
 if kind=='auto_ops':
  state['phase']='resolve';state['pending']['played']={'automatic_ops':1}
  return '받기 더미 고갈로 선택 가능한 카드가 없어 자동 작전값 1을 받습니다.'
 if kind=='play':
  slot=action.get('slot');mode=action.get('mode')
  require(any(c['slot']==slot and mode in c['modes'] for c in candidates(state)),'주사위 결과가 허용하지 않는 카드 또는 사용 방식입니다.')
  require(action.get('base_legal') is True,'원래 게임의 사용 조건을 확인해야 합니다.')
  destination=action.get('destination','discard')
  require(destination in ('discard','removed'),'카드의 이동 위치를 확인하세요.')
  c=card(state,side,slot);cid=c['id']
  if cid=='cp-01' and mode=='event': require(destination=='removed','8월의 포성 이벤트 사용 후 카드를 제거하세요.')
  require(type(action.get('grants_cards',False)) is bool,'추가 카드 효과 여부가 올바르지 않습니다.')
  # common 2.2 overrides common 4.3 only when the card effect grants extra cards.
  if not action.get('grants_cards',False): p['remaining']-=1
  taken=take(state,side,slot);p[destination].append(cid)
  espionage=mode=='event' and cid in (f'cp-{state["mata_hari_number"]:02}','ap-23')
  if espionage:
   for s in SLOTS: reveal(state,other(side),s)
  state['pending']['played']={'slot':slot,'card':cid,'mode':'ops' if espionage else mode,'chosen_mode':mode,
    'face_up':taken['face_up'],'destination':destination,'grants_cards':action.get('grants_cards',False),'espionage':espionage}
  state['phase']='resolve'
  return f'{slot} / {cid}: '+('상대 디스플레이를 모두 공개하고 작전 카드로 사용합니다.' if espionage else f'{mode} 사용. 원래 게임의 효과를 해결하세요.')
 if kind=='resolve':
  played=state['pending']['played'];die=state['pending']['die']
  if 'slot' in played:
   if die==1:
    for s in 'ABDE': fill(state,side,s,True)
    if played['slot']=='C': fill(state,side,'C',True)
   else:
    slots={2:'ABDE',3:'AB',4:'AB',5:'DE',6:'DE',None:''}[die]
    for s in slots: fill(state,side,s,p['faces'][s])
    # C is the draw pile; only result 1 explicitly turns its new top face up.
  state['phase']='action';next_action(state)
  return '효과 해결과 슬롯 보충을 마쳤습니다.'
 if kind=='draw_discard':
  side=action.get('side');slot=action.get('slot')
  require(any(a.get('side')==side and a.get('slot')==slot and a['type']==kind for a in legal),'버릴 수 없는 전투 카드입니다.')
  c=take(state,side,slot);state['sides'][side]['discard'].append(c['id']);state['draw_discards'][side]+=1
  return f'{side}의 앞면 전투 카드를 버렸습니다.'
 if kind=='next_turn':
  require(action.get('base_phases_done') is True,'원래 게임의 나머지 페이즈를 먼저 해결하세요.')
  for side in SIDES:
   state['sides'][side]['remaining']=state['max_hand']
   for slot in 'ABDE': fill(state,side,slot,False)
   clamp(state,side)
  state.update(turn=state['turn']+1,phase='action',active='cp',rounds={'cp':0,'ap':0},pending=None,draw_discards={'cp':0,'ap':0})
  return '전략 카드 받기를 마치고 다음 턴을 시작합니다.'
 if kind=='reshuffle':
  side=action.get('side');reason=action.get('reason')
  require(any(a['type']==kind and a.get('side')==side and a.get('reason')==reason for a in legal),'허용되지 않는 다시 섞기입니다.')
  p=state['sides'][side];pool=p['deck']+p['discard'];p['discard']=[]
  if reason=='war':
   stage=action.get('stage');require(stage in STAGES and STAGES.index(stage)==STAGES.index(p['stage'])+1,'다음 전쟁 투입 단계를 선택하세요.')
   require(action.get('base_legal') is True,'기본 게임의 전쟁 투입 조건을 확인하세요.')
   for slot in 'ABDE':
    if p['slots'][slot]: pool.append(p['slots'][slot]['id']);p['slots'][slot]=None
   pool += [c['id'] for c in CARDS.values() if c['side']==side and c['stage']==stage]
   p['stage']=stage
  else:
   for slot in 'ABDE':
    c=p['slots'][slot]
    if c and not c['face_up']: pool.append(c['id']);p['slots'][slot]=None
  p['deck']=shuffled(pool);p['c_face_up']=False
  for slot in 'ABDE': fill(state,side,slot,reason=='war' and slot in 'AB')
  return f'{side}: '+('전쟁 투입 단계 상승' if reason=='war' else '고갈')+'에 따라 다시 섞었습니다.'
 if kind=='battle_start':
  attacker=action.get('attacker');require(attacker in SIDES,'공격 진영을 선택하세요.')
  state['battle']={'attacker':attacker,'side':attacker,'step':'attacker','refill':[], 'used':[]}
  return '공격자가 먼저 전투 카드 사용 여부를 결정합니다.'
 if kind=='combat_play':
  b=state['battle'];side=b['side'];p=state['sides'][side];destination=action.get('destination')
  require(destination in ('discard','removed'),'전투 카드 이동 위치가 올바르지 않습니다.')
  slot=action.get('slot')
  require(any(a['type']==kind and a.get('slot')==slot for a in legal),'사용 가능한 앞면 전투 카드가 아닙니다.')
  require(action.get('base_legal') is True,'전투 이벤트 사용 조건을 확인하세요.')
  cid=card(state,side,slot)['id'];p['remaining']-=1
  b['used'].append({'side':side,'card':cid})
  c=take(state,side,slot);p[destination].append(cid)
  b['refill'].append({'side':side,'slot':slot,'face_up':c['face_up']})
  return f'{cid}: 전투 카드 처리. 전투 종료 후 슬롯을 보충합니다.'
 if kind=='combat_pass':
  b=state['battle']
  if b['step']=='attacker': b.update(step='defender',side=other(b['attacker']));return '방어자의 전투 카드 선택입니다.'
  for item in b['refill']: fill(state,item['side'],item['slot'],item['face_up'])
  state['battle']=None
  return '전투 카드 처리를 마치고 원래 면 상태로 보충했습니다.'
 raise RuleError('알 수 없는 행동입니다.')

def public_view(state):
 result=copy.deepcopy(state)
 for side,p in result['sides'].items():
  p['deck_count']=len(p.pop('deck'))
  p['display']={}
  for slot in SLOTS:
   c=card(state,side,slot)
   p['display'][slot]=None if c is None else {'face_up':c['face_up'],'card':copy.deepcopy(CARDS[c['id']]) if c['face_up'] else None}
  p.pop('slots');p.pop('c_face_up');p.pop('faces')
 result['available_actions']=available_actions(state)
 result['candidates']=candidates(state)
 return result

def validate(state):
 for side,p in state['sides'].items():
  ids=p['deck']+p['discard']+p['removed']+[c['id'] for c in p['slots'].values() if c]
  expected={c['id'] for c in CARDS.values() if c['side']==side and STAGES.index(c['stage'])<=STAGES.index(p['stage'])}
  require(len(ids)==len(set(ids)) and set(ids)==expected,'카드 보존 규칙 위반입니다.')
  require(0<=p['remaining']<=state['max_hand'],'남은 카드 범위를 벗어났습니다.')
 require(all(0<=n<=6 for n in state['rounds'].values()),'행동 라운드 범위를 벗어났습니다.')
