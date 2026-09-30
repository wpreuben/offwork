import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateMissions,orderedMissionUnits} from '../web/stalingrad42/operations.js';
const group=(id,distance,more={})=>({id,unitIds:[`${id}-2`,`${id}-1`],protectedUnitIds:[],kind:'mobile',ready:true,supplied:true,guardCritical:false,targetDistances:{usman:distance},...more});
const goal={kind:'gain',targetId:'usman',policyId:'GOAL-GAIN',localThreats:[]};
test('가장 가까운 가용 전투단을 주공으로 배정하고 예비를 남긴다',()=>{
  const missions=allocateMissions({plan:goal,groups:[group('A',1),group('B',3),group('C',5)],profile:'standard'});
  assert.equal(missions.find(x=>x.kind==='attack').groupId,'A');
  assert.equal(missions.find(x=>x.kind==='reserve').groupId,'C');
  assert.equal(new Set(missions.map(x=>x.groupId)).size,3);
});
test('보급 없는 전투단과 핵심 거점 경계 전투단은 주공에서 제외한다',()=>{
  const missions=allocateMissions({plan:goal,groups:[group('A',0,{supplied:false}),group('B',0,{guardCritical:true}),group('C',2)],profile:'standard'});
  assert.equal(missions.find(x=>x.kind==='attack').groupId,'C');
});
test('경미한 위협에 전체 병력을 돌리지 않는다',()=>{
  const plan={...goal,localThreats:[{id:'probe',kind:'vp_loss',eta:0,severity:'limited',targetId:'usman',affectedGroupId:'B'}]};
  const missions=allocateMissions({plan,groups:[group('A',1),group('B',3),group('C',5),group('D',7)],profile:'standard'});
  assert.equal(missions.find(x=>x.kind==='attack').groupId,'A');
  assert.equal(missions.filter(x=>x.kind==='respond').length,1);
});
test('즉시 승리에는 미래 지역 위협보다 주공을 유지한다',()=>{
  const plan={...goal,policyId:'GOAL-WIN-NOW',localThreats:[{id:'future',kind:'vp_loss',eta:1,severity:'significant',affectedGroupId:'A'}]};
  const missions=allocateMissions({plan,groups:[group('A',1)],profile:'hard'});
  assert.equal(missions[0].kind,'attack');
});
test('등록 순서와 무관하게 유닛 ID 순서, 보호·이동 유닛은 제외한다',()=>{
  assert.deepEqual(orderedMissionUnits(group('A',1,{protectedUnitIds:['A-1']}),[]),['A-2']);
  assert.deepEqual(orderedMissionUnits(group('A',1),['A-1']),['A-2']);
});
