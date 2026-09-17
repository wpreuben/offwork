# CDG SOLO · 나만의 전략 테이블

제공된 PDF를 따르는 **패스 오브 글로리 CDG 솔로 카드 진행 웹앱**입니다. GitHub Pages에서 서버 없이 실행합니다. 양측의 카드 선택, 운명 주사위, 6개 행동 라운드, 전투 카드 절차와 JSON 기록을 관리합니다. 지도·유닛·이벤트 선행 조건·실제 보드 효과는 사람이 기본 게임에서 해결합니다.

## GitHub Pages 배포

1. 프로젝트를 GitHub 저장소의 `main` 브랜치에 업로드합니다. `data/sessions/`는 개인 저장 파일이므로 업로드하지 않습니다 (`.gitignore` 포함).
2. 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택합니다.
3. `main`에 push하거나 **Actions → Deploy GitHub Pages → Run workflow**를 실행합니다.
4. 배포 작업에 표시되는 `https://<사용자>.github.io/<저장소>/` 주소를 엽니다.

[GitHub 공식 배포 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)를 따르는 `.github/workflows/pages.yml`이 포함되어 있습니다. Python 규칙 테스트 및 브라우저 규칙 대조 검증 후 `web/`만 정적 사이트로 게시합니다. 저장 파일·원본 작업 폴더는 배포 산출물에 포함하지 않습니다. 카드 이미지, 공식 보드·주사위, 룰북도 포함하므로 CDN이나 외부 런타임 패키지가 필요 없습니다. 기본 브랜치가 `main`이 아니면 워크플로의 브랜치 이름을 바꾸세요.

로컬 미리보기:

```bash
python3 -m http.server 8000 --directory web --bind 127.0.0.1
```

`http://localhost:8000`을 엽니다. 기존 `python3 server.py`도 화면을 제공하지만, **화면의 저장은 이제 브라우저 JSON 파일을 사용합니다**. `file://`로 직접 열기는 지원하지 않습니다.

## 플레이와 저장

1. **새 게임**에서 핸드 7/8장과 ‘8월의 포성’ 준비 여부를 고릅니다.
2. 운명 주사위를 굴리거나 공식 기호가 표시된 실물 주사위 입력 버튼을 누릅니다.
3. 금색 테두리 카드를 선택하고 기본 게임 조건을 확인한 뒤 사용합니다.
4. 실제 보드 효과, 전투 카드, 필요한 다시 섞기를 해결한 후 **효과 해결 완료**를 누릅니다.
5. 양측 6개 행동 라운드를 마치면 기본 게임의 나머지 페이즈를 해결하고 다음 턴으로 진행합니다.

확정된 선택마다 브라우저 전용 파일 저장소(OPFS)의 `<session-id>.json`을 갱신합니다. localStorage에는 마지막으로 연 게임의 ID만 보관합니다. JSON에는 전체 상태, 모든 선택과 체크포인트, 공개 LLM 문맥이 포함됩니다. 파일 쓰기를 마친 후 화면을 갱신하며, 여러 탭의 선택은 잠금과 리비전 검사로 보호합니다.

- **JSON 내보내기**: 상단의 전용 버튼으로 전체 백업을 다운로드합니다.
- **JSON 가져오기**: 백업을 별도 게임으로 복원합니다. 기존 게임을 덮어쓰지 않습니다.
- **저장된 게임**: 같은 브라우저·사이트에 저장된 게임을 다시 엽니다. 모바일에서도 상단 버튼을 사용할 수 있습니다.

자동 저장 파일은 일반 다운로드 폴더가 아닌 브라우저 내부에 있습니다. 사이트 데이터를 삭제하면 사라지므로 장기 보관과 다른 기기 이동에는 **JSON 내보내기**를 사용하세요. 브라우저·도메인·저장소 경로가 달라지면 가져오기로 옮겨야 합니다. HTTPS 또는 localhost와 OPFS 쓰기/Web Locks를 지원하는 최신 브라우저가 필요합니다. 지원하지 않는 환경에서는 저장 실패를 표시하며 저장하지 않은 선택을 진행하지 않습니다. [OPFS 설명](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

기존 Python판 `data/sessions/*.json` (schema_version 1)도 **JSON 가져오기**로 복원할 수 있습니다. 원래 파일은 그대로 유지됩니다. 서버 API의 파일 저장 구현은 호환용으로 남아 있으며 브라우저 저장과 자동 동기화하지 않습니다.

## 공식 구성품과 규칙

사용자가 제공한 `Print_n_Play_Kit-Final_2.jpg` / `_4.jpg` / `_6.jpg`를 반영했습니다. 파랑·초록 보드 위에 카드와 남은 카드·최대 핸드 마커를 표시하고, 주사위 도안의 실제 기호를 결과·수동 입력·룰북에서 사용합니다. 원본 이미지를 변경하지 않고 CSS로 표시 영역을 지정했습니다. 도안: © 2022 GMT Games, LLC. 보드 색상 배정은 앱의 진영 구분용입니다.

- C는 받기 더미 맨 위이며 ABDE와 함께 총 5개 선택 위치입니다.
- 핸드 7/8장과 진영별 6개 행동 라운드는 별개입니다.
- **마타 하리 = 동맹군 #17**, #22는 독일군 증원입니다 (2026-09-17 사용자 정정).
- 전투 이벤트 유지·재사용 등 제공된 PDF에 없는 절차는 추정으로 자동화하지 않습니다.

규칙 근거는 [docs/RULES.md](docs/RULES.md)에 있습니다.

## LLM 함께하기

**공개 상태 JSON**을 공유하고, LLM의 `{"expected_revision": 3, "action": {"type": "roll"}}` 형태 제안을 사람이 검토한 뒤 적용합니다. 비공개 카드와 덱 순서를 제외합니다. 전체 백업에는 비공개 정보가 들어 있으므로 LLM 공유에는 공개 JSON을 사용하세요. 외부 LLM 호출·API 키는 필요 없습니다.

## 개발과 검증

```bash
python3 -m unittest discover -s tests -v
python3 scripts/check_static_rules.py  # 개발 검증에 Node 22+ 필요
python3 scripts/build_static.py       # 카드 메타데이터·룰북 갱신
```

브라우저 검증: [docs/TESTING.md](docs/TESTING.md). Node·Playwright는 개발 검증용이며 배포된 앱에는 필요 없습니다.

- `web/games/paths-of-glory.js`: 정적 앱 규칙 어댑터, Python 규칙과 대조 검증
- `web/storage.js`: OPFS JSON 저장, 잠금, 리비전, 파일 가져오기/내보내기
- `web/app.js`: UI, 합법성은 어댑터에 위임
- `cdg/games/paths_of_glory.py`, `cdg/storage.py`: 기존 Python 규칙·파일 저장
- `scripts/build_static.py`, `.github/workflows/pages.yml`: 정적 산출물 및 배포
- [AGENTS.md](AGENTS.md), [docs/ADDING_GAMES.md](docs/ADDING_GAMES.md), [docs/JSON_PROTOCOL.md](docs/JSON_PROTOCOL.md): 확장·인수인계 지침
