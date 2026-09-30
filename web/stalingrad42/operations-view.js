import {TARGETS} from './catalog.js';
import {MISSION_LABELS} from './operations.js';
import {ATTACK_POLICY,rankLocalOptions} from './procedures.js';
import {esc,options,checked} from './view-common.js';
const targetName=id=>TARGETS.find(t=>t.id===id)?.name??'전선';

export function groupPanel(s,editingGroupId){
  const edit=s.groups.find(g=>g.id===editingGroupId);
  const groups=s.groups.map(g=>`<tr><td>${esc(g.id)}<br><small>${esc(g.unitIds.join(', '))}</small></td><td>${g.kind==='mobile'?'기동':'보병'} · ${g.ready?'가용':'사용 불가'} · ${g.supplied?'보급':'보급 없음'}${g.guardCritical?' · 거점 경계':''}</td><td>${Object.entries(g.targetDistances).map(([id,d])=>`${esc(targetName(id))}: ${d}헥스`).join('<br>')||'거리 미확인'}</td><td><button class="small secondary" data-action="edit_group" data-id="${esc(g.id)}">수정</button><button class="small secondary" data-action="remove_group" data-id="${esc(g.id)}">제거</button></td></tr>`).join('');
  return `<section class="panel"><h2>전투단 병력 장부</h2><p>실물 유닛의 군 표기나 구별 가능한 묶음마다 ID를 정합니다. 병력과 거리만 관측하면 오토마가 임무를 배정합니다. 거점·보급로에서 움직이면 안 되는 유닛은 보호 유닛에 적으세요.</p>${groups?`<div class="table-wrap"><table><thead><tr><th>전투단·유닛</th><th>상태</th><th>목표 거리</th><th>갱신</th></tr></thead><tbody>${groups}</tbody></table></div>`:'<p>계획 전에 전투단을 등록하고 목표까지 거리를 확인하세요.</p>'}
  <details${!groups||edit?' open':''}><summary>${edit?'전투단 관측 수정':'전투단 등록'}</summary><form id="group-form"><div class="row"><label>전투단 ID <input name="id" required value="${esc(edit?.id??'')}" placeholder="예: 6A"></label><label>종류 <select name="kind">${options([['mobile','기동'],['infantry','보병']],edit?.kind??'mobile')}</select></label></div><label>유닛 ID 목록 (쉼표로 구분) <input name="unitIds" required value="${esc(edit?.unitIds.join(', ')??'')}" placeholder="예: 6A-1, 6A-2"></label><label>보호 유닛 ID 목록 <input name="protectedUnitIds" value="${esc(edit?.protectedUnitIds.join(', ')??'')}"></label><div class="row"><label><input type="checkbox" name="ready"${checked(edit?.ready??true)}> 이번 차례 가용</label><label><input type="checkbox" name="supplied"${checked(edit?.supplied??true)}> 현재 보급</label><label><input type="checkbox" name="guardCritical"${checked(edit?.guardCritical)}> 전투단이 핵심 거점·보급로를 경계해야 함</label></div><button type="submit">병력 관측 저장</button></form></details>
  ${groups?`<details><summary>목표까지 거리 갱신</summary><form id="distance-form"><div class="row"><label>전투단 <select name="groupId">${options(s.groups.map(g=>[g.id,g.id]),edit?.id??s.groups[0]?.id)}</select></label><label>목표 <select name="targetId">${options(TARGETS.map(t=>[t.id,t.name]),s.currentGoal??'usman')}</select></label><label>최소 헥스 거리 <input type="number" name="distance" min="0" max="99" required placeholder="모르면 99"></label></div><p class="tiny">실물 보드에서 센 거리입니다. 이동 합법성은 경로 선택 때 다시 확인합니다.</p><button type="submit">거리 저장</button></form></details>`:''}</section>`;
}

export function missionPanel(s){
  if(!s.plan)return '';
  return `<section class="panel"><h2>오토마의 전투단 임무</h2><p>주공을 유지하면서 위협 대응 병력과 예비를 배정했습니다. 유닛 순서에서 첫 합법 유닛을 사용하고, 예비·보호 병력은 유지합니다.</p>${s.plan.missions.map(m=>`<article class="card"><h3>${esc(m.groupId)} · ${esc(MISSION_LABELS[m.kind])}</h3><p>${esc(targetName(m.targetId))}${m.threatId?` · 위협 ${esc(m.threatId)}`:''}</p><p class="tiny">유닛 순서: ${esc(m.unitIds.join(' → ')||'가용 이동 유닛 없음')} · ${esc(m.policyId)}</p>${s.phase==='movement'?s.doneGroups.includes(m.groupId)?'<p class="success">이동 임무 완료</p>':`<div class="actions"><button data-action="start_decision" data-kind="movement" data-group-id="${esc(m.groupId)}">이 전투단 이동 판단</button><button class="secondary" data-action="complete_group" data-group-id="${esc(m.groupId)}">남은 합법 이동 없음 / 유지 완료</button></div>`:s.phase==='combat'&&m.kind!=='reserve'?`<button class="secondary" data-action="start_decision" data-kind="attack" data-group-id="${esc(m.groupId)}">이 전투단 공격 판단</button>`:''}</article>`).join('')}</section>`;
}

