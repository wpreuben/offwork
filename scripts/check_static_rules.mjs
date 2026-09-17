import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rules from '../web/games/paths-of-glory.js';
crypto.getRandomValues=array=>{array.fill(0);return array;};
const cases=JSON.parse(readFileSync(process.argv[2],'utf8'));
for(const [i,c] of cases.entries()){
 const original=structuredClone(c.before);
 try {
 if(c.error)assert.throws(()=>rules.apply(c.before,c.action));
 else {const actual=rules.apply(c.before,c.action);assert.deepEqual(actual.state,c.after);assert.equal(actual.message,c.message);assert.deepEqual(rules.publicView(actual.state),c.public);}
 assert.deepEqual(c.before,original,'Input state must remain unchanged');
 }catch(error){throw new Error(`Parity case ${i}: ${JSON.stringify(c.action)}\n${error.stack}`);}
}
for(const max_hand of [7,8])for(const guns of [true,false]){const s=rules.create({max_hand,guns});rules.validate(s);assert.equal(s.sides.cp.deck.length,10);assert.equal(s.sides.cp.remaining,max_hand);assert.equal(s.pending?.forced,guns?'guns':undefined);}
console.log(`PASS: ${cases.length} Python/browser transitions, messages, candidates and public projections; 4 setup variants.`);
