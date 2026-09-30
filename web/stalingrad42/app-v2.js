import {TARGETS} from './catalog.js';
import {createV2Session,applyV2Action} from './session-v2.js';
import {V2JsonStore} from './storage-v2.js';
import {renderV2Landing,renderV2Game} from './view-v2.js';

const root=document.getElementById('app'),status=document.getElementById('status');
let store,record=null;
let pendingWrite=Promise.resolve();
const notice=(message,error=false)=>{status.textContent=message;status.className=error?'error':'';};
const asInt=value=>Number(value);
function queue(operation){const next=pendingWrite.then(operation);pendingWrite=next.catch(()=>{});return next;}

async function render(){root.innerHTML=record?renderV2Game(record.state):renderV2Landing(await store.listing());}
function transition(action){
  return queue(async()=>{
    if(!record)throw new Error('게임 기록을 먼저 여세요.');
    const next=applyV2Action(record.state,typeof action==='function'?action(record.state):action);
    record=await store.write(next,record.id,record.revision);
    await render();
    notice('기록했습니다.');
  });
}

function formObjective(form){
  const f=new FormData(form);
  return {type:'set_objective',id:f.get('id'),observation:{control:f.get('control'),eta:asInt(f.get('eta')),counterattack:f.get('counterattack'),forceReady:f.has('forceReady'),supplySecure:f.has('supplySecure'),exitStepsReady:f.has('exitStepsReady'),roadReady:f.has('roadReady')}};
}
function formVp(form){
  const f=new FormData(form),controlledVpHexes=[],isolatedSovietVpHexes=[];
  for(const target of TARGETS.filter(t=>t.type==='vp_hex')){
    const state=f.get(`vp-${target.id}`);
    if(!['soviet','soviet_isolated','axis_supplied','axis_unsupplied'].includes(state))throw new Error(`${target.name}의 점유·보급을 확인하세요.`);
    if(state==='soviet_isolated')isolatedSovietVpHexes.push(target.id);
    if(state.startsWith('axis_'))controlledVpHexes.push({id:target.id,supplied:state==='axis_supplied'});
  }
  if(!f.has('vpChecked'))throw new Error('모든 VP와 감점을 확인하세요.');
  return {controlledVpHexes,isolatedSovietVpHexes,eastExit:{mechanizedSteps:asInt(f.get('eastSteps')),roadSupply:f.has('eastRoad')},southExit:{mechanizedSteps:asInt(f.get('southSteps')),roadSupply:f.has('southRoad')},donSouthGermanCombatUnit:f.has('don'),sovietAtAxisEntryAreas:f.getAll('entry'),sovietHeldWestStartMajorCities:f.getAll('major'),sovietHeldWestStartMinorCityCount:asInt(f.get('minorCount'))};
}

root.addEventListener('submit',async event=>{
  event.preventDefault();
  try{
    const form=event.target,f=new FormData(form),formId=form.getAttribute?.('id')??form.id;
    if(formId==='objective-form')await transition(formObjective(form));
    else if(formId==='threat-form'){
      const next={id:crypto.randomUUID(),kind:f.get('kind'),eta:asInt(f.get('eta')),targetId:f.get('targetId')||null,actionable:f.has('actionable')};
      await transition(s=>({type:'set_threats',threats:[...s.threats,next]}));
    }else if(formId==='crt-form')await transition({type:'set_crt',successFaces:asInt(f.get('successFaces')),lossFaces:asInt(f.get('lossFaces')),critical:f.has('critical')});
    else if(formId==='decision-form')await transition({type:'confirm_decision',piece:f.get('piece'),hex:f.get('hex'),note:f.get('note'),firstTurnLegal:f.has('firstTurnLegal')});
    else if(formId==='vp-form')await transition({type:'soviet_complete',observation:formVp(form)});
  }catch(e){notice(e.message,true);}
});

root.addEventListener('click',async event=>{
  const control=event.target.closest?.('[data-action]');if(!control)return;
  try{
    switch(control.dataset.action){
      case 'new':{const difficulty=document.getElementById('difficulty').value;await queue(async()=>{record=await store.write(createV2Session({difficulty}),undefined,0);await render();notice('새 0.2 기록을 만들었습니다.');});break;}
      case 'load':{const id=control.dataset.id;await queue(async()=>{record=await store.read(id);await render();notice('기록을 열었습니다.');});break;}
      case 'home':await queue(async()=>{record=null;await render();});break;
      case 'check_step':await transition({type:'check_step',id:control.dataset.id});break;
      case 'board-review':await transition({type:'review_board'});break;
      case 'goal-plan':await transition({type:'plan',die:asInt(document.getElementById('plan-die').value)});break;
      case 'start_decision':await transition({type:'start_decision',kind:control.dataset.kind});break;
      case 'answer':await transition({type:'answer',value:control.dataset.value==='yes'});break;
      case 'cancel_decision':await transition({type:'cancel_decision'});break;
      case 'remove_threat':await transition(s=>({type:'set_threats',threats:s.threats.filter(x=>x.id!==control.dataset.id)}));break;
      case 'next_phase':await transition({type:'next_phase'});break;
      case 'next_turn':await transition({type:'next_turn'});break;
      case 'export':{
        await queue(async()=>{const json=await store.exportJson(record.id),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
          const a=document.createElement('a');a.href=url;a.download=`stalingrad42-v2-${record.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
          notice('0.2 JSON을 내보냈습니다.');});break;
      }
    }
  }catch(e){notice(e.message,true);}
});

root.addEventListener('change',async event=>{
  if(event.target.id!=='import')return;
  try{const file=event.target.files[0];if(!file)return;const json=await file.text();await queue(async()=>{record=await store.importJson(json);await render();notice('새 저장 ID로 가져왔습니다.');});}catch(e){notice(e.message,true);}
});

try{store=await V2JsonStore.open();await render();}catch(e){notice(e.message,true);root.innerHTML='<section class="panel"><h2>웹 저장을 사용할 수 없습니다</h2><p>종이 순서도로 계속 플레이할 수 있습니다.</p><a href="./paper.html">종이 순서도 열기</a></section>';}
