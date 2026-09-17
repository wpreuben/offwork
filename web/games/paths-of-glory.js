// Static-host rules adapter. Kept in parity with cdg/games/paths_of_glory.py.
// UI/storage never determine legal moves. C always means deck[0].
import {CARDS, DICE} from './pog-data.js';
export {CARDS, DICE};
export const ID='paths-of-glory', NAME='패스 오브 글로리';
const SIDES=['cp','ap'], SLOTS=[...'ABCDE'], DEAL=[...'ABDE'], STAGES=['mobilization','limited','total'];
const clone=x=>structuredClone(x), require=(ok,message)=>{if(!ok)throw new Error(message);};
const other=side=>side==='cp'?'ap':'cp';
function randomBelow(n){const limit=4294967296-4294967296%n, a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
function shuffled(ids){const result=[...ids];for(let i=result.length-1;i>0;i--){const j=randomBelow(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}
export function card(state,side,slot){const p=state.sides[side];return slot==='C'?(p.deck.length?{id:p.deck[0],face_up:p.c_face_up}:null):p.slots[slot];}
function visible(state,side){return Object.fromEntries(SLOTS.map(s=>[s,card(state,side,s)]).filter(([,c])=>c?.face_up));}
function reveal(state,side,slot){const c=card(state,side,slot);if(c){if(slot==='C')state.sides[side].c_face_up=true;else{c.face_up=true;state.sides[side].faces[slot]=true;}}}
function clamp(state,side){const p=state.sides[side];if(!p.deck.length){p.remaining=Math.min(p.remaining,4);p.c_face_up=false;}}
function fill(state,side,slot,up){const p=state.sides[side];if(slot==='C')p.c_face_up=!!p.deck.length&&up;else if(!p.slots[slot]&&p.deck.length){p.slots[slot]={id:p.deck.shift(),face_up:up};p.faces[slot]=up;p.c_face_up=false;}clamp(state,side);}
function take(state,side,slot){const p=state.sides[side],c=clone(card(state,side,slot));require(c,'빈 슬롯입니다.');if(slot==='C'){p.deck.shift();p.c_face_up=false;}else p.slots[slot]=null;clamp(state,side);return c;}
export function create(options={}){
 require([7,8].includes(options.max_hand??7),'최대 핸드는 7 또는 8입니다.');
 const state={game:ID,turn:1,phase:'action',active:'cp',max_hand:options.max_hand??7,rounds:{cp:0,ap:0},pending:null,battle:null,notes:[],guns:options.guns??true,mata_hari_number:17,draw_discards:{cp:0,ap:0},draw_allowance:{cp:0,ap:0},sides:{}};
 for(const side of SIDES){const ids=Object.values(CARDS).filter(c=>c.side===side&&c.stage==='mobilization'&&!(side==='cp'&&state.guns&&c.id==='cp-01')).map(c=>c.id);
 state.sides[side]={deck:shuffled(ids),slots:Object.fromEntries(DEAL.map(s=>[s,null])),c_face_up:false,faces:Object.fromEntries(DEAL.map(s=>[s,'AB'.includes(s)])),remaining:state.max_hand,discard:[],removed:[],stage:'mobilization'};
 for(const slot of DEAL)fill(state,side,slot,'AB'.includes(slot));
 if(side==='cp'&&state.guns){state.sides.cp.deck.unshift('cp-01');state.sides.cp.c_face_up=true;}}
 if(state.guns)state.pending={die:null,forced:'guns',status:'select'};
 validate(state);return state;
}
function eventAllowed(state,cid){if(CARDS[cid].combat)return false;return cid!=='cp-01'||state.turn===1&&state.rounds.cp===0;}
export function candidates(state){
 if(state.phase!=='action'||!state.pending||state.pending.status!=='select'||state.battle)return [];
 const p=state.pending,v=visible(state,state.active);
 if(p.forced==='guns')return [{slot:'C',card:'cp-01',modes:['event']}];
 const die=p.die;let chosen;
 if(die===1){const low=Math.min(...Object.entries(v).filter(([s])=>s!=='C').map(([,c])=>CARDS[c.id].ops));chosen=Object.keys(v).filter(s=>s==='C'||CARDS[v[s].id].ops===low);}
 else if(die===2)chosen=Object.keys(v);else chosen=[...{3:'ABC',4:'AB',5:'CDE',6:'DE'}[die]].filter(s=>v[s]);
 const low=Math.min(...Object.values(v).map(c=>CARDS[c.id].ops));
 return chosen.flatMap(slot=>{const cid=v[slot].id,modes=die===2?(CARDS[cid].ops===low?['ops']:[]):['ops','sr','rp'];if(eventAllowed(state,cid))modes.push('event');return modes.length?[{slot,card:cid,modes}]:[];});
}
function nextAction(state){const side=state.active;state.rounds[side]++;state.pending=null;
 if(Object.values(state.rounds).every(n=>n>=6)||Object.values(state.sides).every(p=>p.remaining===0)){state.phase='draw';state.draw_discards={cp:0,ap:0};state.draw_allowance=Object.fromEntries(SIDES.map(s=>[s,state.sides[s].remaining]));}
 else state.active=state.rounds[other(side)]<6?other(side):side;
}
export function availableActions(state){
 const actions=[],add=(type,fields={})=>actions.push({type,...fields});
 if(state.battle){const side=state.battle.side;for(const [slot,c] of Object.entries(visible(state,side)))if(CARDS[c.id].combat&&state.sides[side].remaining>0)for(const destination of ['discard','removed'])add('combat_play',{slot,destination,base_legal:true});add('combat_pass');return actions;}
 if(state.phase==='resolve'){add('resolve');add('battle_start',{attacker:'cp'});add('battle_start',{attacker:'ap'});}
 else if(state.phase==='draw'){for(const side of SIDES)if(state.draw_discards[side]<state.draw_allowance[side])for(const [slot,c] of Object.entries(visible(state,side)))if(CARDS[c.id].combat)add('draw_discard',{side,slot});add('next_turn',{base_phases_done:true});}
 else if(!state.pending)add(state.sides[state.active].remaining>0?'roll':'skip');
 else if(state.pending.status==='reveal'){for(const slot of SLOTS){const c=card(state,state.active,slot);if(c&&!c.face_up)add('reveal',{slot});}}
 else {for(const c of candidates(state))for(const mode of c.modes)add('play',{slot:c.slot,mode,base_legal:true,destination:c.card==='cp-01'&&mode==='event'?'removed':'discard',grants_cards:false});if(!candidates(state).length&&!state.sides[state.active].deck.length)add('auto_ops');}
 if(['draw','resolve'].includes(state.phase))for(const side of SIDES){const p=state.sides[side];if(!p.deck.length&&(p.discard.length||Object.values(p.slots).some(c=>c&&!c.face_up)))add('reshuffle',{side,reason:'exhaustion'});if(state.phase==='draw'&&p.stage!=='total')add('reshuffle',{side,reason:'war',stage:STAGES[STAGES.indexOf(p.stage)+1],base_legal:true});}
 return actions;
}
export function apply(original,action){require(action&&typeof action==='object'&&!Array.isArray(action),'action은 JSON 객체여야 합니다.');const state=clone(original),message=mutate(state,action);validate(state);return {state,message};}
function mutate(state,action){
 const kind=action.type;let side=state.active,p=state.sides[side];
 if(kind==='note'){require(typeof action.text==='string'&&action.text.trim().length>0&&action.text.trim().length<=4000,'메모는 1~4000자로 입력하세요.');state.notes.push({turn:state.turn,side,text:action.text.trim()});return '상황 메모를 기록했습니다.';}
 const legal=availableActions(state);require(legal.some(a=>a.type===kind),'현재 단계에서 할 수 없는 행동입니다.');
 if(kind==='roll'){const die=action.value??randomBelow(6)+1;require(Number.isInteger(die)&&die>=1&&die<=6,'운명 주사위는 1~6입니다.');state.pending={die,status:'select'};for(const slot of {1:'C',2:'',3:'ABC',4:'AB',5:'CDE',6:'DE'}[die])reveal(state,side,slot);if(die===2&&Object.keys(visible(state,side)).length<2&&SLOTS.some(s=>card(state,side,s)&&!card(state,side,s).face_up))state.pending.status='reveal';return `운명 주사위 ${die}: ${DICE[die-1].title}`;}
 if(kind==='reveal'){const slot=action.slot;require(legal.some(a=>a.slot===slot),'공개할 수 없는 슬롯입니다.');reveal(state,side,slot);if(Object.keys(visible(state,side)).length>=2||!SLOTS.some(s=>card(state,side,s)&&!card(state,side,s).face_up))state.pending.status='select';return `${slot} 슬롯을 공개했습니다.`;}
 if(kind==='skip'){nextAction(state);return '남은 카드가 없어 행동 라운드를 넘겼습니다.';}
 if(kind==='auto_ops'){state.phase='resolve';state.pending.played={automatic_ops:1};return '받기 더미 고갈로 선택 가능한 카드가 없어 자동 작전값 1을 받습니다.';}
 if(kind==='play'){
 const {slot,mode}=action;require(candidates(state).some(c=>c.slot===slot&&c.modes.includes(mode)),'주사위 결과가 허용하지 않는 카드 또는 사용 방식입니다.');require(action.base_legal===true,'원래 게임의 사용 조건을 확인해야 합니다.');
 const destination=action.destination??'discard';require(['discard','removed'].includes(destination),'카드의 이동 위치를 확인하세요.');const cid=card(state,side,slot).id;
 if(cid==='cp-01'&&mode==='event')require(destination==='removed','8월의 포성 이벤트 사용 후 카드를 제거하세요.');require(typeof(action.grants_cards??false)==='boolean','추가 카드 효과 여부가 올바르지 않습니다.');if(!action.grants_cards)p.remaining--;
 const taken=take(state,side,slot);p[destination].push(cid);const espionage=mode==='event'&&['cp-17','ap-23'].includes(cid);if(espionage)for(const s of SLOTS)reveal(state,other(side),s);
 state.pending.played={slot,card:cid,mode:espionage?'ops':mode,chosen_mode:mode,face_up:taken.face_up,destination,grants_cards:action.grants_cards??false,espionage};state.phase='resolve';return `${slot} / ${cid}: `+(espionage?'상대 디스플레이를 모두 공개하고 작전 카드로 사용합니다.':`${mode} 사용. 원래 게임의 효과를 해결하세요.`);
 }
 if(kind==='resolve'){const {played,die}=state.pending;if('slot' in played){if(die===1){for(const s of DEAL)fill(state,side,s,true);if(played.slot==='C')fill(state,side,'C',true);}else for(const s of ({2:'ABDE',3:'AB',4:'AB',5:'DE',6:'DE',null:''}[die]))fill(state,side,s,p.faces[s]);}state.phase='action';nextAction(state);return '효과 해결과 슬롯 보충을 마쳤습니다.';}
 if(kind==='draw_discard'){const {side,slot}=action;require(legal.some(a=>a.type===kind&&a.side===side&&a.slot===slot),'버릴 수 없는 전투 카드입니다.');const c=take(state,side,slot);state.sides[side].discard.push(c.id);state.draw_discards[side]++;return `${side}의 앞면 전투 카드를 버렸습니다.`;}
 if(kind==='next_turn'){require(action.base_phases_done===true,'원래 게임의 나머지 페이즈를 먼저 해결하세요.');for(const side of SIDES){state.sides[side].remaining=state.max_hand;for(const slot of DEAL)fill(state,side,slot,false);clamp(state,side);}Object.assign(state,{turn:state.turn+1,phase:'action',active:'cp',rounds:{cp:0,ap:0},pending:null,draw_discards:{cp:0,ap:0}});return '전략 카드 받기를 마치고 다음 턴을 시작합니다.';}
 if(kind==='reshuffle'){
 const {side,reason}=action;require(legal.some(a=>a.type===kind&&a.side===side&&a.reason===reason),'허용되지 않는 다시 섞기입니다.');const p=state.sides[side],pool=[...p.deck,...p.discard];p.discard=[];
 if(reason==='war'){const stage=action.stage;require(STAGES.includes(stage)&&STAGES.indexOf(stage)===STAGES.indexOf(p.stage)+1,'다음 전쟁 투입 단계를 선택하세요.');require(action.base_legal===true,'기본 게임의 전쟁 투입 조건을 확인하세요.');for(const slot of DEAL)if(p.slots[slot]){pool.push(p.slots[slot].id);p.slots[slot]=null;}pool.push(...Object.values(CARDS).filter(c=>c.side===side&&c.stage===stage).map(c=>c.id));p.stage=stage;}
 else for(const slot of DEAL){const c=p.slots[slot];if(c&&!c.face_up){pool.push(c.id);p.slots[slot]=null;}}
 p.deck=shuffled(pool);p.c_face_up=false;for(const slot of DEAL)fill(state,side,slot,reason==='war'&&'AB'.includes(slot));return `${side}: ${reason==='war'?'전쟁 투입 단계 상승':'고갈'}에 따라 다시 섞었습니다.`;
 }
 if(kind==='battle_start'){require(SIDES.includes(action.attacker),'공격 진영을 선택하세요.');state.battle={attacker:action.attacker,side:action.attacker,step:'attacker',refill:[],used:[]};return '공격자가 먼저 전투 카드 사용 여부를 결정합니다.';}
 if(kind==='combat_play'){const b=state.battle,side=b.side,p=state.sides[side],{slot,destination}=action;require(['discard','removed'].includes(destination),'전투 카드 이동 위치가 올바르지 않습니다.');require(legal.some(a=>a.type===kind&&a.slot===slot),'사용 가능한 앞면 전투 카드가 아닙니다.');require(action.base_legal===true,'전투 이벤트 사용 조건을 확인하세요.');const cid=card(state,side,slot).id;p.remaining--;b.used.push({side,card:cid});const c=take(state,side,slot);p[destination].push(cid);b.refill.push({side,slot,face_up:c.face_up});return `${cid}: 전투 카드 처리. 전투 종료 후 슬롯을 보충합니다.`;}
 if(kind==='combat_pass'){const b=state.battle;if(b.step==='attacker'){b.step='defender';b.side=other(b.attacker);return '방어자의 전투 카드 선택입니다.';}for(const item of b.refill)fill(state,item.side,item.slot,item.face_up);state.battle=null;return '전투 카드 처리를 마치고 원래 면 상태로 보충했습니다.';}
 throw new Error('알 수 없는 행동입니다.');
}
export function publicView(state){const result=clone(state);for(const side of SIDES){const p=result.sides[side];p.deck_count=p.deck.length;p.display={};for(const slot of SLOTS){const c=card(state,side,slot);p.display[slot]=c?{face_up:c.face_up,card:c.face_up?clone(CARDS[c.id]):null}:null;}for(const key of ['deck','slots','c_face_up','faces'])delete p[key];}result.available_actions=availableActions(state);result.candidates=candidates(state);return result;}
export function validate(state){
 require(state&&state.game===ID&&state.mata_hari_number===17,'지원하지 않는 게임 또는 마타 하리 번호입니다.');
 require([7,8].includes(state.max_hand)&&Number.isInteger(state.turn)&&state.turn>0&&SIDES.includes(state.active)&&['action','resolve','draw'].includes(state.phase),'게임 진행 정보가 올바르지 않습니다.');
 require(state.sides&&Object.keys(state.sides).sort().join(',')==='ap,cp','진영 정보가 올바르지 않습니다.');
 require(Array.isArray(state.notes)&&state.notes.every(n=>Number.isInteger(n.turn)&&SIDES.includes(n.side)&&typeof n.text==='string'),'메모 정보가 올바르지 않습니다.');
 for(const side of SIDES){const p=state.sides[side];require(p&&STAGES.includes(p.stage)&&Array.isArray(p.deck)&&Array.isArray(p.discard)&&Array.isArray(p.removed)&&Object.keys(p.slots??{}).sort().join('')==='ABDE'&&Object.keys(p.faces??{}).sort().join('')==='ABDE','카드 저장 형식이 올바르지 않습니다.');require(typeof p.c_face_up==='boolean'&&DEAL.every(s=>typeof p.faces[s]==='boolean'&&(p.slots[s]===null||typeof p.slots[s]?.face_up==='boolean')),'카드 면 정보가 올바르지 않습니다.');
 const ids=[...p.deck,...p.discard,...p.removed,...Object.values(p.slots).filter(Boolean).map(c=>c.id)];const expected=Object.values(CARDS).filter(c=>c.side===side&&STAGES.indexOf(c.stage)<=STAGES.indexOf(p.stage)).map(c=>c.id);require(ids.length===new Set(ids).size&&ids.length===expected.length&&expected.every(id=>ids.includes(id)),'카드 보존 규칙 위반입니다.');require(Number.isInteger(p.remaining)&&p.remaining>=0&&p.remaining<=state.max_hand,'남은 카드 범위를 벗어났습니다.');
 require(Number.isInteger(state.rounds?.[side])&&state.rounds[side]>=0&&state.rounds[side]<=6,'행동 라운드 범위를 벗어났습니다.');for(const key of ['draw_allowance','draw_discards'])require(Number.isInteger(state[key]?.[side])&&state[key][side]>=0&&state[key][side]<=state.max_hand,'받기 페이즈 정보가 올바르지 않습니다.');}
 require(state.pending===null||(state.pending&&[null,1,2,3,4,5,6].includes(state.pending.die)&&['select','reveal'].includes(state.pending.status)),'주사위 진행 정보가 올바르지 않습니다.');
 if(state.pending?.forced)require(state.pending.forced==='guns'&&state.pending.die===null&&state.turn===1&&state.rounds.cp===0&&state.active==='cp','첫 행동 정보가 올바르지 않습니다.');
 if(state.phase==='resolve'){const p=state.pending?.played;require(p&&(p.automatic_ops===1||SLOTS.includes(p.slot)&&CARDS[p.card]&&['ops','event','sr','rp'].includes(p.mode)),'효과 해결 정보가 올바르지 않습니다.');}
 if(state.phase==='action'&&state.pending?.forced)require(card(state,'cp','C')?.id==='cp-01','8월의 포성 위치가 올바르지 않습니다.');
 require(state.battle===null||(state.phase==='resolve'&&SIDES.includes(state.battle?.attacker)&&SIDES.includes(state.battle.side)&&['attacker','defender'].includes(state.battle.step)&&Array.isArray(state.battle.refill)&&state.battle.refill.every(x=>SIDES.includes(x.side)&&SLOTS.includes(x.slot)&&typeof x.face_up==='boolean')&&Array.isArray(state.battle.used)),'전투 정보가 올바르지 않습니다.');
}
