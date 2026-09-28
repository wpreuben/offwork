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
test('controlled_vp_without_axis_supply_does_not_count',()=>{
  const result=calculateS1Vp({controlledVpHexes:[{id:'voronezh',supplied:false},{id:'rostov',supplied:true}]});
  assert.equal(result.total,2);
  assert.equal(result.entries.length,1);
  assert.throws(()=>calculateS1Vp({controlledVpHexes:[{id:'usman'}]}),/보급/);
});
test('general_vp_penalties_apply_once_per_entry_area_and_city',()=>{
  const result=calculateS1Vp({sovietAtAxisEntryAreas:['X','X','Z'],sovietHeldWestStartMajorCities:['kharkov'],sovietHeldWestStartMinorCityCount:2});
  assert.equal(result.total,-11);
  assert.equal(result.entries.filter(e=>e.vp<0).length,4);
});
test('unnamed_north_rail_target_uses_location_not_unverified_hex',()=>{
  const target=TARGETS.find(t=>t.id==='north_rail_vp');
  assert.ok(target);
  assert.ok(!('hex' in target));
});
