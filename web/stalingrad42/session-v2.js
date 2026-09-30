import {SCENARIO,TARGETS,calculateS1Vp} from './catalog.js';
import {DOCTRINE_VERSION,DOCTRINE_PROFILES,PHASE_CHECKLISTS,THREAT_ORDER,planAxisTurn} from './doctrine.js';
import {runProcedure,attackReadiness,rankLocalOptions,ATTACK_POLICY,DD_POLICY,SELECTION_RULES} from './procedures.js';
import {allocateMissions,orderedMissionUnits} from './operations.js';

const PHASES=['initial','movement','combat','recovery','supply','soviet_turn','victory'];
const TARGET_IDS=new Set(TARGETS.map(t=>t.id));
const clone=value=>structuredClone(value);
const kinds={movement:['movement'],combat:['attack','advance','breakthrough','loss','retreat'],soviet_turn:['defense','loss','retreat']};
const frozen=id=>/(?:^|[^a-z0-9])(?:14\s*pz|22\s*pz|60\s*pzg)(?:$|[^a-z0-9])/i.test(id);
const ids=value=>String(value??'').split(/[,;]/).map(x=>x.trim()).filter(Boolean);
const invalidate=s=>{s.boardRevision++;s.boardReviewedTurn=0;s.plan=null;s.pending=null;s.doneGroups=[];s.vpObservation=null;};
const score=controls=>TARGETS.reduce((n,t)=>n+(['axis_supplied','soviet_isolated'].includes(controls[t.id])?t.vp:0),0);
const controls=s=>Object.fromEntries(Object.entries(s.objectiveStates).map(([id,o])=>[id,o.control]));
const age=(o,turn)=>o.eta===99?99:Math.max(0,o.eta-(turn-(o.observedTurn??turn)));

export function createV2Session({difficulty='standard'}={}){
  if(!DOCTRINE_PROFILES[difficulty])throw new Error('알 수 없는 난이도');
  return {schemaVersion:2,scenario:SCENARIO.id,policyVersion:DOCTRINE_VERSION,difficulty,turn:1,phase:'initial',vp:0,winner:null,objectiveStates:{},threats:[],groups:[],currentGoal:null,plan:null,boardRevision:0,boardReviewedTurn:0,checks:{},pending:null,usedUnits:[],usedAttackUnits:[],doneGroups:[],breakthroughLedger:{},vpObservation:null,lastVpControls:{},history:[]};
}

export function upgradeV2Session(state){
  const s={...createV2Session({difficulty:state.difficulty}),...clone(state)};
  if(state.policyVersion!==DOCTRINE_VERSION){
    s.policyVersion=DOCTRINE_VERSION;s.plan=null;s.pending=null;s.boardReviewedTurn=0;s.doneGroups=[];
    s.lastVpControls=controls(s);
    s.history.push({type:'policy_upgrade',turn:s.turn,from:state.policyVersion,to:DOCTRINE_VERSION});
  }
  return s;
}

export function replayV2Plan(snapshot){
  if(snapshot?.policyVersion!==DOCTRINE_VERSION)throw new Error('이 정책 버전의 재현 스냅샷이 필요합니다.');
  const plan=planAxisTurn({...clone(snapshot.input),profilePolicy:snapshot.parameters.doctrine});
  return {...plan,missions:allocateMissions({plan,groups:snapshot.groups,profile:snapshot.input.profile,profilePolicy:snapshot.parameters.doctrine})};
}

function groupInput(group,others){
  const g=clone(group);
  if(!g||typeof g.id!=='string'||!g.id.trim()||g.id.length>60||!Array.isArray(g.unitIds)||!g.unitIds.length||g.unitIds.some(x=>typeof x!=='string'||!x.trim())||new Set(g.unitIds).size!==g.unitIds.length||!Array.isArray(g.protectedUnitIds)||g.protectedUnitIds.some(x=>!g.unitIds.includes(x))||!['mobile','infantry'].includes(g.kind)||['ready','supplied','guardCritical'].some(k=>typeof g[k]!=='boolean')||!g.targetDistances||typeof g.targetDistances!=='object')throw new Error('전투단의 유닛·보호 병력·가용·보급·거리 관측을 확인하세요.');
  if(others.some(x=>x.id!==g.id&&x.unitIds.some(id=>g.unitIds.includes(id))))throw new Error('유닛은 둘 이상의 전투단에 등록할 수 없습니다.');
  for(const [target,distance] of Object.entries(g.targetDistances))if(!TARGET_IDS.has(target)||!Number.isInteger(distance)||distance<0||distance>99)throw new Error('목표까지 헥스 거리 오류');
  return g;
}

