const node=(id,fact,question,yes,no,rule)=>({id,fact,question,yes,no,rule});
const end=(id,action,text,rule)=>({id,action,text,rule});
export const ATTACK_POLICY=Object.freeze({
  beginner:{minimumSuccessFaces:5,criticalMinimumSuccessFaces:5,maxAxisLossFaces:2},
  standard:{minimumSuccessFaces:4,criticalMinimumSuccessFaces:4,maxAxisLossFaces:2},
  hard:{minimumSuccessFaces:4,criticalMinimumSuccessFaces:3,maxAxisLossFaces:2}
});
export function attackReadiness({profile,successFaces,lossFaces,critical=false}){
  const policy=ATTACK_POLICY[profile];
  if(!policy||!Number.isInteger(successFaces)||successFaces<0||successFaces>6||!Number.isInteger(lossFaces)||lossFaces<0||lossFaces>6||typeof critical!=='boolean')throw new Error('CRT 1–6 결과의 성공·추축군 손실 면을 확인하세요.');
  const minimum=critical?policy.criticalMinimumSuccessFaces:policy.minimumSuccessFaces;
  return {ready:successFaces>=minimum&&lossFaces<=policy.maxAxisLossFaces,minimumSuccessFaces:minimum,maxAxisLossFaces:policy.maxAxisLossFaces,policyId:'ATT-CRT',ruleRef:'8–10'};
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
    node('ADV-GOAL','takesGoal','진격으로 작전 목표 또는 필수 보급로를 확보하는가?','ADV-TAKE','ADV-HOLD','S1.3, 16.3'),
    end('ADV-TAKE','advance','목표를 확보하는 첫 합법 진격 경로를 선택한다','14.0'),
    end('ADV-HOLD','hold','진격하지 않거나 안전한 최소 진격만 수행한다','14.0')
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
    {id:'DEF-LEAD',text:'Determined Defense 선도 유닛은 적법한 유닛 중 생존 가능·높은 방어 능력·낮은 작전 손실 순으로 고른다',rule:'11.2.3'},
    {id:'DEF-SUPPORT',text:'VP 또는 핵심 보급로를 지키는 방어에 가용 지원을 먼저 투입한다',rule:'11.3'}
  ],
  advance:[
    {id:'ADV-ROUTE',text:'목표 점유, 도로 보급 연결, 재포위 회피 순으로 합법 진격 경로를 고른다',rule:'14.0, 16.3'}
  ],
  loss:[
    {id:'LOSS-ELIGIBLE',text:'CRT가 손실 선택권을 누구에게 주는지 확인하고 규칙상 참여한 유닛만 후보로 둔다',rule:'10.2'},
    {id:'LOSS-PROTECT',text:'VP·보급로 유지에 필수인 유닛과 기계화 돌파 전력은 가능한 한 보존한다',rule:'10.2'},
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

export function rankLocalOptions(kind,options){
  if(!Array.isArray(options)||!['retreat','loss'].includes(kind))throw new Error('지역 선택지 형식 오류');
  const available=options.filter(x=>kind==='retreat'?x.legal:x.eligible);
  const bool=(x,key)=>x[key]===true?1:0;
  return available.slice().sort((a,b)=>{
    if(kind==='retreat')return bool(b,'supplied')-bool(a,'supplied')||bool(a,'isolated')-bool(b,'isolated')||bool(b,'preservesVp')-bool(a,'preservesVp')||(b.enemyDistance??0)-(a.enemyDistance??0)||a.id.localeCompare(b.id);
    return bool(a,'essentialToSupply')-bool(b,'essentialToSupply')||bool(a,'essentialToVp')-bool(b,'essentialToVp')||bool(a,'mechanized')-bool(b,'mechanized')||a.id.localeCompare(b.id);
  });
}
