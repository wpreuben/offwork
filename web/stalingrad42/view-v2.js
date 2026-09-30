import {TARGETS} from './catalog.js';
import {DOCTRINE_VERSION,DOCTRINE_PROFILES,PHASE_CHECKLISTS,THREAT_ORDER} from './doctrine.js';
import {SELECTION_RULES} from './procedures.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phaseName={initial:'추축군 초기',movement:'추축군 이동',combat:'추축군 전투',recovery:'회복',supply:'보급',soviet_turn:'소련군 차례 · 추축군 대응',victory:'승리 판정'};
const controlName={soviet:'소련 점유',soviet_isolated:'소련 점유·고립',axis_supplied:'추축 점유·보급',axis_unsupplied:'추축 점유·보급 없음'};
const etaName={0:'이번 턴',1:'다음 턴',2:'이후',99:'불가·미확인'};
const threatName={supply:'보급로 단절',vp_supply:'추축 점유 VP 보급 없음',vp_loss:'기존 VP 상실',entry_penalty:'X·Y·Z 감점',city_penalty:'시작선 서쪽 도시 감점',encirclement:'핵심 부대 포위'};
const kindName={movement:'이동',attack:'공격',advance:'전투 후 진격',defense:'추축군 방어',loss:'손실 유닛',retreat:'퇴각 헥스'};
const options=(values,current)=>values.map(([value,label])=>`<option value="${esc(value)}"${String(current)===String(value)?' selected':''}>${esc(label)}</option>`).join('');

export function renderV2Landing(records=[]){
  return `<div class="grid"><section class="panel"><p class="eyebrow">S1 FALL BLAU · ${DOCTRINE_VERSION}</p><h2>새 추축군 오토마 기록</h2><label>난이도 <select id="difficulty">${options(Object.entries(DOCTRINE_PROFILES).map(([id,p])=>[id,`${p.label} · 소련군 목표 승률 ${Math.round(p.targetHumanWinRate*100)}% (미측정)`]),'standard')}</select></label><div class="actions"><button data-action="new">새 게임 시작</button><a class="button" href="./paper.html">종이 순서도</a></div><p class="tiny">작전 목표와 추축군 방어까지 종이판과 같은 정책을 사용합니다. 승률은 종이 플레이 검증 전입니다.</p></section><section class="panel"><h2>저장한 0.2 게임</h2>${records.length?`<ul class="list">${records.map(r=>`<li><button class="secondary" data-action="load" data-id="${esc(r.id)}">${r.state.turn}턴 · ${esc(phaseName[r.state.phase])}</button></li>`).join('')}</ul>`:'<p>새 기록이 없습니다.</p>'}<label>0.2 JSON 가져오기 <input id="import" type="file" accept=".json,application/json"></label><p class="tiny">이전 0.1 기록은 <a href="./legacy.html">0.1 헬퍼에서 열고 내보낼 수 있습니다</a>.</p></section></div>`;
}

