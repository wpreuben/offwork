const node=(id,fact,question,yes,no,rule)=>({id,fact,question,yes,no,rule});
const end=(id,action,text,rule)=>({id,action,text,rule});
export const ATTACK_POLICY=Object.freeze({
  beginner:{minimumSuccessFaces:5,criticalMinimumSuccessFaces:5,maxAxisLossFaces:2,maxSupportCommitted:0},
  standard:{minimumSuccessFaces:4,criticalMinimumSuccessFaces:4,maxAxisLossFaces:2,maxSupportCommitted:1},
  hard:{minimumSuccessFaces:4,criticalMinimumSuccessFaces:3,maxAxisLossFaces:2,maxSupportCommitted:2}
});
export const DD_POLICY=Object.freeze({none:0,possible:1,strong:2});
export function attackReadiness({profile,successFaces,lossFaces,critical=false,defenderDd='none',supportCommitted=0}){
  const policy=ATTACK_POLICY[profile];
  if(!policy||!Number.isInteger(successFaces)||successFaces<0||successFaces>6||!Number.isInteger(lossFaces)||lossFaces<0||lossFaces>6||typeof critical!=='boolean'||!Object.hasOwn(DD_POLICY,defenderDd)||!Number.isInteger(supportCommitted)||supportCommitted<0||supportCommitted>2)throw new Error('CRT 면수·수비측 DD·지원 수를 확인하세요.');
  const minimum=Math.min(6,(critical?policy.criticalMinimumSuccessFaces:policy.minimumSuccessFaces)+DD_POLICY[defenderDd]);
  return {ready:successFaces>=minimum&&lossFaces<=policy.maxAxisLossFaces&&supportCommitted<=policy.maxSupportCommitted,minimumSuccessFaces:minimum,maxAxisLossFaces:policy.maxAxisLossFaces,maxSupportCommitted:policy.maxSupportCommitted,ddAdjustment:DD_POLICY[defenderDd],policyId:'ATT-CRT',ruleRef:'8–11',metric:'공격 유효성 지표 · 점령 성공률 아님'};
}

