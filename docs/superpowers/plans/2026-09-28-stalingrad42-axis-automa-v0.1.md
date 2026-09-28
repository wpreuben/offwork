# Stalingrad ’42 추축군 오토마 0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S1 Fall Blau에서 사람이 소련군을 맡고 추축군을 운영할 수 있는 종이 순서도와 웹 헬퍼를 제공한다.

**Architecture:** 독립적인 정적 앱 `web/stalingrad42/`에 규칙 근거 데이터, 순수 결정 엔진, 턴 상태 전이, 인쇄 화면, 진행 화면, 게임 전용 JSON 저장소를 둔다. 종이판과 웹판은 같은 정책 ID·목표 목록·난이도 값을 읽고, 사람은 실제 보드에서 헥스별 합법성과 주사위 결과를 확인한다.

**Tech Stack:** 바닐라 HTML/CSS/JavaScript, Node 22 내장 테스트, GitHub Pages, 브라우저 OPFS·Web Locks. 제품 의존성은 추가하지 않는다.

**Spec:** `docs/superpowers/specs/2026-09-28-stalingrad42-axis-automa-design.md`

## Global Constraints

- 영문 `Stal42_RULES-2025-Final_LoRes.pdf` v2.1과 S1.1~S1.3을 판정 기준으로 삼는다. 한글 v2.0은 화면 용어에만 사용한다.
- S1은 지도 A, 1~8턴, 추축군 선행이며 8턴까지 추축군이 8VP 이상을 얻어야 한다. 일반 자동 승리 기준을 S1에 적용하지 않는다.
- 실제 헥스별 이동·전투의 합법성과 CRT 해결은 사람이 실물 보드에서 확인한다. 앱은 미확인 후보를 추천하지 않는다.
- 난이도는 입문·표준·어려움이며 소련군 플레이어 승률 70%·50%·35%는 향후 측정 목표다. 원 게임의 유닛·VP·주사위 규칙을 변경하지 않는다.
- 게임 기록은 독립된 OPFS JSON 파일에 저장한다. 기존 PoG·Combat Commander 저장소와 규칙 코드는 건드리지 않는다.
- 제품 페이지에 원본 규칙 PDF·지도·Vassal 이미지를 복사하지 않는다. 브랜치 작업 중 `main`의 Pages 배포를 실행하지 않는다.

## Review Focus

1. 후보의 합법성·보급·포위 입력이 빠진 경우 추천을 중단하고 필요한 질문을 표시하는가? Task 2 테스트.
2. S1의 고립된 미점령 VP, 두 출구의 5 기계화 스텝·도로 보급, Don강 보너스를 중복 없이 세는가? Task 1·3 테스트.
3. 턴 1의 전투 유닛 전술 이동 및 1기갑군 제한이 일반 이동 후보보다 먼저 적용되는가? Task 3 테스트.
4. 한 유닛을 같은 이동 단계에서 두 번 지시하거나, 취소 후 기록을 잘못 유지하지 않는가? Task 3·5 테스트.
5. 다른 탭의 저장 충돌이나 지원되지 않는 OPFS 환경에서 성공 기록을 표시하지 않고 JSON을 보존하는가? Task 5 테스트.

---

## File map

- `docs/stalingrad42/SOURCES.md`: 영문 규칙 번호, S1 예외, 지도 목표 전사 근거, 참조 봇에서 채택한 구조를 기록한다.
- `web/stalingrad42/catalog.js`: S1 목표·승점·첫 턴 제약·규칙 참조를 한 곳에서 제공한다.
- `web/stalingrad42/policy.js`: 세 난이도의 실험값, `FLOW` 분기 그래프와 점수표를 제공한다. 인쇄 화면과 결정 엔진이 공유한다.
- `web/stalingrad42/engine.js`: 필수 관측값 검증, 후보 필터·점수, 선택 이유와 탈락 이유를 산출한다.
- `web/stalingrad42/session.js`: 초기화, 페이즈 전이, 확정·취소, VP 계산, 게임 종료를 처리한다.
- `web/stalingrad42/paper.html`, `paper.js`, `print.css`: 인쇄용 순서도와 참조표를 표시한다.
- `web/stalingrad42/index.html`, `app.js`, `style.css`: 단계별 질문, 결과·근거, 기록과 접근성 있는 조작을 표시한다.
- `web/stalingrad42/storage.js`: 게임 전용 OPFS JSON 저장, 검증, 내보내기·가져오기를 처리한다.
- `tests/stalingrad42-catalog.test.mjs`, `stalingrad42-engine.test.mjs`, `stalingrad42-session.test.mjs`, `stalingrad42-storage.test.mjs`: 사용자에게 영향을 주는 규칙·상태·저장 실패 사례를 검증한다.
- `web/index.html`, `.github/workflows/pages.yml`: 마지막 통합 단계에서만 새 게임 링크와 테스트 실행을 추가한다.

