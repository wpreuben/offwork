import test from 'node:test';
import assert from 'node:assert/strict';
import {planAxisTurn} from '../web/stalingrad42/doctrine.js';
const target={control:'soviet',eta:0,supplySecure:true,forceReady:true,counterattack:'none'};
const input={turn:8,vp:7,profile:'hard',objectiveStates:{usman:target},die:1};
test('8턴의 종료 이후 위협이 즉시 승리를 방해하지 않는다',()=>{
  assert.equal(planAxisTurn({...input,threats:[{id:'future',kind:'supply',eta:2,severity:'critical',actionable:true}]}).policyId,'GOAL-WIN-NOW');
});
test('경미한 압박은 주공을 바꾸지 않고 지역 대응 목록에 남는다',()=>{
  const plan=planAxisTurn({...input,turn:4,vp:2,threats:[{id:'probe',kind:'encirclement',eta:0,severity:'limited',actionable:true}]});
  assert.equal(plan.kind,'gain');assert.equal(plan.localThreats[0].id,'probe');
});
test('미래 핵심 위협도 이번 승리 판정보다 우선하지 않는다',()=>{
  assert.equal(planAxisTurn({...input,turn:7,threats:[{id:'future',kind:'supply',eta:1,severity:'critical',actionable:true}]}).policyId,'GOAL-WIN-NOW');
});
test('즉시 핵심 보급 붕괴는 승리 목표보다 먼저 대응한다',()=>{
  assert.equal(planAxisTurn({...input,threats:[{id:'cut',kind:'supply',eta:0,severity:'critical',actionable:true}]}).policyId,'THREAT-SUPPLY');
});
