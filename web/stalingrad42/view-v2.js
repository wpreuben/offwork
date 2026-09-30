import {TARGETS} from './catalog.js';
import {DOCTRINE_VERSION,DOCTRINE_PROFILES,PHASE_CHECKLISTS} from './doctrine.js';
import {SELECTION_RULES} from './procedures.js';
import {groupPanel,missionPanel,crtForm,breakthroughForm,lossCandidates,recordForm} from './operations-view.js';
import {esc,options,checked} from './view-common.js';

const phaseName={initial:'추축군 초기',movement:'추축군 이동',combat:'추축군 전투',recovery:'회복',supply:'보급',soviet_turn:'소련군 차례 · 추축군 대응',victory:'승리 판정'};
const controlName={soviet:'소련 점유',soviet_isolated:'소련 점유·고립',axis_supplied:'추축 점유·보급',axis_unsupplied:'추축 점유·보급 없음'};
const etaName={0:'이번 턴',1:'다음 턴',2:'그다음 턴',99:'불가·미확인'};
const threatName={supply:'보급로 단절',vp_supply:'추축 점유 VP 보급 없음',vp_loss:'기존 VP 상실',entry_penalty:'X·Y·Z 감점',city_penalty:'시작선 서쪽 도시 감점',encirclement:'핵심 부대 포위'};
const severityName={critical:'핵심 병력·유일 보급로 붕괴',significant:'VP·거점 상실',limited:'경미한 압박'};
const kindName={movement:'이동',attack:'공격',advance:'전투 후 진격',breakthrough:'돌파전투',defense:'추축군 방어',loss:'손실 유닛',retreat:'퇴각 헥스'};
const remaining=(o,s)=>o.eta===99?99:Math.max(0,o.eta-(s.turn-(o.observedTurn??s.turn)));

export function renderV2Landing(records=[]){
  return `<div class="grid"><section class="panel"><p class="eyebrow">S1 FALL BLAU · ${DOCTRINE_VERSION}</p><h2>새 추축군 오토마 기록</h2><label>난이도 <select id="difficulty">${options(Object.entries(DOCTRINE_PROFILES).map(([id,p])=>[id,`${p.label} · 소련군 목표 승률 ${Math.round(p.targetHumanWinRate*100)}% (미측정)`]),'standard')}</select></label><div class="actions"><button data-action="new">새 게임 시작</button><a class="button" href="./paper.html">종이 순서도</a></div><p class="tiny">전투단 임무, 작전 목표, 추축군 방어까지 종이판과 같은 정책을 사용합니다. 승률은 종이 플레이 검증 전입니다.</p></section><section class="panel"><h2>저장한 0.2 게임</h2>${records.length?`<ul class="list">${records.map(r=>`<li><button class="secondary" data-action="load" data-id="${esc(r.id)}">${r.state.turn}턴 · ${esc(phaseName[r.state.phase])} · ${esc(r.state.policyVersion)}</button></li>`).join('')}</ul>`:'<p>새 기록이 없습니다.</p>'}<label>0.2 JSON 가져오기 <input id="import" type="file" accept=".json,application/json"></label><p class="tiny">0.2.0 기록은 이력을 보존하고 새 정책으로 전환합니다. 전투단을 등록하고 전황을 다시 확인하세요. 0.1 기록은 <a href="./legacy.html">0.1 헬퍼</a>에서 내보낼 수 있습니다.</p></section></div>`;
}

