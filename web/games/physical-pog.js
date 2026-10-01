// Paths of Glory helper for a physical card display. It never stores card identities.
export const ID='paths-of-glory', NAME='패스 오브 글로리';
export const DICE=[
 {value:1,title:'C 또는 최저 작전값',selection:'C의 공개 카드 1장, 또는 A/B/D/E의 앞면 카드 중 작전값이 가장 낮은 카드(동률이면 선택)',before:'C 위치의 받기 더미 맨 위 카드를 앞면으로 공개합니다. !!는 이 게임에서 효과가 없습니다.',after:'사용한 뒤 빈 A/B/D/E 슬롯은 앞면으로 채웁니다.'},
 {value:2,title:'앞면 이벤트 또는 최저 작전값',selection:'사용 가능한 앞면 카드의 이벤트, 또는 앞면 카드 중 작전값이 가장 낮은 카드의 작전(동률이면 선택)',before:'앞면 카드가 2장 미만이면 뒷면 카드를 하나씩 공개해 앞면 2장을 만듭니다.',after:'빈 A/B/D/E 슬롯은 기존 면 상태로 채웁니다.'},
 {value:3,title:'A / B / C',selection:'A/B/C 중 앞면 카드 1장',before:'A/B/C의 뒷면 카드를 모두 공개합니다.',after:'빈 A/B 슬롯은 기존 면 상태로 채웁니다.'},
 {value:4,title:'A / B',selection:'A/B 중 앞면 카드 1장',before:'A/B의 뒷면 카드를 모두 공개합니다.',after:'빈 A/B 슬롯은 기존 면 상태로 채웁니다.'},
 {value:5,title:'C / D / E',selection:'C/D/E 중 앞면 카드 1장',before:'C/D/E의 뒷면 카드를 모두 공개합니다.',after:'빈 D/E 슬롯은 기존 면 상태로 채웁니다.'},
 {value:6,title:'D / E',selection:'D/E 중 앞면 카드 1장',before:'D/E의 뒷면 카드를 모두 공개합니다.',after:'빈 D/E 슬롯은 기존 면 상태로 채웁니다.'}
];
const sides=['cp','ap'];
export const WAR_STAGES={mobilization:'동원전',limited:'제한전',total:'총력전'};
const require=(ok,message)=>{if(!ok)throw new Error(message);};
const other=side=>side==='cp'?'ap':'cp';
function die(){const a=new Uint32Array(1),limit=4294967296-4294967296%6;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%6+1;}
export function create(options={}){
 const max_hand=Number(options.max_hand??7),guns=options.guns!==false;
 require([7,8].includes(max_hand),'최대 핸드는 7 또는 8입니다.');
 return {game:ID,physical:true,turn:1,phase:'action',active:'cp',max_hand,rounds:{cp:0,ap:0},sides:{cp:{remaining:max_hand,war_stage:'mobilization'},ap:{remaining:max_hand,war_stage:'mobilization'}},pending:guns?{die:null,forced:'guns'}:null,guns,notes:[]};
}
export function guidance(state){
 if(state.pending?.forced==='guns')return {title:'8월의 포성',before:'동맹군 #1을 C 위치의 받기 더미 맨 위에 앞면으로 놓습니다.',selection:'주사위 없이 C의 8월의 포성을 이벤트로 사용합니다.',after:'사용 후 카드를 제거합니다. 카드 효과와 다시 섞기를 처리한 뒤 보충하세요.'};
 const result=DICE[(state.pending?.die??0)-1];return result||null;
}
function advance(s){const side=s.active;s.rounds[side]++;s.pending=null;
 if(sides.every(x=>s.rounds[x]===6)||sides.every(x=>s.sides[x].remaining===0)){s.phase='draw';return;}
 let next=s.rounds[other(side)]<6?other(side):side;
 while(s.rounds[next]<6&&s.sides[next].remaining===0){
  s.rounds[next]++;
  if(sides.every(x=>s.rounds[x]===6)||sides.every(x=>s.sides[x].remaining===0)){s.phase='draw';return;}
  next=s.rounds[other(next)]<6?other(next):next;
 }
 s.active=next;
}
export function availableActions(s){
 if(s.phase==='draw')return [{type:'next_turn'},...sides.flatMap(side=>{
  const stage=s.sides[side].war_stage;
  return (stage==='total'?[]:stage==='limited'?['total']:stage==='mobilization'?['limited']:['limited','total']).map(stage=>({type:'war_shuffle',side,stage}));
 })];
 const clamp=s.sides[s.active].remaining>4?[{type:'clamp_remaining'}]:[];
 if(s.pending)return [...clamp,{type:'complete',keep_remaining:false},{type:'complete',keep_remaining:true},...(s.pending.forced?[]:[{type:'auto_ops'}])];
 return [...clamp,{type:s.sides[s.active].remaining===0?'skip':'roll'}];
}
export function apply(original,action){
 require(action&&typeof action==='object'&&!Array.isArray(action),'행동 형식이 올바르지 않습니다.');
 const s=structuredClone(original);validate(s);
 const kind=action.type,side=s.active;
 if(kind==='note'){require(typeof action.text==='string'&&action.text.trim().length>0&&action.text.trim().length<=4000,'메모는 1~4000자로 입력하세요.');s.notes.push({turn:s.turn,side,text:action.text.trim()});return {state:s,message:'상황 메모를 기록했습니다.'};}
 require(availableActions(s).some(a=>a.type===kind),'현재 단계에서 할 수 없는 행동입니다.');
 let message;
 if(kind==='war_shuffle'){
  require(availableActions(s).some(a=>a.type===kind&&a.side===action.side&&a.stage===action.stage),'현재 선택할 수 없는 진영 또는 전쟁 투입 단계입니다.');
  s.sides[action.side].war_stage=action.stage;
  message=`${action.side==='cp'?'동맹군':'연합군'} ${WAR_STAGES[action.stage]} 카드 추가·다시 섞기·디스플레이 재구성을 마쳤습니다.`;
 }
 else if(kind==='clamp_remaining'){s.sides[side].remaining=4;message='받기 더미 고갈로 남은 카드 수를 4로 낮췄습니다.';}
 else if(kind==='roll'){const value=action.value??die();require(Number.isInteger(value)&&value>=1&&value<=6,'운명 주사위는 1~6입니다.');s.pending={die:value};message=`${side==='cp'?'동맹군':'연합군'} 주사위 ${value}: ${DICE[value-1].title}`;}
 else if(kind==='complete'){require(typeof(action.keep_remaining??false)==='boolean','카운트 유지 값이 올바르지 않습니다.');if(!action.keep_remaining)s.sides[side].remaining--;advance(s);message=action.keep_remaining?'카드 효과로 카드를 받아 남은 카드 수를 유지하고 차례를 넘겼습니다.':'카드 사용을 마치고 남은 카드 수를 1 줄였습니다.';}
 else if(kind==='auto_ops'){require(action.deck_exhausted===true,'실물 받기 더미 고갈과 사용 가능한 카드가 없음을 확인하세요.');advance(s);message='받기 더미 고갈로 선택할 카드가 없어 자동 작전값 1을 사용했습니다.';}
 else if(kind==='skip'){advance(s);message='남은 카드가 없어 행동 라운드를 넘겼습니다.';}
 else if(kind==='next_turn'){s.turn++;s.phase='action';s.active='cp';s.rounds={cp:0,ap:0};s.pending=null;for(const x of sides)s.sides[x].remaining=s.max_hand;message='전략 카드 받기를 마치고 다음 턴을 시작했습니다.';}
 validate(s);return {state:s,message};
}
export function publicView(state){const result=structuredClone(state);result.available_actions=availableActions(state);result.guidance=guidance(state);return result;}
export function validate(s){
 require(s&&s.game===ID&&s.physical===true&&[7,8].includes(s.max_hand)&&Number.isInteger(s.turn)&&s.turn>0,'실물 카드 헬퍼 저장 형식이 올바르지 않습니다.');
 require(['action','draw'].includes(s.phase)&&sides.includes(s.active)&&typeof s.guns==='boolean','진행 상태가 올바르지 않습니다.');
 for(const x of sides){require(Number.isInteger(s.rounds?.[x])&&s.rounds[x]>=0&&s.rounds[x]<=6,'행동 라운드가 올바르지 않습니다.');require(Number.isInteger(s.sides?.[x]?.remaining)&&s.sides[x].remaining>=0&&s.sides[x].remaining<=s.max_hand,'남은 카드 수가 올바르지 않습니다.');}
 for(const x of sides)require(s.sides[x].war_stage===undefined||Object.hasOwn(WAR_STAGES,s.sides[x].war_stage),'전쟁 투입 단계가 올바르지 않습니다.');
 require(s.pending===null||s.phase==='action'&&((Number.isInteger(s.pending?.die)&&s.pending.die>=1&&s.pending.die<=6&&!s.pending.forced)||(s.pending?.die===null&&s.pending?.forced==='guns'&&s.guns&&s.turn===1&&s.active==='cp'&&s.rounds.cp===0)),'주사위 진행 상태가 올바르지 않습니다.');
 require(Array.isArray(s.notes)&&s.notes.every(n=>Number.isInteger(n.turn)&&sides.includes(n.side)&&typeof n.text==='string'),'메모 정보가 올바르지 않습니다.');
}
