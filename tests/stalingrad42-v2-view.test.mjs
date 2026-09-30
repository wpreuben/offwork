import test from 'node:test';
import assert from 'node:assert/strict';
import {renderV2Landing,renderV2Game} from '../web/stalingrad42/view-v2.js';
import {createV2Session,applyV2Action} from '../web/stalingrad42/session-v2.js';

test('landing presents version 2 paper, unmeasured win targets and legacy export path',()=>{
  const html=renderV2Landing([]);
  for(const term of ['종이 순서도','70%','50%','35%','미측정','legacy.html'])assert.ok(html.includes(term),term);
});

test('game presents shared board ledger and required initial checklist',()=>{
  const html=renderV2Game(createV2Session());
  for(const term of ['지도 A 목표','Voronezh','동쪽 출구','감점','air','resources','board-review','goal-plan'])assert.ok(html.includes(term),term);
  assert.ok(!html.includes('목표 VP ×'));
});

test('pending decision displays one question and correct paper policy id',()=>{
  const state=applyV2Action({...createV2Session(),phase:'soviet_turn'},{type:'start_decision',kind:'defense'});
  const html=renderV2Game(state);
  assert.ok(html.includes('DEF-LEGAL'));
  assert.ok(html.includes('Determined Defense'));
  assert.ok(html.includes('data-action="answer" data-value="yes"'));
});

test('attack CRT question requests six outcome counts',()=>{
  let state={...createV2Session(),phase:'combat'};
  for(const action of [
    {type:'set_group',group:{id:'A',unitIds:['A-1'],protectedUnitIds:[],kind:'mobile',ready:true,supplied:true,guardCritical:false,targetDistances:{usman:1}}},
    {type:'set_objective',id:'usman',observation:{control:'soviet',eta:0,supplySecure:true,forceReady:true,counterattack:'none'}},
    {type:'review_board'},{type:'plan',die:1},{type:'start_decision',kind:'attack'}
  ])state=applyV2Action(state,action);
  for(const value of [true,true,false,true])state=applyV2Action(state,{type:'answer',value});
  const html=renderV2Game(state);
  assert.ok(html.includes('id="crt-form"'));
  assert.ok(html.includes('name="successFaces"'));
  assert.ok(html.includes('name="lossFaces"'));
  assert.ok(html.includes('name="defenderDd"'));
  assert.ok(html.includes('공격 유효성 지표'));
});

test('Soviet turn offers Axis defense and VP observation in the same phase',()=>{
  const html=renderV2Game({...createV2Session(),phase:'soviet_turn'});
  assert.ok(html.includes('data-kind="defense"'));
  assert.ok(html.includes('data-kind="loss"'));
  assert.ok(html.includes('data-kind="retreat"'));
  assert.ok(html.includes('id="vp-form"'));
  assert.ok(html.includes('X·Y·Z'));
});
