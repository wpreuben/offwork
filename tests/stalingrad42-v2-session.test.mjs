import test from 'node:test';
import assert from 'node:assert/strict';
import {createV2Session as rawCreateV2Session,applyV2Action} from '../web/stalingrad42/session-v2.js';
const createV2Session=options=>applyV2Action(rawCreateV2Session(options),{type:'set_group',group:{id:'6A',unitIds:['6A-1','6A-2','14Pz'],protectedUnitIds:[],kind:'mobile',ready:true,supplied:true,guardCritical:false,targetDistances:{usman:1}}});

const doAction=(state,...actions)=>actions.reduce((s,a)=>applyV2Action(s,a),state);
const goal={control:'soviet',eta:0,supplySecure:true,forceReady:true,counterattack:'none'};

test('new game stores policy 0.2 and requires this turn board review before planning',()=>{
  const s=createV2Session({difficulty:'standard'});
  assert.equal(s.schemaVersion,2);assert.equal(s.phase,'initial');
  assert.throws(()=>applyV2Action(s,{type:'plan',die:1}),/전황/);
  const planned=doAction(s,{type:'set_objective',id:'usman',observation:goal},{type:'review_board'},{type:'plan',die:1});
  assert.equal(planned.plan.targetId,'usman');assert.equal(planned.history.at(-1).type,'plan');
});

test('rules checklist cannot be skipped and a chosen goal survives next turn',()=>{
  let s=createV2Session();
  assert.throws(()=>applyV2Action(s,{type:'next_phase'}),/체크/);
  for(const id of ['air','markers','resources','asu','reinforcements','leaders'])s=applyV2Action(s,{type:'check_step',id});
  s=applyV2Action(s,{type:'next_phase'});
  assert.equal(s.phase,'movement');
  s=doAction(s,{type:'set_objective',id:'usman',observation:goal},{type:'review_board'},{type:'plan',die:1});
  assert.equal(s.currentGoal,'usman');
  s=doAction(s,{type:'complete_group',groupId:'6A'},{type:'next_phase'},{type:'next_phase'});
  for(const id of ['automatic_recovery','rally','replacement_markers'])s=applyV2Action(s,{type:'check_step',id});
  s=applyV2Action(s,{type:'next_phase'});
  for(const id of ['railheads','supply_status','isolation','asu_supply'])s=applyV2Action(s,{type:'check_step',id});
  s=applyV2Action(s,{type:'next_phase'});
  s=applyV2Action(s,{type:'soviet_complete',observation:{controlledVpHexes:[],isolatedSovietVpHexes:[]}});
  s=applyV2Action(s,{type:'next_phase'});
  s=applyV2Action(s,{type:'next_turn'});
  assert.equal(s.turn,2);assert.equal(s.currentGoal,'usman');assert.equal(s.boardReviewedTurn,0);
});

test('Soviet turn permits repeated Axis defense decisions and records them',()=>{
  let s=createV2Session();s={...s,phase:'soviet_turn'};
  s=applyV2Action(s,{type:'start_decision',kind:'defense'});
  assert.equal(s.pending.result.policyId,'DEF-LEGAL');
  s=applyV2Action(s,{type:'answer',value:true});
  s=applyV2Action(s,{type:'answer',value:true});
  assert.equal(s.pending.result.action,'determined_defense');
  s=applyV2Action(s,{type:'confirm_decision',piece:'6A-1',hex:'2208',note:'VP 방어'});
  assert.equal(s.history.at(-1).action,'determined_defense');
  assert.equal(s.pending,null);
  s=applyV2Action(s,{type:'start_decision',kind:'defense'});
  assert.equal(s.pending.result.status,'ask');
});

test('movement executes the chosen goal and a unit cannot be reused',()=>{
  let s={...createV2Session(),phase:'movement'};
  s=doAction(s,{type:'set_objective',id:'usman',observation:goal},{type:'review_board'},{type:'plan',die:1},{type:'start_decision',kind:'movement'});
  assert.deepEqual(s.pending.facts,{corridorThreatened:false,urgentResponse:false,goalActive:true});
  assert.equal(s.pending.result.action,'approach_goal');
  s=applyV2Action(s,{type:'confirm_decision',piece:'6A-1',hex:'2108',firstTurnLegal:true});
  s=applyV2Action(s,{type:'start_decision',kind:'movement'});
  assert.throws(()=>applyV2Action(s,{type:'confirm_decision',piece:'6A-1',hex:'2109',firstTurnLegal:true}),/중복/);
});

