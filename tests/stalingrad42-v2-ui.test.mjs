import test from 'node:test';
import assert from 'node:assert/strict';

class Directory{
  constructor(){this.files=new Map();this.dirs=new Map();}
  async getDirectoryHandle(name){if(!this.dirs.has(name))this.dirs.set(name,new Directory());return this.dirs.get(name);}
  async getFileHandle(name,{create}={}){if(create&&!this.files.has(name))this.files.set(name,'');if(!this.files.has(name))throw new Error('NotFound');const d=this;return {getFile:async()=>({text:async()=>d.files.get(name)}),createWritable:async()=>{let value;return {write:async x=>{value=x;},close:async()=>{d.files.set(name,value);}};}};}
  async *entries(){for(const name of this.files.keys())yield [name,{}];}
}

test('web helper builds its own goal, then saves a movement decision in v2 JSON',async()=>{
  const directory=new Directory(),handlers={},root={innerHTML:'',addEventListener:(name,fn)=>{handlers[name]=fn;}},status={textContent:'',className:''};
  const fields={difficulty:{value:'standard'},'plan-die':{value:'2'}};
  globalThis.document={getElementById:id=>id==='app'?root:id==='status'?status:fields[id]};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>directory},locks:{request:async(_name,fn)=>fn()}}});
  globalThis.FormData=class{constructor(form){this.data=form.fields;}get(key){return this.data[key]??null;}has(key){return Object.hasOwn(this.data,key);}getAll(key){return this.data[key]??[];}};
  await import('../web/stalingrad42/app-v2.js');
  const click=async(action,extras={})=>handlers.click({target:{closest:()=>({dataset:{action,...extras}})}});
  // A form control named "id" shadows HTMLFormElement.id in Chromium.
  const submit=async(id,formFields)=>handlers.submit({preventDefault(){},target:{id:id==='objective-form'?{value:formFields.id}:id,getAttribute:()=>id,fields:formFields}});
  await click('new');
  assert.ok(root.innerHTML.includes('지도 A 목표 장부'));
  await Promise.all([click('check_step',{id:'air'}),click('check_step',{id:'markers'})]);
  let snapshot=[...directory.dirs.get('stalingrad42-automa-v2').files.values()].map(JSON.parse)[0];
  assert.deepEqual(new Set(snapshot.state.checks.initial),new Set(['air','markers']));
  await submit('objective-form',{id:'usman',control:'soviet',eta:'0',counterattack:'none',forceReady:'on',supplySecure:'on'});
  await click('board-review');await click('goal-plan');
  assert.ok(root.innerHTML.includes('GOAL-GAIN'));
  for(const id of ['air','markers','resources','asu','reinforcements','leaders'])await click('check_step',{id});
  await click('next_phase');
  await click('start_decision',{kind:'movement'});
  await submit('decision-form',{piece:'6A-1',hex:'2108',note:'안전한 접근',firstTurnLegal:'on'});
  const stored=[...directory.dirs.get('stalingrad42-automa-v2').files.values()].map(JSON.parse)[0];
  assert.equal(stored.state.plan.targetId,'usman');
  assert.equal(stored.state.history.at(-1).action,'approach_goal');
  assert.deepEqual(stored.state.usedUnits,['6A-1']);
  await Promise.all([click('board-review'),click('home')]);
  assert.ok(root.innerHTML.includes('새 추축군 오토마 기록'));
});
