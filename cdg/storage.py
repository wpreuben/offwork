"""Atomic JSON sessions. A successful action response means fsync + replace finished.
One authoritative file contains current state, exact checkpoints and public LLM context.
No secondary save file can diverge from the authoritative revision.
"""
import json
import os
import re
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from . import engine

SCHEMA_VERSION=1
class Conflict(ValueError): pass

def now(): return datetime.now(timezone.utc).isoformat()

def context(session):
 return {'schema_version':SCHEMA_VERSION,'session_id':session['id'],'revision':session['revision'],
  'game':session['state']['game'],'state':engine.view(session['state']),
  'recent_history':[{k:e[k] for k in ('revision','at','action','message')} for e in session['history'][-24:]],
  'instructions':[
   'You assist the human controlling BOTH sides. Choose in the interest of the active side.',
   'Hidden card identities and deck order are intentionally omitted. Do not invent them.',
   'The solo PDFs restrict card selection, not board legality. Ask the human to verify original-game event and board prerequisites.',
   'Reply with JSON: {"expected_revision": revision, "action": one available_actions object}.',
   'base_legal=true and base_phases_done=true are attestations that must be confirmed by the human.',
   'Optional note action: {"type":"note","text":"board position, decision or rationale"}.',
   'Mata Hari is CP #17 by explicit user correction of the supplied PDF #22.',
  ]}

class Store:
 def __init__(self,root):
  self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True);self.lock=threading.RLock()
 def path(self,sid):
  if not isinstance(sid,str) or not re.fullmatch(r'[0-9a-f]{32}',sid): raise ValueError('잘못된 세션 ID입니다.')
  return self.root/f'{sid}.json'
 def read(self,sid):
  with self.lock: return json.loads(self.path(sid).read_text())
 def save(self,session):
  session['llm_context']=context(session)
  data=json.dumps(session,ensure_ascii=False,indent=2,allow_nan=False)+'\n'
  fd,name=tempfile.mkstemp(prefix='.save-',suffix='.tmp',dir=self.root)
  try:
   with os.fdopen(fd,'w',encoding='utf-8') as f: f.write(data);f.flush();os.fsync(f.fileno())
   os.replace(name,self.path(session['id']))
   if hasattr(os,'O_DIRECTORY'):
    directory=os.open(self.root,os.O_DIRECTORY)
    try: os.fsync(directory)
    finally: os.close(directory)
  finally:
   if os.path.exists(name): os.unlink(name)
 def record(self,session,action,message):
  session['updated_at']=now()
  session['history'].append({'revision':session['revision'],'at':session['updated_at'],
   'action':action,'message':message,'state_after':session['state']})
  self.save(session)
 def create(self,game,options,name=''):
  with self.lock:
   state=engine.create(game,options)
   session={'schema_version':SCHEMA_VERSION,'id':uuid.uuid4().hex,'name':str(name).strip()[:80] or '패스 오브 글로리',
     'created_at':now(),'updated_at':now(),'revision':0,'state':state,'history':[]}
   self.record(session,{'type':'create','game':game,'options':options},'새 게임을 준비했습니다. 마타 하리: 카드 이미지 #17 적용.')
   return session
 def act(self,sid,revision,action):
  with self.lock:
   session=self.read(sid)
   if type(revision) is not int or revision!=session['revision']: raise Conflict('다른 선택이 먼저 저장되었습니다. 최신 상태를 확인하고 다시 선택하세요.')
   if not isinstance(action,dict): raise ValueError('action은 JSON 객체여야 합니다.')
   state,message=engine.apply(session['state'],action)
   session['state']=state;session['revision']+=1
   self.record(session,action,message)
   return session
 def listing(self):
  with self.lock:
   items=[]
   for path in self.root.glob('*.json'):
    s=json.loads(path.read_text())
    items.append({k:s[k] for k in ('id','name','revision','created_at','updated_at')} | {'turn':s['state']['turn']})
   return sorted(items,key=lambda s:s['updated_at'],reverse=True)
 def response(self,s):
  return {'id':s['id'],'name':s['name'],'revision':s['revision'],'updated_at':s['updated_at'],
   'save_path':f'data/sessions/{s["id"]}.json','state':engine.view(s['state']),
   'history':[{k:e[k] for k in ('revision','at','action','message')} for e in s['history']]}
