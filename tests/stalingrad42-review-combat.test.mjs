import test from 'node:test';
import assert from 'node:assert/strict';
import {runProcedure,rankLocalOptions,attackReadiness} from '../web/stalingrad42/procedures.js';
test('안전한 목표 접근만으로도 진격을 선택한다',()=>{
  assert.equal(runProcedure('advance',{legal:true,supplyAfter:true,counterattackCollapse:false,takesGoal:false,improvesPosition:true}).action,'advance');
});
test('목적 없는 진격과 고립 진격은 정지한다',()=>{
  assert.equal(runProcedure('advance',{legal:true,supplyAfter:true,counterattackCollapse:false,takesGoal:false,improvesPosition:false}).action,'hold');
  assert.equal(runProcedure('advance',{legal:true,supplyAfter:false}).action,'hold');
});
test('자군 손실은 기계화 보존, 적군 손실은 핵심 전력 손상을 선택한다',()=>{
  const units=[{id:'tank',eligible:true,mechanized:true,steps:2,quality:1},{id:'infantry',eligible:true,mechanized:false,steps:2,quality:0}];
  assert.equal(rankLocalOptions('loss',units,{enemyLoss:false})[0].id,'infantry');
  assert.equal(rankLocalOptions('loss',units,{enemyLoss:true})[0].id,'tank');
});
test('적군 손실은 마지막 스텝 제거와 보급 핵심 타격을 먼저 한다',()=>{
  const units=[{id:'normal',eligible:true,steps:2},{id:'last',eligible:true,steps:1},{id:'key',eligible:true,steps:2,essentialToSupply:true}];
  assert.equal(rankLocalOptions('loss',units,{enemyLoss:true})[0].id,'key');
  assert.equal(rankLocalOptions('loss',units.slice(0,2),{enemyLoss:true})[0].id,'last');
});
test('DD 가능·강한 방어는 공격 유효성 기준을 높인다',()=>{
  const base={profile:'standard',successFaces:4,lossFaces:1,critical:false};
  assert.equal(attackReadiness({...base,defenderDd:'none'}).ready,true);
  assert.equal(attackReadiness({...base,defenderDd:'possible'}).ready,false);
  assert.equal(attackReadiness({...base,successFaces:5,defenderDd:'strong'}).ready,false);
  assert.equal(attackReadiness({...base,successFaces:6,defenderDd:'strong'}).ready,true);
});
test('난이도 준비 정책이 지원 배분 상한을 실제로 제한한다',()=>{
  const base={successFaces:6,lossFaces:1,defenderDd:'none',supportCommitted:2};
  assert.equal(attackReadiness({...base,profile:'standard'}).ready,false);
  assert.equal(attackReadiness({...base,profile:'hard'}).ready,true);
});
test('돌파전투는 허용량·합법성·보급·목적·CRT가 충족되어야 한다',()=>{
  const facts={legal:true,allowanceReady:true,supplyAfter:true,counterattackCollapse:false,goalRelevant:true,oddsReady:true};
  assert.equal(runProcedure('breakthrough',facts).action,'breakthrough');
  assert.equal(runProcedure('breakthrough',{...facts,allowanceReady:false}).action,'hold');
  assert.equal(runProcedure('breakthrough',{...facts,goalRelevant:false}).action,'hold');
});
