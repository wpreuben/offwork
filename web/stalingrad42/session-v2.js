import {SCENARIO,TARGETS,calculateS1Vp} from './catalog.js';
import {DOCTRINE_VERSION,DOCTRINE_PROFILES,PHASE_CHECKLISTS,planAxisTurn} from './doctrine.js';
import {runProcedure,attackReadiness,SELECTION_RULES} from './procedures.js';

const PHASES=['initial','movement','combat','recovery','supply','soviet_turn','victory'];
const TARGET_IDS=new Set(TARGETS.map(t=>t.id));
const clone=value=>structuredClone(value);
const decisionKinds={movement:['movement'],combat:['attack','advance','loss','retreat'],soviet_turn:['defense','loss','retreat']};

export function createV2Session({difficulty='standard'}={}){
  if(!DOCTRINE_PROFILES[difficulty])throw new Error('알 수 없는 난이도');
  return {schemaVersion:2,scenario:SCENARIO.id,policyVersion:DOCTRINE_VERSION,difficulty,turn:1,phase:'initial',vp:0,winner:null,objectiveStates:{},threats:[],currentGoal:null,plan:null,boardReviewedTurn:0,checks:{},pending:null,usedUnits:[],vpObservation:null,history:[]};
}

export function applyV2Action(state,action){
  if(state?.schemaVersion!==2||state.scenario!==SCENARIO.id||!action?.type)throw new Error('0.2 세션 또는 입력 형식 오류');
  if(state.winner&&action.type!=='export')throw new Error('종료된 게임입니다.');
  const s=clone(state);
  switch(action.type){
    case 'set_objective':{
      if(!TARGET_IDS.has(action.id))throw new Error('알 수 없는 목표');
      const o=action.observation;
      if(!o||!['soviet','soviet_isolated','axis_supplied','axis_unsupplied'].includes(o.control)||![0,1,2,99].includes(o.eta)||typeof o.supplySecure!=='boolean'||typeof o.forceReady!=='boolean'||!['none','pressure','collapse'].includes(o.counterattack))throw new Error('목표의 점유·완료 시점·보급·병력·반격 상태를 확인하세요.');
      s.objectiveStates[action.id]=clone(o);
      s.boardReviewedTurn=0;s.plan=null;
      return s;
    }
    case 'set_threats':
      if(!Array.isArray(action.threats))throw new Error('위협 목록 오류');
      s.threats=clone(action.threats);s.boardReviewedTurn=0;s.plan=null;return s;
    case 'review_board':
      s.boardReviewedTurn=s.turn;
      s.history.push({type:'review_board',turn:s.turn});
      return s;
    case 'plan':
      if(s.boardReviewedTurn!==s.turn)throw new Error('이번 턴 전황을 먼저 확인하세요.');
      s.plan=planAxisTurn({turn:s.turn,vp:s.vp,profile:s.difficulty,currentGoal:s.currentGoal,objectiveStates:s.objectiveStates,threats:s.threats,die:action.die});
      if(s.plan.kind==='gain')s.currentGoal=s.plan.targetId;
      s.history.push({type:'plan',turn:s.turn,phase:s.phase,die:action.die,result:clone(s.plan),policyVersion:s.policyVersion});
      return s;
    case 'check_step':{
      const rows=PHASE_CHECKLISTS[s.phase];
      if(!rows?.some(x=>x.id===action.id))throw new Error('이 단계의 체크 항목이 아닙니다.');
      s.checks[s.phase]??=[];
      if(!s.checks[s.phase].includes(action.id))s.checks[s.phase].push(action.id);
      return s;
    }
    case 'start_decision':{
      if(!decisionKinds[s.phase]?.includes(action.kind))throw new Error('현재 단계에서 이 결정을 할 수 없습니다.');
      if(action.kind==='movement'&&!s.plan)throw new Error('이번 턴 작전 목표를 먼저 정하세요.');
      const facts=action.kind==='movement'?{
        corridorThreatened:s.plan.kind==='respond'&&['THREAT-SUPPLY','THREAT-VP-SUPPLY'].includes(s.plan.policyId),
        urgentResponse:s.plan.kind==='respond'&&!['THREAT-SUPPLY','THREAT-VP-SUPPLY'].includes(s.plan.policyId),
        goalActive:s.plan.kind==='gain'
      }:{};
      const result=SELECTION_RULES[action.kind]&&!['movement','attack','defense','advance'].includes(action.kind)
        ?{status:'decision',action:`select_${action.kind}`,policyId:`${action.kind.toUpperCase()}-PRIORITY`,ruleRefs:SELECTION_RULES[action.kind].map(x=>x.rule)}
        :runProcedure(action.kind,facts);
      s.pending={kind:action.kind,facts,crt:null,result};
      return s;
    }
    case 'answer':{
      if(s.pending?.result?.status!=='ask'||typeof action.value!=='boolean')throw new Error('현재 질문의 예/아니요 답이 필요합니다.');
      const fact=s.pending.result.fact;
      if(fact==='oddsReady')throw new Error('CRT 결과 면수를 입력하세요.');
      s.pending.facts[fact]=action.value;
      s.pending.result=runProcedure(s.pending.kind,s.pending.facts);
      return s;
    }
    case 'set_crt':{
      if(s.pending?.kind!=='attack'||s.pending.result?.fact!=='oddsReady')throw new Error('지금은 CRT 입력 단계가 아닙니다.');
      const readiness=attackReadiness({profile:s.difficulty,successFaces:action.successFaces,lossFaces:action.lossFaces,critical:action.critical});
      s.pending.crt={successFaces:action.successFaces,lossFaces:action.lossFaces,critical:action.critical,readiness};
      s.pending.facts.oddsReady=readiness.ready;
      s.pending.result=runProcedure('attack',s.pending.facts);
      return s;
    }
    case 'cancel_decision':s.pending=null;return s;
    case 'confirm_decision':{
      const result=s.pending?.result;
      if(result?.status!=='decision')throw new Error('먼저 결정 질문을 완료하세요.');
      const piece=String(action.piece??'').trim(),hex=String(action.hex??'').trim();
      if(['movement','defense','loss','retreat','advance'].includes(s.pending.kind)&&!piece)throw new Error('선택된 유닛을 적으세요.');
      if(s.pending.kind==='attack'&&result.action==='attack'&&!piece)throw new Error('공격에 참여한 유닛을 적으세요.');
      if(s.pending.kind==='movement'&&!hex)throw new Error('이동 도착 헥스를 적으세요.');
      if(s.turn===1&&['movement','attack'].includes(s.pending.kind)&&/(?:^|[^a-z0-9])(?:14\s*pz|22\s*pz|60\s*pzg)(?:$|[^a-z0-9])/i.test(piece))throw new Error('S1.2: 1턴 14Pz·22Pz·60PzG는 이동·공격할 수 없습니다.');
      if(s.turn===1&&s.pending.kind==='movement'&&action.firstTurnLegal!==true)throw new Error('S1.2: 전투 유닛은 전술 이동 2헥스 이내, SP는 전체 MA 이동인지 확인하세요.');
      if(s.pending.kind==='movement'&&s.usedUnits.includes(piece))throw new Error('같은 이동 단계의 유닛 중복');
      if(s.pending.kind==='movement')s.usedUnits.push(piece);
      s.history.push({type:'decision',turn:s.turn,phase:s.phase,kind:s.pending.kind,action:result.action,policyId:result.policyId,ruleRefs:clone(result.ruleRefs),facts:clone(s.pending.facts),crt:clone(s.pending.crt),piece,hex,note:String(action.note??'').trim(),policyVersion:s.policyVersion});
      s.pending=null;
      return s;
    }
    case 'soviet_complete':
      if(s.phase!=='soviet_turn'||!action.observation)throw new Error('소련군 차례 종료와 VP 관측이 필요합니다.');
      calculateS1Vp(action.observation);
      const controlled=new Map((action.observation.controlledVpHexes??[]).map(x=>[x.id,x.supplied]));
      const isolated=new Set(action.observation.isolatedSovietVpHexes??[]);
      for(const target of TARGETS.filter(x=>x.type==='vp_hex')){
        const previous=s.objectiveStates[target.id]??{control:'soviet',eta:99,supplySecure:false,forceReady:false,counterattack:'none'};
        const control=controlled.has(target.id)?controlled.get(target.id)?'axis_supplied':'axis_unsupplied':isolated.has(target.id)?'soviet_isolated':'soviet';
        s.objectiveStates[target.id]={...previous,control};
      }
      for(const [id,earned] of [
        ['east_exit',action.observation.eastExit?.mechanizedSteps>=5&&action.observation.eastExit?.roadSupply===true],
        ['south_exit',action.observation.southExit?.mechanizedSteps>=5&&action.observation.southExit?.roadSupply===true],
        ['don_bonus',action.observation.donSouthGermanCombatUnit===true]
      ]){
        const previous=s.objectiveStates[id]??{control:'soviet',eta:99,supplySecure:false,forceReady:false,counterattack:'none'};
        s.objectiveStates[id]={...previous,control:earned?'axis_supplied':'soviet'};
      }
      s.vpObservation=clone(action.observation);
      return s;
    case 'next_phase':{
      if(s.pending)throw new Error('진행 중인 결정을 완료하거나 취소하세요.');
      const rows=PHASE_CHECKLISTS[s.phase];
      if(rows?.some(x=>!s.checks[s.phase]?.includes(x.id)))throw new Error('규칙 단계 체크를 모두 완료하세요.');
      if(s.phase==='soviet_turn'&&!s.vpObservation)throw new Error('소련군 차례와 VP 관측을 완료하세요.');
      const index=PHASES.indexOf(s.phase);
      if(index<0||index===PHASES.length-1)throw new Error('다음 단계가 없습니다.');
      s.phase=PHASES[index+1];
      if(s.phase==='victory'){
        s.vp=calculateS1Vp(s.vpObservation).total;
        if(s.vp>=SCENARIO.axisVictoryVp)s.winner='axis';
        else if(s.turn===SCENARIO.lastTurn)s.winner='soviet';
        s.history.push({type:'victory',turn:s.turn,vp:s.vp,winner:s.winner,ruleRefs:['S1.3','24.1.1','24.1.4']});
      }
      return s;
    }
    case 'next_turn':
      if(s.phase!=='victory'||s.turn>=SCENARIO.lastTurn)throw new Error('다음 턴으로 이동할 수 없습니다.');
      s.turn++;s.phase='initial';s.checks={};s.pending=null;s.usedUnits=[];s.plan=null;s.boardReviewedTurn=0;s.vpObservation=null;
      return s;
    default:throw new Error(`알 수 없는 세션 행동: ${action.type}`);
  }
}