function boardPanel(s,editingObjectiveId){
  const edit=s.objectiveStates[editingObjectiveId];
  const selected=editingObjectiveId??'usman';
  const targetOptions=options(TARGETS.map(t=>[t.id,`${t.name} · ${t.vp}VP`]),selected);
  const rows=TARGETS.map(t=>{
    const o=s.objectiveStates[t.id];
    const ready=s.groups.filter(g=>g.ready&&g.supplied&&!g.guardCritical&&(g.targetDistances[t.id]??99)<99).length;
    return `<tr><td>${esc(t.name)} <small>${t.vp}VP</small></td><td>${esc(o?controlName[o.control]:'미확인')}</td><td>${esc(o?etaName[remaining(o,s)]:'미확인')}</td><td>가용 전투단 ${ready} · ${o?.supplySecure?'보급 유지 가능':'보급 미확인'}</td><td><button class="small secondary" data-action="edit_objective" data-id="${t.id}">관측 수정</button></td></tr>`;
  }).join('');
  const threats=s.threats.map(t=>`<li>${esc(threatName[t.kind])} · ${esc(severityName[t.severity??'critical'])} · ${esc(etaName[remaining(t,s)]??remaining(t,s))} · ${esc(t.affectedGroupId??TARGETS.find(x=>x.id===t.targetId)?.name??'전선')} <button class="small secondary" data-action="remove_threat" data-id="${esc(t.id)}">제거</button></li>`).join('');
  const planning=['initial','movement','combat'].includes(s.phase);
  return `<section class="panel"><p class="eyebrow">전황 · 이번 턴 ${s.boardReviewedTurn===s.turn?'확인 완료':'확인 필요'}</p><h2>지도 A 목표 장부</h2><p class="tiny">변한 점유·보급·반격 관측만 수정합니다. 완료 예상 시점은 관측 턴 이후 경과를 반영합니다. 전투단의 가용 병력과 거리를 확인한 뒤 작전을 정하세요.</p><div class="table-wrap"><table><thead><tr><th>목표</th><th>점유·보급</th><th>완료 예상</th><th>실행 조건</th><th>갱신</th></tr></thead><tbody>${rows}</tbody></table></div>
  <details${editingObjectiveId?' open':''}><summary>목표 상태 갱신</summary><form id="objective-form"><div class="row"><label>목표 <select name="id">${targetOptions}</select></label><label>점유·보급 <select name="control">${options(Object.entries(controlName),edit?.control??'soviet')}</select></label><label>완료 예상 <select name="eta">${options(Object.entries(etaName),edit?remaining(edit,s):99)}</select></label></div><label>소련군 다음 턴 반격 <select name="counterattack">${options([['none','낮음'],['pressure','압박'],['collapse','핵심 병력·보급 즉시 붕괴']],edit?.counterattack??'none')}</select></label><label><input type="checkbox" name="supplySecure"${checked(edit?.supplySecure)}> 완료 시점 보급 유지</label><div class="row"><label><input type="checkbox" name="exitStepsReady"${checked(edit?.exitStepsReady)}> 출구 5 기계화 스텝 가능</label><label><input type="checkbox" name="roadReady"${checked(edit?.roadReady)}> 출구까지 도로 보급 가능</label></div><button type="submit">이 목표 저장</button></form></details>
  <details><summary>감점·보급 위협 입력</summary><form id="threat-form"><div class="row"><label>위협 <select name="kind">${options(Object.entries(threatName),'supply')}</select></label><label>피해 규모 <select name="severity">${options(Object.entries(severityName),'significant')}</select></label><label>언제 발생 <select name="eta">${options([[0,'이번 턴'],[1,'다음 턴'],[2,'그다음 턴']],0)}</select></label></div><div class="row"><label>관련 목표 <select name="targetId"><option value="">없음</option>${options(TARGETS.map(t=>[t.id,t.name]),'')}</select></label><label>영향받는 전투단 <select name="affectedGroupId"><option value="">없음</option>${options(s.groups.map(g=>[g.id,g.id]),s.groups[0]?.id??'')}</select></label></div><label><input name="actionable" type="checkbox" checked> 현재 병력으로 대응할 수 있음</label><button type="submit">위협 추가</button></form></details><p><b>현재 위협:</b></p>${threats?`<ul>${threats}</ul>`:'<p>없음</p>'}
  ${planning?'<div class="actions"><button data-action="board-review">이번 턴 전황 확인</button><label>공개 d6 <input id="plan-die" type="number" min="1" max="6" value="1"></label><button data-action="goal-plan">작전 목표·임무 정하기</button></div>':''}
  ${s.plan?`<div class="card"><strong>${esc(s.plan.kind==='gain'?TARGETS.find(t=>t.id===s.plan.targetId)?.name:s.plan.kind==='respond'?'핵심 위협 대응':'전선 유지')}</strong><p>${esc(s.plan.reason)}</p><small>정책 ${esc(s.plan.policyId)} · 영문 ${esc(s.plan.ruleRefs.join(', '))}</small></div>`:''}</section>`;
}