export function crtForm(s){
  const policy=ATTACK_POLICY[s.difficulty];
  return `<form id="crt-form"><p><b>공격 유효성 지표</b>를 입력합니다. 실제 CRT에서 수비측 퇴각·제거를 발생시키는 면을 셉니다. EX는 수비측 마지막 스텝을 제거할 때만 포함하고 A1은 제외합니다. DD·City Battle 이후 점령 성공은 보장되지 않습니다.</p><div class="row"><label>유효 CRT 면수 (0–6) <input type="number" name="successFaces" min="0" max="6" required></label><label>추축군 손실 CRT 면수 (0–6) <input type="number" name="lossFaces" min="0" max="6" required></label></div><label>수비측 DD <select name="defenderDd" required><option value="">실제 규칙·지형을 확인하세요</option>${options([['none','불가'],['possible','가능'],['strong','가능 · 도시/요새 또는 유리한 선도 DRM']], '')}</select></label><label>이번 공격 항공·ASU 지원 합계 <input type="number" name="supportCommitted" min="0" max="2" value="0" required></label><p class="tiny">난이도 정책 상한 ${policy.maxSupportCommitted}개. 지원을 반영한 실제 CRT에서 다시 셉니다. 즉시 승리 여부는 작전 계획에서 판정합니다.</p><button type="submit">공격 정책 판정</button></form>`;
}

export function breakthroughForm(p){
  return `<form id="breakthrough-form"><p>초기 공격의 참여 유닛으로 한 합법 스택을 구성합니다. 형성·방향 변경·이미 이동한 헥스 비용을 초기 진격 허용량에서 차감하세요. 포병 지원 금지, 원 공격의 항공지원만 허용합니다.</p><div class="row"><label>초기 전투 ID <input name="combatId" required placeholder="예: 1턴-C1"></label><label>돌파집단 유닛 (쉼표 구분) <input name="piece" value="${esc(p.unitIds[0]??'')}" required></label><label>남은 초기 진격 허용량 <input type="number" name="remaining" min="0" max="4" required></label></div><p class="tiny">같은 초기 전투는 같은 ID를 사용합니다. 허용량을 늘리거나 종료된 돌파를 재개할 수 없습니다.</p><button type="submit">돌파집단·허용량 확인</button></form>`;
}

export function lossCandidates(p){
  const sorted=rankLocalOptions('loss',p.options,{enemyLoss:p.facts.enemyLoss});
  return `<p><b>${p.facts.enemyLoss?'소련군 손실 선택':'추축군 손실 선택'}</b>: 실제 CRT와 10.2.3의 선택 제한을 확인해 적격 후보만 추가하세요.</p><form id="loss-candidate-form"><div class="row"><label>유닛 ID <input name="id" required></label><label>현재 스텝 <input type="number" name="steps" min="1" max="3" value="2" required></label><label>품질 <select name="quality">${options([[-1,'Low Quality'],[0,'일반'],[1,'Elite']],0)}</select></label></div><div class="row"><label><input type="checkbox" name="mechanized"> 기계화</label><label><input type="checkbox" name="essentialToSupply"> 보급 핵심</label><label><input type="checkbox" name="essentialToVp"> VP 핵심</label><label><input type="checkbox" name="eligible" required> 규칙상 선택 가능</label></div><button type="submit">후보 추가·관측 수정</button></form><p>선택 순서: ${esc(sorted.map(x=>x.id).join(' → ')||'후보를 추가하세요')}</p>${p.selectedId?`<p class="success">오토마 선택: ${esc(p.selectedId)}</p>`:''}`;
}

export function recordForm(s,p){
  const holding=['hold_reserve','hold_position'].includes(p.result.action);
  const piece=p.selectedId??p.breakthrough?.piece??p.unitIds[0]??'';
  return `<form id="decision-form">${!holding?`<div class="row"><label>선택 유닛 ID (공격은 쉼표 구분) <input name="piece" value="${esc(piece)}"${p.kind==='loss'?' readonly':''}></label><label>도착·전투 헥스 <input name="hex" placeholder="지도 헥스"></label></div>`:''}${s.turn===1&&p.kind==='movement'&&!holding?'<label><input type="checkbox" name="firstTurnLegal" required> S1.2: 전투 유닛은 전술 이동 2헥스 이내, SP는 전체 MA 이동 허용. 14Pz·22Pz·60PzG 제외</label>':''}${p.result.action==='breakthrough'?'<label>실제 돌파 CRT <select name="breakthroughResult" required><option value="">결과 확인</option><option value="continue">Adv 3 또는 Adv 4 · 남은 허용량으로 계속 가능</option><option value="stop">그 밖의 결과 · 돌파 종료</option></select></label>':''}<label>실제 결과·메모 <input name="note" placeholder="선택 결과"></label><button type="submit"${p.kind==='loss'&&!p.selectedId?' disabled':''}>결정·결과 기록</button></form>`;
}
