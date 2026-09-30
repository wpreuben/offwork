import test from 'node:test';
import assert from 'node:assert/strict';
import * as sessions from '../web/stalingrad42/session-v2.js';
const {createV2Session,applyV2Action}=sessions;
const group={id:'6A',unitIds:['6A-1','6A-2','14Pz'],protectedUnitIds:[],kind:'mobile',ready:true,supplied:true,guardCritical:false,targetDistances:{usman:1}};
const objective={control:'soviet',eta:0,supplySecure:true,forceReady:true,counterattack:'none'};
const apply=(s,...actions)=>actions.reduce((x,a)=>applyV2Action(x,a),s);
const planned=()=>apply({...createV2Session(),phase:'movement'},{type:'set_group',group},{type:'set_objective',id:'usman',observation:objective},{type:'review_board'},{type:'plan',die:1});
test('위협이 연결된 전투단은 위협을 먼저 제거해야 삭제할 수 있다',()=>{
  const s=apply(planned(),{type:'set_threats',threats:[{id:'cut',kind:'supply',eta:0,severity:'critical',actionable:true,affectedGroupId:'6A'}]});
  assert.throws(()=>applyV2Action(s,{type:'remove_group',id:'6A'}),/위협/);
  assert.equal(apply(s,{type:'set_threats',threats:[]},{type:'remove_group',id:'6A'}).groups.length,0);
});
test('병력 장부가 없으면 계획을 확정하지 못한다',()=>{
  assert.throws(()=>applyV2Action({...createV2Session(),boardReviewedTurn:1},{type:'plan',die:1}),/전투단/);
});
test('전황을 수정하면 진행 중 이동 판단도 취소된다',()=>{
  let s=apply(planned(),{type:'start_decision',kind:'movement'});
  s=applyV2Action(s,{type:'set_threats',threats:[{id:'cut',kind:'supply',eta:0,severity:'critical',actionable:true,affectedGroupId:'6A'}]});
  assert.equal(s.plan,null);assert.equal(s.pending,null);
  assert.throws(()=>applyV2Action(s,{type:'confirm_decision',piece:'6A-1',hex:'2108',firstTurnLegal:true}),/결정/);
});
test('배정 밖 유닛은 이동·공격 기록할 수 없다',()=>{
  const s=apply(planned(),{type:'start_decision',kind:'movement'});
  assert.throws(()=>applyV2Action(s,{type:'confirm_decision',piece:'other-1',hex:'2108',firstTurnLegal:true}),/전투단/);
  assert.equal(s.pending.groupId,'6A');
});
test('전투 처리 뒤에는 기존 VP 관측을 다시 요구한다',()=>{
  let s={...createV2Session(),phase:'soviet_turn'};
  s=apply(s,{type:'soviet_complete',observation:{controlledVpHexes:[{id:'voronezh',supplied:true}],isolatedSovietVpHexes:[]}},{type:'start_decision',kind:'defense'},{type:'answer',value:false},{type:'confirm_decision',piece:'6A-1',hex:'2108'});
  assert.equal(s.vpObservation,null);
  assert.throws(()=>applyV2Action(s,{type:'next_phase'}),/VP/);
});
test('계획 스냅샷은 나중에 장부가 바뀌어도 재현할 수 있다',()=>{
  let s=planned();
  const record=s.history.find(x=>x.type==='plan');
  assert.ok(record.snapshot.groups.length);assert.ok(record.snapshot.parameters.attack);
  s=applyV2Action(s,{type:'set_objective',id:'usman',observation:{...objective,control:'axis_supplied'}});
  assert.deepEqual(sessions.replayV2Plan(record.snapshot),record.result);
  assert.equal(record.snapshot.input.objectiveStates.usman.control,'soviet');
});
test('관측 턴 이후 경과를 ETA에 반영한다',()=>{
  let s=planned();
  s=applyV2Action(s,{type:'set_threats',threats:[{id:'cut',kind:'supply',eta:1,severity:'critical',actionable:true,affectedGroupId:'6A'}]});
  s={...s,turn:2,phase:'initial'};
  s=apply(s,{type:'review_board'},{type:'plan',die:1});
  assert.equal(s.plan.threat.eta,0);
});
test('적군 손실 후보를 추가하면 핵심 유닛을 자동 선택한다',()=>{
  let s={...createV2Session(),phase:'soviet_turn'};
  s=apply(s,{type:'start_decision',kind:'loss'},{type:'answer',value:true},
    {type:'add_loss_candidate',candidate:{id:'inf',eligible:true,steps:2,quality:0,mechanized:false}},
    {type:'add_loss_candidate',candidate:{id:'tank',eligible:true,steps:2,quality:1,mechanized:true}});
  assert.equal(s.pending.selectedId,'tank');
  assert.throws(()=>applyV2Action(s,{type:'confirm_decision',piece:'inf'}),/선택/);
});
test('구형 세션 전환은 구형 판단을 취소하고 이력을 보존한다',()=>{
  const old={...createV2Session(),policyVersion:'0.2.0',plan:{kind:'gain'},pending:{kind:'movement'},history:[{type:'legacy',turn:1}]};
  delete old.groups;
  const s=sessions.upgradeV2Session(old);
  assert.equal(s.policyVersion,'0.2.1');assert.deepEqual(s.groups,[]);assert.equal(s.plan,null);assert.equal(s.pending,null);
  assert.equal(s.history[0].type,'legacy');
});