function planningInput(s,die){
  const observations=Object.fromEntries(Object.entries(s.objectiveStates).map(([id,o])=>[id,{...o,eta:age(o,s.turn),forceReady:o.forceReady&&s.groups.some(g=>g.ready&&g.supplied&&!g.guardCritical&&(g.targetDistances[id]??99)<99&&orderedMissionUnits(g).length)}]));
  return {turn:s.turn,vp:s.vp+score(controls(s))-score(s.lastVpControls),profile:s.difficulty,currentGoal:s.currentGoal,objectiveStates:observations,threats:s.threats.map(t=>({...t,eta:age(t,s.turn)})),die};
}

function startDecision(s,action){
  if(s.pending)throw new Error('진행 중인 판단을 먼저 완료하거나 취소하세요.');
  if(!kinds[s.phase]?.includes(action.kind))throw new Error('현재 단계에서 이 결정을 할 수 없습니다.');
  let facts={},mission=null,group=null,unitIds=[];
  if(['movement','attack','breakthrough'].includes(action.kind)){
    if(!s.plan)throw new Error('이번 턴 작전 목표와 전투단 임무를 먼저 정하세요.');
    const choices=s.plan.missions.filter(m=>action.kind==='movement'?!s.doneGroups.includes(m.groupId):!['reserve'].includes(m.kind));
    mission=action.groupId?choices.find(m=>m.groupId===action.groupId):choices[0];
    if(!mission)throw new Error('판단할 전투단 임무가 없습니다.');
    group=s.groups.find(g=>g.id===mission.groupId);
    unitIds=orderedMissionUnits(group,action.kind==='movement'?s.usedUnits:action.kind==='attack'?s.usedAttackUnits:[]).filter(id=>s.turn!==1||!frozen(id));
    if(action.kind==='movement')facts={corridorThreatened:mission.kind==='supply',urgentResponse:mission.kind==='respond',goalActive:mission.kind==='attack'};
    if(action.kind==='attack'&&ATTACK_POLICY[s.difficulty].maxSupportCommitted===0)facts.supportCanFixOdds=false;
  }
  let result;
  if(action.kind==='movement'&&(mission.kind==='reserve'||group.guardCritical||!group.ready))result={status:'decision',action:mission.kind==='reserve'?'hold_reserve':'hold_position',text:'배정된 예비·거점 경계 병력을 유지하고 전투단 임무 완료를 기록한다',policyId:mission.policyId,ruleRefs:['오토마 0.2.1']};
  else if(SELECTION_RULES[action.kind]&&!runHasGraph(action.kind))result={status:'decision',action:`select_${action.kind}`,policyId:`${action.kind.toUpperCase()}-PRIORITY`,ruleRefs:SELECTION_RULES[action.kind].map(x=>x.rule)};
  else result=runProcedure(action.kind,facts);
  s.pending={kind:action.kind,groupId:group?.id??null,targetId:mission?.targetId??null,unitIds,facts,crt:null,result,boardRevision:s.boardRevision,options:[],selectedId:null};
}
const runHasGraph=kind=>['movement','attack','defense','advance','breakthrough','loss'].includes(kind);

