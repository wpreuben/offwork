export const SCENARIO = Object.freeze({id:'s1', name:'Fall Blau', firstTurn:1, lastTurn:8, axisVictoryVp:8, map:'A', rules:'S1.1–S1.3'});

// Map A red VP symbols; coordinate is omitted when the printed hex number is obscured.
export const TARGETS = Object.freeze([
  ['usman','Usman',1], ['north_rail_vp','지도 A 북쪽 철도 VP',1], ['voronezh','Voronezh',2],
  ['borisoglebsk','Borisoglebsk',1], ['stary_oskol','Stary Oskol',1],
  ['svoboda','Svoboda',1], ['valuyki','Valuyki',1], ['millerovo','Millerovo',1],
  ['voroshilovgrad','Voroshilovgrad',1], ['morozovsk','Morozovsk',1],
  ['shakhty','Shakhty',1], ['rostov','Rostov',2], ['salsk','Salsk',1]
].map(([id,name,vp]) => Object.freeze({id,name,type:'vp_hex',vp,location:name,rule:'S1.3'})).concat([
  {id:'east_exit',name:'동쪽 출구',type:'east_exit',vp:2,location:'지도 A 동쪽',rule:'S1.3'},
  {id:'south_exit',name:'남쪽 출구',type:'south_exit',vp:2,location:'지도 A 남쪽',rule:'S1.3'},
  {id:'don_bonus',name:'Don강 남쪽',type:'don_bonus',vp:1,location:'Don강 남쪽',rule:'S1.3'}
].map(Object.freeze)));

const BY_ID = new Map(TARGETS.map(t => [t.id,t]));
export function calculateS1Vp(observation = {}) {
  const entries = [];
  const counted = new Set();
  for (const item of observation.controlledVpHexes ?? []) {
    const target = BY_ID.get(item.id);
    if (!target || target.type !== 'vp_hex') throw new Error(`알 수 없는 VP 목표: ${item.id}`);
    if (typeof item.supplied !== 'boolean') throw new Error(`${item.id}의 추축군 보급선 확인이 필요합니다.`);
    if (item.supplied && !counted.has(item.id)) { entries.push({id:item.id, vp:target.vp, reason:'axis_control', rule:'24.1.1'}); counted.add(item.id); }
  }
  for (const id of observation.isolatedSovietVpHexes ?? []) {
    const target = BY_ID.get(id);
    if (!target || target.type !== 'vp_hex') throw new Error(`알 수 없는 VP 목표: ${id}`);
    if (!counted.has(id)) { entries.push({id, vp:target.vp, reason:'isolated_soviet', rule:target.rule}); counted.add(id); }
  }
  for (const [key,id] of [['eastExit','east_exit'],['southExit','south_exit']]) {
    const exit = observation[key];
    if (exit?.mechanizedSteps >= 5 && exit.roadSupply === true) entries.push({id, vp:2, reason:'exit', rule:'S1.3'});
  }
  if (observation.donSouthGermanCombatUnit === true) entries.push({id:'don_bonus', vp:1, reason:'don_south', rule:'S1.3'});
  const entryAreas=new Set(observation.sovietAtAxisEntryAreas??[]);
  for(const area of entryAreas){
    if(!['X','Y','Z'].includes(area))throw new Error(`알 수 없는 추축군 진입 구역: ${area}`);
    entries.push({id:`soviet_entry_${area.toLowerCase()}`,vp:-3,reason:'soviet_at_axis_entry',rule:'24.1.4'});
  }
  const majorCities=new Set(observation.sovietHeldWestStartMajorCities??[]);
  for(const city of majorCities){
    if(!['kharkov','stalino'].includes(city))throw new Error(`알 수 없는 서쪽 대도시: ${city}`);
    entries.push({id:`soviet_held_${city}`,vp:-3,reason:'soviet_held_west_major',rule:'24.1.4'});
  }
  const minorCount=observation.sovietHeldWestStartMinorCityCount??0;
  if(!Number.isInteger(minorCount)||minorCount<0)throw new Error('서쪽 소도시 수 오류');
  if(minorCount)entries.push({id:'soviet_held_west_minor',vp:-minorCount,reason:'soviet_held_west_minor',rule:'24.1.4'});
  return {total:entries.reduce((sum,e) => sum + e.vp,0), entries};
}