// Printed charts and the browser walk these exact nodes. A missing observation never becomes false.
export const PROCEDURES=Object.freeze({
  movement:{title:'추축군 이동',root:'MOVE-CORRIDOR',nodes:[
    node('MOVE-CORRIDOR','corridorThreatened','현재 추축군 보급로가 이번 턴에 끊길 위험이 있는가?','MOVE-SUPPLY','MOVE-RESPONSE','16.3'),
    node('MOVE-RESPONSE','urgentResponse','선택된 작전 계획이 VP·감점·포위 위협 대응인가?','MOVE-COUNTER','MOVE-GOAL','S1.3, 24.1, 16.3'),
    node('MOVE-GOAL','goalActive','이번 턴 실행 가능한 작전 목표가 있는가?','MOVE-APPROACH','MOVE-SCREEN','S1.3'),
    end('MOVE-SUPPLY','secure_corridor','보급로를 안전하게 하는 첫 합법 이동을 고른다','16.3'),
    end('MOVE-COUNTER','counter_threat','선택한 VP·감점·포위 위협을 막는 첫 합법 이동을 고른다','S1.3, 24.1, 16.3'),
    end('MOVE-APPROACH','approach_goal','담당 편제를 목표 쪽으로 이동한다. 보급과 소련군 다음 턴 포위 위험을 먼저 확인한다','5.0, 16.3'),
    end('MOVE-SCREEN','screen_line','중요 VP·보급로를 지킬 수 있는 위치를 우선한다','5.0, 16.3')
  ]},
  attack:{title:'추축군 공격',root:'ATT-LEGAL',nodes:[
    node('ATT-LEGAL','legal','영문 규칙상 이 공격이 가능한가?','ATT-SUPPLY','ATT-PASS','8.0'),
    node('ATT-SUPPLY','supplyAfter','공격·전투 후 진격 뒤에도 핵심 병력의 보급을 유지하는가?','ATT-EXPOSURE','ATT-PASS','16.3'),
    node('ATT-EXPOSURE','counterattackCollapse','소련군 다음 턴 반격에 핵심 병력이나 보급로가 무너지는가?','ATT-PASS','ATT-PURPOSE','8.0, 16.3'),
    node('ATT-PURPOSE','goalRelevant','이번 작전 목표의 점령·접근에 도움이 되는가?','ATT-ODDS','ATT-THREAT','S1.3'),
    node('ATT-THREAT','removesThreat','보급·VP 상실 위협을 제거하는가?','ATT-ODDS','ATT-PASS','16.3, 24.1'),
    node('ATT-ODDS','oddsReady','실제 CRT 이동과 지원을 반영해 공격 준비 기준을 만족하는가?','ATT-HOLD','ATT-SUPPORT','8–10'),
    node('ATT-SUPPORT','supportCanFixOdds','합법적인 미사용 지원으로 준비 기준을 만족시킬 수 있는가?','ATT-PREPARE','ATT-PASS','9.0, 18.6'),
    node('ATT-HOLD','canHold','성공 후 목표·보급로를 소련군 다음 턴까지 지킬 수 있는가?','ATT-EXECUTE','ATT-PASS','16.3, S1.3'),
    end('ATT-PREPARE','prepare_support','가능한 지원을 작전 목표에 배분한 뒤 공격 조건을 다시 확인한다','9.0, 18.6'),
    end('ATT-EXECUTE','attack','최소 필요 병력으로 공격하고 실제 CRT 결과를 적용한다','8–10'),
    end('ATT-PASS','pass_attack','이 공격은 건너뛰고 다음 규칙상 가능한 기회를 검사한다','8.0')
  ]},
  defense:{title:'소련군 공격 중 추축군 방어',root:'DEF-LEGAL',nodes:[
    node('DEF-LEGAL','ddLegal','CRT 결과와 잔여 스텝상 Determined Defense가 가능한가?','DEF-SUPPLY','DEF-RETREAT','11.1'),
    node('DEF-SUPPLY','retreatBreaksSupply','퇴각하면 주요 추축군 보급로가 끊기는가?','DEF-HOLD','DEF-VP','11.1, 16.3'),
    node('DEF-VP','retreatLosesVp','퇴각하면 이번 승리 판정의 VP를 잃는가?','DEF-HOLD','DEF-ELIM','11.1, S1.3'),
    node('DEF-ELIM','retreatEliminates','합법적인 퇴각으로도 해당 부대가 제거되는가?','DEF-HOLD','DEF-RETREAT','11.5, 12.0'),
    end('DEF-HOLD','determined_defense','적법한 선도 유닛을 고르고 중요 거점이면 가능한 방어 지원을 우선 사용한다','11.1–11.5'),
    end('DEF-RETREAT','retreat','규칙상 합법인 첫 퇴각 경로를 퇴각 우선순위표로 선택한다','12.0')
  ]},
  advance:{title:'전투 후 진격',root:'ADV-LEGAL',nodes:[
    node('ADV-LEGAL','legal','전투 결과와 유닛 상태상 진격할 수 있는가?','ADV-SUPPLY','ADV-HOLD','14.0'),
    node('ADV-SUPPLY','supplyAfter','진격 뒤 필요한 보급선이 유지되는가?','ADV-EXPOSURE','ADV-HOLD','16.3'),
    node('ADV-EXPOSURE','counterattackCollapse','소련군 다음 턴에 진격 부대가 고립·붕괴하는가?','ADV-HOLD','ADV-GOAL','14.0, 16.3'),
    node('ADV-GOAL','takesGoal','진격으로 작전 목표 또는 필수 보급로를 확보하는가?','ADV-TAKE','ADV-PROGRESS','S1.3, 16.3'),
    node('ADV-PROGRESS','improvesPosition','합법 진격으로 목표까지 헥스 거리를 줄이거나 적 보급·퇴각로 차단 또는 합법 돌파 기회를 만드는가?','ADV-APPROACH','ADV-HOLD','14.0, 15.0'),
    end('ADV-TAKE','advance','목표를 확보하는 첫 합법 진격 경로를 선택한다','14.0'),
    end('ADV-APPROACH','advance','안전 조건 안에서 목표 접근·적 보급로 차단·돌파 기회를 가장 많이 만드는 합법 경로로 진격한다','14.0, 15.0'),
    end('ADV-HOLD','hold','안전하거나 유익한 진격 경로가 없으므로 현 위치를 유지한다','14.0')
  ]},
  breakthrough:{title:'돌파전투',root:'BT-LEGAL',nodes:[
    node('BT-LEGAL','legal','초기 전투가 Adv 2–4이고, 참여한 한 돌파집단으로 합법적인 목표를 공격하는가? 포병 금지와 원 공격 항공지원만 허용하는 15.2.9를 확인했는가?','BT-ALLOWANCE','BT-HOLD','15.1–15.2.9'),
    node('BT-ALLOWANCE','allowanceReady','초기 전투에서 받은 진격 허용량 중 공격 비용 1헥스 이상이 남았는가?','BT-SUPPLY','BT-HOLD','15.2.4'),
    node('BT-SUPPLY','supplyAfter','돌파 뒤에도 핵심 병력의 보급을 유지하는가?','BT-EXPOSURE','BT-HOLD','16.3'),
    node('BT-EXPOSURE','counterattackCollapse','돌파로 다음 소련군 차례에 핵심 병력·보급로가 고립·붕괴하는가?','BT-HOLD','BT-PURPOSE','15.0, 16.3'),
    node('BT-PURPOSE','goalRelevant','목표 접근·보급로 확보·적 퇴각로 차단에 도움이 되는가?','BT-ODDS','BT-HOLD','15.0'),
    node('BT-ODDS','oddsReady','실제 CRT와 수비측 DD를 반영한 공격 유효성 기준을 만족하는가?','BT-EXECUTE','BT-HOLD','8–11, 15.0'),
    end('BT-EXECUTE','breakthrough','돌파집단으로 공격하고 허용량 1을 차감한다. 결과가 Adv 3/4일 때만 남은 허용량으로 다음 돌파를 검사한다','15.2.4, 15.2.7–15.2.8'),
    end('BT-HOLD','hold','돌파전투를 멈추고 다른 참여 유닛의 합법 진격을 처리한다','15.2.1')
  ]},
  loss:{title:'손실 유닛 선택',root:'LOSS-SIDE',nodes:[
    node('LOSS-SIDE','enemyLoss','실제 CRT의 손실 선택권에 따라 추축군이 소련군 손실 유닛을 고르는가?','LOSS-ENEMY','LOSS-OWN','10.2.2'),
    end('LOSS-ENEMY','select_enemy_loss','규칙상 선택 가능한 소련군 후보에 적군 손실 우선순위를 적용한다','10.2.2–10.2.3'),
    end('LOSS-OWN','select_own_loss','규칙상 선택 가능한 추축군 후보에 자군 손실 우선순위를 적용한다','10.2.1–10.2.2')
  ]}
});

