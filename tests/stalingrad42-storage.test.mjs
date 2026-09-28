import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonStore,validateRecord,APP_ID} from '../web/stalingrad42/storage.js';
import {createSession} from '../web/stalingrad42/session.js';

class MemoryDirectory {
  files=new Map(); directories=new Map(); failClose=false;
  async getDirectoryHandle(name,{create}={}) {if(!this.directories.has(name)&&create)this.directories.set(name,new MemoryDirectory());return this.directories.get(name);}
  async getFileHandle(name,{create}={}) {if(!this.files.has(name)&&create)this.files.set(name,'');if(!this.files.has(name))throw new Error('NotFound');const d=this;return {getFile:async()=>({text:async()=>d.files.get(name)}),createWritable:async()=>({write:async text=>{this.pending=text;},close:async()=>{if(d.failClose)throw new Error('disk');d.files.set(name,this.pending);}})};}
  async *entries(){for(const name of this.files.keys())yield [name,{}];}
}
const locks={request:async(_name,fn)=>fn()};
const store=async()=>JsonStore.open({root:new MemoryDirectory(),locks});
test('rejects_foreign_app_and_invalid_schema',()=>{
  const record={appId:APP_ID,schemaVersion:1,id:'x',revision:1,state:createSession(),history:[]};
  assert.equal(validateRecord(record),true);
  assert.throws(()=>validateRecord({...record,appId:'POG'}));
  assert.throws(()=>validateRecord({...record,schemaVersion:2}));
});
test('rejects_stale_expected_revision',async()=>{
  const s=await store();const state=createSession();const record=await s.write(state,[],undefined,0);
  await assert.rejects(s.write(state,[],record.id,0),/충돌/);
});
test('failed_write_does_not_report_success',async()=>{
  const root=new MemoryDirectory(),s=await JsonStore.open({root,locks});root.directories.get('stalingrad42-automa').failClose=true;
  await assert.rejects(s.write(createSession(),[],undefined,0),/disk/);
  assert.equal((await s.listing()).length,0);
});
test('import_creates_new_id',async()=>{
  const s=await store();const state=createSession();const original=await s.write(state,[],undefined,0);
  const copy=await s.importJson(await s.exportJson(original.id));
  assert.notEqual(copy.id,original.id);
  assert.equal((await s.listing()).length,2);
});
