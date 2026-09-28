import {TARGETS} from './catalog.js';
import {PROFILES,POLICY_VERSION,PHASE_ACTIONS} from './policy.js';
import {createSession,applySession} from './session.js';
import {JsonStore} from './storage.js';

const root=document.getElementById('app');
const status=document.getElementById('status');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phaseLabel={initial:'초기 확인',movement:'이동',combat:'전투',recovery:'회복',supply:'보급',soviet_turn:'소련군 차례',victory:'승리 판정'};
const actionName={advance:'접근·이동',defend:'방어 준비',attack:'공격',no_attack:'공격 없음',reorganize:'재편',restore_supply:'보급 회복'};
let store,record=null,candidates=[],candidateCounter=0;
const notice=(message,error=false)=>{status.textContent=message;status.className=error?'error':'';};
const targetOptions=TARGETS.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} · ${t.vp}VP</option>`).join('');
const vpChecks=name=>TARGETS.filter(t=>t.type==='vp_hex').map(t=>`<label><input type="checkbox" name="${name}" value="${esc(t.id)}">${esc(t.name)} (${t.vp})</label>`).join('');
const answer=(name,label)=>`<label>${label}<select name="${name}"><option value="">확인 전</option><option value="yes">예</option><option value="no">아니요</option></select></label>`;
const asAnswer=value=>value==='yes'?true:value==='no'?false:undefined;
const numberOrNaN=value=>value===''?NaN:Number(value);

async function transition(actions,{clear=false,removeId=null}={}) {
  let next=record.state;
  for(const action of actions) next=applySession(next,action);
  const saved=await store.write(next,next.history,record.id,record.revision);
  record=saved;
  if(clear){candidates=[];candidateCounter=0;}
  if(removeId)candidates=candidates.filter(c=>c.id!==removeId);
  await render();
  notice('저장했습니다.');
}
function landing(records) {
  root.innerHTML=`<div class="grid"><section class="panel"><p class="eyebrow">새 게임</p><h2>S1 Fall Blau 시작</h2><label>난이도 <select id="difficulty">${Object.entries(PROFILES).map(([id,p])=>`<option value="${id}" ${id==='standard'?'selected':''}>${p.label} · 소련군 목표 승률 ${Math.round(p.targetHumanWinRate*100)}% (미측정)</option>`).join('')}</select></label><div class="actions"><button data-action="new">새 기록 만들기</button><a class="button" href="./paper.html">종이판 열기</a></div><p class="muted">현재 정책 ${POLICY_VERSION}. 승률은 향후 종이 테스트로 조정합니다.</p></section><aside class="panel"><h2>저장한 게임</h2>${records.length?`<ul class="list">${records.map(r=>`<li><button class="secondary" data-action="load" data-id="${esc(r.id)}">${esc(r.state.turn)}턴 · ${esc(PROFILES[r.state.difficulty]?.label)} · ${esc(r.state.phase)}</button></li>`).join('')}</ul>`:'<p class="muted">저장 기록이 없습니다.</p>'}<label>JSON 가져오기 <input type="file" id="import" accept="application/json,.json"></label></aside></div>`;
}
function initialForm() {
  const items=['턴·날씨·주도권','증원과 대체 병력','자원·항공·포병 가용 상태','철도·보급과 전선 위험','첫 턴 S1.2 제한'];
  return `<section class="panel"><p class="eyebrow">영문 3.0 · S1.2</p><h2>턴 시작 확인</h2><form id="initial-form"><div class="checks">${items.map(x=>`<label><input type="checkbox" name="initial" required>${x}</label>`).join('')}</div><button type="submit">확인 완료 · 이동 단계</button></form></section>`;
}
function candidateForm(s) {
  const actions=PHASE_ACTIONS[s.phase].map(id=>`<option value="${id}">${actionName[id]}</option>`).join('');
  return `<section class="panel"><p class="eyebrow">후보 만들기</p><h2>실물 보드에서 확인한 선택지</h2><form id="candidate-form"><div class="row"><label>담당 편제 <input name="formation" required placeholder="예: 6A"></label><label>사용 유닛 ID (쉼표 구분) <input name="units" required placeholder="예: 6A-1, 6A-2"></label></div><div class="row"><label>목표 <select name="target" required><option value="">목표 선택</option>${targetOptions}</select></label><label>현재 단계 행동 <select name="action">${actions}</select></label></div><div class="row"><label>이동 헥스 수 (이동 시) <input type="number" name="hexes" min="0" placeholder="실제 거리"></label><label>남길 예비 병력 수 <input type="number" name="reserve" min="0" placeholder="확인 후 입력"></label></div><div class="row"><label>포위 위험 <select name="risk"><option value="">확인 전</option><option value="none">없음</option><option value="low">낮음</option><option value="high">높음</option></select></label><label>전투 유닛 여부 <select name="combatUnit"><option value="">확인 전</option><option value="yes">전투 유닛</option><option value="no">비전투 유닛</option></select></label></div><div class="row"><label>예상 공격 비율 (공격 시) <input type="number" name="odds" min="0" step="0.1" placeholder="예: 1.5"></label><label>예상 손실 위험 0–1 (공격 시) <input type="number" name="loss" min="0" max="1" step="0.05" placeholder="예: 0.25"></label></div><div class="checks">${answer('legal','행동 합법성')}${answer('supplied','보급 유지')}${answer('reachable','목표 접근 가능성')}</div><button type="submit">후보 추가</button></form><p class="tiny">확인 전 답은 안전 검사에서 멈춥니다. 전투 적격성과 실제 전투 결과는 따로 확인합니다.</p></section>`;
}
function vpForm() {
  return `<section class="panel"><p class="eyebrow">S1.3</p><h2>소련군 차례 완료 및 VP 관측</h2><form id="vp-form"><p>추축군 점령 VP 헥스</p><div class="checks">${vpChecks('controlled')}</div><p>소련 보급원에서 고립된 미점령 VP 헥스</p><div class="checks">${vpChecks('isolated')}</div><div class="row"><fieldset><legend>동쪽 출구</legend><label>기계화 스텝 <input type="number" name="eastSteps" min="0" value="0"></label><label><input type="checkbox" name="eastRoad">도로 보급</label></fieldset><fieldset><legend>남쪽 출구</legend><label>기계화 스텝 <input type="number" name="southSteps" min="0" value="0"></label><label><input type="checkbox" name="southRoad">도로 보급</label></fieldset></div><label><input type="checkbox" name="don">Don강 남쪽 독일 전투 유닛</label><label><input type="checkbox" name="vpChecked" required>지도 A의 VP 목표·출구·Don 조건을 모두 확인함</label><button type="submit">소련군 차례 완료 · VP 판정</button></form></section>`;
}
function fallbackForm(s) {
  const actions=PHASE_ACTIONS[s.phase].filter(a=>a!=='advance'&&a!=='attack').map(a=>`<option value="${a}">${actionName[a]}</option>`).join('');
  return `<p>보급 회복·재편·방어 준비 중 현재 단계에서 실제 가능한 행동을 골라 확인하세요. 불가능하면 다음 단계로 이동합니다.</p><div class="row"><label>대체 행동 <select id="fallback-action" required><option value="">선택</option>${actions}</select></label><label>실행 유닛 ID <input id="fallback-units" placeholder="실물 보드 유닛"></label></div><label><input type="checkbox" id="fallback-safe">합법성·보급·포위 위험을 확인함</label>`;
}
function resultCard(s) {
  if(!s.decision)return '';
  const d=s.decision,c=d.selected,fb=c?.id==='fallback';
  return `<div class="card"><h3>평가 결과</h3>${d.questions.length?`<p>${esc(d.questions.join(' · '))}</p>`:`<p>${c?`${esc(actionName[c.action]??c.action)} / ${esc(c.targetId??'대체 행동')}`:'선택 보류'}</p>`}<p class="tiny">정책 ${esc(d.policyIds.join(', '))} · 영문 ${esc(d.ruleRefs.join(', '))} · d6 ${esc(s.die)}</p>${d.rejected.length?`<p>제외: ${esc(d.rejected.map(r=>`${r.id} (${r.policyId})`).join(', '))}</p>`:''}${c&&!d.questions.length?`${fb?fallbackForm(s):s.phase==='combat'&&c.action==='attack'?'<label>실제 전투 결과 <input id="combat-result" placeholder="영문 9–16으로 해결한 결과"></label>':''}<div class="actions"><button data-action="confirm">실행 확인 후 확정</button>${!fb?'<button class="secondary" data-action="reject">실행 불가 · 다음 후보</button>':''}</div>`:''}</div>`;
}
function game(s) {
  const list=candidates.map(c=>`<li>${esc(c.id)} · ${esc(c.formationId)} / ${esc(TARGETS.find(t=>t.id===c.targetId)?.name)} / ${esc(actionName[c.action])} / ${esc(c.units.join(', '))}</li>`).join('');
  const work=['movement','combat','recovery','supply'].includes(s.phase);
  root.innerHTML=`<div class="summary"><span class="pill">${s.turn} / 8턴</span><span class="pill">${esc(phaseLabel[s.phase])}</span><span class="pill">${s.vp} / 8 VP</span><span class="pill">${esc(PROFILES[s.difficulty].label)}</span></div><div class="grid"><div><section class="panel"><p class="eyebrow">현재 단계</p><h2>${esc(phaseLabel[s.phase])}</h2><p>${esc(s.message)}</p>${s.winner?`<div class="card"><b>${s.winner==='axis'?'추축군':'소련군'} 승리</b> · S1.3</div>`:''}${s.phase==='initial'&&!s.winner?initialForm():''}${s.phase==='soviet_turn'&&!s.winner?vpForm():''}${work&&!s.winner?candidateForm(s):''}${list?`<h3>이번 검토 후보</h3><ol class="list">${list}</ol><label>공개 d6 <input id="die" type="number" min="1" max="6" value="${s.die??1}"></label><button data-action="decide">후보 평가</button>`:''}${resultCard(s)}<div class="actions">${work&&!s.winner?'<button class="secondary" data-action="next_phase">다음 단계</button>':''}${s.phase==='victory'&&!s.winner?'<button data-action="next_turn">다음 턴</button>':''}<button class="secondary" data-action="undo" ${s.undoStack.length?'':'disabled'}>마지막 확정 취소</button></div></section></div><aside><section class="panel"><h2>게임 기록</h2><p class="tiny">정책 ${esc(s.policyVersion)} · 영문 규칙 v2.1</p><ol class="list">${s.history.slice(-8).map(h=>`<li>${h.turn}턴 ${esc(h.phase??'판정')} · ${esc(h.type)} · ${esc(h.policyIds?.join(', ')??h.vp+'VP')}</li>`).join('')}</ol><div class="actions"><button class="secondary" data-action="export">JSON 내보내기</button><button class="secondary" data-action="home">목록</button></div></section></aside></div>`;
}
async function render(){if(record)game(record.state);else landing(await store.listing());}
function formCandidate(form) {
  const f=new FormData(form),action=f.get('action');
  return {id:`C${String(++candidateCounter).padStart(3,'0')}`,targetId:f.get('target'),formationId:f.get('formation').trim(),action,units:f.get('units').split(',').map(x=>x.trim()).filter(Boolean),hexes:numberOrNaN(f.get('hexes')),reserveRemaining:numberOrNaN(f.get('reserve')),encirclementRisk:f.get('risk')||undefined,combatUnit:asAnswer(f.get('combatUnit')),legal:asAnswer(f.get('legal')),supplied:asAnswer(f.get('supplied')),reachable:asAnswer(f.get('reachable')),...(action==='attack'?{attack:{odds:numberOrNaN(f.get('odds')),lossRisk:numberOrNaN(f.get('loss'))}}:{})};
}
function formVp(form) {
  const f=new FormData(form);
  return {sovietTurnComplete:true,vp:{controlledVpHexes:f.getAll('controlled').map(id=>({id,supplied:true})),isolatedSovietVpHexes:f.getAll('isolated'),eastExit:{mechanizedSteps:Number(f.get('eastSteps')),roadSupply:f.has('eastRoad')},southExit:{mechanizedSteps:Number(f.get('southSteps')),roadSupply:f.has('southRoad')},donSouthGermanCombatUnit:f.has('don')}};
}
root.addEventListener('submit',async event=>{
  event.preventDefault();
  try {
    if(event.target.id==='candidate-form'){candidates.push(formCandidate(event.target));await render();notice('후보를 추가했습니다.');}
    else if(event.target.id==='initial-form')await transition([{type:'observe',observation:{initialComplete:true}},{type:'next_phase'}],{clear:true});
    else if(event.target.id==='vp-form')await transition([{type:'observe',observation:formVp(event.target)},{type:'next_phase'}],{clear:true});
  }catch(e){notice(e.message,true);}
});
root.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action]');if(!button)return;
  try {
    switch(button.dataset.action) {
      case 'new':record=await store.write(createSession({difficulty:document.getElementById('difficulty').value}),[],undefined,0);candidates=[];candidateCounter=0;await render();notice('새 게임을 저장했습니다.');break;
      case 'load':record=await store.read(button.dataset.id);candidates=[];candidateCounter=0;await render();notice('기록을 열었습니다.');break;
      case 'home':record=null;candidates=[];await render();break;
      case 'next_phase':await transition([{type:'next_phase'}],{clear:true});break;
      case 'next_turn':await transition([{type:'next_turn'}],{clear:true});break;
      case 'decide':await transition([{type:'decide',candidates,die:Number(document.getElementById('die').value)}]);break;
      case 'confirm': {
        const s=record.state,choice=s.decision?.selected;if(!choice)throw new Error('확정할 행동이 없습니다.');
        let candidate=choice,fallbackVerified=false,combatResolved=false,combatResult=null;
        if(choice.id==='fallback') {
          const chosen=document.getElementById('fallback-action').value,units=document.getElementById('fallback-units').value.split(',').map(x=>x.trim()).filter(Boolean),safe=document.getElementById('fallback-safe').checked;
          if(!chosen||!units.length||!safe)throw new Error('대체 행동의 유닛·합법성·보급·포위 위험을 확인하세요.');
          candidate={...choice,action:chosen,units,legal:true,supplied:true,encirclementRisk:'none'};fallbackVerified=true;
        }else if(s.phase==='combat'&&choice.action==='attack') {
          combatResult=document.getElementById('combat-result').value.trim();
          if(!combatResult)throw new Error('실제 전투 결과를 기록하세요.');
          combatResolved=true;
        }
        await transition([{type:'confirm',candidate,policyIds:s.decision.policyIds,ruleRefs:s.decision.ruleRefs,combatResolved,combatResult,fallbackVerified}],{clear:true});
        break;
      }
      case 'reject':{const id=record.state.decision?.selected?.id;if(!id)throw new Error('거절할 후보가 없습니다.');await transition([{type:'reject',reason:'실물 보드에서 실행 불가'}],{removeId:id});break;}
      case 'undo':await transition([{type:'undo'}],{clear:true});break;
      case 'export':{const json=await store.exportJson(record.id),url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`stalingrad42-${record.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('JSON을 내보냈습니다.');break;}
    }
  }catch(e){notice(e.message,true);}
});
root.addEventListener('change',async event=>{
  if(event.target.id!=='import')return;
  try{const file=event.target.files[0];if(!file)return;record=await store.importJson(await file.text());candidates=[];candidateCounter=0;await render();notice('새 저장 ID로 가져왔습니다.');}catch(e){notice(e.message,true);}
});
try{store=await JsonStore.open();await render();}catch(e){notice(e.message,true);root.innerHTML='<section class="panel"><h2>웹 저장을 사용할 수 없습니다</h2><p>종이 순서도로 계속 플레이할 수 있습니다.</p><a href="./paper.html">종이판 열기</a></section>';}