test('a supply emergency chosen in the plan directs movement without repeat questions',()=>{
  let s={...createV2Session(),phase:'movement'};
  assert.throws(()=>applyV2Action(s,{type:'start_decision',kind:'movement'}),/작전 목표/);
  s=doAction(s,{type:'set_threats',threats:[{id:'cut',kind:'supply',eta:0,actionable:true}]},{type:'review_board'},{type:'plan',die:1},{type:'start_decision',kind:'movement'});
  assert.equal(s.pending.result.action,'secure_corridor');
});

test('changing the board invalidates a plan and VP observation marks scored goals',()=>{
  let s=createV2Session();
  s=doAction(s,{type:'set_objective',id:'usman',observation:goal},{type:'review_board'},{type:'plan',die:1});
  s={...s,phase:'soviet_turn'};
  s=applyV2Action(s,{type:'set_threats',threats:[]});
  assert.equal(s.plan,null);
  assert.throws(()=>applyV2Action({...s,phase:'movement'},{type:'start_decision',kind:'movement'}),/작전 목표/);
  s=applyV2Action(s,{type:'soviet_complete',observation:{controlledVpHexes:[{id:'usman',supplied:true}],isolatedSovietVpHexes:[]}});
  assert.equal(s.objectiveStates.usman.control,'axis_supplied');
  s=applyV2Action(s,{type:'soviet_complete',observation:{controlledVpHexes:[{id:'usman',supplied:false}],isolatedSovietVpHexes:[]}});
  assert.equal(s.objectiveStates.usman.control,'axis_unsupplied');
  s=applyV2Action(s,{type:'soviet_complete',observation:{controlledVpHexes:[],isolatedSovietVpHexes:[]}});
  assert.equal(s.objectiveStates.usman.control,'soviet');
  s=applyV2Action(s,{type:'soviet_complete',observation:{controlledVpHexes:[],isolatedSovietVpHexes:[],eastExit:{mechanizedSteps:5,roadSupply:true},donSouthGermanCombatUnit:true}});
  assert.equal(s.objectiveStates.east_exit.control,'axis_supplied');
  assert.equal(s.objectiveStates.don_bonus.control,'axis_supplied');
  s=applyV2Action(s,{type:'soviet_complete',observation:{controlledVpHexes:[],isolatedSovietVpHexes:[]}});
  assert.equal(s.objectiveStates.east_exit.control,'soviet');
  assert.equal(s.objectiveStates.don_bonus.control,'soviet');
});

test('first turn rejects inactive formations and requires tactical range confirmation',()=>{
  let s={...createV2Session(),phase:'movement'};
  s=doAction(s,{type:'set_objective',id:'usman',observation:goal},{type:'review_board'},{type:'plan',die:1},{type:'start_decision',kind:'movement'});
  assert.throws(()=>applyV2Action(s,{type:'confirm_decision',piece:'14Pz',hex:'2108',firstTurnLegal:true}),/S1.2/);
  assert.throws(()=>applyV2Action(s,{type:'confirm_decision',piece:'6A-1',hex:'2108'}),/2헥스/);
  assert.equal(applyV2Action(s,{type:'confirm_decision',piece:'6A-1',hex:'2108',firstTurnLegal:true}).history.at(-1).action,'approach_goal');
});

test('attack CRT facts are calculated from six outcomes and cannot be guessed',()=>{
  let s={...createV2Session(),phase:'combat'};
  s=doAction(s,{type:'set_objective',id:'usman',observation:goal},{type:'review_board'},{type:'plan',die:1});
  s=applyV2Action(s,{type:'start_decision',kind:'attack'});
  for(const value of [true,true,false,true])s=applyV2Action(s,{type:'answer',value});
  assert.equal(s.pending.result.fact,'oddsReady');
  assert.throws(()=>applyV2Action(s,{type:'answer',value:true}),/CRT/);
  s=applyV2Action(s,{type:'set_crt',successFaces:4,lossFaces:1,defenderDd:'none',supportCommitted:0});
  assert.equal(s.pending.result.fact,'canHold');
  s=applyV2Action(s,{type:'answer',value:true});
  assert.equal(s.pending.result.action,'attack');
});
