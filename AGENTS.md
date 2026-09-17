# 다음 Codex를 위한 작업 지침

## 목적과 사용자 결정

이 프로젝트는 제공된 CDG 솔로 PDF를 따르는 GitHub Pages 정적 웹앱이다 (2026-09-18 사용자 결정). 현재 게임은 패스 오브 글로리이며, 다른 CDG 솔로 게임을 나중에 추가한다. **확정된 모든 게임 선택은 실제 JSON 파일에 저장되어야 한다.** 브라우저 localStorage만으로 대체하지 않는다.

2026-09-17 사용자가 명시적으로 확인한 정정: **마타 하리 = 동맹군 #17 (카드 이미지 기준)**. 제공된 PDF에 쓰인 #22로 되돌리지 않는다. `cp-22`는 원본 카드 이미지의 독일군 증원이다.

## 먼저 읽을 파일 (PDF를 매번 재추출하지 말 것)

1. `docs/RULES.md`, `docs/rules/common.txt`, `docs/rules/paths-of-glory.txt`
2. `docs/ADDING_GAMES.md`, `docs/JSON_PROTOCOL.md`
3. 변경하려는 규칙의 기존 테스트

원문 PDF는 `images/`에 있다. 추출 텍스트는 원문을 고치지 않고 보존한다. 새 정정은 RULES.md에 출처와 사용자 결정을 남긴다.

## 구조와 불변조건

- `web/games/paths-of-glory.js`: 정적 앱 게임 규칙. `scripts/check_static_rules.py`로 Python판과 상태 전이를 대조한다.
- `web/storage.js`: 브라우저 전용 파일 저장소(OPFS)의 실제 JSON 파일에 저장. Web Locks + 리비전 검사 + 파일 close 후 성공 응답. localStorage는 세션 ID만 사용한다.
- `cdg/games/paths_of_glory.py`: 기존 Python 게임 규칙. UI나 HTTP 핸들러에 합법성 판정을 중복 구현하지 않는다.
- `cdg/engine.py`: 게임 어댑터 선택과 사본에 대한 상태 전이.
- `cdg/storage.py`: 성공한 전이만 저장. 리비전 검사 + 스레드 잠금 + fsync + os.replace를 보존한다.
- C는 `deck[0]`이다. `slots`에는 A/B/D/E만 있다. C용 카드를 별도로 뽑아 6장을 만들지 않는다.
- `faces`는 빈 슬롯의 이전 면 상태를 기억한다. 주사위 2~6의 보충에서 이를 보존한다.
- 전체 카드 = 덱 + 디스플레이 + 버림 + 제거. 중복/유실을 `validate()`로 거부한다.
- 7/8장 핸드와 진영별 6개 행동 라운드를 혼동하지 않는다.
- 게임 효과 해결/카드 문구의 다시 섞기 **후** 슬롯 보충을 한다.
- 비공개 덱과 뒷면 카드 ID를 HTTP 일반 상태나 LLM 공유 상태에 추가하지 않는다. 전체 백업 API는 의도적으로 비공개 정보도 포함한다.
- LLM 선택은 사람 검토 후 동일 액션 API로 처리한다. LLM이 저장 JSON을 직접 편집하게 하지 않는다.
- 보드게임 전체 엔진을 구현했다고 설명하지 않는다. 선행 조건과 실제 보드 효과는 사람이 확인한다.
- PDF에 없는 세부 처리(전투 이벤트 유지 등)는 `docs/RULES.md`의 구현 경계를 읽고, 추정으로 범위를 넓히지 않는다.

## 실행과 검증

실행: `python3 -m http.server 8000 --directory web --bind 127.0.0.1` → `http://localhost:8000`. 배포는 `.github/workflows/pages.yml`로 `web/`만 게시한다. 기존 `python3 server.py`도 화면을 제공하지만 UI는 OPFS에 저장하며 기존 서버 JSON과 동기화하지 않는다. Python 표준 라이브러리와 바닐라 HTML/CSS/JS를 사용한다. 런타임 의존성을 불필요하게 추가하지 않는다.

규칙 또는 저장 변경: `python3 -m unittest discover -s tests -v` 및 `python3 scripts/check_static_rules.py` (Node 22+). OPFS 저장·가져오기는 브라우저 테스트도 실행한다.
UI 변경: `docs/TESTING.md`에 설명된 브라우저 검증을 활용한다. 플레이 파일 대신 임시 세션을 사용한다.
카드 이미지 재생성은 선택 사항이며 Pillow가 필요하다. 번호·OPS·CC·단계를 원본과 대조한다.

## 후속 확장

새 게임은 `docs/ADDING_GAMES.md`를 따른다. 현재 UI에는 패스 오브 글로리 전용 화면이 있으므로 새 어댑터를 레지스트리에 등록하는 것만으로 UI 확장이 완료되었다고 가정하지 않는다. 데이터 스키마를 바꾸면 schema_version과 마이그레이션을 함께 고려한다.

## 2026-09-18 구성품·배포 결정

- 사용자 제공 공식 `Print_n_Play_Kit-Final_2.jpg`, `_4.jpg`, `_6.jpg`: 파랑/초록 디스플레이와 주사위/마커. `web/assets/official/`의 원본 사본을 CSS로 표시한다. AI로 도안을 다시 그리지 않는다.
- 상단 JSON 내보내기/가져오기 버튼으로 백업·복원. 가져오기는 새 ID로 저장하며 기존 세션을 덮어쓰지 않는다. schema_version 1의 Python 백업 호환을 보존한다.
- 자동 저장은 브라우저 내부 파일이다. 사이트 데이터 삭제·다른 기기 이동에는 JSON 내보내기가 필요함을 UI/문서에 명시한다.
- 개인 `data/sessions/`를 GitHub 또는 Pages 산출물에 포함하지 않는다.
