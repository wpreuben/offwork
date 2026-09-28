import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPaper} from '../web/stalingrad42/paper.js';
import {FLOW,PROFILES} from '../web/stalingrad42/policy.js';

test('paper_exposes_every_branch_and_profile_scoring_parameters',()=>{
  for(const [profile,values] of Object.entries(PROFILES)){
    const html=renderPaper({profile});
    assert.ok(FLOW.every(node=>html.includes(node.id)));
    assert.ok(html.includes(`목표 VP × ${values.targetWeight}`));
    assert.ok(html.includes(`× ${values.vpShortfallWeight} × 목표 VP`));
    assert.ok(html.includes(`차이가 ${values.tieWindow} 이하`));
    assert.ok(html.includes('C001, C002'));
  }
});
test('paper_has_engine_safety_gate_ids',()=>{
  const ids=new Set(FLOW.map(node=>node.id));
  for(const id of ['SAFE-INPUT','PHASE-ACTION','SAFE-USED','S1-FIRST-TURN','SAFE-LEGAL','SAFE-SUPPLY','SAFE-ENCIRCLE','GOAL-REACH','SAFE-RESERVE','ACT-ATTACK','FALLBACK'])assert.ok(ids.has(id),id);
});
