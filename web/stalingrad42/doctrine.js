import {TARGETS} from './catalog.js';

export const DOCTRINE_VERSION='0.2.0';
export const DOCTRINE_PROFILES=Object.freeze({
  beginner:{label:'입문',targetHumanWinRate:0.70,threatHorizon:0,attackPreparation:'local'},
  standard:{label:'표준',targetHumanWinRate:0.50,threatHorizon:1,attackPreparation:'supported'},
  hard:{label:'어려움',targetHumanWinRate:0.35,threatHorizon:2,attackPreparation:'supported_and_followup'}
});

// These are rule procedures, not voluntary actions offered to the automa.
export const PHASE_CHECKLISTS=Object.freeze({
  initial:[
    {id:'air',text:'항공 유닛을 Ready로 되돌린다',rule:'3.0'},
    {id:'markers',text:'열차 표식을 제거하고 완료된 축성·공세 표식을 처리한다',rule:'3.0'},
    {id:'resources',text:'자원 포인트를 작전 목표에 먼저 배분한다',rule:'18.1'},
    {id:'asu',text:'가능한 SP로 ASU를 준비한다',rule:'18.6.4'},
    {id:'reinforcements',text:'증원과 대체 병력을 규칙에 따라 배치한다',rule:'22.1, 21.0'},
    {id:'leaders',text:'지도자와 공세 표식을 Ready로 되돌린다',rule:'28.1, 26.0'}
  ],
  recovery:[
    {id:'automatic_recovery',text:'EZOC 밖의 Disrupted·Full Retreat 유닛은 한 단계 회복한다',rule:'13.4'},
    {id:'rally',text:'EZOC 안의 해당 유닛은 Rally 판정을 한다',rule:'13.5'},
    {id:'replacement_markers',text:'Replacement 표식을 제거한다',rule:'21.4'}
  ],
  supply:[
    {id:'railheads',text:'추축군 철도두를 최대 네 개, 각각 최대 두 헥스 전진시킨다',rule:'17.2.1'},
    {id:'supply_status',text:'모든 추축군 유닛의 보급 상태를 확인한다',rule:'16.1'},
    {id:'isolation',text:'고립 및 인접 조건을 만족하는 전투 유닛의 손실을 판정한다',rule:'16.5'},
    {id:'asu_supply',text:'규칙상 가능한 SP로 Good Order ASU를 준비한다',rule:'18.6.4'}
  ]
});

export const THREAT_ORDER=Object.freeze({supply:0,vp_supply:1,vp_loss:2,entry_penalty:3,city_penalty:4,encirclement:5});
export const GOAL_STEPS=Object.freeze([
  {id:'GOAL-ELIGIBLE',text:'이미 득점한 목표와 규칙상 불가능·보급 유지 불가·즉시 붕괴할 목표를 제외한다',rule:'16.3, S1.3'},
  {id:'GOAL-THREAT',text:'보급 단절, 얻은 VP 상실, X·Y·Z 및 시작선 서쪽 도시 감점 위협에 먼저 대응한다',rule:'16.3, 24.1.4'},
  {id:'GOAL-WIN-NOW',text:'이번 승리 판정에서 8VP를 만들 수 있는 목표를 우선한다',rule:'S1.3'},
  {id:'GOAL-CONTINUE',text:'여전히 가능하고 안전한 이전 임무를 유지한다',rule:'오토마 0.2'},
  {id:'GOAL-GAIN',text:'새 순 VP가 큰 목표, 동률이면 일찍 완료되는 목표를 고른다',rule:'S1.3'},
  {id:'GOAL-TIE',text:'완전 동률이면 상위 세 목표를 공개 d6로 고른다: 2개는 홀/짝, 3개는 1–2/3–4/5–6',rule:'오토마 0.2'}
]);
const SCORED=new Set(['axis_supplied','soviet_isolated']);
const EXIT_TYPES=new Set(['east_exit','south_exit']);