function boardPanel(s){
  const targetRows=TARGETS.map(t=>{
    const o=s.objectiveStates[t.id];
    return `<tr><td>${esc(t.name)} <small>${t.vp}VP</small></td><td>${esc(o?controlName[o.control]:'미확인')}</td><td>${esc(o?etaName[o.eta]:'미확인')}</td><td>${o?.forceReady?'병력 가능':'—'} · ${o?.supplySecure?'보급 가능':'—'}</td></tr>`;
  }).join('');
  const targetOptions=options(TARGETS.map(t=>[t.id,`${t.name} · ${t.vp}VP`]),'');
  const threats=s.threats.map(t=>`<li>${esc(threatName[t.kind]??t.kind)} · ${esc(etaName[t.eta]??t.eta)} <button class="small secondary" data-action="remove_threat" data-id="${esc(t.id)}">제거</button></li>`).join('');
  return `<section class="panel"><p class="eyebrow">전황 · 이번 턴 ${s.boardReviewedTurn===s.turn?'확인 완료':'확인 필요'}</p><h2>지도 A 목표 장부</h2><p class="tiny">이미 득점한 목표는 다시 고르지 않습니다. 바뀐 목표만 갱신하고, 목표·위협을 확인한 뒤 작전 목표를 정하세요.</p><div class="table-wrap"><table><thead><tr><th>목표</th><th>점유·보급</th><th>완료 예상</th><th>실행 조건</th></tr></thead><tbody>${targetRows}</tbody></table></div><details><summary>목표 상태 갱신</summary><form id="objective-form"><div class="row"><label>목표 <select name="id">${targetOptions}</select></label><label>점유·보급 <select name="control">${options(Object.entries(controlName),'soviet')}</select></label><label>완료 예상 <select name="eta">${options(Object.entries(etaName),'99')}</select></label></div><div class="row"><label>소련군 다음 턴 반격 <select name="counterattack">${options([['none','낮음'],['pressure','압박'],['collapse','즉시 붕괴']], 'none')}</select></label><label><input type="checkbox" name="forceReady"> 담당 편제·병력 확보</label><label><input type="checkbox" name="supplySecure"> 완료 시점 보급 유지</label></div><div class="row"><label><input type="checkbox" name="exitStepsReady"> 출구 5 기계화 스텝 가능</label><label><input type="checkbox" name="roadReady"> 출구까지 도로 보급 가능</label></div><button type="submit">이 목표 저장</button></form></details><details><summary>감점·보급 위협 입력</summary><form id="threat-form"><div class="row"><label>위협 <select name="kind">${options(Object.entries(threatName).map(([k,v])=>[k,v]),'supply')}</select></label><label>언제 발생 <select name="eta">${options([[0,'이번 턴'],[1,'다음 턴'],[2,'그다음 턴']],0)}</select></label><label>관련 목표 <select name="targetId"><option value="">없음</option>${targetOptions}</select></label></div><label><input name="actionable" type="checkbox" checked> 대응할 수 있음</label><button type="submit">위협 추가</button></form></details><p><b>현재 위협:</b> ${threats?`<ul>${threats}</ul>`:'없음'}</p><div class="actions"><button data-action="board-review">이번 턴 전황 확인</button><label>공개 d6 <input id="plan-die" type="number" min="1" max="6" value="1"></label><button data-action="goal-plan">작전 목표 정하기</button></div>${s.plan?`<div class="card"><strong>${esc(s.plan.kind==='gain'?TARGETS.find(t=>t.id===s.plan.targetId)?.name:s.plan.kind==='respond'?'위협 대응':'전선 유지')}</strong><p>${esc(s.plan.reason)}</p><small>정책 ${esc(s.plan.policyId)} · 영문 ${esc(s.plan.ruleRefs.join(', '))}</small></div>`:''}</section>`;
}

function checklist(s){
  const rows=PHASE_CHECKLISTS[s.phase];
  if(!rows)return '';
  return `<section class="panel"><h2>${esc(phaseName[s.phase])} 규칙 순서</h2><p class="tiny">해당 항목이 없는 경우에도 확인 후 표시하세요. 원 게임 절차입니다.</p><div class="checks">${rows.map(row=>`<label><input type="checkbox" data-action="check_step" data-id="${esc(row.id)}" ${s.checks[s.phase]?.includes(row.id)?'checked':''}>${esc(row.text)} <small>영문 ${esc(row.rule)}</small></label>`).join('')}</div></section>`;
}

function decisionPanel(s){
  const allowed={movement:['movement'],combat:['attack','advance','loss','retreat'],soviet_turn:['defense','loss','retreat']}[s.phase];
  if(!allowed)return '';
  const buttons=allowed.map(kind=>`<button class="secondary" data-action="start_decision" data-kind="${kind}">${esc(kindName[kind])} 판단</button>`).join('');
  const p=s.pending;
  let body='';
  if(p?.result.status==='ask'){
    body=`<div class="card"><p class="eyebrow">${esc(p.result.policyId)} · 영문 ${esc(p.result.ruleRefs.join(', '))}</p><h3>${esc(p.result.question)}</h3>${p.result.fact==='oddsReady'?`<form id="crt-form"><div class="row"><label>목표 달성 CRT 결과 면수(0–6) <input type="number" name="successFaces" min="0" max="6" required></label><label>추축군 스텝 손실 결과 면수(0–6) <input type="number" name="lossFaces" min="0" max="6" required></label></div><label><input type="checkbox" name="critical"> 이번 승리 판정 8VP 달성 목표</label><button type="submit">CRT 정책 판정</button></form>`:`<div class="actions"><button data-action="answer" data-value="yes">예</button><button class="secondary" data-action="answer" data-value="no">아니요</button></div>`}</div>`;
  }else if(p?.result.status==='decision'){
    const rows=SELECTION_RULES[p.kind]??[];
    const firstTurnCheck=s.turn===1&&p.kind==='movement'?'<label><input type="checkbox" name="firstTurnLegal" required> S1.2 확인: 전투 유닛은 전술 이동 2헥스 이내, SP는 전체 MA 이동 허용. 14Pz·22Pz·60PzG는 이동 금지</label>':'';
    body=`<div class="card"><p class="eyebrow">${esc(p.result.policyId)} · 영문 ${esc(p.result.ruleRefs.join(', '))}</p><h3>${esc(p.result.text??kindName[p.kind])}</h3><ol>${rows.map(x=>`<li>${esc(x.text)} <small>영문 ${esc(x.rule)}</small></li>`).join('')}</ol><form id="decision-form"><div class="row"><label>선택 유닛 ID <input name="piece" placeholder="예: 6A-1"></label><label>도착·전투 헥스 <input name="hex" placeholder="지도 헥스"></label></div>${firstTurnCheck}${s.turn===1&&p.kind==='attack'?'<p>S1.2: 1턴 14Pz·22Pz·60PzG는 공격할 수 없습니다.</p>':''}<label>실제 결과·메모 <input name="note" placeholder="선택 결과"></label><button type="submit">결정·결과 기록</button></form></div>`;
  }
  return `<section class="panel"><h2>${esc(phaseName[s.phase])} 오토마</h2><p>종이판과 같은 질문을 차례대로 확인합니다. 규칙상 첫 합법 유닛·헥스를 우선순위에 따라 고르세요.</p><div class="actions">${buttons}${p?'<button class="secondary" data-action="cancel_decision">현재 판단 취소</button>':''}</div>${body}</section>`;
}

