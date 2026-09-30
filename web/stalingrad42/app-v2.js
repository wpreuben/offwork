import {TARGETS} from './catalog.js';
import {createV2Session,applyV2Action,upgradeV2Session,replayV2Plan} from './session-v2.js';
import {V2JsonStore} from './storage-v2.js';
import {renderV2Landing,renderV2Game} from './view-v2.js';

const root=document.getElementById('app'),status=document.getElementById('status');
let store,record=null;
let editingGroupId=null,editingObjectiveId=null;
let pendingWrite=Promise.resolve();
const notice=(message,error=false)=>{status.textContent=message;status.className=error?'error':'';};
const asInt=value=>Number(value);
function queue(operation){const next=pendingWrite.then(operation);pendingWrite=next.catch(()=>{});return next;}

async function render(){root.innerHTML=record?renderV2Game(record.state,{editingGroupId,editingObjectiveId}):renderV2Landing(await store.listing());}
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
  return {type:'set_objective',id:f.get('id'),observation:{control:f.get('control'),eta:asInt(f.get('eta')),counterattack:f.get('counterattack'),forceReady:true,supplySecure:f.has('supplySecure'),exitStepsReady:f.has('exitStepsReady'),roadReady:f.has('roadReady')}};
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
    else if(formId==='group-form'){
      const id=String(f.get('id')??'').trim(),split=value=>String(value??'').split(/[,;]/).map(x=>x.trim()).filter(Boolean);
      const observation={id,unitIds:split(f.get('unitIds')),protectedUnitIds:split(f.get('protectedUnitIds')),kind:f.get('kind'),ready:f.has('ready'),supplied:f.has('supplied'),guardCritical:f.has('guardCritical')};
      await transition(s=>({type:'set_group',group:{...observation,targetDistances:s.groups.find(g=>g.id===id)?.targetDistances??{}}}));
    }else if(formId==='distance-form'){
      const groupId=f.get('groupId'),targetId=f.get('targetId'),distance=asInt(f.get('distance'));
      await transition(s=>{const group=s.groups.find(g=>g.id===groupId);if(!group)throw new Error('전투단을 먼저 등록하세요.');return {type:'set_group',group:{...group,targetDistances:{...group.targetDistances,[targetId]:distance}}};});
    }
    else if(formId==='threat-form'){
      const next={id:crypto.randomUUID(),kind:f.get('kind'),severity:f.get('severity'),eta:asInt(f.get('eta')),targetId:f.get('targetId')||null,affectedGroupId:f.get('affectedGroupId')||null,actionable:f.has('actionable')};
      if(!next.targetId&&!next.affectedGroupId)throw new Error('위협의 관련 목표 또는 영향받는 전투단을 지정하세요.');
      await transition(s=>({type:'set_threats',threats:[...s.threats,next]}));
    }else if(formId==='crt-form')await transition({type:'set_crt',successFaces:asInt(f.get('successFaces')),lossFaces:asInt(f.get('lossFaces')),defenderDd:f.get('defenderDd'),supportCommitted:asInt(f.get('supportCommitted'))});
    else if(formId==='breakthrough-form')await transition({type:'set_breakthrough',combatId:f.get('combatId'),piece:f.get('piece'),remaining:asInt(f.get('remaining'))});
    else if(formId==='loss-candidate-form')await transition({type:'add_loss_candidate',candidate:{id:f.get('id'),steps:asInt(f.get('steps')),quality:asInt(f.get('quality')),eligible:f.has('eligible'),mechanized:f.has('mechanized'),essentialToSupply:f.has('essentialToSupply'),essentialToVp:f.has('essentialToVp')}});
    else if(formId==='decision-form')await transition({type:'confirm_decision',piece:f.get('piece'),hex:f.get('hex'),note:f.get('note'),firstTurnLegal:f.has('firstTurnLegal'),breakthroughResult:f.get('breakthroughResult')});
    else if(formId==='vp-form')await transition({type:'soviet_complete',observation:formVp(form)});
  }catch(e){notice(e.message,true);}
});

root.addEventListener('click',async event=>{
  const control=event.target.closest?.('[data-action]');if(!control)return;
  try{
    switch(control.dataset.action){
      case 'new':{const difficulty=document.getElementById('difficulty').value;await queue(async()=>{record=await store.write(createV2Session({difficulty}),undefined,0);await render();notice('새 0.2 기록을 만들었습니다.');});break;}
      case 'load':{const id=control.dataset.id;await queue(async()=>{record=await store.read(id);const updated=upgradeV2Session(record.state);const old=updated.policyVersion!==record.state.policyVersion;if(old)record=await store.write(updated,record.id,record.revision);editingGroupId=null;editingObjectiveId=null;await render();notice(old?'이력을 보존하고 0.2.1로 전환했습니다. 전투단을 등록하고 전황을 다시 확인하세요.':'기록을 열었습니다.');});break;}
      case 'home':await queue(async()=>{record=null;await render();});break;
      case 'check_step':await transition({type:'check_step',id:control.dataset.id});break;
      case 'board-review':await transition({type:'review_board'});break;
      case 'goal-plan':await transition({type:'plan',die:asInt(document.getElementById('plan-die').value)});break;
      case 'start_decision':await transition({type:'start_decision',kind:control.dataset.kind,groupId:control.dataset.groupId});break;
      case 'edit_group':await queue(async()=>{editingGroupId=control.dataset.id;await render();});break;
      case 'edit_objective':await queue(async()=>{editingObjectiveId=control.dataset.id;await render();});break;
      case 'remove_group':await transition({type:'remove_group',id:control.dataset.id});break;
      case 'complete_group':await transition({type:'complete_group',groupId:control.dataset.groupId});break;
      case 'answer':await transition({type:'answer',value:control.dataset.value==='yes'});break;
      case 'cancel_decision':await transition({type:'cancel_decision'});break;
      case 'remove_threat':await transition(s=>({type:'set_threats',threats:s.threats.filter(x=>x.id!==control.dataset.id)}));break;
      case 'next_phase':await transition({type:'next_phase'});break;
      case 'next_turn':await transition({type:'next_turn'});break;
      case 'replay-plan':await queue(async()=>{const h=record.state.history.filter(x=>x.type==='plan'&&x.snapshot).at(-1);if(!h||JSON.stringify(replayV2Plan(h.snapshot))!==JSON.stringify(h.result))throw new Error('현재 정책과 기록의 재현 결과가 다릅니다.');notice('저장된 전황·병력·d6·매개변수로 같은 작전과 임무를 재현했습니다.');});break;
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
