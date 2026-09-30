import test from 'node:test';
import assert from 'node:assert/strict';
import {PROCEDURES,SELECTION_RULES,runProcedure,rankLocalOptions,attackReadiness} from '../web/stalingrad42/procedures.js';

test('movement goes to supply corridor before an objective when it is threatened',()=>{
  const result=runProcedure('movement',{corridorThreatened:true});
  assert.equal(result.action,'secure_corridor');assert.equal(result.policyId,'MOVE-SUPPLY');
});

test('movement follows assigned objective and otherwise protects the line',()=>{
  assert.equal(runProcedure('movement',{corridorThreatened:false,urgentResponse:false,goalActive:true}).action,'approach_goal');
  assert.equal(runProcedure('movement',{corridorThreatened:false,urgentResponse:false,goalActive:false}).action,'screen_line');
  assert.equal(runProcedure('movement',{corridorThreatened:false,urgentResponse:true,goalActive:true}).action,'counter_threat');
});

test('attack rejects illegal, unsupplied and suicidal local opportunities',()=>{
  const base={legal:true,supplyAfter:true,counterattackCollapse:false,goalRelevant:true,oddsReady:true,canHold:true};
  for(const [key,value] of [['legal',false],['supplyAfter',false],['counterattackCollapse',true],['canHold',false]]){
    assert.equal(runProcedure('attack',{...base,[key]:value}).action,'pass_attack',key);
  }
  assert.equal(runProcedure('attack',base).action,'attack');
});

test('attack asks for support when odds can be made adequate',()=>{
  const base={legal:true,supplyAfter:true,counterattackCollapse:false,goalRelevant:true,oddsReady:false,supportCanFixOdds:true,canHold:true};
  assert.equal(runProcedure('attack',base).action,'prepare_support');
  assert.equal(runProcedure('attack',{...base,supportCanFixOdds:false}).action,'pass_attack');
});

test('CRT face counts give an explicit attack policy instead of a guessed loss probability',()=>{
  assert.equal(attackReadiness({profile:'beginner',successFaces:4,lossFaces:1,critical:true}).ready,false);
  assert.equal(attackReadiness({profile:'standard',successFaces:4,lossFaces:1,critical:false}).ready,true);
  assert.equal(attackReadiness({profile:'hard',successFaces:3,lossFaces:1,critical:true}).ready,true);
  assert.equal(attackReadiness({profile:'hard',successFaces:5,lossFaces:3,critical:true}).ready,false);
  assert.throws(()=>attackReadiness({profile:'standard',successFaces:7,lossFaces:0,critical:false}));
});

test('defense attempts determined defense only when legal and loss of ground matters',()=>{
  assert.equal(runProcedure('defense',{ddLegal:true,retreatBreaksSupply:true}).action,'determined_defense');
  assert.equal(runProcedure('defense',{ddLegal:false,retreatBreaksSupply:true}).action,'retreat');
  assert.equal(runProcedure('defense',{ddLegal:true,retreatBreaksSupply:false,retreatLosesVp:false,retreatEliminates:false}).action,'retreat');
});

test('missing board answer stops at its exact policy question',()=>{
  const result=runProcedure('defense',{});
  assert.equal(result.status,'ask');assert.equal(result.policyId,'DEF-LEGAL');
});

test('ranked retreat options preserve supply and avoid isolation among legal routes',()=>{
  const options=[
    {id:'north',legal:true,supplied:false,isolated:true,preservesVp:false,enemyDistance:3},
    {id:'east',legal:true,supplied:true,isolated:false,preservesVp:true,enemyDistance:2},
    {id:'south',legal:false,supplied:true,isolated:false,preservesVp:true,enemyDistance:4}
  ];
  assert.equal(rankLocalOptions('retreat',options)[0].id,'east');
  assert.equal(rankLocalOptions('retreat',options).length,2);
});

test('printed selection orders and evaluated procedures share policy ids',()=>{
  for(const kind of ['movement','attack','defense','advance']){
    assert.ok(PROCEDURES[kind].nodes.length>=2);
    assert.ok(SELECTION_RULES[kind]?.length);
    assert.ok(PROCEDURES[kind].nodes.every(node=>node.id&&node.rule));
  }
});
