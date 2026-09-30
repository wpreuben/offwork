import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPaper} from '../web/stalingrad42/paper.js';
import {DOCTRINE_PROFILES,PHASE_CHECKLISTS,DOCTRINE_VERSION} from '../web/stalingrad42/doctrine.js';
import {PROCEDURES,SELECTION_RULES,runProcedure,ATTACK_POLICY} from '../web/stalingrad42/procedures.js';

test('paper uses the new doctrine, not the old global VP score',()=>{
  for(const profile of Object.keys(DOCTRINE_PROFILES)){
    const html=renderPaper({profile});
    assert.ok(html.includes(DOCTRINE_VERSION));
    assert.ok(html.includes(DOCTRINE_PROFILES[profile].label));
    assert.ok(html.includes(String(ATTACK_POLICY[profile].minimumSuccessFaces)));
    assert.ok(!html.includes('목표 VP ×'));
  }
});

test('all phase steps and local choice priorities have rule references on paper',()=>{
  const html=renderPaper();
  for(const rows of Object.values(PHASE_CHECKLISTS))for(const step of rows){assert.ok(html.includes(step.id));assert.ok(html.includes(step.rule));}
  for(const [kind,rows] of Object.entries(SELECTION_RULES))for(const row of rows)assert.ok(html.includes(`data-step="${kind}:${row.id}"`));
  for(const term of ['보급선이 없으면 0VP','X·Y·Z','Kharkov·Stalino','시작선 서쪽 소도시','xx31','5 기계화 스텝'])assert.ok(html.includes(term),term);
});

test('printed branch attributes exactly match executable procedure graphs',()=>{
  const html=renderPaper();
  for(const [kind,procedure] of Object.entries(PROCEDURES)){
    assert.ok(html.includes(`data-procedure="${kind}"`));
    for(const node of procedure.nodes){
      assert.ok(html.includes(`data-id="${node.id}"`),node.id);
      if(node.fact)for(const [key,value] of Object.entries({fact:node.fact,yes:node.yes,no:node.no}))assert.ok(html.includes(`data-${key}="${value}"`),`${node.id}:${key}`);
      else assert.ok(html.includes(`data-action="${node.action}"`),node.id);
    }
  }
});

test('paper decision graph and web resolver agree on representative defense and attack boards',()=>{
  const html=renderPaper();
  const printed=new Map();
  for(const tag of html.match(/<article class="node"[^>]+>/g)??[]){
    const attr=Object.fromEntries([...tag.matchAll(/data-([a-z]+)="([^"]+)"/g)].map(([,k,v])=>[k,v]));
    printed.set(attr.id,attr);
  }
  for(const [kind,facts] of [
    ['defense',{ddLegal:true,retreatBreaksSupply:true}],
    ['defense',{ddLegal:false,retreatBreaksSupply:true}],
    ['defense',{ddLegal:true,retreatBreaksSupply:false,retreatLosesVp:false,retreatEliminates:false}],
    ['attack',{legal:true,supplyAfter:true,counterattackCollapse:false,goalRelevant:true,oddsReady:true,canHold:true}],
    ['attack',{legal:true,supplyAfter:false}],
    ['movement',{corridorThreatened:false,urgentResponse:false,goalActive:true}]
  ]){
    let id=PROCEDURES[kind].root;
    for(let n=0;n<20;n++){
      const row=printed.get(id);assert.ok(row,id);
      if(row.action){assert.equal(row.action,runProcedure(kind,facts).action);break;}
      assert.equal(typeof facts[row.fact],'boolean',row.fact);
      id=facts[row.fact]?row.yes:row.no;
    }
  }
});