function confirmDecision(s,action){
  const p=s.pending,result=p?.result;
  if(result?.status!=='decision')throw new Error('먼저 결정 질문을 완료하세요.');
  if(p.boardRevision!==s.boardRevision)throw new Error('전황이 바뀌었습니다. 결정을 다시 확인하세요.');
  const hold=['hold_reserve','hold_position'].includes(result.action);
  const piece=String(action.piece??p.selectedId??'').trim(),hex=String(action.hex??'').trim(),pieces=ids(piece);
  if(!hold&&['movement','defense','loss','retreat','advance'].includes(p.kind)&&!piece)throw new Error('선택된 유닛을 적으세요.');
  if(['attack','breakthrough'].includes(result.action)&&!piece)throw new Error('공격에 참여한 유닛을 적으세요.');
  if(p.kind==='loss'&&(!p.selectedId||piece!==p.selectedId))throw new Error('적격 후보의 오토마 선택을 먼저 확인하세요.');
  if(s.turn===1&&['movement','attack','breakthrough'].includes(p.kind)&&pieces.some(frozen))throw new Error('S1.2: 1턴 14Pz·22Pz·60PzG는 이동·공격할 수 없습니다.');
  if(p.kind==='movement'&&s.usedUnits.includes(piece))throw new Error('같은 이동 단계의 유닛 중복');
  if(['movement','attack','breakthrough'].includes(p.kind)&&pieces.some(id=>!p.unitIds.includes(id)))throw new Error('배정된 전투단의 가용·보호되지 않은 유닛만 선택할 수 있습니다.');
  if(p.kind==='movement'&&!hold){
    if(pieces.length!==1||!hex)throw new Error('이동 유닛 한 개와 도착 헥스를 적으세요.');
    if(s.turn===1&&action.firstTurnLegal!==true)throw new Error('S1.2: 전투 유닛 2헥스 이내, SP는 전체 MA 이동인지 확인하세요.');
    if(s.usedUnits.includes(piece))throw new Error('같은 이동 단계의 유닛 중복');
    s.usedUnits.push(piece);
  }
  if(result.action==='attack'){
    if(pieces.some(id=>s.usedAttackUnits.includes(id)))throw new Error('이미 정규 공격에 사용한 유닛입니다.');
    s.usedAttackUnits.push(...pieces);
  }
  if(result.action==='breakthrough'){
    if(!p.breakthrough||piece!==p.breakthrough.piece||!['continue','stop'].includes(action.breakthroughResult))throw new Error('같은 돌파집단과 실제 Adv 3/4 여부를 확인하세요.');
    s.breakthroughLedger[p.breakthrough.combatId]={...p.breakthrough,remaining:p.breakthrough.remaining-1,closed:action.breakthroughResult==='stop'};
  }
  if(hold&&!s.doneGroups.includes(p.groupId))s.doneGroups.push(p.groupId);
  s.history.push({type:'decision',turn:s.turn,phase:s.phase,kind:p.kind,groupId:p.groupId,targetId:p.targetId,action:result.action,policyId:result.policyId,ruleRefs:clone(result.ruleRefs),facts:clone(p.facts),crt:clone(p.crt),breakthrough:clone(p.breakthrough??null),options:clone(p.options),piece,hex,note:String(action.note??'').trim(),policyVersion:s.policyVersion});
  s.pending=null;s.vpObservation=null;
}