export const SELECTION_RULES=Object.freeze({
  movement:[
    {id:'MOV-UNIT',text:'현재 임무를 맡은 편제의 아직 이동하지 않은 유닛을 먼저 고른다',rule:'5.0'},
    {id:'MOV-HEX',text:'합법 헥스 중 이동 후 보급 가능, 소련군 다음 턴 포위 회피, 목표 접근, 유리한 방어 지형 순으로 고른다',rule:'5.0, 16.3'},
    {id:'MOV-TIE',text:'동일하면 지도 북쪽 헥스, 그다음 서쪽 헥스를 고른다',rule:'오토마 0.2'}
  ],
  attack:[
    {id:'ATT-TARGET',text:'목표 VP 점령, 보급로 확보, 소련군 위협 제거 순으로 인접 적 헥스를 검사한다',rule:'8.0, S1.3'},
    {id:'ATT-FORCE',text:'CRT 준비 기준을 만족하는 최소 합법 병력을 먼저 쓰고 후속 방어 병력을 남긴다',rule:'8–10'},
    {id:'ATT-TIE',text:'동일하면 지도 북쪽 헥스, 그다음 서쪽 헥스를 먼저 공격한다',rule:'오토마 0.2'}
  ],
  defense:[
    {id:'DEF-LEAD',text:'Determined Defense 선도 유닛은 적법한 Good Order 전투 유닛 중 높은 선도 DRM(Elite +1, Low Quality −1, 독일 도시/축성 Elite), 생존 가능한 스텝 수, 낮은 작전 손실 순으로 고른다',rule:'11.2.3–11.2.4'},
    {id:'DEF-SUPPORT',text:'VP 또는 핵심 보급로를 지키는 방어에 가용 지원을 먼저 투입한다',rule:'11.3'}
  ],
  advance:[
    {id:'ADV-ROUTE',text:'목표 점유·도로 보급 연결, 목표 거리 감소, 적 보급·퇴각로 차단, 합법 돌파 기회, 유리한 방어 위치 순으로 안전한 합법 경로를 고른다',rule:'14.0–15.0, 16.3'}
  ],
  breakthrough:[
    {id:'BT-GROUP',text:'초기 공격에 참여한 가용 기계화 유닛, 공격 능력, 스텝 수, 유닛 ID 순으로 합법적인 한 스택의 돌파집단을 만든다. 남겨야 할 보급·거점 경계 병력은 제외한다',rule:'15.2.2–15.2.3'},
    {id:'BT-COST',text:'집단 형성·초기 방향 변경·각 헥스 진격·돌파 공격의 비용을 초기 허용량에서 차감한다. 추가 허용량은 얻지 않는다. Adv 3/4가 아니면 종료한다',rule:'15.2.4, 15.2.7–15.2.9'}
  ],
  loss:[
    {id:'LOSS-ELIGIBLE',text:'CRT가 손실 선택권을 누구에게 주는지 확인하고 규칙상 참여한 유닛만 후보로 둔다',rule:'10.2'},
    {id:'LOSS-PROTECT',text:'자군: 보급 핵심, VP 핵심, 기계화 전력을 보존하고 낮은 품질, 마지막 스텝이 아닌 유닛 순으로 손실을 고른다',rule:'10.2'},
    {id:'LOSS-ENEMY',text:'적군: 보급 핵심, VP 핵심, 마지막 스텝 제거, 기계화 전력, 높은 품질 순으로 타격한다. 선택 제한은 항상 먼저 적용한다',rule:'10.2.3'},
    {id:'LOSS-TIE',text:'동등하면 유닛 ID 오름차순으로 고른다',rule:'오토마 0.2'}
  ],
  retreat:[
    {id:'RET-LEGAL',text:'영문 규칙상 합법 퇴각 헥스만 남긴다',rule:'12.1–12.4'},
    {id:'RET-SUPPLY',text:'보급 유지, 고립 회피, VP 유지, 적과의 거리 순으로 고른다',rule:'12.0, 16.3'},
    {id:'RET-TIE',text:'동등하면 지도 북쪽 헥스, 그다음 서쪽 헥스를 고른다',rule:'오토마 0.2'}
  ]
});

