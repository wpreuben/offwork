import test from 'node:test';
import assert from 'node:assert/strict';

class Directory {
  constructor(){this.files=new Map();this.dirs=new Map();}
  async getDirectoryHandle(name){if(!this.dirs.has(name))this.dirs.set(name,new Directory());return this.dirs.get(name);}
  async getFileHandle(name,{create}={}){if(create&&!this.files.has(name))this.files.set(name,'');if(!this.files.has(name))throw new Error('NotFound');const d=this;return {getFile:async()=>({text:async()=>d.files.get(name)}),createWritable:async()=>{let value;return {write:async x=>{value=x;},close:async()=>{d.files.set(name,value);}};}};}
  async *entries(){for(const name of this.files.keys())yield [name,{}];}
}
test('web_flow_requires_answers_preserves_die_and_clears_confirmed_candidate',async()=>{
  const directory=new Directory(),handlers={},root={innerHTML:'',addEventListener:(name,fn)=>{handlers[name]=fn;}},status={textContent:'',className:''};
  const fields={difficulty:{value:'standard'},die:{value:'6'}};
  globalThis.document={getElementById:id=>id==='app'?root:id==='status'?status:fields[id]};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>directory},locks:{request:async(_name,fn)=>fn()}}});
  globalThis.FormData=class {constructor(form){this.data=form.fields;}get(key){return this.data[key]??null;}has(key){return Object.hasOwn(this.data,key);}getAll(key){return this.data[key]??[];}};
  await import('../web/stalingrad42/app.js');
  const click=async(action)=>handlers.click({target:{closest:()=>({dataset:{action}})}});
  await click('new');
  assert.ok(root.innerHTML.includes('턴 시작 확인'));
  await handlers.submit({preventDefault(){},target:{id:'initial-form',fields:{}}});
  assert.ok(root.innerHTML.includes('확인 전'));
  assert.ok(!root.innerHTML.includes('name="legal" checked'));
  const unknown={id:'candidate-form',fields:{formation:'6A',units:'6A-1',target:'voronezh',action:'advance',hexes:'1',reserve:'2',risk:'',combatUnit:'yes',legal:'',supplied:'',reachable:''}};
  await handlers.submit({preventDefault(){},target:unknown});
  await click('decide');
  assert.ok(root.innerHTML.includes('필수 보드 상태를 확인'));
  assert.ok(!root.innerHTML.includes('실행 확인 후 확정'));
  await click('home');
  await click('new');
  await handlers.submit({preventDefault(){},target:{id:'initial-form',fields:{}}});
  const candidate={id:'candidate-form',fields:{formation:'6A',units:'6A-1',target:'voronezh',action:'advance',hexes:'1',reserve:'2',risk:'none',combatUnit:'yes',legal:'yes',supplied:'yes',reachable:'yes'}};
  await handlers.submit({preventDefault(){},target:candidate});
  assert.ok(root.innerHTML.includes('C001'));
  await click('decide');
  assert.ok(root.innerHTML.includes('value="6"'));
  await click('confirm');
  assert.ok(!root.innerHTML.includes('이번 검토 후보'));
  const stored=[...directory.dirs.get('stalingrad42-automa').files.values()].map(JSON.parse).find(r=>r.state.history.length);
  assert.equal(stored.state.history.at(-1).die,6);
  await click('next_phase');
  assert.ok(root.innerHTML.includes('value="attack"'));
  assert.ok(!root.innerHTML.includes('<option value="advance">'));
});
