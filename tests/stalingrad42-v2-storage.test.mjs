import test from 'node:test';
import assert from 'node:assert/strict';
import {V2JsonStore,validateV2Record,APP_ID} from '../web/stalingrad42/storage-v2.js';
import {JsonStore} from '../web/stalingrad42/storage.js';
import {createSession} from '../web/stalingrad42/session.js';
import {createV2Session,applyV2Action} from '../web/stalingrad42/session-v2.js';

class MemoryDirectory{
  files=new Map();directories=new Map();failClose=false;
  async getDirectoryHandle(name,{create}={}){if(!this.directories.has(name)&&create)this.directories.set(name,new MemoryDirectory());return this.directories.get(name);}
  async getFileHandle(name,{create}={}){if(!this.files.has(name)&&create)this.files.set(name,'');if(!this.files.has(name))throw new Error('NotFound');const d=this;return {getFile:async()=>({text:async()=>d.files.get(name)}),createWritable:async()=>({write:async text=>{this.pending=text;},close:async()=>{if(d.failClose)throw new Error('disk');d.files.set(name,this.pending);}})};}
  async *entries(){for(const name of this.files.keys())yield [name,{}];}
}
const locks={request:async(_name,fn)=>fn()};

test('version 2 store is isolated from existing v0.1 records',async()=>{
  const root=new MemoryDirectory(),legacy=await JsonStore.open({root,locks}),next=await V2JsonStore.open({root,locks});
  await legacy.write(createSession(),[],undefined,0);
  const record=await next.write(createV2Session(),undefined,0);
  assert.equal(record.appId,APP_ID);assert.equal(record.schemaVersion,2);
  assert.equal((await legacy.listing()).length,1);assert.equal((await next.listing()).length,1);
  assert.notEqual(legacy.directory,next.directory);
});

test('unfinished decision survives close and reopen, import gives a new ID',async()=>{
  const root=new MemoryDirectory(),first=await V2JsonStore.open({root,locks});
  let state={...createV2Session(),phase:'soviet_turn'};
  state=applyV2Action(state,{type:'start_decision',kind:'defense'});
  state=applyV2Action(state,{type:'answer',value:true});
  const saved=await first.write(state,undefined,0);
  const reopened=await V2JsonStore.open({root,locks});
  assert.deepEqual((await reopened.read(saved.id)).state.pending.facts,{ddLegal:true});
  const copy=await reopened.importJson(await reopened.exportJson(saved.id));
  assert.notEqual(copy.id,saved.id);assert.equal((await reopened.listing()).length,2);
});

test('version 2 record rejects foreign, stale and failed writes',async()=>{
  const root=new MemoryDirectory(),store=await V2JsonStore.open({root,locks});
  const saved=await store.write(createV2Session(),undefined,0);
  assert.equal(validateV2Record(saved),true);
  assert.throws(()=>validateV2Record({...saved,appId:'STAL42-AXIS-0.1'}));
  await assert.rejects(store.write(saved.state,saved.id,0),/충돌/);
  root.directories.get('stalingrad42-automa-v2').failClose=true;
  await assert.rejects(store.write(createV2Session(),undefined,0),/disk/);
  assert.equal((await store.listing()).length,1);
});
