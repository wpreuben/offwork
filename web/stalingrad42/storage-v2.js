export const APP_ID='STAL42-AXIS-0.2';
export const STORAGE_SCHEMA=2;
const DIR='stalingrad42-automa-v2';
const safeId=id=>{if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw new Error('저장 ID 오류');return id;};

export function validateV2Record(record){
  if(!record||record.appId!==APP_ID||record.schemaVersion!==STORAGE_SCHEMA)throw new Error('다른 게임 또는 지원하지 않는 저장 형식');
  safeId(record.id);
  const s=record.state;
  if(!Number.isInteger(record.revision)||record.revision<1||s?.schemaVersion!==2||s.scenario!=='s1'||s.policyVersion!=='0.2.0'||!['beginner','standard','hard'].includes(s.difficulty)||!Array.isArray(s.history)||!Array.isArray(s.threats)||!s.objectiveStates||typeof s.objectiveStates!=='object')throw new Error('저장 기록이 손상되었습니다.');
  return true;
}

export class V2JsonStore{
  constructor(directory,locks){this.directory=directory;this.locks=locks;}
  static async open({root,locks}={}){
    root??=await globalThis.navigator?.storage?.getDirectory?.();
    locks??=globalThis.navigator?.locks;
    if(!root||!locks?.request)throw new Error('이 브라우저는 OPFS 또는 Web Locks 저장을 지원하지 않습니다.');
    return new V2JsonStore(await root.getDirectoryHandle(DIR,{create:true}),locks);
  }
  async read(id){
    const file=await this.directory.getFileHandle(`${safeId(id)}.json`);
    const record=JSON.parse(await (await file.getFile()).text());
    validateV2Record(record);
    if(record.id!==id)throw new Error('저장 ID가 일치하지 않습니다.');
    return record;
  }
  async write(state,id,expectedRevision=0){
    if(state?.schemaVersion!==2||state.scenario!=='s1')throw new Error('0.2 세션 기록 오류');
    const actualId=safeId(id??crypto.randomUUID());
    return this.locks.request(`${DIR}:${actualId}`,async()=>{
      let previous;
      try{previous=await this.read(actualId);}catch(e){if(e?.message!=='NotFound'&&e?.name!=='NotFoundError')throw e;}
      if((previous?.revision??0)!==expectedRevision)throw new Error('저장 충돌: 다른 탭의 기록이 변경되었습니다.');
      const record={appId:APP_ID,schemaVersion:STORAGE_SCHEMA,id:actualId,revision:expectedRevision+1,updatedAt:new Date().toISOString(),state};
      validateV2Record(record);
      const handle=await this.directory.getFileHandle(`${actualId}.json`,{create:true});
      const writer=await handle.createWritable();
      await writer.write(JSON.stringify(record));
      await writer.close();
      return record;
    });
  }
  async listing(){
    const records=[];
    for await(const [name] of this.directory.entries()){
      if(!name.endsWith('.json'))continue;
      try{records.push(await this.read(name.slice(0,-5)));}catch(_e){/* Invalid or incomplete records are excluded. */}
    }
    return records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  async exportJson(id){return JSON.stringify(await this.read(id),null,2);}
  async importJson(json){const source=JSON.parse(json);validateV2Record(source);return this.write(source.state,undefined,0);}
}
