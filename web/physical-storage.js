// Physical-card helper saves every confirmed step to an OPFS JSON file.
import * as rules from './games/physical-pog.js';
import {validateSession as validateLegacy} from './storage.js';

const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const eventView=e=>({revision:e.revision,at:e.at,action:e.action,message:e.message});
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID().replaceAll('-','');
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(object(x))return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function head(s){const last=s.history.at(-1);return last?.action.type==='undo'?last.action.target_revision:s.revision;}
export function undoTarget(s){const current=head(s);return current>0?(s.history[current].parent_revision??current-1):null;}
export function context(s){return {schema_version:2,session_id:s.id,revision:s.revision,game:s.state.game,state:rules.publicView(s.state),recent_history:s.history.slice(-24).map(eventView),instructions:[
 'This is a helper for physical cards. Card identities, slots and deck order are never tracked.',
 'The human resolves the physical cards and board. Do not infer which card is present.',
 'Suggest one available action with expected_revision, or ask for needed board context.'
]};}
export function validateSession(s){
 if(!object(s)||s.schema_version!==2||!/^([0-9a-f]{32})$/.test(s.id)||typeof s.name!=='string'||s.name.length>80||!Number.isInteger(s.revision)||s.revision<0||!Number.isFinite(Date.parse(s.created_at))||!Number.isFinite(Date.parse(s.updated_at))||!Array.isArray(s.history)||s.history.length!==s.revision+1)fail('전체 저장 JSON 형식(schema_version 2)을 확인하세요. 공개 상태 JSON은 복원할 수 없습니다.');
 rules.validate(s.state);
 for(const [i,e] of s.history.entries()){if(!object(e)||e.revision!==i||!Number.isFinite(Date.parse(e.at))||!object(e.action)||typeof e.action.type!=='string'||typeof e.message!=='string')fail('진행 기록 형식이 올바르지 않습니다.');rules.validate(e.state_after);}
 for(const [i,e] of s.history.entries()){
  if(i>0&&e.parent_revision!==undefined&&(!Number.isInteger(e.parent_revision)||e.parent_revision<0||e.parent_revision>=i))fail('되돌리기 기록의 연결이 올바르지 않습니다.');
  if(e.action.type==='undo'){const target=e.action.target_revision;if(!Number.isInteger(target)||target<0||target>=i||!equal(e.state_after,s.history[target].state_after))fail('되돌리기 체크포인트가 올바르지 않습니다.');}
 }
 if(!equal(s.history.at(-1).state_after,s.state))fail('마지막 체크포인트와 현재 상태가 다릅니다.');
}
function physicalFromLegacy(old){const previous=old.state,s=rules.create({max_hand:previous.max_hand,guns:previous.guns});
 s.turn=previous.turn;s.active=previous.active;s.rounds=structuredClone(previous.rounds);s.phase=previous.phase==='draw'?'draw':'action';s.pending=null;
 for(const side of ['cp','ap'])s.sides[side].remaining=previous.sides[side].remaining;
 s.notes=structuredClone(previous.notes||[]);
 if(previous.phase==='action'&&previous.pending){const p=previous.pending;if(p.forced==='guns')s.pending={die:null,forced:'guns'};else if(Number.isInteger(p.die))s.pending={die:p.die};}
 if(previous.phase==='resolve'){
  const side=s.active;s.rounds[side]=Math.min(6,s.rounds[side]+1);
  if(['cp','ap'].every(x=>s.rounds[x]===6)||['cp','ap'].every(x=>s.sides[x].remaining===0))s.phase='draw';
  else s.active=s.rounds[side==='cp'?'ap':'cp']<6?(side==='cp'?'ap':'cp'):side;
 }
 rules.validate(s);return s;
}
export class FileStore{
 constructor(directory,lockName){this.directory=directory;this.lockName=lockName;}
 static async open(){
  if(!navigator.storage?.getDirectory||!navigator.locks)fail('JSON 파일 자동 저장을 사용할 수 없습니다. HTTPS 또는 localhost에서 최신 브라우저로 열어 주세요.');
  const root=await navigator.storage.getDirectory(),namespace='cdg-'+encodeURIComponent(new URL('.',location.href).pathname);
  const directory=await root.getDirectoryHandle(namespace,{create:true});
  await navigator.locks.request(namespace,async()=>{const probe=await directory.getFileHandle('.write-check',{create:true});const writer=await probe.createWritable();await writer.close();await directory.removeEntry('.write-check');});
  return new FileStore(directory,namespace);
 }
 lock(fn){return navigator.locks.request(this.lockName,fn);}
 filename(sid){if(typeof sid!=='string'||!/^([0-9a-f]{32})$/.test(sid))fail('잘못된 세션 ID입니다.');return `${sid}.json`;}
 async read(sid){try{const handle=await this.directory.getFileHandle(this.filename(sid));return JSON.parse(await(await handle.getFile()).text());}catch(e){if(e.name==='NotFoundError')fail('저장된 게임이 없습니다.',404);throw e;}}
 async write(s){const handle=await this.directory.getFileHandle(this.filename(s.id),{create:true});let writer;try{writer=await handle.createWritable();await writer.write(JSON.stringify(s,null,2)+'\n');await writer.close();}catch(e){if(writer)await writer.abort().catch(()=>{});throw new Error(`JSON 파일 저장에 실패했습니다. (${e.name})`);}}
 async save(s){s.llm_context=context(s);await this.write(s);}
 async record(s,action,message,parent=null){s.updated_at=now();s.history.push({revision:s.revision,parent_revision:parent,at:s.updated_at,action:structuredClone(action),message,state_after:structuredClone(s.state)});await this.save(s);return this.response(s);}
 response(s){return {id:s.id,name:s.name,revision:s.revision,updated_at:s.updated_at,can_undo:undoTarget(s)!==null,save_path:`브라우저 전용 파일 / ${s.id}.json`,state:rules.publicView(s.state),history:s.history.map(eventView)};}
 async create(options,name){return this.lock(async()=>{const s={schema_version:2,id:id(),name:String(name??'').trim().slice(0,80)||rules.NAME,created_at:now(),updated_at:now(),revision:0,state:rules.create(options),history:[]};return this.record(s,{type:'create',options},'실물 카드 헬퍼를 시작했습니다.');});}
 async migrate(old){validateLegacy(old);return this.lock(async()=>{const stamp=now(),s={schema_version:2,id:id(),name:(old.name.slice(0,65)+' · 실물 카드').slice(0,80),created_at:stamp,updated_at:stamp,revision:0,state:physicalFromLegacy(old),history:[]};return this.record(s,{type:'migrate_legacy',source_id:old.id},'기존 게임의 턴·남은 카드 수·메모를 옮겼습니다. 실물 카드 배치를 확인하세요.');});}
 async get(sid){const s=await this.lock(()=>this.read(sid));if(s.schema_version===1)return this.migrate(s);validateSession(s);return this.response(s);}
 async act(sid,revision,action){return this.lock(async()=>{const s=await this.read(sid);validateSession(s);if(!Number.isInteger(revision)||s.revision!==revision)fail('다른 선택이 먼저 저장되었습니다. 최신 상태를 확인하고 다시 선택하세요.',409);const parent=head(s);let message;
 if(action?.type==='undo'){const target=undoTarget(s);if(target===null)fail('되돌릴 진행이 없습니다.');s.state=structuredClone(s.history[target].state_after);action={type:'undo',target_revision:target};message='직전 진행을 되돌렸습니다. 실물 카드와 보드도 해당 상태로 맞춰 주세요.';}
 else{const result=rules.apply(s.state,action);s.state=result.state;message=result.message;}
 s.revision++;return this.record(s,action,message,parent);});}
 async listing(){return this.lock(async()=>{const list=[];for await(const [name,handle] of this.directory.entries()){if(!/^[0-9a-f]{32}\.json$/.test(name))continue;const file=await handle.getFile();if(!file.size)continue;const s=JSON.parse(await file.text());list.push({id:s.id,name:s.name,revision:s.revision,created_at:s.created_at,updated_at:s.updated_at,turn:s.state.turn,legacy:s.schema_version===1});}return list.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));});}
 async import(text){let s;try{s=JSON.parse(text);if(s.schema_version===1)validateLegacy(s);else validateSession(s);}catch(e){fail(`가져올 수 없는 저장 파일입니다. ${e.message}`);}
  if(s.schema_version===1){s.id=id();s.name=(s.name.slice(0,64)+' · 이전 원본').slice(0,80);await this.lock(()=>this.write(s));return this.migrate(s);}
  return this.lock(async()=>{s.id=id();s.name=(s.name.slice(0,70)+' · 가져옴');s.updated_at=now();await this.save(s);return this.response(s);});
 }
 async request(path,body){
  if(path==='/api/games')return [{id:rules.ID,name:rules.NAME,dice:rules.DICE}];
  if(path==='/api/sessions')return body?this.create(body.options,body.name):this.listing();
  const match=path.match(/^\/api\/sessions\/([0-9a-f]{32})(?:\/(actions|llm|export))?$/);if(!match)fail('경로를 찾을 수 없습니다.',404);
  const [,sid,kind]=match;if(kind==='actions')return this.act(sid,body.expected_revision,body.action);
  if(!kind)return this.get(sid);
  const s=await this.lock(()=>this.read(sid));validateSession(s);return kind==='export'?s:context(s);
 }
}
