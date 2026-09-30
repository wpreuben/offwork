import {SCENARIO,TARGETS} from './catalog.js';
import {DOCTRINE_VERSION,DOCTRINE_PROFILES,PHASE_CHECKLISTS,GOAL_STEPS,THREAT_ORDER} from './doctrine.js';
import {PROCEDURES,SELECTION_RULES,ATTACK_POLICY} from './procedures.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const threatLabel={supply:'보급로 단절',vp_supply:'추축 점유 VP의 보급 없음',vp_loss:'획득 VP 상실',entry_penalty:'X·Y·Z 감점',city_penalty:'시작선 서쪽 도시 감점',encirclement:'핵심 병력 포위'};
const actionLabel={secure_corridor:'보급로 확보',approach_goal:'목표 접근',screen_line:'전선 방어',pass_attack:'이 공격 건너뛰기',prepare_support:'지원 준비 후 재검사',attack:'공격 실행',determined_defense:'결사 방어 판정',retreat:'퇴각 경로 선택',advance:'전투 후 진격',hold:'현 위치 유지'};

function chart(kind,procedure){
  const nodes=procedure.nodes.map(n=>{
    const attrs=n.fact?`data-fact="${esc(n.fact)}" data-yes="${esc(n.yes)}" data-no="${esc(n.no)}"`:`data-action="${esc(n.action)}"`;
    return `<article class="node" data-id="${esc(n.id)}" ${attrs}><strong>${esc(n.id)}</strong><small>영문 ${esc(n.rule)}</small><p>${esc(n.question??n.text)}</p>${n.fact?`<div class="branches"><span>예 → ${esc(n.yes)}</span><span>아니요 → ${esc(n.no)}</span></div>`:`<b class="outcome">${esc(actionLabel[n.action]??n.action)}</b>`}</article>`;
  }).join('');
  return `<section class="chart" data-procedure="${esc(kind)}"><h2>${esc(procedure.title)}</h2><p class="hint">시작: ${esc(procedure.root)}. 답을 모르면 보드를 확인합니다. 행동이 불가능하면 다음 합법 후보를 검사합니다.</p><div class="flow">${nodes}</div></section>`;
}