function checklist(s){
  const rows=PHASE_CHECKLISTS[s.phase];if(!rows)return '';
  return `<section class="panel"><h2>${esc(phaseName[s.phase])} 순서표</h2><div class="checks">${rows.map(x=>`<label><input type="checkbox" data-action="check_step" data-id="${x.id}"${checked(s.checks[s.phase]?.includes(x.id))}> ${esc(x.text)} <small>영문 ${esc(x.rule)}</small></label>`).join('')}</div></section>`;
}

function decisionPanel(s){
  const allowed={movement:['movement'],combat:['attack','advance','breakthrough','loss','retreat'],soviet_turn:['defense','loss','retreat']}[s.phase];if(!allowed)return '';
  const p=s.pending;
  const buttons=allowed.map(kind=>`<button class="secondary" data-action="start_decision" data-kind="${kind}"${p?' disabled':''}>${esc(kindName[kind])} 판단</button>`).join('');
  let body='';
  if(p?.result.status==='ask'){
    const question=p.result.fact==='oddsReady'?crtForm(s):p.result.fact==='allowanceReady'?breakthroughForm(p):'<div class="actions"><button data-action="answer" data-value="yes">예</button><button class="secondary" data-action="answer" data-value="no">아니요</button></div>';
    body=`<div class="card"><p class="eyebrow">${esc(p.result.policyId)} · 영문 ${esc(p.result.ruleRefs.join(', '))}</p><h3>${esc(p.result.question)}</h3>${question}</div>`;
  }else if(p?.result.status==='decision'){
    const rows=SELECTION_RULES[p.kind]??[];
    const readiness=p.crt?.readiness;
    body=`<div class="card"><p class="eyebrow">${esc(p.result.policyId)} · ${esc(p.groupId??'방어 스택')} · 영문 ${esc(p.result.ruleRefs.join(', '))}</p><h3>${esc(p.result.text??kindName[p.kind])}</h3>${readiness?`<p>유효 면수 ${p.crt.successFaces}/${readiness.minimumSuccessFaces}, 손실 면수 ${p.crt.lossFaces}/${readiness.maxAxisLossFaces}, 지원 ${p.crt.supportCommitted}/${readiness.maxSupportCommitted} · ${readiness.ready?'기준 충족':'기준 미달'}</p>`:''}<ol>${rows.map(x=>`<li>${esc(x.text)} <small>영문 ${esc(x.rule)}</small></li>`).join('')}</ol>${p.kind==='loss'?lossCandidates(p):''}${p.unitIds.length?`<p class="tiny">가용 유닛 순서: ${esc(p.unitIds.join(' → '))}. 앞 유닛이 규칙상 불가능하면 다음 유닛을 확인하세요.</p>`:''}${recordForm(s,p)}</div>`;
  }
  return `<section class="panel"><h2>${esc(phaseName[s.phase])} 오토마</h2><p>종이판과 같은 정책을 적용합니다. 배정된 전투단의 첫 합법 유닛·헥스를 선택하세요.</p><div class="actions">${buttons}${p?'<button class="secondary" data-action="cancel_decision">현재 판단 취소</button>':''}</div>${body}</section>`;
}

