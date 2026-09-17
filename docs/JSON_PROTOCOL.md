# JSON 저장 및 LLM 행동 프로토콜 (schema_version 1)

## GitHub Pages / 정적 UI (2026-09-18)

기본 UI는 `web/storage.js`를 통해 브라우저 전용 파일 저장소(OPFS)의 `<id>.json`을 저장한다. 사이트 경로별 디렉터리로 분리한다. 아래 schema_version 1 구조를 그대로 사용하며, 매 선택은 Web Locks 잠금 안에서 최신 리비전 확인 → 사본 상태 전이/검증 → `createWritable`/write/close 완료 후 성공 처리한다. localStorage에는 마지막 세션 ID만 저장한다. 사이트 데이터 삭제 시 파일도 지워지므로 전용 **JSON 내보내기** 버튼으로 백업한다.

**JSON 가져오기**는 버전, 카드 보존, 진행 상태, 체크포인트를 검증하고 새 ID의 별도 세션으로 저장한다. 기존 Python판 전체 백업과 호환된다. 공개 LLM JSON은 복구 파일이 아니므로 거부한다. `llm_context`는 가져온 값 대신 현재 상태에서 재계산한다.

정적 UI의 `/api/...` 문자열은 `FileStore.request` 내부 계약 이름이며 실제 HTTP 요청이 아니다. 서버/네트워크 없이 같은 액션 계약을 처리한다. 일반 UI 응답/LLM 공유에는 숨겨진 정보를 제외하며 전체 JSON 내보내기에만 포함한다.

## 기존 Python 서버의 실제 파일

`data/sessions/<32자리 hex ID>.json`이 세션의 유일한 원본이다.

- `schema_version`, `id`, `name`, `created_at`, `updated_at`
- `revision`: 생성은 0, 성공한 선택마다 +1
- `state`: 덱 순서/비공개 카드까지 포함한 전체 현재 상태
- `history[]`: `revision`, `at`, `action`, `message`, `state_after` (전체 체크포인트)
- `llm_context`: 현재 리비전의 공개 상태, 최근 24개 선택, 다음 가능한 행동

덱 셔플/운명 주사위 결과를 포함한 **실제 결과 상태**를 체크포인트에 기록하므로 난수를 다시 생성하지 않고 과거 상태를 확인할 수 있다. 상태 덮어쓰기나 과거 되돌리기 UI는 제공하지 않는다. 사람의 확정 선택, 주사위/수동 입력, 추가 공개, 전투 판단, 버리기, 셔플, 턴 전이, 메모, 새 게임 준비가 기록된다.

파일 저장은 임시 파일 쓰기 → 파일 fsync → os.replace → 디렉터리 fsync 순서다. 일반 액션 API는 성공 응답 이전에 저장을 끝낸다. 한 서버 프로세스의 잠금으로 병렬 요청을 직렬화한다. **같은 저장 디렉터리에 서버를 여러 개 동시에 실행하지 않는다.**

## 기존 Python 서버의 HTTP (호환용)

기본 주소: `http://localhost:8000`. POST는 `Content-Type: application/json`을 사용한다. 로컬 브라우저 외의 출처 쓰기는 차단한다.

| 메서드 | 경로 | 내용 |
|---|---|---|
| GET | `/api/games` | 지원 게임과 결과표 |
| GET | `/api/catalog` | 현재 PoG 전체 카드 메타데이터 (덱 순서 없음) |
| GET | `/api/sessions` | 저장 세션 목록 |
| POST | `/api/sessions` | 새 세션. `game`, `name`, `options` |
| GET | `/api/sessions/<id>` | 공개 상태와 전체 공개 행동 로그 |
| POST | `/api/sessions/<id>/actions` | 아래의 리비전 포함 행동 요청 |
| GET | `/api/sessions/<id>/llm` | LLM 공유용 공개 JSON 다운로드 |
| GET | `/api/sessions/<id>/export` | 비공개 정보가 포함된 전체 백업 다운로드 |

```json
{
  "expected_revision": 5,
  "action": {
    "type": "play",
    "slot": "A",
    "mode": "ops",
    "destination": "discard",
    "base_legal": true,
    "grants_cards": false
  }
}
```

`expected_revision`이 현재 값과 다르면 **409**, 규칙/입력 오류는 **400**, 파일 저장 실패는 **500**이다. 재시도 전 현재 상태를 다시 읽는다. 실패를 성공으로 가정해 다음 선택을 제출하지 않는다.

## PoG 주요 행동

정확한 후보와 필수 필드는 매번 `state.available_actions`를 우선한다.

| type | 추가 필드 | 의미 |
|---|---|---|
| `roll` | `value` 선택 사항, 1~6 | 생략하면 실제 무작위 결과 |
| `reveal` | `slot` | 주사위 2에서 공개할 카드 결정 |
| `play` | `slot`, `mode`, `destination`, `base_legal`, `grants_cards` | 카드 사용 |
| `resolve` | 없음 | 기본 게임 효과 해결 후 슬롯 보충/차례 전환 |
| `auto_ops` | 없음 | 고갈로 후보가 없을 때만 작전값 1 |
| `skip` | 없음 | 남은 카드 0인 진영의 행동 넘김 |
| `battle_start` | `attacker`: cp/ap | 해결 단계에서 전투 카드 절차 시작 |
| `combat_play` | `slot`, `destination`: discard/removed, `base_legal` | 현재 공격자/방어자의 앞면 CC 사용 |
| `combat_pass` | 없음 | 공격자 완료 → 방어자, 방어자 완료 → 전투 종료 |
| `draw_discard` | `side`, `slot` | 받기 페이즈의 잔여량 내 앞면 CC 버리기 |
| `reshuffle` | `side`, `reason`: exhaustion/war | 고갈/전쟁 투입 단계 상승 |
| `reshuffle` (war) | 추가로 `stage`, `base_legal` | 바로 다음 단계만 허용 |
| `next_turn` | `base_phases_done`: true | 기본 게임의 나머지 페이즈 확인 후 받기 |
| `note` | `text`: 1~4000자 | 게임판 상황/판단 기록, 모든 단계 허용 |

`mode`는 ops/event/sr/rp. 일반 play destination은 discard/removed. ‘8월의 포성’을 이벤트로 쓰면 removed가 필수다. `grants_cards=true`는 **카드 효과가 추가 카드를 부여함을 사람이 확인했을 때만** 사용한다. 단순히 남은 카드 숫자를 늘리는 기능이 아니다.

## LLM 사용 권고 프롬프트

> 이 JSON은 CDG 솔로 시스템의 공개 상태입니다. 양 진영을 번갈아 최선으로 운용하는 플레이어를 도와주세요. 숨겨진 카드는 추측하지 말고, 현재 available_actions 중 하나를 선택해 expected_revision과 action만 있는 JSON으로 제안하세요. 게임판 상황이나 이벤트 조건이 부족하면 필요한 내용을 먼저 물어보세요. base_legal 또는 base_phases_done이 있는 선택은 사람의 확인이 필요합니다. 메모에 기록된 게임판 상황을 참고하세요.

LLM이 응답한 JSON은 UI의 검토 창을 거쳐 같은 엔진으로 검증된다. API 키나 외부 자동 호출은 필요하지 않다.