export function runProcedure(kind,facts={}){
  const procedure=PROCEDURES[kind];
  if(!procedure)throw new Error(`알 수 없는 절차: ${kind}`);
  const byId=new Map(procedure.nodes.map(n=>[n.id,n]));
  const path=[];
  let id=procedure.root;
  for(let i=0;i<=procedure.nodes.length;i++){
    const current=byId.get(id);
    if(!current)throw new Error(`절차 연결 오류: ${id}`);
    path.push(current.id);
    if(current.action)return {status:'decision',action:current.action,text:current.text,policyId:current.id,ruleRefs:[...new Set(path.map(p=>byId.get(p).rule))],path};
    if(typeof facts[current.fact]!=='boolean')return {status:'ask',question:current.question,fact:current.fact,policyId:current.id,ruleRefs:[current.rule],path};
    id=facts[current.fact]?current.yes:current.no;
  }
  throw new Error(`절차 순환: ${kind}`);
}

export function rankLocalOptions(kind,options,{enemyLoss=false}={}){
  if(!Array.isArray(options)||!['retreat','loss'].includes(kind))throw new Error('지역 선택지 형식 오류');
  const available=options.filter(x=>kind==='retreat'?x.legal:x.eligible);
  const bool=(x,key)=>x[key]===true?1:0;
  return available.slice().sort((a,b)=>{
    if(kind==='retreat')return bool(b,'supplied')-bool(a,'supplied')||bool(a,'isolated')-bool(b,'isolated')||bool(b,'preservesVp')-bool(a,'preservesVp')||(b.enemyDistance??0)-(a.enemyDistance??0)||(a.northOrder??99)-(b.northOrder??99)||(a.westOrder??99)-(b.westOrder??99)||a.id.localeCompare(b.id);
    if(enemyLoss)return bool(b,'essentialToSupply')-bool(a,'essentialToSupply')||bool(b,'essentialToVp')-bool(a,'essentialToVp')||Number(b.steps===1)-Number(a.steps===1)||bool(b,'mechanized')-bool(a,'mechanized')||(b.quality??0)-(a.quality??0)||a.id.localeCompare(b.id);
    return bool(a,'essentialToSupply')-bool(b,'essentialToSupply')||bool(a,'essentialToVp')-bool(b,'essentialToVp')||bool(a,'mechanized')-bool(b,'mechanized')||(a.quality??0)-(b.quality??0)||Number(a.steps===1)-Number(b.steps===1)||a.id.localeCompare(b.id);
  });
}