function vpPanel(s){
  if(s.phase!=='soviet_turn')return '';
  const old=s.vpObservation;
  const rows=TARGETS.filter(t=>t.type==='vp_hex').map(t=>`<label>${esc(t.name)} (${t.vp}VP)<select name="vp-${t.id}">${options(Object.entries(controlName),s.objectiveStates[t.id]?.control??'soviet')}</select></label>`).join('');
  return `<section class="panel"><h2>소련군 차례 완료 · VP 관측</h2><p>추축군 방어·손실·퇴각을 먼저 처리하세요. 관측 후 행동을 추가하면 VP 재확인이 필요합니다.</p><form id="vp-form"><div class="checks">${rows}</div><div class="row">${[['east','동쪽'],['south','남쪽']].map(([key,label])=>`<fieldset><legend>${label} 출구</legend><label>기계화 스텝 <input name="${key}Steps" type="number" min="0" value="${old?.[`${key}Exit`]?.mechanizedSteps??0}"></label><label><input name="${key}Road" type="checkbox"${checked(old?.[`${key}Exit`]?.roadSupply)}> 도로 보급</label></fieldset>`).join('')}</div><label><input name="don" type="checkbox"${checked(old?.donSouthGermanCombatUnit)}> Don강 남쪽 xx31 아래 독일 전투 유닛</label><p>일반 VP 감점(24.1.4): X·Y·Z 진입 구역, Kharkov·Stalino, 시작선 서쪽 소도시</p><div class="row"><fieldset><legend>X·Y·Z</legend>${['X','Y','Z'].map(x=>`<label><input type="checkbox" name="entry" value="${x}"${checked(old?.sovietAtAxisEntryAreas?.includes(x))}>${x}</label>`).join('')}</fieldset><fieldset><legend>시작선 서쪽 대도시</legend>${['kharkov','stalino'].map(x=>`<label><input type="checkbox" name="major" value="${x}"${checked(old?.sovietHeldWestStartMajorCities?.includes(x))}>${x}</label>`).join('')}</fieldset><label>소도시 수 <input name="minorCount" type="number" min="0" value="${old?.sovietHeldWestStartMinorCityCount??0}"></label></div><label><input type="checkbox" name="vpChecked" required> 모든 VP와 감점을 확인했습니다</label><button type="submit">소련군 차례 완료</button></form>${old?'<p class="success">VP 관측 저장됨. 승리 판정으로 진행하세요.</p>':''}</section>`;
}

export function renderV2Game(s,{editingGroupId,editingObjectiveId}={}){
  const historyName={review_board:'전황 확인',plan:'작전 계획',decision:'행동 결정',victory:'승리 판정',group_complete:'전투단 완료',policy_upgrade:'정책 전환'};
  const recent=s.history.slice(-5).reverse().map(h=>`<li>${h.turn}턴 ${esc(historyName[h.type]??h.type)} · ${esc(h.groupId??h.policyId??h.result?.policyId??h.action??'')}</li>`).join('');
  const snapshot=s.history.filter(h=>h.type==='plan'&&h.snapshot).at(-1);
  return `<div class="summary"><span class="pill">${s.turn} / 8턴</span><span class="pill">${esc(phaseName[s.phase])}</span><span class="pill">지난 판정 ${s.vp} / 8 VP</span><span class="pill">${esc(DOCTRINE_PROFILES[s.difficulty].label)} · ${s.policyVersion}</span></div>${groupPanel(s,editingGroupId)}${boardPanel(s,editingObjectiveId)}<div class="grid"><div>${s.winner?`<section class="panel"><h2>${s.winner==='axis'?'추축군':'소련군'} 승리</h2><p>영문 S1.3</p></section>`:''}${checklist(s)}${missionPanel(s)}${decisionPanel(s)}${vpPanel(s)}${s.phase==='victory'&&!s.winner?'<section class="panel"><h2>승리 판정 완료</h2><button data-action="next_turn">다음 턴</button></section>':''}<section class="panel"><div class="actions">${s.phase!=='victory'&&!s.winner?'<button class="secondary" data-action="next_phase">다음 단계</button>':''}<button class="secondary" data-action="export">JSON 내보내기</button><button class="secondary" data-action="home">기록 목록</button></div></section></div><div><section class="panel"><h2>최근 결정</h2>${recent?`<ul>${recent}</ul>`:'<p>아직 기록이 없습니다.</p>'}${snapshot?`<p class="tiny">최근 계획 입력 ${snapshot.snapshot.input.vp}VP · 전황·병력·매개변수 스냅샷 저장됨</p><button class="secondary" data-action="replay-plan">최근 계획 재현 확인</button>`:''}</section></div></div>`;
}
