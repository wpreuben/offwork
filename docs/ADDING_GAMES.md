# 정적 앱 확장 주의 (2026-09-18)

GitHub Pages의 실행 어댑터는 `web/games/paths-of-glory.js`이며, `web/storage.js`가 호출한다. 아래 Python 계약은 기존 서버판의 계약이다. 새 게임은 정적 JS 어댑터와 저장소 레지스트리, UI를 함께 확장해야 하며 Python 등록만으로 배포 앱에 추가되지 않는다. `scripts/check_static_rules.py`는 현재 PoG의 Python/브라우저 상태 전이를 대조한다. `web/games/pog-data.js`는 `scripts/build_static.py`로 생성한다. UI와 저장 계층에 게임 합법성을 복제하지 않는다.

# 새 CDG 솔로 게임 추가

## 공통 계약

`cdg/games/__init__.py`의 `GAMES`는 게임 ID → 어댑터 모듈이다. `engine.py`와 `storage.py`는 특정 게임의 주사위/카드 선택을 판단하지 않는다.

어댑터는 다음을 제공한다.

```python
ID: str
NAME: str
DICE: list[dict]  # 결과표 UI 메타데이터

def create(options: dict) -> dict: ...
def apply(state: dict, action: dict) -> str: ...
def validate(state: dict) -> None: ...
def public_view(state: dict) -> dict: ...
```

- `create`: `game=ID`를 포함한 JSON 직렬화 가능 상태를 반환.
- `apply`: 전달된 사본만 변경하고 메시지 반환. 불가능한 선택은 ValueError 계열로 거부. 파일/HTTP에 접근하지 않음.
- `validate`: 카드 보존, 숫자 범위, 게임별 단계 불변조건 검사.
- `public_view`: 비공개 카드 정체/덱 순서를 지우고 `available_actions` 포함.
- `available_actions`: 현재 제출 가능한 행동 JSON. 사람이 확인할 기본 게임 조건은 명시적 attestation 필드로 제공.

## 추가 순서

1. 새 게임의 PDF/플레이시트를 보관하고 추출 텍스트 및 출처 표를 작성한다. 공통 규칙보다 플레이시트가 우선한다. 불일치는 조용히 덮어쓰지 않는다.
2. 새 `cdg/games/<game>.py`와 카드 카탈로그를 만든다. PoG의 `card/fill`을 그대로 복사하지 말고 **싱글 덱/듀얼 덱**부터 확인한다.
3. 게임 ID를 레지스트리에 등록한다.
4. 준비, 6가지 주사위, 고갈, 받기 페이즈, 게임별 수정에 대해 테스트한다.
5. UI/카탈로그 엔드포인트를 게임 ID별로 선택하도록 확장한다. 현재 `/api/catalog`와 `web/app.js`의 진영·6라운드·턴 UI는 PoG 전용이다. 신규 게임은 자체 렌더러를 만들거나 표시용 메타데이터 계약을 확장한다.
6. 저장·LLM 프로토콜의 외부 형태는 보존한다. 새로운 행동도 `/actions` 한 경로로 보내고 리비전 검증을 통과시킨다.
7. `schema_version`이 바뀌면 기존 세션의 마이그레이션 또는 호환 로더를 작성한다. 기존 게임/사용자 세션을 덮어쓰지 않는다.
8. README, RULES 문서와 UI 지원 게임 목록을 갱신한다.

## 재사용할 것

원자적 JSON 저장, 체크포인트, 리비전 충돌, 공개 상태 내보내기, LLM 제안 검토, 로그와 메모는 공통으로 사용한다. 현재 게임의 7/8장 핸드, 6행동, CP/AP, C=덱, 마타 하리 정정은 다른 게임의 공통 규칙으로 끌어올리지 않는다.
