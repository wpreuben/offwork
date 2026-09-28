import {TARGETS} from './catalog.js';
import {PROFILES} from './policy.js';

const targets=new Map(TARGETS.map(t=>[t.id,t]));
const fallback={id:'fallback',action:'restore_supply',targetId:null,formationId:null,policyId:'FALLBACK',ruleRefs:['18','21–23']};
export function evaluateCandidates({turn,vp,profile,candidates,die}) {
  if (!Number.isInteger(turn)||turn<1||turn>8||!Number.isInteger(vp)||vp<0||!PROFILES[profile]||!Number.isInteger(die)||die<1||die>6||!Array.isArray(candidates)) throw new Error('턴·VP·난이도·후보·d6 입력 오류');
  const p=PROFILES[profile], rejected=[], questions=[], accepted=[];
  for (const c of candidates) {
    const missing=[];
    if (!c.id||!c.formationId||!c.action||!targets.has(c.targetId)) missing.push('목표·편제·행동');
    if (typeof c.legal!=='boolean') missing.push('합법성');
    if (typeof c.supplied!=='boolean') missing.push('보급');
    if (!['none','low','high'].includes(c.encirclementRisk)) missing.push('포위 위험');
    if (!Number.isFinite(c.reserveRemaining)) missing.push('남길 예비 병력');
    if (typeof c.reachable!=='boolean') missing.push('목표 접근 가능성');
    if (!Array.isArray(c.units)||!c.units.length) missing.push('사용 유닛');
    if (c.action==='attack' && (!Number.isFinite(c.attack?.odds)||!Number.isFinite(c.attack?.lossRisk))) missing.push('예상 공격 비율·손실 위험');
    if (missing.length) {questions.push(`${c.id??'후보'}: ${missing.join(', ')} 확인`);continue;}
    let policyId,rule;
    if (turn===1 && c.combatUnit!==false && (c.units.some(u=>['14Pz','22Pz','60PzG'].some(f=>u.includes(f))) || ((c.action==='advance'||c.action==='attack') && c.hexes>2))) [policyId,rule]=['S1-FIRST-TURN','S1.2'];
    else if (!c.legal) [policyId,rule]=['SAFE-LEGAL','5–8'];
    else if (!c.supplied) [policyId,rule]=['SAFE-SUPPLY','21–23'];
    else if (c.encirclementRisk==='high') [policyId,rule]=['SAFE-ENCIRCLE','6–7, 21–23'];
    else if (!c.reachable && (c.action==='advance'||c.action==='attack')) [policyId,rule]=['GOAL-REACH','5–8'];
    else if (c.reserveRemaining<p.minReserve) [policyId,rule]=['SAFE-RESERVE','5–8'];
    else if (c.action==='attack' && (c.attack.odds<p.minAttackOdds||c.attack.lossRisk>p.maxLossRisk)) [policyId,rule]=['ACT-ATTACK','9–16'];
    if (policyId) {rejected.push({id:c.id,policyId,ruleRef:rule});continue;}
    const target=targets.get(c.targetId);
    const shortfall=Math.max(0,8-vp), turnsLeft=9-turn;
    const score=target.vp*p.targetWeight+(c.reachable?shortfall*p.vpShortfallWeight*target.vp/turnsLeft:0)+(c.action==='attack'?0.05:0)-(c.encirclementRisk==='low'?0.3:0);
    accepted.push({...c,score,policyId:'GOAL-VP',ruleRefs:['S1.3', c.action==='attack'?'9–16':'5–8']});
  }
  const ruleRefs=[...new Set(rejected.map(r=>r.ruleRef))];
  if (questions.length) return {selected:null,rejected,questions,policyIds:['SAFE-INPUT'],ruleRefs};
  if (!accepted.length) return {selected:fallback,rejected,questions,policyIds:['FALLBACK',...rejected.map(r=>r.policyId)],ruleRefs:[...new Set([...ruleRefs,...fallback.ruleRefs]) ]};
  accepted.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const best=accepted[0].score;
  const tied=accepted.filter(c=>best-c.score<=p.tieWindow);
  const selected=tied[(die-1)%tied.length];
  return {selected,rejected,questions,policyIds:['GOAL-VP','CHOOSE',...rejected.map(r=>r.policyId)],ruleRefs:[...new Set([...ruleRefs,...selected.ruleRefs])]};
}
