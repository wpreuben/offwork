import test from 'node:test';
import assert from 'node:assert/strict';
import {planAxisTurn} from '../web/stalingrad42/doctrine.js';
import {runProcedure,attackReadiness} from '../web/stalingrad42/procedures.js';

const target=(overrides={})=>({control:'soviet',eta:0,supplySecure:true,forceReady:true,counterattack:'none',...overrides});
const base=(overrides={})=>({turn:1,vp:0,profile:'standard',objectiveStates:{usman:target()},threats:[],die:1,...overrides});
const cases=[
  ['보급 단절이 득점보다 우선',()=>planAxisTurn(base({threats:[{id:'cut',kind:'supply',eta:0,actionable:true}]})).policyId,'THREAT-SUPPLY'],
  ['보급되지 않는 점유 VP 복구',()=>planAxisTurn(base({objectiveStates:{usman:target({control:'axis_unsupplied'})}})).policyId,'THREAT-VP-SUPPLY'],
  ['이미 득점한 목표는 제외',()=>planAxisTurn(base({objectiveStates:{usman:target({control:'axis_supplied'})}})).kind,'consolidate'],
  ['즉시 붕괴할 목표는 제외',()=>planAxisTurn(base({objectiveStates:{usman:target({counterattack:'collapse'})}})).kind,'consolidate'],
  ['부대가 없는 목표는 제외',()=>planAxisTurn(base({objectiveStates:{usman:target({forceReady:false})}})).kind,'consolidate'],
  ['보급 유지 불가능 목표 제외',()=>planAxisTurn(base({objectiveStates:{usman:target({supplySecure:false})}})).kind,'consolidate'],
  ['출구의 도로 보급 필수',()=>planAxisTurn(base({objectiveStates:{east_exit:target({exitStepsReady:true,roadReady:false})}})).kind,'consolidate'],
  ['8VP 즉시 달성 우선',()=>planAxisTurn(base({vp:7,objectiveStates:{usman:target({eta:0}),voronezh:target({eta:1})}})).policyId,'GOAL-WIN-NOW'],
  ['기존 목표 계속 수행',()=>planAxisTurn(base({currentGoal:'usman',objectiveStates:{usman:target({eta:1}),voronezh:target({eta:0})}})).policyId,'GOAL-CONTINUE'],
  ['입문은 다음 턴 위협 보류',()=>planAxisTurn(base({profile:'beginner',threats:[{id:'loss',kind:'vp_loss',eta:1,actionable:true}]})).kind,'gain'],
  ['어려움은 두 턴 뒤 위협 고려',()=>planAxisTurn(base({profile:'hard',threats:[{id:'loss',kind:'vp_loss',eta:2,actionable:true}]})).policyId,'THREAT-VP-LOSS'],
  ['보급 위협의 이동',()=>runProcedure('movement',{corridorThreatened:true}).action,'secure_corridor'],
  ['감점 위협의 이동',()=>runProcedure('movement',{corridorThreatened:false,urgentResponse:true}).action,'counter_threat'],
  ['자살 공격 거부',()=>runProcedure('attack',{legal:true,supplyAfter:true,counterattackCollapse:true}).action,'pass_attack'],
  ['득점 헥스 퇴각보다 합법 결사 방어',()=>runProcedure('defense',{ddLegal:true,retreatBreaksSupply:false,retreatLosesVp:true}).action,'determined_defense'],
  ['고난도라도 손실면이 지나치면 공격하지 않음',()=>attackReadiness({profile:'hard',successFaces:5,lossFaces:3,critical:true}).ready,false]
];
for(const [name,actual,expected] of cases)test(name,()=>assert.equal(actual(),expected));