function vpPanel(s){
  if(s.phase!=='soviet_turn')return '';
  const vpRows=TARGETS.filter(t=>t.type==='vp_hex').map(t=>{
    const current=s.objectiveStates[t.id]?.control??'soviet';
    return `<label>${esc(t.name)} (${t.vp}VP)<select name="vp-${esc(t.id)}">${options(Object.entries(controlName),current)}</select></label>`;
  }).join('');
  return `<section class="panel"><h2>소련군 차례 완료 · VP 관측</h2><p>소련군 공격 중 추축군 방어·손실·퇴각을 먼저 처리하세요. 모든 VP의 점유와 보급을 실물 보드에서 다시 확인합니다.</p><form id="vp-form"><div class="checks">${vpRows}</div><div class="row"><fieldset><legend>동쪽 출구</legend><label>기계화 스텝 <input name="eastSteps" type="number" min="0" value="0"></label><label><input name="eastRoad" type="checkbox"> 도로 보급</label></fieldset><fieldset><legend>남쪽 출구</legend><label>기계화 스텝 <input name="southSteps" type="number" min="0" value="0"></label><label><input name="southRoad" type="checkbox"> 도로 보급</label></fieldset></div><label><input name="don" type="checkbox"> Don강 남쪽 xx31 아래 독일 전투 유닛</label><p>일반 VP 감점(24.1.4): X·Y·Z 진입 구역, Kharkov·Stalino, 시작선 서쪽 소도시</p><div class="row"><fieldset><legend>X·Y·Z</legend>${['X','Y','Z'].map(x=>`<label><input type="checkbox" name="entry" value="${x}">${x}</label>`).join('')}</fieldset><fieldset><legend>시작선 서쪽 대도시</legend>${['kharkov','stalino'].map(x=>`<label><input type="checkbox" name="major" value="${x}">${x}</label>`).join('')}</fieldset><label>소도시 수 <input name="minorCount" type="number" min="0" value="0"></label></div><label><input type="checkbox" name="vpChecked" required> 모든 VP와 감점을 확인했습니다</label><button type="submit">소련군 차례 완료</button></form>${s.vpObservation?'<p class="success">VP 관측 저장됨. 승리 판정으로 진행하세요.</p>':''}</section>`;
}

export function renderV2Game(s){
  const historyName={review_board:'전황 확인',plan:'작전 계획',decision:'행동 결정',victory:'승리 판정'};
  const recent=s.history.slice(-5).reverse().map(h=>`<li>${h.turn}턴 ${esc(historyName[h.type]??h.type)} · ${esc(h.policyId??h.result?.policyId??h.action??'')}</li>`).join('');
  return `<div class="summary"><span class="pill">${s.turn} / 8턴</span><span class="pill">${esc(phaseName[s.phase])}</span><span class="pill">${s.vp} / 8 VP</span><span class="pill">${esc(DOCTRINE_PROFILES[s.difficulty].label)}</span></div>${boardPanel(s)}<div class="grid"><div>${s.winner?`<section class="panel"><h2>${s.winner==='axis'?'추축군':'소련군'} 승리</h2><p>영문 S1.3</p></section>`:''}${checklist(s)}${decisionPanel(s)}${vpPanel(s)}${s.phase==='victory'&&!s.winner?'<section class="panel"><h2>승리 판정 완료</h2><button data-action="next_turn">다음 턴</button></section>':''}<section class="panel"><div class="actions"><button class="secondary" data-action="next_phase">다음 단계</button><button class="secondary" data-action="export">JSON 내보내기</button><button class="secondary" data-action="home">기록 목록</button></div></section></div><div><section class="panel"><h2>최근 결정</h2>${recent?`<ul>${recent}</ul>`:'<p>아직 기록이 없습니다.</p>'}</section></div></div>`;
}
