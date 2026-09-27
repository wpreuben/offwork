import assert from 'node:assert/strict';
import {create, apply, validate, guidance} from '../web/games/physical-pog.js';

const move=(state, action)=>apply(state,action).state;
let state=create({guns:false});
assert.equal(state.sides.cp.remaining,7);
assert.equal(state.active,'cp');
state=move(state,{type:'roll',value:1});
assert.equal(state.pending.die,1);
assert.match(guidance(state).selection,/C의 공개 카드 1장, 또는 A\/B\/D\/E/);
state=move(state,{type:'complete'});
assert.equal(state.sides.cp.remaining,6);
assert.equal(state.rounds.cp,1);
assert.equal(state.active,'ap');
state=move(state,{type:'roll',value:2});
assert.match(guidance(state).selection,/이벤트/);
state=move(state,{type:'complete',keep_remaining:true});
assert.equal(state.sides.ap.remaining,7);
assert.equal(state.active,'cp');
for(const [die, slots] of [[3,'A/B/C'],[4,'A/B'],[5,'C/D/E'],[6,'D/E']]){
 const fresh=move(create({guns:false}),{type:'roll',value:die});
 assert.match(guidance(fresh).selection,new RegExp(slots.replaceAll('/','\\/')));
}
const forced=create({guns:true,max_hand:8});
assert.equal(forced.pending.forced,'guns');
assert.throws(()=>move(forced,{type:'roll',value:3}));
const afterForced=move(forced,{type:'complete'});
assert.equal(afterForced.sides.cp.remaining,7);
assert.equal(afterForced.active,'ap');
assert.throws(()=>move(create({guns:false}),{type:'complete'}));
assert.throws(()=>move(create({guns:false}),{type:'roll',value:7}));
const depleted=move(create({guns:false}),{type:'clamp_remaining'});
assert.equal(depleted.sides.cp.remaining,4);
assert.equal(depleted.active,'cp');
let noAlliedCards=create({guns:false});
noAlliedCards.sides.ap.remaining=0;
noAlliedCards=move(move(noAlliedCards,{type:'roll',value:4}),{type:'complete'});
assert.equal(noAlliedCards.rounds.ap,1);
assert.equal(noAlliedCards.active,'cp');
let round=create({guns:false});
for(let i=0;i<12;i++){
 round=move(round,{type:'roll',value:4});
 round=move(round,{type:'complete'});
}
assert.equal(round.phase,'draw');
assert.deepEqual(round.rounds,{cp:6,ap:6});
round=move(round,{type:'next_turn'});
assert.equal(round.turn,2);
assert.deepEqual(round.rounds,{cp:0,ap:0});
assert.equal(round.sides.cp.remaining,7);
assert.equal(round.sides.ap.remaining,7);
validate(round);
console.log('PASS: physical PoG dice, completion, count, forced event, six rounds, next turn');
