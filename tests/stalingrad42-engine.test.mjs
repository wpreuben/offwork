import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidates } from '../web/stalingrad42/engine.js';

const base = (id, extra={}) => ({id,targetId:'voronezh',formationId:'6A',action:'advance',legal:true,supplied:true,encirclementRisk:'none',reserveRemaining:2,reachable:true,units:['A'], ...extra});
test('missing_safety_answers_returns_questions_without_selection', () => {
  const result=evaluateCandidates({turn:2,vp:0,profile:'standard',candidates:[base('a',{supplied:undefined})],die:1});
  assert.equal(result.selected,null);
  assert.ok(result.questions.some(q=>q.includes('보급')));
  assert.ok(result.policyIds.includes('SAFE-INPUT'));
});
test('out_of_supply_or_encircled_candidate_is_rejected', () => {
  const result=evaluateCandidates({turn:2,vp:0,profile:'standard',candidates:[base('a',{supplied:false}),base('b',{encirclementRisk:'high'})],die:1});
  assert.equal(result.selected.action,'restore_supply');
  assert.equal(result.rejected.length,2);
  assert.ok(result.rejected.every(r=>r.policyId.startsWith('SAFE-')));
  assert.ok(result.ruleRefs.includes('21–23'));
});
test('attack_below_policy_floor_is_rejected', () => {
  const result=evaluateCandidates({turn:2,vp:0,profile:'standard',candidates:[base('a',{action:'attack',attack:{odds:0.5,lossRisk:0.8}})],die:1});
  assert.equal(result.selected.action,'restore_supply');
  assert.equal(result.rejected[0].policyId,'ACT-ATTACK');
});
test('vp_shortfall_raises_reachable_objective_priority', () => {
  const candidates=[base('a',{targetId:'voronezh',reachable:true}),base('b',{targetId:'usman',reachable:true})];
  const result=evaluateCandidates({turn:7,vp:3,profile:'standard',candidates,die:1});
  assert.equal(result.selected.id,'a');
  assert.ok(result.policyIds.includes('GOAL-VP'));
});
test('same_die_repeats_same_tie_result', () => {
  const input={turn:2,vp:0,profile:'standard',candidates:[base('a'),base('b',{units:['B']})],die:4};
  assert.equal(evaluateCandidates(input).selected.id,evaluateCandidates(input).selected.id);
});
test('no_candidates_selects_fallback', () => {
  const result=evaluateCandidates({turn:2,vp:0,profile:'standard',candidates:[],die:1});
  assert.equal(result.selected.action,'restore_supply');
  assert.ok(result.policyIds.includes('FALLBACK'));
});
test('turn_one_restrictions_filter_before_recommendation',()=>{
  const result=evaluateCandidates({turn:1,vp:0,profile:'standard',candidates:[base('a',{units:['14Pz'],hexes:1}),base('b',{units:['6A'],hexes:3})],die:1});
  assert.equal(result.selected.action,'restore_supply');
  assert.equal(result.rejected.length,2);
  assert.ok(result.rejected.every(r=>r.policyId==='S1-FIRST-TURN'));
});
test('unreachable_objective_is_not_selected',()=>{
  const result=evaluateCandidates({turn:2,vp:0,profile:'standard',candidates:[base('a',{reachable:false})],die:1});
  assert.equal(result.selected.action,'restore_supply');
  assert.equal(result.rejected[0].policyId,'GOAL-REACH');
});
test('vp_pressure_increases_high_value_score',()=>{
  const candidate=base('a',{targetId:'voronezh'});
  const early=evaluateCandidates({turn:2,vp:7,profile:'standard',candidates:[candidate],die:1});
  const late=evaluateCandidates({turn:7,vp:2,profile:'standard',candidates:[candidate],die:1});
  assert.ok(late.selected.score>early.selected.score);
});
