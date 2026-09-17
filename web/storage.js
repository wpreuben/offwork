// Every successful choice commits an actual JSON file in OPFS. No localStorage saves.
import * as rules from './games/paths-of-glory.js';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const eventView=e=>({revision:e.revision,at:e.at,action:e.action,message:e.message});
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID().replaceAll('-','');
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function context(s){return {schema_version:1,session_id:s.id,revision:s.revision,game:s.state.game,state:rules.publicView(s.state),recent_history:s.history.slice(-24).map(eventView),instructions:[
 'You assist the human controlling BOTH sides. Choose in the interest of the active side.',
 'Hidden card identities and deck order are intentionally omitted. Do not invent them.',
 'The solo PDFs restrict card selection, not board legality. Ask the human to verify original-game event and board prerequisites.',
 'Reply with JSON: {"expected_revision": revision, "action": one available_actions object}.',
 'base_legal=true and base_phases_done=true are attestations that must be confirmed by the human.',
 'Optional note action: {"type":"note","text":"board position, decision or rationale"}.',
 'Mata Hari is CP #17 by explicit user correction of the supplied PDF #22.'
 ]};}
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(object(x))return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
function equal(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
export function validateSession(s){
 if(!object(s)||s.schema_version!==1||!/^([0-9a-f]{32})$/.test(s.id)||typeof s.name!=='string'||s.name.length>80||!Number.isInteger(s.revision)||s.revision<0||!Number.isFinite(Date.parse(s.created_at))||!Number.isFinite(Date.parse(s.updated_at))||!Array.isArray(s.history)||s.history.length!==s.revision+1)fail('전체 저장 JSON 형식(schema_version 1)을 확인하세요. 공개 상태 JSON은 복원할 수 없습니다.');
 rules.validate(s.state);
 for(const [i,e] of s.history.entries()){if(!object(e)||e.revision!==i||!Number.isFinite(Date.parse(e.at))||!object(e.action)||typeof e.action.type!=='string'||typeof e.message!=='string')fail('진행 기록 형식이 올바르지 않습니다.');rules.validate(e.state_after);}
 if(!equal(s.history.at(-1).state_after,s.state))fail('마지막 체크포인트와 현재 상태가 다릅니다.');
 // Also exercise public projection before accepting a file into the library.
 rules.publicView(s.state);
}
export class FileStore {
 constructor(directory,lockName){this.directory=directory;this.lockName=lockName;}
 static async open(){
 if(!navigator.storage?.getDirectory||!navigator.locks)fail('이 브라우저에서는 JSON 파일 자동 저장을 사용할 수 없습니다. HTTPS 또는 localhost에서 최신 Chrome, Edge, Firefox, Safari로 열어 주세요.');
 const root=await navigator.storage.getDirectory();
 // Different project sites on the same github.io origin must not share sessions.
 const namespace='cdg-'+encodeURIComponent(new URL('.',location.href).pathname);
 const directory=await root.getDirectoryHandle(namespace,{create:true});
 await navigator.locks.request(namespace,async()=>{
 const probe=await directory.getFileHandle('.write-check',{create:true});
 if(!probe.createWritable)fail('이 브라우저는 JSON 파일 쓰기를 지원하지 않습니다. 최신 브라우저로 열어 주세요.');
 const writer=await probe.createWritable();await writer.close();await directory.removeEntry('.write-check');
 });
 return new FileStore(directory,namespace);
 }
 lock(fn){return navigator.locks.request(this.lockName,fn);}
 filename(sid){if(typeof sid!=='string'||!/^([0-9a-f]{32})$/.test(sid))fail('잘못된 세션 ID입니다.');return `${sid}.json`;}
 async read(sid){try{const handle=await this.directory.getFileHandle(this.filename(sid));return JSON.parse(await (await handle.getFile()).text());}catch(e){if(e.name==='NotFoundError')fail('저장된 세션이 없습니다.',404);throw e;}}
 async save(s){s.llm_context=context(s);const data=JSON.stringify(s,null,2)+'\n';const handle=await this.directory.getFileHandle(this.filename(s.id),{create:true});let writer;
 try{writer=await handle.createWritable();await writer.write(data);await writer.close();}catch(e){if(writer)await writer.abort().catch(()=>{});throw new Error(`JSON 파일 저장에 실패했습니다. 저장 공간과 브라우저 권한을 확인하세요. (${e.name})`);}}
 async record(s,action,message){s.updated_at=now();s.history.push({revision:s.revision,at:s.updated_at,action:structuredClone(action),message,state_after:structuredClone(s.state)});await this.save(s);return this.response(s);}
 response(s){return {id:s.id,name:s.name,revision:s.revision,updated_at:s.updated_at,save_path:`브라우저 전용 파일 / ${s.id}.json`,state:rules.publicView(s.state),history:s.history.map(eventView)};}
 async create(game,options,name){return this.lock(async()=>{if(game!==rules.ID)fail('지원하지 않는 게임입니다.');const s={schema_version:1,id:id(),name:String(name??'').trim().slice(0,80)||rules.NAME,created_at:now(),updated_at:now(),revision:0,state:rules.create(options),history:[]};return this.record(s,{type:'create',game,options},'새 게임을 준비했습니다. 마타 하리: 카드 이미지 #17 적용.');});}
 async act(sid,revision,action){return this.lock(async()=>{const s=await this.read(sid);if(!Number.isInteger(revision)||s.revision!==revision)fail('다른 선택이 먼저 저장되었습니다. 최신 상태를 확인하고 다시 선택하세요.',409);const result=rules.apply(s.state,action);s.state=result.state;s.revision++;return this.record(s,action,result.message);});}
 async listing(){return this.lock(async()=>{const list=[];for await(const [name,handle] of this.directory.entries()){if(!/^[0-9a-f]{32}\.json$/.test(name))continue;const file=await handle.getFile();if(!file.size)continue;const s=JSON.parse(await file.text());list.push({id:s.id,name:s.name,revision:s.revision,created_at:s.created_at,updated_at:s.updated_at,turn:s.state.turn});}return list.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));});}
 async import(text){let s;try{s=JSON.parse(text);validateSession(s);}catch(e){fail(`가져올 수 없는 저장 파일입니다. ${e.message}`);}
 // Import as a separate table, preserving checkpoints and never overwriting a newer game.
 return this.lock(async()=>{s.id=id();s.name=(s.name.slice(0,70)+' · 가져옴');s.updated_at=now();await this.save(s);return this.response(s);});}
 async request(path,body){
 if(path==='/api/games')return [{id:rules.ID,name:rules.NAME,dice:rules.DICE}];
 if(path==='/api/catalog')return rules.CARDS;
 if(path==='/api/sessions')return body?this.create(body.game,body.options,body.name):this.listing();
 const match=path.match(/^\/api\/sessions\/([0-9a-f]{32})(?:\/(actions|llm|export))?$/);if(!match)fail('경로를 찾을 수 없습니다.',404);
 const [,sid,kind]=match;if(kind==='actions')return this.act(sid,body.expected_revision,body.action);
 const s=await this.lock(()=>this.read(sid));return kind==='export'?s:kind==='llm'?context(s):this.response(s);
 }
}
