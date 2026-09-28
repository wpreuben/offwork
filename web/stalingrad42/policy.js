export const POLICY_VERSION='0.1.0';
export const PHASE_ACTIONS=Object.freeze({movement:['advance','defend'],combat:['attack','no_attack'],recovery:['reorganize'],supply:['restore_supply']});
export const PROFILES=Object.freeze({
  beginner:{label:'입문',targetHumanWinRate:0.70,targetWeight:1,vpShortfallWeight:0.15,minAttackOdds:1.5,maxLossRisk:0.35,minReserve:2,tieWindow:0.8},
  standard:{label:'표준',targetHumanWinRate:0.50,targetWeight:1.3,vpShortfallWeight:0.35,minAttackOdds:1.25,maxLossRisk:0.50,minReserve:1,tieWindow:0.4},
  hard:{label:'어려움',targetHumanWinRate:0.35,targetWeight:1.6,vpShortfallWeight:0.55,minAttackOdds:1,maxLossRisk:0.65,minReserve:1,tieWindow:0.2}
});
// These are experimental automa values, not game-rule amendments or measured win rates.
export const FLOW=Object.freeze([
  {id:'START',question:'현재 턴과 VP를 확인했는가?',yes:'GOAL-VP',no:'START',rule:'S1.1–S1.3'},
  {id:'GOAL-VP',question:'미달 VP를 메울 수 있는 목표는 어디인가?',yes:'SAFE-INPUT',no:'FALLBACK',rule:'S1.3'},
  {id:'SAFE-INPUT',question:'합법성·보급·포위·예비 병력·공격 조건을 모두 확인했는가?',yes:'PHASE-ACTION',no:'ASK',rule:'5–8, 21–23'},
  {id:'PHASE-ACTION',question:'현재 단계에서 허용된 행동인가?',yes:'SAFE-USED',no:'NEXT',rule:'3.0, 5–8, 9–16, 18, 21–23'},
  {id:'SAFE-USED',question:'이 이동 단계에서 아직 쓰지 않은 유닛인가?',yes:'S1-FIRST-TURN',no:'NEXT',rule:'5–8'},
  {id:'S1-FIRST-TURN',question:'첫 턴 금지 편제와 2헥스 제한을 지키는가?',yes:'SAFE-LEGAL',no:'NEXT',rule:'S1.2'},
  {id:'SAFE-LEGAL',question:'이 이동 또는 공격이 합법인가?',yes:'SAFE-SUPPLY',no:'NEXT',rule:'5–8'},
  {id:'SAFE-SUPPLY',question:'보급과 후속 보급선을 유지하는가?',yes:'SAFE-ENCIRCLE',no:'NEXT',rule:'21–23'},
  {id:'SAFE-ENCIRCLE',question:'고위험 포위가 없는가?',yes:'GOAL-REACH',no:'NEXT',rule:'6–7, 21–23'},
  {id:'GOAL-REACH',question:'이 행동으로 목표에 접근 가능한가?',yes:'SAFE-RESERVE',no:'NEXT',rule:'5–8'},
  {id:'SAFE-RESERVE',question:'필요한 예비 병력을 남기는가?',yes:'ACT-ATTACK',no:'NEXT',rule:'5–8'},
  {id:'ACT-ATTACK',question:'공격이면 예상 전투 조건을 충족하는가?',yes:'CHOOSE',no:'NEXT',rule:'9–16'},
  {id:'CHOOSE',question:'동등한 후보는 공개 d6로 고르고 실행 가능한가?',yes:'CONFIRM',no:'NEXT',rule:'오토마 0.1'},
  {id:'NEXT',question:'다음 후보가 있는가?',yes:'SAFE-INPUT',no:'FALLBACK',rule:'오토마 0.1'},
  {id:'FALLBACK',question:'현재 단계에서 가능한 보급 회복·재편·방어 준비를 유닛·합법성·보급·포위까지 확인했는가?',yes:'CONFIRM',no:'END',rule:'18, 21–23'}
]);
