import {SCENARIO,calculateS1Vp} from './catalog.js';
import {PROFILES,POLICY_VERSION,PHASE_ACTIONS} from './policy.js';
import {evaluateCandidates} from './engine.js';

const PHASES=['initial','movement','combat','recovery','supply','soviet_turn','victory'];
const FROZEN=['14Pz','22Pz','60PzG'];
const clone=value=>structuredClone(value);
export function createSession({difficulty='standard'}={}) {
  if(!PROFILES[difficulty]) throw new Error('알 수 없는 난이도');
  return {schemaVersion:1,scenario:SCENARIO.id,policyVersion:POLICY_VERSION,difficulty,turn:1,phase:'initial',winner:null,vp:0,observation:{},decision:null,die:null,history:[],usedUnits:[],undoStack:[],message:'초기 상태를 확인하세요.'};
}
export function applySession(state,action) {
  if(!state||state.schemaVersion!==1||!action?.type) throw new Error('세션 또는 행동 입력 오류');
  if(state.winner && action.type!=='undo') throw new Error('종료된 게임입니다.');
  const s=clone(state);
  switch(action.type) {
    case 'observe':
      s.observation={...s.observation,...clone(action.observation??{})};
      s.message='관측을 기록했습니다.';
      return s;
    case 'decide':
      s.decision=evaluateCandidates({turn:s.turn,vp:s.vp,profile:s.difficulty,candidates:action.candidates,die:action.die,phase:s.phase,usedUnits:s.usedUnits});
      s.die=action.die;
      s.message=s.decision.questions.length?'필수 보드 상태를 확인하세요.':'추천 행동을 실물 보드에서 확인하세요.';
      return s;
    case 'reject':
      if(!s.decision?.selected) throw new Error('거절할 추천이 없습니다.');
      s.history.push({type:'reject',turn:s.turn,phase:s.phase,candidateId:s.decision.selected.id,reason:action.reason??'실행 불가',policyIds:['NEXT'],ruleRefs:s.decision.ruleRefs});
      s.decision=null;
      s.message='다음 후보를 검사하세요.';
      return s;
    case 'confirm': {
      const c=action.candidate??s.decision?.selected;
      if(!c||!Array.isArray(c.units)) throw new Error('확정할 유닛과 후보가 필요합니다.');
      if(!['movement','combat','recovery','supply'].includes(s.phase)) throw new Error('현재 단계에서 행동을 확정할 수 없습니다.');
      if(!PHASE_ACTIONS[s.phase].includes(c.action)) throw new Error('현재 단계와 맞지 않는 행동입니다.');
      if(c.id==='fallback' && (action.fallbackVerified!==true||c.legal!==true||c.supplied!==true||c.encirclementRisk!=='none'||!c.units.length)) throw new Error('대체 행동의 유닛·합법성·보급·포위 위험을 실물 보드에서 확인하세요.');
      if(s.turn===1 && (s.phase==='movement'||s.phase==='combat') && c.units.some(u=>FROZEN.some(f=>u.includes(f)))) throw new Error('첫 턴 14Pz·22Pz·60PzG 이동·공격 금지');
      if(s.turn===1 && s.phase==='movement' && c.action==='advance' && c.combatUnit!==false && (!Number.isFinite(c.hexes)||c.hexes>2)) throw new Error('첫 턴 전투 유닛은 전술 이동 최대 2헥스');
      if(s.phase==='movement' && c.units.some(u=>s.usedUnits.includes(u))) throw new Error('같은 이동 단계 유닛 중복');
      if(s.phase==='combat' && c.action==='attack' && action.combatResolved!==true) throw new Error('실제 전투 결과를 먼저 확인하세요.');
      s.undoStack.push(clone({...state,undoStack:[]}));
      if(s.phase==='movement') s.usedUnits.push(...c.units);
      s.history.push({type:'confirm',turn:s.turn,phase:s.phase,candidate:clone(c),policyIds:action.policyIds??s.decision?.policyIds??[],ruleRefs:action.ruleRefs??s.decision?.ruleRefs??[],observation:clone(s.observation),die:action.die??s.die,combatResult:action.combatResult??null});
      s.decision=null;
      s.die=null;
      s.message='행동을 확정했습니다.';
      return s;
    }
    case 'undo': {
      const previous=s.undoStack.pop();
      if(!previous) throw new Error('취소할 확정 행동이 없습니다.');
      return {...previous,undoStack:s.undoStack,message:'마지막 확정을 취소했습니다.'};
    }
    case 'next_phase': {
      const index=PHASES.indexOf(s.phase);
      if(index<0||index===PHASES.length-1) throw new Error('다음 단계가 없습니다.');
      if(s.phase==='soviet_turn' && s.observation.sovietTurnComplete!==true) throw new Error('소련군 차례 완료를 확인하세요.');
      s.phase=PHASES[index+1];
      s.decision=null;
      s.die=null;
      if(s.phase==='victory') {
        if(!s.observation.vp) throw new Error('승리 판정에 필요한 VP 관측이 없습니다.');
        s.vp=calculateS1Vp(s.observation.vp).total;
        if(s.vp>=SCENARIO.axisVictoryVp) s.winner='axis';
        else if(s.turn===SCENARIO.lastTurn) s.winner='soviet';
        s.history.push({type:'victory',turn:s.turn,vp:s.vp,winner:s.winner,ruleRefs:['S1.3']});
      }
      s.message=`${s.phase} 단계입니다.`;
      return s;
    }
    case 'next_turn':
      if(s.phase!=='victory'||s.turn>=SCENARIO.lastTurn) throw new Error('다음 턴으로 이동할 수 없습니다.');
      s.turn++;
      s.phase='initial';
      s.observation={};
      s.usedUnits=[];
      s.decision=null;
      s.die=null;
      s.message=`${s.turn}턴 시작`;
      return s;
    default: throw new Error('알 수 없는 행동');
  }
}
