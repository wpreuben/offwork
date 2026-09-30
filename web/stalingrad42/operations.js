import {DOCTRINE_PROFILES} from './doctrine.js';

export const MISSION_LABELS=Object.freeze({attack:'주공 · 목표 접근',respond:'위협 대응',supply:'보급로 확보',screen:'측면·거점 방어',reserve:'예비 유지'});
export const OPERATION_STEPS=Object.freeze([
  {id:'OPS-READY',text:'유닛 목록, 가용·보급·거점 경계 상태와 목표까지 최소 헥스 거리를 확인한다. 목표 거리를 모르는 전투단은 주공 후보에서 제외한다.'},
  {id:'OPS-CRITICAL',text:'즉시 핵심 위협은 관련 전투단부터 대응한다. 표준·어려움은 최대 2개, 입문은 1개이며 남은 전투단은 측면을 지킨다.'},
  {id:'OPS-MAIN',text:'주공은 가용·보급·거점 경계 필요 없음인 전투단 중 목표까지 거리가 가장 짧은 하나, 동률이면 기동 전투단, 다시 동률이면 ID 순으로 배정한다.'},
  {id:'OPS-LOCAL',text:'경미한 위협은 주공을 유지하고 가용 전투단 수×0.34의 내림만큼만 대응한다. 이번 승리 목표이면 미래 위협은 이번 배정에서 제외한다.'},
  {id:'OPS-RESERVE',text:'가용 전투단이 3개 이상이면 미배정 전투단 중 기동 전투단, 주목표에서 먼 전투단, ID 순으로 하나를 예비에 둔다. 나머지는 측면·거점 방어다.'},
  {id:'OPS-UNIT',text:'각 전투단의 보호 유닛과 이미 이동한 유닛을 제외하고 유닛 ID 순서로 첫 합법 유닛을 고른다. 예비·거점 경계 유닛은 유지한다. 후보가 없으면 전투단 완료를 기록한다.'}
]);

export function orderedMissionUnits(group,usedUnits=[]){
  return group.unitIds.filter(id=>!group.protectedUnitIds?.includes(id)&&!usedUnits.includes(id)).slice().sort((a,b)=>a.localeCompare(b));
}

export function allocateMissions({plan,groups,profile,profilePolicy}){
  const params=profilePolicy??DOCTRINE_PROFILES[profile];
  if(!params||!Array.isArray(groups))throw new Error('작전 병력 입력 오류');
  const missions=[],assigned=new Set();
  const active=groups.filter(g=>g.ready);
  const distance=(g,target)=>g.targetDistances?.[target]??99;
  const closest=(pool,target,affected)=>pool.slice().sort((a,b)=>Number(b.id===affected)-Number(a.id===affected)||distance(a,target)-distance(b,target)||Number(b.kind==='mobile')-Number(a.kind==='mobile')||a.id.localeCompare(b.id));
  const add=(g,kind,targetId=null,threatId=null)=>{assigned.add(g.id);missions.push({groupId:g.id,kind,targetId,threatId,unitIds:orderedMissionUnits(g),policyId:`OPS-${kind.toUpperCase()}`});};
  if(plan.kind==='respond'){
    const threat=plan.threat??{id:plan.id,targetId:plan.targetId,kind:'supply',severity:'critical'};
    const limit=threat.severity==='critical'?params.criticalResponseGroups:Math.max(1,Math.floor(active.length*params.localResponseFraction));
    for(const g of closest(active,threat.targetId,threat.affectedGroupId).slice(0,limit))add(g,['supply','vp_supply'].includes(threat.kind)?'supply':'respond',threat.targetId,threat.id);
  }else if(plan.kind==='gain'){
    const attackers=active.filter(g=>g.supplied&&!g.guardCritical&&distance(g,plan.targetId)<99&&orderedMissionUnits(g).length);
    const main=closest(attackers,plan.targetId)[0];
    if(main)add(main,'attack',plan.targetId);
  }
  let budget=Math.floor(active.length*params.localResponseFraction);
  for(const t of plan.localThreats??[]){
    if(!budget||(plan.policyId==='GOAL-WIN-NOW'&&t.eta>0))continue;
    const g=closest(active.filter(x=>!assigned.has(x.id)),t.targetId,t.affectedGroupId)[0];
    if(g){add(g,['supply','vp_supply'].includes(t.kind)?'supply':'respond',t.targetId,t.id);budget--;}
  }
  if(active.length>=params.reserveFromGroups){
    const reserve=active.filter(g=>!assigned.has(g.id)&&!g.guardCritical&&g.supplied).sort((a,b)=>Number(b.kind==='mobile')-Number(a.kind==='mobile')||distance(b,plan.targetId)-distance(a,plan.targetId)||a.id.localeCompare(b.id))[0];
    if(reserve)add(reserve,'reserve');
  }
  for(const g of groups.slice().sort((a,b)=>a.id.localeCompare(b.id)))if(!assigned.has(g.id))add(g,'screen');
  return missions;
}