export function applyV2Action(state,action){
  if(state?.schemaVersion!==2||state.scenario!==SCENARIO.id||!action?.type)throw new Error('0.2 세션 또는 입력 형식 오류');
  if(state.winner)throw new Error('종료된 게임입니다.');
  const s=upgradeV2Session(state);
  switch(action.type){
    case 'set_group':{
      const group=groupInput(action.group,s.groups);
      s.groups=s.groups.filter(g=>g.id!==group.id).concat(group);invalidate(s);return s;
    }
    case 'remove_group':
      if(s.threats.some(t=>t.affectedGroupId===action.id))throw new Error('이 전투단에 연결된 위협을 먼저 제거하세요.');
      s.groups=s.groups.filter(g=>g.id!==action.id);invalidate(s);return s;
    case 'set_objective':{
      const o=action.observation;
      if(!TARGET_IDS.has(action.id)||!o||!['soviet','soviet_isolated','axis_supplied','axis_unsupplied'].includes(o.control)||![0,1,2,99].includes(o.eta)||typeof o.supplySecure!=='boolean'||typeof o.forceReady!=='boolean'||!['none','pressure','collapse'].includes(o.counterattack))throw new Error('목표의 점유·완료 시점·보급·반격 관측을 확인하세요.');
      s.objectiveStates[action.id]={...clone(o),observedTurn:s.turn};invalidate(s);return s;
    }
    case 'set_threats':{
      if(!Array.isArray(action.threats))throw new Error('위협 목록 오류');
      s.threats=action.threats.map(t=>{
        if(!t||typeof t.id!=='string'||!Object.hasOwn(THREAT_ORDER,t.kind)||![0,1,2].includes(t.eta)||typeof t.actionable!=='boolean'||!['critical','significant','limited'].includes(t.severity??'critical')||(t.targetId&&!TARGET_IDS.has(t.targetId))||(t.affectedGroupId&&!s.groups.some(g=>g.id===t.affectedGroupId)))throw new Error('위협의 종류·피해 규모·발생 시점·관련 목표/전투단을 확인하세요.');
        return {...clone(t),severity:t.severity??'critical',observedTurn:t.observedTurn??s.turn};
      });invalidate(s);return s;
    }
    case 'review_board':s.boardReviewedTurn=s.turn;s.history.push({type:'review_board',turn:s.turn});return s;
    case 'plan':{
      if(!['initial','movement','combat'].includes(s.phase))throw new Error('추축군 차례에 작전을 계획하세요.');
      if(s.pending)throw new Error('진행 중인 판단을 먼저 완료하거나 취소하세요.');
      if(s.boardReviewedTurn!==s.turn)throw new Error('이번 턴 전황을 먼저 확인하세요.');
      if(!s.groups.length)throw new Error('전투단 병력 장부를 먼저 등록하세요.');
      const snapshot={policyVersion:s.policyVersion,input:planningInput(s,action.die),groups:clone(s.groups),parameters:{doctrine:clone(DOCTRINE_PROFILES[s.difficulty]),attack:clone(ATTACK_POLICY[s.difficulty]),dd:clone(DD_POLICY)}};
      s.plan=replayV2Plan(snapshot);s.doneGroups=[];
      if(s.plan.kind==='gain')s.currentGoal=s.plan.targetId;
      s.history.push({type:'plan',turn:s.turn,phase:s.phase,die:action.die,snapshot,result:clone(s.plan),policyVersion:s.policyVersion});return s;
    }
    case 'check_step':{
      if(!PHASE_CHECKLISTS[s.phase]?.some(x=>x.id===action.id))throw new Error('이 단계의 체크 항목이 아닙니다.');
      s.checks[s.phase]??=[];if(!s.checks[s.phase].includes(action.id))s.checks[s.phase].push(action.id);return s;
    }
    case 'start_decision':startDecision(s,action);return s;
    case 'answer':{
      if(s.pending?.result?.status!=='ask'||typeof action.value!=='boolean')throw new Error('현재 질문의 예/아니요 답이 필요합니다.');
      const fact=s.pending.result.fact;
      if(fact==='oddsReady')throw new Error('CRT 결과 면수와 DD를 입력하세요.');
      if(fact==='allowanceReady')throw new Error('돌파집단과 남은 허용량을 입력하세요.');
      s.pending.facts[fact]=action.value;s.pending.result=runProcedure(s.pending.kind,s.pending.facts);return s;
    }
    case 'set_crt':{
      const p=s.pending;
      if(!['attack','breakthrough'].includes(p?.kind)||p.result.fact!=='oddsReady')throw new Error('지금은 CRT 입력 단계가 아닙니다.');
      if(!Object.hasOwn(DD_POLICY,action.defenderDd))throw new Error('수비측 DD 가능 여부를 확인하세요.');
      const critical=s.plan?.policyId==='GOAL-WIN-NOW'&&s.plan.missions.some(m=>m.groupId===p.groupId&&m.kind==='attack');
      const readiness=attackReadiness({profile:s.difficulty,successFaces:action.successFaces,lossFaces:action.lossFaces,critical,defenderDd:action.defenderDd,supportCommitted:action.supportCommitted??0});
      p.crt={successFaces:action.successFaces,lossFaces:action.lossFaces,critical,defenderDd:action.defenderDd,supportCommitted:action.supportCommitted??0,readiness};p.facts.oddsReady=readiness.ready;
      if(p.kind==='attack'&&(p.crt.supportCommitted>=readiness.maxSupportCommitted))p.facts.supportCanFixOdds=false;
      p.result=runProcedure(p.kind,p.facts);return s;
    }
    case 'set_breakthrough':{
      const p=s.pending,old=s.breakthroughLedger[action.combatId];
      if(p?.kind!=='breakthrough'||p.result.fact!=='allowanceReady')throw new Error('지금은 돌파집단 확인 단계가 아닙니다.');
      if(typeof action.combatId!=='string'||!action.combatId.trim()||!ids(action.piece).length||ids(action.piece).some(id=>!p.unitIds.includes(id))||!Number.isInteger(action.remaining)||action.remaining<0||action.remaining>4)throw new Error('초기 전투 ID·돌파집단·허용량을 확인하세요.');
      if(old&&(old.closed||action.remaining>old.remaining||old.piece!==action.piece))throw new Error('종료된 돌파 또는 집단 변경·허용량 증가가 불가능합니다.');
      p.breakthrough={combatId:action.combatId,piece:action.piece,remaining:action.remaining};p.facts.allowanceReady=action.remaining>=1;p.result=runProcedure('breakthrough',p.facts);return s;
    }
    case 'add_loss_candidate':{
      const p=s.pending,c=clone(action.candidate);
      if(p?.kind!=='loss'||p.result.status!=='decision'||!c||typeof c.id!=='string'||!c.id.trim()||c.eligible!==true||!Number.isInteger(c.steps)||c.steps<1||c.steps>3||![-1,0,1].includes(c.quality))throw new Error('손실 선택권과 적격 유닛·스텝·품질을 확인하세요.');
      p.options=p.options.filter(x=>x.id!==c.id).concat(c);p.selectedId=rankLocalOptions('loss',p.options,{enemyLoss:p.facts.enemyLoss})[0]?.id??null;return s;
    }
    case 'cancel_decision':s.pending=null;return s;
    case 'confirm_decision':confirmDecision(s,action);return s;
    case 'complete_group':
      if(s.phase!=='movement'||s.pending||!s.plan?.missions.some(m=>m.groupId===action.groupId))throw new Error('해당 전투단의 이동 판단을 먼저 완료하세요.');
      if(!s.doneGroups.includes(action.groupId))s.doneGroups.push(action.groupId);
      s.history.push({type:'group_complete',turn:s.turn,groupId:action.groupId,note:'남은 합법 이동 없음 또는 유지 임무 완료'});return s;
    case 'soviet_complete':{
      if(s.phase!=='soviet_turn'||s.pending||!action.observation)throw new Error('소련군 차례의 진행 중 판단을 완료하고 VP를 관측하세요.');
      calculateS1Vp(action.observation);
      const controlled=new Map((action.observation.controlledVpHexes??[]).map(x=>[x.id,x.supplied])),isolated=new Set(action.observation.isolatedSovietVpHexes??[]);
      for(const target of TARGETS.filter(x=>x.type==='vp_hex')){
        const previous=s.objectiveStates[target.id]??{eta:99,supplySecure:false,forceReady:true,counterattack:'none'};
        s.objectiveStates[target.id]={...previous,control:controlled.has(target.id)?controlled.get(target.id)?'axis_supplied':'axis_unsupplied':isolated.has(target.id)?'soviet_isolated':'soviet'};
      }
      for(const [id,earned] of [['east_exit',action.observation.eastExit?.mechanizedSteps>=5&&action.observation.eastExit?.roadSupply===true],['south_exit',action.observation.southExit?.mechanizedSteps>=5&&action.observation.southExit?.roadSupply===true],['don_bonus',action.observation.donSouthGermanCombatUnit===true]]){
        s.objectiveStates[id]={...(s.objectiveStates[id]??{eta:99,supplySecure:false,forceReady:true,counterattack:'none'}),control:earned?'axis_supplied':'soviet'};
      }
      s.vpObservation=clone(action.observation);s.lastVpControls=controls(s);s.boardRevision++;return s;
    }
    case 'next_phase':{
      if(s.pending)throw new Error('진행 중인 결정을 완료하거나 취소하세요.');
      if(PHASE_CHECKLISTS[s.phase]?.some(x=>!s.checks[s.phase]?.includes(x.id)))throw new Error('규칙 단계 체크를 모두 완료하세요.');
      if(s.phase==='movement'&&(!s.plan||s.plan.missions.some(m=>!s.doneGroups.includes(m.groupId))))throw new Error('작전 목표와 모든 전투단의 이동 완료를 확인하세요.');
      if(s.phase==='soviet_turn'&&!s.vpObservation)throw new Error('소련군 차례와 VP 관측을 완료하세요.');
      const index=PHASES.indexOf(s.phase);if(index<0||index===PHASES.length-1)throw new Error('다음 단계가 없습니다.');
      s.phase=PHASES[index+1];
      if(s.phase==='victory'){
        s.vp=calculateS1Vp(s.vpObservation).total;
        if(s.vp>=SCENARIO.axisVictoryVp)s.winner='axis';else if(s.turn===SCENARIO.lastTurn)s.winner='soviet';
        s.history.push({type:'victory',turn:s.turn,vp:s.vp,winner:s.winner,ruleRefs:['S1.3','24.1.1','24.1.4']});
      }return s;
    }
    case 'next_turn':
      if(s.phase!=='victory'||s.turn>=SCENARIO.lastTurn)throw new Error('다음 턴으로 이동할 수 없습니다.');
      s.turn++;s.phase='initial';s.checks={};s.pending=null;s.usedUnits=[];s.usedAttackUnits=[];s.doneGroups=[];s.breakthroughLedger={};s.plan=null;s.boardReviewedTurn=0;s.vpObservation=null;return s;
    default:throw new Error(`알 수 없는 세션 행동: ${action.type}`);
  }
}