function selectEquivalent(items,die,turn){
  const rotated=items.length>3?items.slice((turn-1)%items.length).concat(items.slice(0,(turn-1)%items.length)):items;
  const top=rotated.slice(0,3);
  return top[Math.floor((die-1)*top.length/6)];
}

export function planAxisTurn({turn,vp,profile,currentGoal=null,objectiveStates={},threats=[],die}){
  if(!Number.isInteger(turn)||turn<1||turn>8||!Number.isInteger(vp)||!DOCTRINE_PROFILES[profile]||!Number.isInteger(die)||die<1||die>6)throw new Error('작전 입력의 턴·VP·난이도·d6를 확인하세요.');
  const horizon=DOCTRINE_PROFILES[profile].threatHorizon;
  const urgent=[];
  for(const threat of threats){
    if(!Object.hasOwn(THREAT_ORDER,threat.kind))throw new Error(`알 수 없는 위협: ${threat.kind}`);
    if(threat.actionable&&Number.isInteger(threat.eta)&&threat.eta<=horizon)urgent.push(threat);
  }
  for(const target of TARGETS){
    if(target.type==='vp_hex'&&objectiveStates[target.id]?.control==='axis_unsupplied')urgent.push({id:`supply_${target.id}`,kind:'vp_supply',targetId:target.id,eta:0,actionable:true});
  }
  urgent.sort((a,b)=>THREAT_ORDER[a.kind]-THREAT_ORDER[b.kind]||a.eta-b.eta||a.id.localeCompare(b.id));
  if(urgent.length){
    const threat=urgent[0];
    const ids={supply:'THREAT-SUPPLY',vp_supply:'THREAT-VP-SUPPLY',vp_loss:'THREAT-VP-LOSS',entry_penalty:'THREAT-ENTRY',city_penalty:'THREAT-CITY',encirclement:'THREAT-ENCIRCLE'};
    return {kind:'respond',id:threat.id,targetId:threat.targetId??null,policyId:ids[threat.kind],reason:`${threat.kind} 위협에 먼저 대응`,ruleRefs:threat.kind.includes('penalty')?['24.1.4']:['16.1–16.5','S1.3']};
  }
  const eligible=[];
  for(const [order,target] of TARGETS.entries()){
    const s=objectiveStates[target.id];
    if(!s||SCORED.has(s.control)||s.control==='axis_unsupplied'||!s.forceReady||!s.supplySecure||s.counterattack==='collapse'||!Number.isInteger(s.eta)||s.eta<0||s.eta>2)continue;
    if(EXIT_TYPES.has(target.type)&&(!s.exitStepsReady||!s.roadReady))continue;
    eligible.push({target,order,eta:s.eta,immediateWin:s.eta===0&&vp+target.vp>=8});
  }
  if(!eligible.length)return {kind:'consolidate',id:'consolidate',targetId:null,policyId:'GOAL-CONSOLIDATE',reason:'실행 가능하고 유지 가능한 새 목표 없음',ruleRefs:['S1.3','16.1–16.5']};
  const winning=eligible.filter(x=>x.immediateWin);
  const pool=winning.length?winning:eligible;
  const continuing=!winning.length&&pool.find(x=>x.target.id===currentGoal);
  if(continuing)return {kind:'gain',id:continuing.target.id,targetId:continuing.target.id,policyId:'GOAL-CONTINUE',reason:'기존 임무를 계속 수행',ruleRefs:['S1.3']};
  pool.sort((a,b)=>b.target.vp-a.target.vp||a.eta-b.eta||a.order-b.order);
  const best=pool[0],equivalent=pool.filter(x=>x.target.vp===best.target.vp&&x.eta===best.eta);
  const choice=selectEquivalent(equivalent,die,turn);
  return {kind:'gain',id:choice.target.id,targetId:choice.target.id,policyId:winning.length?'GOAL-WIN-NOW':'GOAL-GAIN',reason:`${choice.target.vp}VP · ${choice.eta===0?'이번 턴':choice.eta===1?'다음 턴':'이후'} 목표`,ruleRefs:['S1.3'],tieIds:equivalent.map(x=>x.target.id)};
}