export function renderPaper({profile='standard'}={}){
  const setting=DOCTRINE_PROFILES[profile],attack=ATTACK_POLICY[profile];
  if(!setting||!attack)throw new Error('알 수 없는 난이도');
  const steps=GOAL_STEPS.map(x=>`<li><b>${esc(x.id)}</b> — ${esc(x.text)} <small>영문 ${esc(x.rule)}</small></li>`).join('');
  const threats=Object.entries(THREAT_ORDER).sort((a,b)=>a[1]-b[1]).map(([id])=>`<li>□ ${esc(threatLabel[id])}</li>`).join('');
  const phases=Object.entries(PHASE_CHECKLISTS).map(([phase,rows])=>`<section><h3>${esc({initial:'추축군 초기',recovery:'회복',supply:'보급'}[phase])}</h3><ol>${rows.map(x=>`<li data-step="${esc(x.id)}">${esc(x.text)} <small>[영문 ${esc(x.rule)}]</small></li>`).join('')}</ol></section>`).join('');
  const priorities=Object.entries(SELECTION_RULES).map(([kind,rows])=>`<section><h3>${esc({movement:'이동 유닛·헥스',attack:'공격 목표·병력',defense:'방어 선도·지원',advance:'전투 후 진격',loss:'손실 유닛',retreat:'퇴각 헥스'}[kind])}</h3><ol>${rows.map(x=>`<li data-step="${kind}:${esc(x.id)}">${esc(x.text)} <small>[영문 ${esc(x.rule)}]</small></li>`).join('')}</ol></section>`).join('');
  const ledger=TARGETS.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.vp}</td><td>${esc(t.type)}</td><td class="blank">□</td><td class="blank">□</td></tr>`).join('');
  return `<section class="summary"><h2>시나리오·정책</h2><p>${esc(SCENARIO.name)} · 지도 ${SCENARIO.map} · ${SCENARIO.firstTurn}–${SCENARIO.lastTurn}턴 · 추축군 선행 · 승리 판정에서 ${SCENARIO.axisVictoryVp}VP</p><p>정책 ${DOCTRINE_VERSION} / ${esc(setting.label)} · 소련군 목표 승률 ${Math.round(setting.targetHumanWinRate*100)}% (미측정)</p><p>CRT 1–6의 결과를 보고 목표 달성 결과가 ${attack.minimumSuccessFaces}면 이상인지 확인합니다. 즉시 승리 목표는 ${attack.criticalMinimumSuccessFaces}면 이상, 추축군 스텝 손실 결과는 ${attack.maxAxisLossFaces}면 이하입니다. 이 수치는 오토마 정책이지 원 게임 규칙의 수정이 아닙니다.</p></section>
  <section><h2>1 · 실제 턴 순서</h2><p>초기 → 이동 → 전투 → 회복 → 보급 → 사람의 소련군 차례(추축군 방어 순서도 사용) → VP 승리 판정. 1턴 추축 전투 유닛은 전술 이동 2헥스만, 14Pz·22Pz·60PzG는 이동·공격 금지(S1.2).</p>${phases}</section>
  <section class="page-break"><h2>2 · 작전 목표 장부와 선택</h2><p>변한 목표의 점유·보급 상태만 갱신합니다. 달성 가능한 턴은 이번 턴/다음 턴/이후/불가로 표시하고, 소련군 다음 턴 반격과 해당 병력·도로 보급 가능성을 확인합니다.</p><ol>${steps}</ol><p><b>위협 우선 확인:</b></p><ul class="threats">${threats}</ul><p>이미 얻은 목표는 다시 점령 목표로 고르지 않습니다. 보급선이 없으면 0VP가 되는 추축 점유 VP는 보급 복구 위협으로 처리합니다. 출구는 각각 5 기계화 스텝과 해당 소련 진입 구역까지의 도로 보급선이 필요합니다.</p><table><thead><tr><th>목표</th><th>VP</th><th>종류</th><th>점유·보급</th><th>완료 턴</th></tr></thead><tbody>${ledger}</tbody></table></section>
  <section><h2>3 · 첫 합법 후보 선택 기준</h2><p>아래 항목을 위에서부터 적용합니다. 사람은 게임판에서 해당하는 첫 합법 유닛·헥스를 찾아 적습니다. 후보가 없으면 다음 기준으로 넘어갑니다. 손실 선택권과 퇴각 합법성은 영문 규칙을 먼저 확인합니다.</p>${priorities}</section>
  <section class="page-break"><h2>4 · 추축군 행동 및 소련군 차례 대응</h2>${Object.entries(PROCEDURES).map(([kind,p])=>chart(kind,p)).join('')}</section>
  <section class="page-break"><h2>5 · VP 및 행동 기록</h2><p>추축 점유 VP는 승리 판정 때 보급선이 없으면 0VP(24.1.1). 소련 점유지만 모든 소련 보급원에서 고립된 VP는 S1.3에 따라 셉니다. 같은 헥스는 한 번만 셉니다. Don 보너스는 Don강 남쪽 xx31 헥스열 아래 독일 전투 유닛이 있을 때 1VP입니다.</p><p><b>일반 VP 감점(24.1.4):</b> X·Y·Z 진입 구역 인접 가장자리의 소련 유닛은 구역마다 −3VP, Kharkov·Stalino 소련 점유는 각 −3VP, 시작선 서쪽 소도시 소련 점유는 각 −1VP입니다.</p><table><thead><tr><th>턴·단계</th><th>목표·편제</th><th>질문·결과</th><th>정책 ID·d6</th><th>실제 결과</th></tr></thead><tbody>${Array.from({length:8},()=>'<tr><td class="blank"></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table></section>`;
}

if(typeof document!=='undefined'){
  const root=document.getElementById('paper'),select=document.getElementById('difficulty');
  const draw=()=>{root.innerHTML=renderPaper({profile:select.value});};
  select.addEventListener('change',draw);draw();
}