### Task 1: S1 근거표와 목표 목록

**Files:** Create `docs/stalingrad42/SOURCES.md`, `web/stalingrad42/catalog.js`, `tests/stalingrad42-catalog.test.mjs`.

**Interfaces:** `SCENARIO`는 `{id:'s1', firstTurn:1, lastTurn:8, axisVictoryVp:8, map:'A'}`다. `TARGETS`는 고유 ID, 표시 이름, 종류(`vp_hex|east_exit|south_exit|don_bonus`), VP, 근거 규칙, 지도 헥스 또는 출구를 가진 배열이다. `calculateS1Vp(observation)`은 `{total, entries}`를 반환한다. `observation`은 `controlledVpHexes:[{id,supplied}]`, `isolatedSovietVpHexes:[id]`, `eastExit:{mechanizedSteps,sameMovementPhase,roadSupply}`, `southExit:{mechanizedSteps,sameMovementPhase,roadSupply}`, `donSouthGermanCombatUnit:boolean`을 가진다.

- [ ] **Step 1:** `/home/pc/project/Stalingrad42_automa/`의 영문 규칙 3.0, 5~16, 18, 21~24, S1.1~S1.3과 지도 A·Vassal S1을 대조해 `SOURCES.md`에 목표·승점·예외의 근거를 기록한다. 한국어 번역과 불일치는 따로 적는다.
- [ ] **Step 2:** `stalingrad42-catalog.test.mjs`에 `scenario_is_eight_turns_and_eight_vp`, `s1_target_ids_are_unique`, `isolated_uncaptured_vp_counts_once`, `exits_require_five_steps_same_phase_and_road_supply`, `don_bonus_adds_one`을 실패 테스트로 추가한다. 두 출구 조건과 Don 조건이 모두 참이면 추가 VP는 정확히 5다.
- [ ] **Step 3:** `node --test tests/stalingrad42-catalog.test.mjs`를 실행해 실패를 확인한다.
- [ ] **Step 4:** `catalog.js`에 `SCENARIO`, `TARGETS`, `calculateS1Vp(observation)`을 구현한다. 목표 목록의 VP·헥스는 원본 지도와 S1.3에 맞춰 전사하고 서로 다른 근거를 섞지 않는다.
- [ ] **Step 5:** 같은 테스트를 통과시키고 `git add docs/stalingrad42/SOURCES.md web/stalingrad42/catalog.js tests/stalingrad42-catalog.test.mjs && git commit -m 'Add Stalingrad 42 S1 source catalog'`로 커밋한다.

### Task 2: 안전 검사와 목표 결정

**Files:** Create `web/stalingrad42/policy.js`, `web/stalingrad42/engine.js`, `tests/stalingrad42-engine.test.mjs`.

**Interfaces:** `PROFILES`는 `beginner|standard|hard`의 단계별 목표 가치, VP 부족 가중치, 공격 위험 한도, 예비 병력, 동률 d6 범위를 제공한다. `FLOW`는 정책 ID별 필수 질문·예/아니요 경로·규칙 참조·대체 행동을 가진 분기 그래프다. `evaluateCandidates({turn,vp,profile,candidates,die})`는 `FLOW`와 점수표를 사용해 `{selected,rejected,questions,policyIds,ruleRefs}`를 반환한다. 각 후보는 목표 ID, 편제 ID, 합법 확인, 보급·포위·공격 관측, 사용할 병력과 남길 예비 병력을 포함한다.