test('돌파집단은 허용량을 소비하며 같은 전투에서 허용량을 늘릴 수 없다',()=>{
  let s={...planned(),phase:'combat'};
  s=apply(s,{type:'start_decision',kind:'breakthrough'},{type:'answer',value:true},{type:'set_breakthrough',combatId:'C1',piece:'6A-1',remaining:2});
  for(const value of [true,false,true])s=applyV2Action(s,{type:'answer',value});
  s=applyV2Action(s,{type:'set_crt',successFaces:4,lossFaces:1,defenderDd:'none',supportCommitted:0});
  s=applyV2Action(s,{type:'confirm_decision',piece:'6A-1',hex:'2108',breakthroughResult:'continue'});
  assert.equal(s.breakthroughLedger.C1.remaining,1);
  s=apply(s,{type:'start_decision',kind:'breakthrough'},{type:'answer',value:true});
  assert.throws(()=>applyV2Action(s,{type:'set_breakthrough',combatId:'C1',piece:'6A-1',remaining:2}),/허용량/);
});

test('지금 관측한 VP 상실을 반영해 즉시 승리 목표를 재계산한다',()=>{
  let s=planned();
  s={...s,vp:7,lastVpControls:{voronezh:'axis_supplied'}};
  s=apply(s,{type:'set_objective',id:'voronezh',observation:objective},{type:'review_board'},{type:'plan',die:1});
  assert.equal(s.plan.policyId,'GOAL-CONTINUE');
  assert.equal(s.history.at(-1).snapshot.input.vp,5);
});

test('정규 공격에 참여한 유닛을 같은 돌파집단에 사용할 수 있다',()=>{
  let s={...planned(),phase:'combat'};
  s=apply(s,{type:'start_decision',kind:'attack'},{type:'answer',value:true},{type:'answer',value:true},{type:'answer',value:false},{type:'answer',value:true},{type:'set_crt',successFaces:4,lossFaces:1,defenderDd:'none',supportCommitted:0},{type:'answer',value:true},{type:'confirm_decision',piece:'6A-1',hex:'2108'});
  s=apply(s,{type:'start_decision',kind:'breakthrough'},{type:'answer',value:true});
  assert.doesNotThrow(()=>applyV2Action(s,{type:'set_breakthrough',combatId:'C1',piece:'6A-1',remaining:2}));
});

test('중복 등록과 보호 유닛은 병력 배정에서 제외된다',()=>{
  let s=planned();
  assert.throws(()=>applyV2Action(s,{type:'set_group',group:{...group,id:'other'}}),/둘 이상/);
  s=apply(s,{type:'set_group',group:{...group,protectedUnitIds:['6A-1']}},{type:'review_board'},{type:'plan',die:1},{type:'start_decision',kind:'movement'});
  assert.ok(!s.pending.unitIds.includes('6A-1'));
});
