import test from 'node:test';
import assert from 'node:assert/strict';
import {planAxisTurn,PHASE_CHECKLISTS} from '../web/stalingrad42/doctrine.js';

const state=(id,eta=0,more={})=>({[id]:{control:'soviet',eta,supplySecure:true,forceReady:true,counterattack:'none',...more}});
const input=(more={})=>({turn:4,vp:3,profile:'standard',currentGoal:null,objectiveStates:{},threats:[],die:1,...more});

test('urgent supply threat takes priority over a printed 2 VP target',()=>{
  const result=planAxisTurn(input({objectiveStates:state('voronezh'),threats:[{id:'corridor',kind:'supply',eta:0,actionable:true}]}));
  assert.equal(result.kind,'respond');assert.equal(result.id,'corridor');assert.equal(result.policyId,'THREAT-SUPPLY');
});

test('already scored and unsupplied VP hexes are not ordinary capture goals',()=>{
  const result=planAxisTurn(input({objectiveStates:{...state('voronezh',0,{control:'axis_supplied'}),...state('rostov',0,{control:'axis_unsupplied'}),...state('usman')}}));
  assert.equal(result.kind,'gain');assert.equal(result.targetId,'usman');
  assert.equal(result.localThreats[0].targetId,'rostov');assert.equal(result.localThreats[0].kind,'vp_supply');
});

test('a current feasible goal persists instead of jumping to a new printed 2 VP target',()=>{
  const result=planAxisTurn(input({currentGoal:'usman',objectiveStates:{...state('usman',1),...state('voronezh',1)}}));
  assert.equal(result.kind,'gain');assert.equal(result.targetId,'usman');assert.equal(result.policyId,'GOAL-CONTINUE');
});

test('an immediate winning target overrides goal persistence',()=>{
  const result=planAxisTurn(input({vp:7,currentGoal:'voronezh',objectiveStates:{...state('voronezh',1),...state('usman',0)}}));
  assert.equal(result.targetId,'usman');assert.equal(result.policyId,'GOAL-WIN-NOW');
});

test('exit goal requires five mechanized steps and a road supply plan',()=>{
  const result=planAxisTurn(input({objectiveStates:{...state('east_exit',0,{exitStepsReady:false,roadReady:true}),...state('south_exit',0,{exitStepsReady:true,roadReady:false}),...state('usman')}}));
  assert.equal(result.targetId,'usman');
});

test('unsafe objectives do not become goals at any difficulty',()=>{
  for(const profile of ['beginner','standard','hard']){
    const result=planAxisTurn(input({profile,objectiveStates:state('voronezh',0,{counterattack:'collapse'})}));
    assert.equal(result.kind,'consolidate');
  }
});

test('difficulty changes warning horizon without relaxing fatal safety',()=>{
  const threats=[{id:'entry-x',kind:'entry_penalty',eta:2,actionable:true}];
  const objectives=state('usman');
  assert.equal(planAxisTurn(input({profile:'beginner',threats,objectiveStates:objectives})).kind,'gain');
  assert.equal(planAxisTurn(input({profile:'hard',threats,objectiveStates:objectives})).id,'entry-x');
});

test('equal goals use a fair two or three way d6 mapping',()=>{
  const objectives={...state('usman'),...state('millerovo'),...state('salsk')};
  const ids=Array.from({length:6},(_,i)=>planAxisTurn(input({objectiveStates:objectives,die:i+1})).targetId);
  assert.equal(new Set(ids).size,3);
  for(const id of new Set(ids))assert.equal(ids.filter(x=>x===id).length,2);
});

test('exactly two tied goals use odd and even d6 as printed',()=>{
  const objectives={...state('usman'),...state('millerovo')};
  const ids=Array.from({length:6},(_,i)=>planAxisTurn(input({objectiveStates:objectives,die:i+1})).targetId);
  assert.deepEqual(ids,['usman','millerovo','usman','millerovo','usman','millerovo']);
});

test('final turn excludes goals that cannot finish before scenario end',()=>{
  const objectives={usman:{control:'soviet',eta:0,supplySecure:true,forceReady:true,counterattack:'none'},rostov:{control:'soviet',eta:1,supplySecure:true,forceReady:true,counterattack:'none'}};
  assert.equal(planAxisTurn(input({turn:8,objectiveStates:objectives})).targetId,'usman');
});

test('recovery and supply are rules checklists with correct references',()=>{
  assert.deepEqual(PHASE_CHECKLISTS.recovery.map(x=>x.rule),['13.4','13.5','21.4']);
  assert.deepEqual(PHASE_CHECKLISTS.supply.map(x=>x.rule),['17.2.1','16.1','16.5','18.6.4']);
  assert.ok(!JSON.stringify(PHASE_CHECKLISTS).includes('restore_supply'));
});
