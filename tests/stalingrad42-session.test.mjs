import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,applySession} from '../web/stalingrad42/session.js';

const advance=(s,n)=>{for(let i=0;i<n;i++) s=applySession(s,{type:'next_phase'});return s;};
test('phases_wait_for_human_soviet_turn',()=>{
  const s=advance(createSession({difficulty:'standard'}),5);
  assert.equal(s.phase,'soviet_turn');
  assert.equal(s.turn,1);
  assert.throws(()=>applySession(s,{type:'next_phase'}),/소련군/);
  const after=applySession(s,{type:'observe',observation:{sovietTurnComplete:true,vp:{}}});
  assert.equal(applySession(after,{type:'next_phase'}).phase,'victory');
});
test('turn_one_limits_combat_units_to_two_hexes_and_frozen_panzer_units',()=>{
  let s=advance(createSession({difficulty:'standard'}),1);
  assert.throws(()=>applySession(s,{type:'confirm',candidate:{id:'a',units:['14Pz'],hexes:1,action:'advance'},policyIds:['CHOOSE'],ruleRefs:['S1.2']}),/14Pz/);
  assert.throws(()=>applySession(s,{type:'confirm',candidate:{id:'a',units:['6A'],hexes:3,action:'advance'},policyIds:['CHOOSE'],ruleRefs:['S1.2']}),/2헥스/);
  s=applySession(s,{type:'confirm',candidate:{id:'a',units:['6A'],hexes:2,action:'advance'},policyIds:['CHOOSE'],ruleRefs:['S1.2']});
  assert.equal(s.history.length,1);
});
test('one_unit_moves_once_per_phase',()=>{
  let s=advance(createSession({difficulty:'standard'}),1);
  s=applySession(s,{type:'confirm',candidate:{id:'a',units:['6A'],hexes:1,action:'advance'},policyIds:['CHOOSE'],ruleRefs:['5–8']});
  assert.throws(()=>applySession(s,{type:'confirm',candidate:{id:'b',units:['6A'],hexes:1,action:'advance'},policyIds:['CHOOSE'],ruleRefs:['5–8']}),/중복/);
});
test('undo_restores_last_confirmed_state',()=>{
  let s=advance(createSession({difficulty:'standard'}),1);
  const before=s;
  s=applySession(s,{type:'confirm',candidate:{id:'a',units:['6A'],hexes:1,action:'advance'},policyIds:['CHOOSE'],ruleRefs:['5–8'],die:3});
  s=applySession(s,{type:'undo'});
  assert.deepEqual(s.history,before.history);
  assert.deepEqual(s.usedUnits,before.usedUnits);
});
test('axis_wins_at_any_victory_phase_with_eight_vp',()=>{
  let s=advance(createSession({difficulty:'hard'}),5);
  s=applySession(s,{type:'observe',observation:{sovietTurnComplete:true, vp:{controlledVpHexes:['voronezh','rostov','usman','millerovo','salsk','valuyki'].map(id=>({id,supplied:true}))}}});
  s=applySession(s,{type:'next_phase'});
  assert.equal(s.winner,'axis');
  assert.equal(s.vp,8);
});
test('soviet_wins_at_turn_eight_below_eight_vp',()=>{
  let s=createSession({difficulty:'beginner'});
  for(let turn=1;turn<=8;turn++){
    s=advance(s,5);
    s=applySession(s,{type:'observe',observation:{sovietTurnComplete:true,vp:{}}});
    s=applySession(s,{type:'next_phase'});
    if(turn<8) s=applySession(s,{type:'next_turn'});
  }
  assert.equal(s.winner,'soviet');
  assert.equal(s.turn,8);
});
test('decide_records_die_and_filters_used_units',()=>{
  let s=advance(createSession(),1);
  s=applySession(s,{type:'confirm',candidate:{id:'first',units:['6A'],hexes:1,action:'advance'},policyIds:['CHOOSE'],ruleRefs:['5–8']});
  s=applySession(s,{type:'decide',die:6,candidates:[{id:'repeat',targetId:'voronezh',formationId:'6A',action:'advance',legal:true,supplied:true,encirclementRisk:'none',reserveRemaining:2,reachable:true,units:['6A'],hexes:1,combatUnit:true}]});
  assert.equal(s.die,6);
  assert.equal(s.decision.rejected[0].policyId,'SAFE-USED');
});
test('fallback_requires_verified_real_action',()=>{
  let s=advance(createSession(),1);
  s=applySession(s,{type:'decide',die:1,candidates:[]});
  assert.throws(()=>applySession(s,{type:'confirm',candidate:{...s.decision.selected,action:'defend',units:[]}}),/대체 행동/);
  s=applySession(s,{type:'confirm',candidate:{...s.decision.selected,units:['6A'],legal:true,supplied:true,encirclementRisk:'none',action:'defend'},fallbackVerified:true});
  assert.equal(s.history.length,1);
});
test('general_penalty_prevents_premature_axis_victory',()=>{
  let s=advance(createSession(),5);
  s=applySession(s,{type:'observe',observation:{sovietTurnComplete:true,vp:{controlledVpHexes:['voronezh','rostov','usman','millerovo','salsk','valuyki'].map(id=>({id,supplied:true})),sovietAtAxisEntryAreas:['X']}}});
  s=applySession(s,{type:'next_phase'});
  assert.equal(s.vp,5);
  assert.equal(s.winner,null);
});
