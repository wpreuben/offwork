import {SCENARIO,TARGETS} from './catalog.js';
import {FLOW,PROFILES,POLICY_VERSION} from './policy.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPaper({scenario=SCENARIO,targets=TARGETS,policy=FLOW,profile='standard'}={}) {
  const p=PROFILES[profile];
  if(!p) throw new Error('알 수 없는 난이도');
  const nodes=policy.map((n,i)=>`<article class="node"><div class="node-head"><strong>${i+1}. ${esc(n.id)}</strong><small>영문 ${esc(n.rule)}</small></div><p>${esc(n.question)}</p><div class="branches"><span>예 → <b>${esc(n.yes)}</b></span><span>아니요 → <b>${esc(n.no)}</b></span></div></article>`).join('');
  const objectives=targets.map(t=>`<tr><td>${esc(t.name)}</td><td>${t.vp}</td><td>${esc(t.type)}</td><td>□</td></tr>`).join('');
  return `<section class="summary"><h2>시나리오와 난이도</h2><p>${esc(scenario.name)} · 지도 ${esc(scenario.map)} · ${scenario.firstTurn}–${scenario.lastTurn}턴 · 추축군 선행 · 승리 판정 시 ${scenario.axisVictoryVp}VP 이상</p><p>정책 ${POLICY_VERSION} / ${esc(p.label)}: 공격 예상 비율 ≥ ${p.minAttackOdds}, 손실 위험 ≤ ${p.maxLossRisk}, 예비 병력 ≥ ${p.minReserve}. 이 수치는 실험값이며 원 게임의 규칙이나 CRT를 바꾸지 않습니다.</p><p><b>첫 턴:</b> 전투 유닛 전술 이동 최대 2헥스. 14Pz·22Pz·60PzG는 이동·공격 금지 (S1.2).</p></section>
  <section><h2>1 · 턴 순서</h2><ol class="phase-list"><li>초기 상태 확인</li><li>추축군 이동: 편제별 후보를 아래 순서도로 검사하고, 사용한 유닛에 표시</li><li>추축군 전투: 공격 적격성 확인 후 실제 전투 결과 입력</li><li>회복</li><li>보급</li><li>사람의 소련군 차례</li><li>VP와 승리 판정</li></ol></section>
  <section><h2>2 · 후보마다 순서도 따라가기</h2><p class="hint">필수 답을 모르면 ASK에서 멈추고 실물 보드를 확인합니다. 불합법·보급 단절·고위험 포위 후보는 점수를 매기기 전에 제외합니다. NEXT는 다른 후보로, 후보가 없으면 FALLBACK으로 갑니다.</p><div class="flow">${nodes}</div></section>
  <section class="page-break"><h2>3 · 목표와 VP 장부</h2><p>점령한 VP 헥스와 소련 보급원에서 고립된 미점령 VP 헥스는 같은 칸을 한 번만 셉니다 (S1.3).</p><table><thead><tr><th>목표</th><th>VP</th><th>종류</th><th>확인</th></tr></thead><tbody>${objectives}</tbody></table><p>동쪽·남쪽 출구는 각각 기계화 5스텝과 도로 보급이 모두 필요합니다. Don강 남쪽 보너스는 독일 전투 유닛을 확인합니다 (S1.3). 8턴 말 8VP 미만이면 소련군 승리.</p></section>
  <section><h2>4 · 후보 기록지</h2><table><thead><tr><th>턴/편제/유닛</th><th>목표/행동</th><th>합법·보급·포위</th><th>예비/공격</th><th>정책 ID·d6·결과</th></tr></thead><tbody>${Array.from({length:7},()=>'<tr><td class="blank"></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table><p>동률 후보가 난이도 범위 안에 있을 때만 공개 d6를 굴립니다. 선택한 행동이 불가능하면 NEXT로 갑니다. 전투 해결은 영문 규칙 9–16을 따릅니다.</p></section>`;
}
if(typeof document!=='undefined') {
  const root=document.getElementById('paper'),select=document.getElementById('difficulty');
  const draw=()=>{root.innerHTML=renderPaper({profile:select.value});};
  select.addEventListener('change',draw);draw();
}
