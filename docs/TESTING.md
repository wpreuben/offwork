# 검증

## 규칙·기존 서버 저장

```bash
python3 -m unittest discover -s tests -v
```

Python 표준 라이브러리만 사용합니다. 임시 디렉터리에서 카드 보존, 6가지 주사위, 추가 공개, 보충, 6행동, 7/8장 핸드, 전투·고갈·셔플, 마타 하리 #17, 공개 정보, 원자적 저장 실패 및 오래된 리비전을 확인합니다. 플레이 파일을 변경하지 않습니다.

## 정적 앱 규칙 대조

```bash
python3 scripts/check_static_rules.py
```

Node 22 이상이 개발 검증에 필요합니다 (`NODE=/path/to/node` 지정 가능). 기존 Python 규칙 테스트에서 발생하는 상태 전이를 캡처하고 JS 어댑터에 그대로 재생합니다. 난수를 고정하여 전체 상태·메시지·합법 후보·공개 상태가 동일한지 확인하고, 거부한 행동 및 입력 사본의 보존을 검사합니다. 준비 7/8장·포성 여부 조합도 검사합니다. GitHub Pages 배포 워크플로가 이 검증을 수행합니다.

## 정적 브라우저 검증

```bash
python3 -m venv /tmp/cdg-test-venv
/tmp/cdg-test-venv/bin/pip install playwright
/tmp/cdg-test-venv/bin/python -m playwright install chromium
/tmp/cdg-test-venv/bin/python scripts/browser_smoke.py
```

환경에 따라 Chromium 라이브러리와 한국어 폰트가 필요합니다. Playwright는 개발 검증용이며 앱 런타임 의존성이 아닙니다. 테스트는 임시 디렉터리로 `web/`을 복사하여 **일반 정적 HTTP 서버의 `/repo/` 하위 경로**에서 실행합니다. 실사용 브라우저/저장 폴더를 사용하지 않습니다.

검증 항목:

- 새 게임 → 강제 포성 이벤트 → 해결 → 실물 주사위 기호 입력 → 카드 사용 → 메모.
- OPFS의 실제 JSON 파일과 내보낸 전체 백업 일치, 새로고침 복원.
- LLM 공개 JSON 다운로드, 사람의 제안 검토/적용, 비공개 덱 제외.
- 전용 JSON 가져오기/내보내기, 전체 상태·체크포인트 일치, 기존 세션 보존.
- 공개 JSON·잘못된 버전·마타 하리 잘못된 번호 가져오기 거부.
- 두 탭에서 오래된 리비전 거부와 화면 갱신.
- 파일 스트림 쓰기 실패 시 기존 파일·리비전·기록 보존.
- Python Store가 생성한 기존 schema_version 1 백업 가져오기.
- localStorage가 차단되어도 JSON 파일 목록에서 복원.
- 공식 이미지·PDF 링크 정상, HTTP API 요청 없음, `/repo/` 상대 경로 정상.
- 데스크톱 1440px, 모바일 390px 가로 넘침 없음. 모바일 파일 버튼 접근 가능.

스크린샷: `/tmp/cdg-welcome.png`, `/tmp/cdg-table.png`, `/tmp/cdg-mobile.png`.

## 배포 산출물

```bash
python3 scripts/build_static.py /tmp/cdg-pages-artifact
```

목적지는 아직 없는 디렉터리를 지정합니다. 카드 카탈로그/주사위 표를 Python 데이터에서 생성하고 PDF를 복사한 후 `web/`만 포함합니다. `data/sessions`, Python 서버, 작업 원본은 게시되지 않습니다. GitHub Pages 실제 게시에는 저장소와 Pages 설정이 필요합니다.

## 카드 재생성 (필요할 때만)

```bash
python3 -m pip install Pillow
python3 scripts/build_cards.py
python3 scripts/build_static.py
```

원본을 보존하며 카드 번호·OPS·CC·단계를 대조합니다. 마타 하리는 cp-17이며 cp-22는 독일군 증원입니다. 공식 보드/주사위 자료는 `web/assets/official/`의 원본 사본을 CSS로 표시하므로 별도의 이미지 재생성 도구가 필요 없습니다.

## 확인 결과 (2026-09-18)

- Python 규칙·저장 테스트 31개 통과.
- Python/정적 JS 상태 전이 243건 및 준비 4개 조합 대조 통과.
- Chromium의 정적 `/repo/` 경로에서 위 브라우저 시나리오 전체 통과.
- 배포 산출물에 카드 110장, 공식 구성품 이미지 3장, PDF 2개 포함; 개인 저장 파일 제외 확인.
- 공식 구성품 사본은 제공된 원본과 바이트 단위로 일치.
- GitHub 원격 저장소 및 실제 Pages 게시는 현재 작업 환경에 연결되어 있지 않아 실행하지 않음.