- [ ] **Step 1:** `missing_safety_answers_returns_questions_without_selection`, `out_of_supply_or_encircled_candidate_is_rejected`, `attack_below_policy_floor_is_rejected`, `vp_shortfall_raises_reachable_objective_priority`, `same_die_repeats_same_tie_result`, `no_candidates_selects_fallback`을 실패 테스트로 작성한다. 선택·탈락 결과의 정책 ID와 영문 규칙 번호도 단언한다.
- [ ] **Step 2:** `node --test tests/stalingrad42-engine.test.mjs` 실패를 확인한다.
- [ ] **Step 3:** `policy.js`에 버전 `0.1.0`과 세 프로필의 실험값, 목표→안전→행동→대체의 `FLOW`와 점수표를 선언한다. `engine.js`에 `evaluateCandidates`와 필수 입력 검사를 구현한다. 안전 탈락은 점수보다 앞서고, 같은 후보가 반복 선택되는 문제는 동등 후보 범위 안에서만 d6로 풀어낸다.
- [ ] **Step 4:** 테스트를 통과시키고 테스트 데이터에 대해 선택·탈락 근거가 모두 정책 ID를 가지는지 확인한다.
- [ ] **Step 5:** 두 파일과 테스트를 커밋한다.

### Task 3: 추축군 턴 진행과 S1 예외

**Files:** Create `web/stalingrad42/session.js`, `tests/stalingrad42-session.test.mjs`.

**Interfaces:** `createSession({difficulty})`은 스키마 버전 1, S1, 정책 버전, 턴 1, `phase:'initial'`, `winner:null`, 빈 이력을 반환한다. `applySession(state, action)`은 입력 상태를 변경하지 않고 새 상태·사용자 안내를 반환한다. 페이즈는 `initial|movement|combat|recovery|supply|soviet_turn|victory`다. 액션은 `observe|decide|confirm|reject|undo|next_phase|next_turn`이고, 확정마다 정책 ID·규칙 번호·관측·d6를 이력에 남긴다. `winner`는 `null|'axis'|'soviet'`다.

- [ ] **Step 1:** `phases_wait_for_human_soviet_turn`, `turn_one_limits_combat_units_to_two_hexes_and_frozen_panzer_units`, `one_unit_moves_once_per_phase`, `undo_restores_last_confirmed_state`, `axis_wins_at_any_victory_phase_with_eight_vp`, `soviet_wins_at_turn_eight_below_eight_vp`를 실패 테스트로 작성한다. 각 테스트는 반환 상태의 `phase`, `turn`, `winner`, `history`를 확인한다.
- [ ] **Step 2:** `node --test tests/stalingrad42-session.test.mjs` 실패를 확인한다.
- [ ] **Step 3:** `createSession`과 `applySession`을 구현한다. 공격 적격성 확인과 실제 전투 결과 입력을 분리하고, 행동 실패는 다음 후보 또는 보급 회복·재편·방어 준비로 이어지게 한다.
- [ ] **Step 4:** 테스트를 통과시키고 Task 1·2의 테스트도 함께 실행한다.
- [ ] **Step 5:** 파일과 테스트를 커밋한다.

### Task 4: 인쇄용 종이 순서도

**Files:** Create `web/stalingrad42/paper.html`, `paper.js`, `print.css`.

**Interfaces:** `renderPaper({scenario,targets,policy})`는 `FLOW`의 정책 ID·질문·예/아니요 경로·동률 처리·불가능한 행동의 다음 경로·출처를 HTML에 그린다. Task 1·2의 데이터를 직접 import한다.

- [ ] **Step 1:** S1 턴과 보급/포위/공격/대체 절차를 인쇄물에서 손가락으로 추적하는 사례 3개를 작성해 `docs/stalingrad42/SOURCES.md`에 기대 경로와 정책 ID를 기록한다.
- [ ] **Step 2:** `paper.html`·`paper.js`·`print.css`로 한글 인쇄 화면을 만든다. 영문 규칙 번호와 오토마 정책 ID를 구분해 표기하고, A4 인쇄에서 질문·분기·참조표가 끊기지 않게 한다.
- [ ] **Step 3:** 로컬 HTTP 서버에서 인쇄 미리보기로 시작 상태, 승점 압박, 위험 후보 탈락 사례를 직접 따라가 결과가 Task 2 엔진과 일치하는지 확인한다.
- [ ] **Step 4:** 인쇄 화면을 커밋한다.

