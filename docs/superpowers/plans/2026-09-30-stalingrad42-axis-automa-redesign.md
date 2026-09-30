# Stalingrad ’42 Axis Automa Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** S1의 추축군 선택을 종이 순서도와 웹 헬퍼가 동일하게 안내한다.

**Architecture:** 시나리오 장부와 영어 규칙 절차, 선언적 작전·전술 정책, 게임 기록을 분리한다. 종이판은 정책 데이터에서 만들어지고 웹은 같은 데이터를 실행한다.

**Tech Stack:** 바닐라 ES modules, HTML/CSS, Node 22 테스트, OPFS JSON, 기존 Python 정적 빌드.

**Spec:** `docs/superpowers/specs/2026-09-30-stalingrad42-axis-automa-redesign.md`

## Global Constraints

- S1 Fall Blau, 지도 A, 영문 v2.1 우선, 한국어 표시.
- 사람은 소련군을 플레이한다. 추축군 판단은 종이 순서도에서 독립적으로 따라갈 수 있어야 한다.
- 기존 offwork 게임 및 저장소와 경로/저장 영역을 분리한다.
- 난이도 목표 승률은 미측정 상태로 표기한다.

## Review Focus

- 현재 VP를 이미 얻은 목표와 다시 얻을 수 있는 목표를 구분한다.
- 24.1.4 감점 해소·위협이 일반 1VP 목표보다 앞설 수 있다.
- 출구 목표는 5 기계화 스텝과 도로 보급을 함께 확인한다.
- 소련군 차례 중 추축군 방어 선택을 사람이 임의로 하지 않는다.
- 인쇄물과 웹의 모든 분기·동률·실패 대체가 같다.

## Task 1: 규칙 절차와 작전 목표

**Files:** `web/stalingrad42/doctrine.js`, `engine.js`, `policy.js`, `tests/stalingrad42-doctrine.test.mjs`, `docs/stalingrad42/SOURCES.md`.

- [ ] 영문 3.0·13.4·16.1·S1.3과 감점·출구·보급 위협에 대한 실패 테스트를 작성한다.
- [ ] 테스트가 실제로 실패하는 것을 확인한다.
- [ ] v0.1 전역 점수식을 대체할 작전 우선순위와 목표 지속 조건을 구현한다.
- [ ] 규칙 단계 체크리스트와 참조 번호를 고친다.
- [ ] 해당 테스트 및 기존 규칙 테스트를 실행한다.

## Task 2: 전술과 추축군 방어

**Files:** `web/stalingrad42/procedures.js`, `engine.js`, `tests/stalingrad42-procedures.test.mjs`.

- [ ] 이동·공격·방어·손실·퇴각의 판면 사례 실패 테스트를 작성하고 실패를 확인한다.
- [ ] 규칙상 가능한 첫 행동을 순서대로 찾는 선언적 절차를 구현한다.
- [ ] 반격·보급·포위 위험과 불가능한 행동의 대체 경로를 검증한다.
- [ ] 결정 이유와 정책/규칙 ID가 모든 결과에 남는지 확인한다.

## Task 3: 종이판과 웹판의 정책 공유

**Files:** `web/stalingrad42/paper.js`, `paper.html`, `print.css`, `tests/stalingrad42-paper.test.mjs`.

- [ ] 판면 사례를 종이 분기와 웹 평가기로 추적하는 실패 테스트를 작성한다.
- [ ] 정책 데이터에서 인쇄용 작전·행동 순서도와 장부를 생성한다.
- [ ] A4에서 절차와 대체 경로가 끊기지 않도록 브라우저 인쇄 검사를 한다.

## Task 4: 웹 헬퍼와 버전 2 기록

**Files:** `web/stalingrad42/app.js`, `session.js`, `storage.js`, `index.html`, `style.css`, `tests/stalingrad42-session.test.mjs`, `tests/stalingrad42-storage.test.mjs`, `tests/stalingrad42-ui.test.mjs`.

- [ ] 목표 장부 변경, 결정 재개, 소련군 차례 방어, 기록 내보내기의 실패 테스트를 작성한다.
- [ ] 입력을 최소화한 단계별 화면과 정책 결정 설명을 구현한다.
- [ ] 버전 2 JSON을 별도 OPFS 영역에 저장하고 v0.1 기록을 삭제하지 않는다.
- [ ] 새로고침·내보내기·가져오기·다른 탭 충돌을 확인한다.

## Task 5: 통합 검증과 배포

**Files:** `docs/stalingrad42/TEST_LOG.md`, `.github/workflows/pages.yml` 필요 시.

- [ ] 오토마 15개 판면 사례와 종이·웹 결정 일치를 검사한다.
- [ ] Stalingrad ’42 및 기존 앱 테스트, 정적 빌드, 브라우저 사용 흐름을 확인한다.
- [ ] 기존 페이지에 영향을 주지 않는지 확인한 후 `main`에 병합·배포하고 공개 주소를 검증한다.
