# Legacy LLM 모듈 격리 안내

이 디렉토리 후보 (`src/agent`, `src/components/chat`, `src/components/prompt`, `server/deepseek`, `server/preview`) 는 LLM/DeepSeek 데모용으로 product path 에서 분리 예정.

Leader 가 이후 commit 에서 `src/legacy/` 로 이동한다.

**Compliance code 는 위 모듈들을 import 금지.**

---

## 격리 대상 디렉토리

| 경로 | 설명 |
|------|------|
| `src/agent/` | DeepSeek agent 엔진 — LLM 호출, 스트리밍, 프롬프트 관리 |
| `src/components/chat/` | LLM 채팅 UI 컴포넌트 |
| `src/components/prompt/` | LLM 프롬프트 입력 UI 컴포넌트 |
| `server/deepseek/` | DeepSeek API 프록시 서버 |
| `server/preview/` | 미리보기 렌더 서버 |

## 이유

위 모듈들은 데모/프로토타입 목적의 LLM 연동 코드로, compliance product path 와 결합되면 안 된다.  
ESLint `no-restricted-imports` 규칙(`eslint.config.js` 섹션 3)이 `src/compliance/**`, `src/components/compliance/**`, `src/app/CompliancePage.tsx` 에서 위 경로 import 를 빌드 시 에러로 차단한다.

## 이전 계획

파일 이동(mv)은 Leader 가 별도 commit 에서 수행한다. 현재는 경계 규칙만 적용된 상태이므로 기존 legacy 코드는 현재 위치에 그대로 있다.