### Task 5: 웹 진행 화면과 분리된 JSON 저장

**Files:** Create `web/stalingrad42/index.html`, `app.js`, `style.css`, `storage.js`, `tests/stalingrad42-storage.test.mjs`.

**Interfaces:** `JsonStore.open()`은 게임 경로별 OPFS 디렉터리와 Web Lock을 열고, `read(id)`, `write(state,history,id,expectedRevision)`, `listing()`을 제공한다. `validateRecord(record)`는 앱 ID·스키마·세션 상태를 검사한다. 앱 식별자는 `STAL42-AXIS-0.1`, 저장 스키마는 1이며 다른 게임의 저장 ID를 받아들이지 않는다. 앱은 `applySession`을 거친 확정 결과만 저장한다.

- [ ] **Step 1:** `rejects_foreign_app_and_invalid_schema`, `rejects_stale_expected_revision`, `failed_write_does_not_report_success`, `import_creates_new_id`를 실패 테스트로 작성하고 실행한다. Node 테스트에는 주입 가능한 가짜 디렉터리·잠금 객체를 사용하고, 실제 OPFS는 브라우저에서 점검한다.
- [ ] **Step 2:** `storage.js`를 구현하고 독립 저장 디렉터리, Web Locks, 파일 close 뒤 성공 응답, JSON 내보내기·가져오기를 추가한다. 가져오기는 새 ID로 저장한다.
- [ ] **Step 3:** 테스트를 통과시키고, `index.html`·`app.js`·`style.css`에 턴·페이즈, 한 번에 한 질문, 선택 이유·규칙 번호, 이전 단계·거절·취소, 기록, 난이도, 인쇄 링크를 구현한다.
- [ ] **Step 4:** 브라우저에서 OPFS 신규/재개/내보내기/가져오기/충돌과 키보드 조작을 점검한다. 저장 미지원 환경에는 오류를 표시하고 확정 성공을 표시하지 않는다.
- [ ] **Step 5:** UI·저장 파일과 테스트를 커밋한다.

### Task 6: 기존 사이트 통합과 회귀 검증

**Files:** Modify `web/index.html`, `.github/workflows/pages.yml`; Create `docs/stalingrad42/TEST_LOG.md`.

**Interfaces:** 기존 허브의 두 게임 링크와 저장 기록은 유지하고, 새 링크는 `./stalingrad42/`를 가리킨다. Pages CI는 기존 게이트 뒤에 `node --test tests/stalingrad42-*.test.mjs`를 실행한다.

- [ ] **Step 1:** 허브에 세 번째 게임 링크를 추가하고 CI에 새 테스트 명령을 추가한다. 원본 PDF·지도 이미지는 `web/`에 복사하지 않는다.
- [ ] **Step 2:** `python3 -m unittest discover -s tests -v`, `python3 scripts/build_cc_glossary.py --check`, `python3 scripts/check_static_rules.py`, `node tests/physical-pog.mjs`, `node --test tests/stalingrad42-*.test.mjs`, `python3 scripts/build_static.py _site`를 실행한다. 모두 성공해야 한다.
- [ ] **Step 3:** 산출물에 새 경로가 있고 기존 두 경로가 그대로 있으며 게임별 저장 ID가 분리되는지 확인한다. `TEST_LOG.md`에 시나리오·정책 버전·난이도·플레이어 숙련도·승패와 자살수/목표 일관성/포위·보급 대응/공격성/반복성/역이용 가능성 사례 칸을 만든다. 승률 목표는 아직 측정하지 않았다고 명시한다.
- [ ] **Step 4:** `git diff --check`와 `git status --short`를 확인하고 통합 변경을 커밋한다. 결과 브랜치를 검토 가능한 상태로 제공한다.
