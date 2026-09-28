import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO, TARGETS, calculateS1Vp } from '../web/stalingrad42/catalog.js';

test('scenario_is_eight_turns_and_eight_vp', () => {
  assert.equal(SCENARIO.firstTurn, 1);
  assert.equal(SCENARIO.lastTurn, 8);
  assert.equal(SCENARIO.axisVictoryVp, 8);
  assert.equal(SCENARIO.map, 'A');
});
test('s1_target_ids_are_unique', () => {
  assert.equal(new Set(TARGETS.map(t => t.id)).size, TARGETS.length);
  assert.ok(TARGETS.some(t => t.id === 'voronezh' && t.vp === 2));
  assert.ok(TARGETS.some(t => t.id === 'rostov' && t.vp === 2));
});
test('isolated_uncaptured_vp_counts_once', () => {
  const result = calculateS1Vp({ controlledVpHexes: [{id:'voronezh', supplied:true}], isolatedSovietVpHexes: ['voronezh', 'usman', 'usman'] });
  assert.equal(result.total, 3);
  assert.equal(result.entries.length, 2);
});
test('exits_require_five_steps_and_road_supply', () => {
  assert.equal(calculateS1Vp({eastExit:{mechanizedSteps:4,roadSupply:true},southExit:{mechanizedSteps:5,roadSupply:false}}).total, 0);
  assert.equal(calculateS1Vp({eastExit:{mechanizedSteps:5,roadSupply:true},southExit:{mechanizedSteps:5,roadSupply:true}}).total, 4);
});
test('don_bonus_adds_one', () => {
  const result = calculateS1Vp({eastExit:{mechanizedSteps:5,roadSupply:true},southExit:{mechanizedSteps:5,roadSupply:true},donSouthGermanCombatUnit:true});
  assert.equal(result.total, 5);
});
