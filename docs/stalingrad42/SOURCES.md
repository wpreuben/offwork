# Stalingrad ’42 추축군 오토마 0.1 근거표

판정 기준은 `Stal42_RULES-2025-Final_LoRes.pdf` 영문 v2.1(2025년 4월)이다. 한국어 v2.0은 화면 용어에만 쓴다. 시나리오 특수 규칙 S1.1–S1.3이 일반 규칙보다 우선한다. Vassal `Stalingrad42_v203`은 지도 목표 확인 자료다. 제작사 GMT에 게시된 영문 PDF와 로컬 PDF의 SHA-256이 같다.

| 항목 | 근거 | 0.1 처리 |
| --- | --- | --- |
| S1 Fall Blau, 지도 A, 1–8턴, 추축군 선행 | S1.1–S1.2 | 소련군 차례는 사람이 진행 |
| 8VP 승리 | S1.3 | 매 승리 판정 단계에서 확인; 8턴 말 미달이면 소련군 승리 |
| 지도 VP 목표와 고립된 미점령 VP | 지도 A 빨간 VP 기호, S1.3 | 같은 VP 헥스는 한 번만 계상 |
| 동쪽·남쪽 출구 | S1.3 | 각각 기계화 5스텝과 도로 보급 조건 충족 시 2VP; 일반 24.1.2의 동일 이동 단계 요건은 적용하지 않음 |
| Don강 남쪽 | S1.3 | 독일 전투 유닛이 조건을 만족하면 1VP |
| 첫 턴 제한 | S1.2 | 전투 유닛 전술 이동 최대 2헥스; 14Pz·22Pz·60PzG 이동·공격 금지 |
| 이동·ZOC | 5–8 | 실제 헥스 경로와 적법성은 플레이어가 확인 |
| 전투·손실 | 9–16 | 예상 공격 적격성과 실제 CRT 해결을 분리 |
| 회복·보급 | 18, 21–23 | 단절·포위 위험을 점수보다 먼저 검사 |
| 승리 | 24, S1.3 | S1 예외를 우선 적용 |

## 지도 A VP 기호 전사

Usman 1, 3301 철도 목표 1, Voronezh 2, Borisoglebsk 1, Stary Oskol 1, Svoboda 1, Valuyki 1, Millerovo 1, Voroshilovgrad 1, Morozovsk 1, Shakhty 1, Rostov 2, Salsk 1. 좌표 숫자가 기호에 겹친 곳은 장소 이름을 고유 ID로 삼는다. 종이 테스트에서 원본 지도와 목표 이름을 다시 대조한다. 지도·룰북 원본은 웹 배포물에 넣지 않는다.

## 참조 오토마에서 가져온 구조

Erasmus의 전황→목표→병력 순서, Enemy Action: Kharkov의 위험 우선 검사, Enemy Action: Ardennes Allied/German Solo의 편제별 목표와 실패 대체 경로, Europa Universalis 봇의 공통 선택 규칙과 난이도 매개변수를 참고했다. 다른 게임의 전투 수치나 승리 규칙은 사용하지 않는다.

## 종이판 추적 사례

1. 2턴, 0VP, Voronezh 접근 후보가 합법·보급·포위 안전·예비 병력 충족이라면 `START → GOAL-VP → SAFE-INPUT → SAFE-LEGAL → SAFE-SUPPLY → SAFE-ENCIRCLE → SAFE-RESERVE → ACT-ATTACK → CHOOSE → CONFIRM`이다. 실제 헥스 이동은 영문 5–8에 따라 확인한다.
2. 7턴, 3VP, Rostov 접근 후보가 보급 단절이라면 `SAFE-SUPPLY → NEXT`. 다른 후보가 없으면 `FALLBACK`의 보급 회복을 검토한다. 높은 VP 가치도 안전 탈락을 뒤집지 않는다.
3. 공격 후보의 예상 비율이 선택한 난이도 기준보다 낮으면 `ACT-ATTACK → NEXT`. 다른 후보가 없다면 보급 회복→재편→방어 준비 순으로 실제 가능한 행동을 찾는다. 전투 적격성 확인과 영문 9–16의 실제 CRT 해결은 별도다.
